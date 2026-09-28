# Enterprise Kubernetes Platform Observability

The observability layer runs in the `monitoring` namespace and adds Prometheus, kube-state-metrics, and Grafana on top of the existing application stack.

## Architecture

- Prometheus scrapes Kubernetes kubelet/cAdvisor metrics, kube-state-metrics, and the `enterprise-api` Service endpoints.
- kube-state-metrics exposes Kubernetes object state such as Deployments, Pods, StatefulSets, PVCs, and namespaces.
- Grafana is provisioned with Prometheus as the default data source and the `Enterprise Platform Overview` dashboard.
- Grafana is exposed through the existing Ingress host at `http://enterprise.local:8080/grafana`.

PostgreSQL and Redis are not exposed through Ingress. Their health is exported by `enterprise-api` as Prometheus metrics.

## Enterprise API Metrics

The backend exposes:

- `GET /metrics`
- `enterprise_http_requests_total`
- `enterprise_http_request_duration_seconds`
- `enterprise_http_errors_total`
- `enterprise_postgresql_up`
- `enterprise_redis_up`
- `enterprise_app_uptime_seconds`

Validate directly from inside the cluster:

```powershell
kubectl exec -n production deploy/enterprise-api -- wget -qO- http://localhost:3000/metrics
```

## Prometheus

Prometheus uses Kubernetes service discovery instead of fixed Pod IPs.

Useful checks:

```powershell
kubectl get pods -n monitoring
kubectl get svc -n monitoring
kubectl exec -n monitoring deploy/prometheus -- wget -qO- http://localhost:9090/-/ready
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/targets"
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/query?query=enterprise_postgresql_up"
kubectl exec -n monitoring deploy/prometheus -- wget -qO- "http://localhost:9090/api/v1/query?query=enterprise_redis_up"
```

## Grafana

Grafana is available at:

```text
http://enterprise.local:8080/grafana
```

The admin credentials are stored in `grafana-admin-secret` for local lab use only. Replace them before any real production use.

Recover the lab username and password:

```powershell
kubectl get secret grafana-admin-secret -n monitoring -o jsonpath="{.data.GF_SECURITY_ADMIN_USER}" | %{ [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
kubectl get secret grafana-admin-secret -n monitoring -o jsonpath="{.data.GF_SECURITY_ADMIN_PASSWORD}" | %{ [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

Validate provisioning:

```powershell
kubectl get pvc -n monitoring
kubectl logs -n monitoring deploy/grafana
```

The dashboard is provisioned automatically from the `grafana-dashboard-enterprise-platform` ConfigMap.
