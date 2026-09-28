const apiStatus = document.querySelector("#api-status");
const apiDetail = document.querySelector("#api-detail");
const activeInstance = document.querySelector("#active-instance");
const postgresStatus = document.querySelector("#postgres-status");
const postgresDetail = document.querySelector("#postgres-detail");
const redisStatus = document.querySelector("#redis-status");
const redisDetail = document.querySelector("#redis-detail");
const clusterName = document.querySelector("#cluster-name");
const apiUptime = document.querySelector("#api-uptime");
const apiTimestamp = document.querySelector("#api-timestamp");
const databaseCheck = document.querySelector("#database-check");
const cacheCheck = document.querySelector("#cache-check");
const lastRefresh = document.querySelector("#last-refresh");
const syncIndicator = document.querySelector("#sync-indicator");
const refreshButton = document.querySelector("#refresh-button");

function normalizeState(value) {
  const state = String(value || "pending").toLowerCase();

  if (state === "online" || state === "healthy") {
    return "online";
  }

  if (state === "offline" || state === "degraded") {
    return state;
  }

  return "pending";
}

function setPill(element, state, label) {
  element.textContent = label;
  element.className = `status-pill ${state}`;
}

function setApiStatus(state, label) {
  setPill(apiStatus, state, label);
  syncIndicator.className = `sync-dot ${state === "online" ? "online" : state === "offline" ? "offline" : "pending"}`;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "-";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
  });
}

async function refreshStatus() {
  refreshButton.disabled = true;
  setApiStatus("pending", "CHECKING");
  setPill(postgresStatus, "pending", "CHECKING");
  setPill(redisStatus, "pending", "CHECKING");

  try {
    const response = await fetch("/api/status", {
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Unexpected API response: ${response.status}`);
    }

    const status = await response.json();
    const isOnline = String(status.api).toLowerCase() === "online";
    const postgresql = status.dependencies?.postgresql || {};
    const redis = status.dependencies?.redis || {};
    const postgresqlState = normalizeState(postgresql.status);
    const redisState = normalizeState(redis.status);

    setApiStatus(isOnline ? "online" : "offline", isOnline ? "ONLINE" : "OFFLINE");
    setPill(postgresStatus, postgresqlState, postgresqlState.toUpperCase());
    setPill(redisStatus, redisState, redisState.toUpperCase());
    apiDetail.textContent = isOnline ? "Backend responded through ingress" : "Backend response did not report online";
    postgresDetail.textContent = postgresql.database
      ? `${postgresql.database} as ${postgresql.user || "application user"}`
      : "Database check unavailable";
    redisDetail.textContent = redis.cached ? "Cache read/write succeeded" : "Cache check unavailable";
    activeInstance.textContent = status.instance || "-";
    clusterName.textContent = status.cluster || "-";
    apiUptime.textContent = formatUptime(Number(status.uptime));
    apiTimestamp.textContent = formatTimestamp(status.timestamp);
    databaseCheck.textContent = postgresql.checkId ? `#${postgresql.checkId} in ${postgresql.latencyMs}ms` : "-";
    cacheCheck.textContent = typeof redis.latencyMs === "number" ? `${redis.latencyMs}ms via ${redis.key || "redis"}` : "-";
    lastRefresh.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    setApiStatus("offline", "OFFLINE");
    setPill(postgresStatus, "offline", "OFFLINE");
    setPill(redisStatus, "offline", "OFFLINE");
    apiDetail.textContent = "Unable to reach /api/status";
    postgresDetail.textContent = "Database check unavailable";
    redisDetail.textContent = "Cache check unavailable";
    activeInstance.textContent = "-";
    clusterName.textContent = "-";
    apiUptime.textContent = "-";
    apiTimestamp.textContent = "-";
    databaseCheck.textContent = "-";
    cacheCheck.textContent = "-";
    lastRefresh.textContent = "API unavailable";
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", refreshStatus);
refreshStatus();
setInterval(refreshStatus, 30000);
