const express = require("express");
const os = require("os");
const crypto = require("crypto");
const promClient = require("prom-client");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;

const databaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "enterprise",
    user: process.env.DB_USER || "enterprise_app",
    password: process.env.DB_PASSWORD,
    max: 4,
    connectionTimeoutMillis: 1500,
    idleTimeoutMillis: 30000
};

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

const pool = new Pool(databaseConfig);
const redis = createClient({
    url: redisUrl,
    socket: {
        connectTimeout: 1500,
        reconnectStrategy: false
    }
});

function writeLog(level, message, fields = {}) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        service: "enterprise-platform-api",
        instance: os.hostname(),
        ...fields
    }));
}

redis.on("error", (error) => {
    writeLog("error", "redis_client_error", {
        error: error.message
    });
});

const register = new promClient.Registry();

promClient.collectDefaultMetrics({
    register,
    prefix: "enterprise_"
});

const httpRequestsTotal = new promClient.Counter({
    name: "enterprise_http_requests_total",
    help: "Total HTTP requests processed by the Enterprise API.",
    labelNames: ["method", "route", "status_code"]
});

const httpRequestDuration = new promClient.Histogram({
    name: "enterprise_http_request_duration_seconds",
    help: "HTTP request duration in seconds for the Enterprise API.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const httpErrorsTotal = new promClient.Counter({
    name: "enterprise_http_errors_total",
    help: "Total HTTP 5xx errors returned by the Enterprise API.",
    labelNames: ["method", "route", "status_code"]
});

const httpRequestsInFlight = new promClient.Gauge({
    name: "enterprise_http_requests_in_flight",
    help: "HTTP requests currently being processed by the Enterprise API."
});
httpRequestsInFlight.set(0);

const postgresqlUp = new promClient.Gauge({
    name: "enterprise_postgresql_up",
    help: "PostgreSQL dependency health. 1 means online, 0 means offline."
});

const redisUp = new promClient.Gauge({
    name: "enterprise_redis_up",
    help: "Redis dependency health. 1 means online, 0 means offline."
});

const appUptime = new promClient.Gauge({
    name: "enterprise_app_uptime_seconds",
    help: "Enterprise API process uptime in seconds.",
    collect() {
        this.set(process.uptime());
    }
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(httpErrorsTotal);
register.registerMetric(httpRequestsInFlight);
register.registerMetric(postgresqlUp);
register.registerMetric(redisUp);
register.registerMetric(appUptime);

app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    httpRequestsInFlight.inc();

    res.on("finish", () => {
        const duration = Number(process.hrtime.bigint() - started) / 1e9;
        const route = req.route?.path || req.path || "unknown";
        const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode)
        };

        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, duration);

        if (res.statusCode >= 500) {
            httpErrorsTotal.inc(labels);
        }

        httpRequestsInFlight.dec();
        writeLog(res.statusCode >= 500 ? "error" : "info", "http_request_completed", {
            requestId,
            method: req.method,
            route,
            status: res.statusCode,
            durationMs: Math.round(duration * 1000)
        });
    });

    next();
});

async function ensureDatabaseSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS platform_status_checks (
            id BIGSERIAL PRIMARY KEY,
            instance TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function ensureRedisConnection() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

async function refreshDependencyMetrics() {
    const checks = await Promise.allSettled([
        pool.query("SELECT 1"),
        (async () => {
            await ensureRedisConnection();
            return redis.ping();
        })()
    ]);

    postgresqlUp.set(checks[0].status === "fulfilled" ? 1 : 0);
    redisUp.set(checks[1].status === "fulfilled" && checks[1].value === "PONG" ? 1 : 0);
}

async function checkPostgresql(instance) {
    const started = Date.now();

    try {
        await ensureDatabaseSchema();
        const result = await pool.query(
            `
                INSERT INTO platform_status_checks (instance)
                VALUES ($1)
                RETURNING id, created_at
            `,
            [instance]
        );

        const metadata = await pool.query(`
            SELECT
                current_database() AS database,
                current_user AS user_name,
                version() AS version
        `);

        return {
            status: "online",
            database: metadata.rows[0].database,
            user: metadata.rows[0].user_name,
            checkId: Number(result.rows[0].id),
            latencyMs: Date.now() - started,
            timestamp: result.rows[0].created_at
        };
    } catch (error) {
        postgresqlUp.set(0);

        return {
            status: "offline",
            latencyMs: Date.now() - started,
            error: error.message
        };
    }
}

async function checkRedis(instance) {
    const started = Date.now();

    try {
        await ensureRedisConnection();

        const key = "enterprise-platform:last-status-check";
        const payload = {
            instance,
            timestamp: new Date().toISOString()
        };

        await redis.set(key, JSON.stringify(payload), { EX: 60 });
        const cachedPayload = await redis.get(key);
        const ping = await redis.ping();

        return {
            status: ping === "PONG" && cachedPayload ? "online" : "degraded",
            key,
            latencyMs: Date.now() - started,
            cached: Boolean(cachedPayload)
        };
    } catch (error) {
        redisUp.set(0);

        if (redis.isOpen) {
            await redis.disconnect().catch(() => {});
        }

        return {
            status: "offline",
            latencyMs: Date.now() - started,
            error: error.message
        };
    }
}

app.get("/", (req, res) => {
    res.json({
        service: "enterprise-platform-api",
        version: "1.2.0",
        environment: process.env.NODE_ENV || "development",
        instance: os.hostname(),
        status: "online",
        timestamp: new Date().toISOString()
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        instance: os.hostname()
    });
});

app.get("/metrics", async (req, res) => {
    await refreshDependencyMetrics();

    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
});

app.get("/api/status", async (req, res) => {
    const instance = os.hostname();
    const [postgresql, redisStatus] = await Promise.all([
        checkPostgresql(instance),
        checkRedis(instance)
    ]);

    const dependenciesHealthy = postgresql.status === "online" && redisStatus.status === "online";

    postgresqlUp.set(postgresql.status === "online" ? 1 : 0);
    redisUp.set(redisStatus.status === "online" ? 1 : 0);

    res.json({
        cluster: "Enterprise Kubernetes Platform",
        api: "online",
        instance,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        dependencies: {
            postgresql,
            redis: redisStatus
        },
        ready: dependenciesHealthy
    });
});

async function shutdown() {
    await Promise.allSettled([
        pool.end(),
        redis.isOpen ? redis.quit() : Promise.resolve()
    ]);
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

app.listen(PORT, "0.0.0.0", () => {
    writeLog("info", "api_started", {
        port: PORT
    });
});
