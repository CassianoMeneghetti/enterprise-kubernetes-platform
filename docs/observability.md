# Enterprise Kubernetes Platform Observability

The observability layer runs declaratively through GitOps. Git remains the source of truth, and Argo CD reconciles the Kubernetes resources.

## Architecture

```text
Applications
    |
    +------ metrics ------> Prometheus
    |                         |
    |                         +----> Grafana
    |
    +------ logs ---------> Promtail
                              |
                              v
                             Loki
                              |
                              v
                           Grafana
```

Prometheus, Grafana, Loki, Promtail, exporters, dashboards, and alert rules are stored in `kubernetes/base/monitoring`.

## Components

| Component | Namespace | Purpose |
|---|---|---|
| Prometheus | `monitoring` | Metrics collection, PromQL, alert rule evaluation |
| kube-state-metrics | `monitoring` | Kubernetes object-state metrics |
| Grafana | `monitoring` | Dashboards for metrics and logs |
| Loki | `monitoring` | Centralized log storage |
| Promtail | `monitoring` | Kubernetes container log collection |
| postgres-exporter | `production` | PostgreSQL metrics |
| redis-exporter | `production` | Redis metrics |

## Metrics Flow

Prometheus scrapes:

- `enterprise-api` `/metrics`
- kube-state-metrics
- kubelet `/metrics`
- kubelet `/metrics/cadvisor`
- postgres-exporter
- redis-exporter
- Prometheus itself

The Enterprise API exposes:

- `enterprise_http_requests_total`
- `enterprise_http_request_duration_seconds`
- `enterprise_http_errors_total`
- `enterprise_http_requests_in_flight`
- `enterprise_postgresql_up`
- `enterprise_redis_up`
- `enterprise_app_uptime_seconds`
- Node.js process metrics from `prom-client`

The API avoids high-cardinality labels. HTTP metrics use only `method`, `route`, and `status_code`.

## Logs Flow

Promtail runs as a DaemonSet and reads Kubernetes container logs from `/var/log/pods`.

Logs are sent to Loki with bounded labels:

- `namespace`
- `pod`
- `container`
- `app`
- `node`

Request IDs are emitted inside structured API logs but are not used as Loki labels.

The API writes JSON logs with:

- `timestamp`
- `level`
- `message`
- `service`
- `instance`
- `requestId`
- `method`
- `route`
- `status`
- `durationMs`

Sensitive headers, cookies, tokens, passwords, and connection strings are not logged.

## Grafana

Grafana is available through the existing ingress:

```text
http://enterprise.local:8080/grafana
```

Datasources are provisioned declaratively:

- Prometheus
- Loki

Dashboards are provisioned declaratively:

- Enterprise Platform Overview
- Enterprise API
- PostgreSQL
- Redis
- Kubernetes
- Enterprise Logs

## Alerts

Prometheus loads alert rules from `prometheus-alert-rules`.

Current rules:

- `EnterpriseApiDown`
- `EnterpriseApiHighHttp5xxRate`
- `EnterpriseApiHighLatencyP95`
- `PodRestartingFrequently`
- `PostgreSQLDown`
- `RedisDown`
- `WorkloadHighCpu`
- `WorkloadHighMemory`
- `DeploymentWithoutAvailableReplicas`

Thresholds are tuned for this KIND lab to avoid excessive noise:

- HTTP 5xx rate above 5 percent for 5 minutes.
- API p95 latency above 500ms for 5 minutes.
- More than 3 restarts in 15 minutes.
- Pod CPU above 0.5 cores for 10 minutes.
- Pod memory above 500MiB for 10 minutes.

Alertmanager is not configured with external receivers in this step. No fictitious Slack, email, or webhook credentials are stored.

## Persistence

| Component | PVC | Retention |
|---|---|---|
| Grafana | `grafana-data` | Dashboard state and Grafana data |
| Prometheus | `prometheus-data` | 7 days of TSDB metrics |
| Loki | `loki-data` | 72 hours of logs |

The PostgreSQL PVC is not changed by the observability stack.

## Security and RBAC

Prometheus needs Kubernetes API access to discover services, pods, nodes, and kubelet/cAdvisor metrics. Its ClusterRole grants `get`, `list`, and `watch` only where needed.

kube-state-metrics needs read-only API access to Kubernetes object state.

Promtail needs read-only API access to discover pods/namespaces/nodes and a read-only hostPath mount for `/var/log/pods`.

Components that do not need Kubernetes API access use:

```yaml
automountServiceAccountToken: false
```

Container hardening is applied where compatible:

- `allowPrivilegeEscalation: false`
- `seccompProfile: RuntimeDefault`
- `capabilities.drop: ALL`
- `runAsNonRoot` when supported by the image
- `readOnlyRootFilesystem` where compatible

Promtail is the main exception because collecting node-local container logs requires a hostPath mount.

## Validation

Useful checks:

```powershell
kubectl get pods -n monitoring
kubectl get pods -n production
kubectl get pvc -n monitoring
kubectl get application enterprise-platform -n argocd
```

Prometheus readiness:

```powershell
kubectl exec -n monitoring deploy/prometheus -- wget -qO- http://localhost:9090/-/ready
```

Prometheus targets:

```powershell
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/targets"
```

Application metrics:

```powershell
kubectl exec -n production deploy/enterprise-api -- wget -qO- http://localhost:3000/metrics
```

PostgreSQL and Redis exporter checks:

```powershell
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/query?query=pg_up"
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/query?query=redis_up"
```

Loki readiness:

```powershell
kubectl exec -n monitoring deploy/loki -- wget -qO- http://localhost:3100/ready
```

Loki API log query:

```powershell
kubectl exec -n monitoring deploy/loki -- wget -qO- "http://localhost:3100/loki/api/v1/query_range?query={namespace=%22production%22,app=%22enterprise-api%22}&limit=5"
```

Grafana health:

```powershell
kubectl exec -n monitoring deploy/grafana -- wget -qO- http://localhost:3000/api/health
```

## Troubleshooting

If Prometheus targets are down:

- Check Service names and ports.
- Check exporter Pods in `production`.
- Check Prometheus logs.
- Confirm RBAC for Kubernetes discovery.

If Loki has no logs:

- Check Promtail Pods on every node.
- Check that `/var/log/pods` exists on KIND nodes.
- Check labels in LogQL with `{namespace="production"}`.

If Grafana dashboards are missing:

- Check the dashboard provider ConfigMap.
- Restart Grafana or wait for provisioning reload.
- Check Grafana logs for JSON parsing errors.

If Argo CD is OutOfSync:

- Inspect the Application diff.
- Confirm no manual cluster edits are fighting Git.
- Let Auto-Sync reconcile from `main`.
