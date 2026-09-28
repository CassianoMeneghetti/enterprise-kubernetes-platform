# Enterprise Kubernetes Platform

Plataforma Kubernetes desenvolvida para demonstrar, na prática, conceitos de **Platform Engineering, DevOps, SRE, alta disponibilidade, observabilidade, persistência, resiliência e GitOps** em um ambiente Kubernetes multi-node local.

O projeto simula uma plataforma moderna de execução de aplicações utilizando múltiplos nós Kubernetes, balanceamento entre réplicas, roteamento com Ingress, banco de dados persistente, cache distribuído e uma camada completa de observabilidade.

> O ambiente atualmente executa localmente utilizando KIND e Docker Desktop e foi projetado para estudos de arquitetura, laboratórios Kubernetes, testes de falha, observabilidade e demonstrações técnicas.

---

# Arquitetura

```text
                              CLIENTE
                                 |
                                 |
                    http://enterprise.local:8080
                                 |
                                 v
                     +-----------------------+
                     |     NGINX INGRESS     |
                     |     Control Plane     |
                     +-----------+-----------+
                                 |
                   +-------------+-------------+
                   |                           |
                   | /                         | /api
                   v                           v
          +------------------+        +------------------+
          |     FRONTEND     |        |   BACKEND API    |
          |     Service      |        |     Service      |
          +--------+---------+        +---------+--------+
                   |                            |
            +------+------+              +------+------+
            |      |      |              |      |      |
            v      v      v              v      v      v
           FE1    FE2    FE3           API1   API2   API3
                                                    |
                                          +---------+---------+
                                          |                   |
                                          v                   v
                                  +---------------+     +-------------+
                                  |  PostgreSQL   |     |    Redis    |
                                  |  StatefulSet  |     |    Cache    |
                                  +-------+-------+     +-------------+
                                          |
                                          v
                                  +---------------+
                                  |      PVC      |
                                  | Armazenamento |
                                  |  Persistente  |
                                  +---------------+


                       CAMADA DE OBSERVABILIDADE

                 +-------------------------------+
                 |          Prometheus           |
                 +---------------+---------------+
                                 |
             +-------------------+-------------------+
             |                   |                   |
             v                   v                   v
       Backend /metrics   kube-state-metrics   kubelet/cAdvisor
             |
             v
       +-------------+
       |   Grafana   |
       | Dashboards  |
       +-------------+
```

---

# Cluster Kubernetes

O ambiente utiliza um cluster Kubernetes multi-node criado com KIND.

| Node | Função |
|---|---|
| `enterprise-k8s-control-plane` | Control Plane + NGINX Ingress |
| `enterprise-k8s-worker` | Worker Node |
| `enterprise-k8s-worker2` | Worker Node |
| `enterprise-k8s-worker3` | Worker Node |

As réplicas das aplicações são distribuídas entre os Worker Nodes sempre que possível.

O NGINX Ingress Controller é executado no Control Plane porque as portas do container desse nó são publicadas pelo KIND para o host Windows.

```text
Windows :8080
     |
     v
Control Plane :80
     |
     v
NGINX Ingress
```

---

# Tecnologias utilizadas

## Plataforma

- Kubernetes
- KIND
- Docker
- Docker Desktop
- NGINX Ingress Controller

## Aplicação

- Node.js
- Express
- HTML
- CSS
- JavaScript
- NGINX

## Camada de dados

- PostgreSQL
- Redis
- PersistentVolumeClaim
- Kubernetes StorageClass

## Observabilidade

- Prometheus
- Grafana
- kube-state-metrics
- kubelet
- cAdvisor
- Métricas customizadas da aplicação

## GitOps

Próxima etapa:

- Argo CD
- Sincronização automática
- Detecção de drift
- Self-Healing

---

# Arquitetura da aplicação

A plataforma possui dois workloads principais.

## Frontend

O frontend disponibiliza um dashboard operacional da Enterprise Platform.

A aplicação é servida por NGINX e executada através de múltiplas réplicas dentro do Kubernetes.

```text
Cliente
   |
   v
Ingress
   |
   v
enterprise-frontend Service
   |
   +--> Frontend Pod
   +--> Frontend Pod
   +--> Frontend Pod
```

O acesso externo ocorre através de:

```text
http://enterprise.local:8080/
```

---

## Backend

O backend foi desenvolvido utilizando Node.js e Express.

Ele fornece:

- Status da plataforma
- Health checks
- Persistência de eventos
- Integração com PostgreSQL
- Cache Redis
- Métricas Prometheus
- Identificação da instância responsável pela requisição

Arquitetura:

```text
Ingress
   |
   v
enterprise-api Service
   |
   +--> API Pod
   +--> API Pod
   +--> API Pod
           |
           +--> PostgreSQL
           |
           +--> Redis
```

Cada resposta da API pode identificar o hostname do Pod responsável pela requisição.

Isso permite visualizar o balanceamento entre diferentes réplicas da aplicação.

---

# PostgreSQL

O PostgreSQL executa como um Kubernetes `StatefulSet`.

Ele é utilizado para armazenar dados persistentes da aplicação.

```text
Backend
   |
   v
PostgreSQL Service
   |
   v
PostgreSQL StatefulSet
   |
   v
PersistentVolumeClaim
```

O banco possui armazenamento persistente através de PVC.

Isso significa que o ciclo de vida dos dados não depende diretamente do ciclo de vida do Pod.

Caso o Pod PostgreSQL seja destruído e recriado, os dados permanecem armazenados no volume persistente.

---

## Alta disponibilidade do banco

Atualmente o PostgreSQL possui apenas uma instância.

Essa decisão é proposital.

Aumentar simplesmente:

```yaml
replicas: 1
```

para:

```yaml
replicas: 3
```

não criaria uma arquitetura PostgreSQL de alta disponibilidade válida.

Uma implementação real de produção normalmente utilizaria:

- Replicação PostgreSQL
- PostgreSQL Operator
- Patroni
- CloudNativePG
- Serviço de banco gerenciado em Cloud

---

# Redis

Redis é utilizado como camada de cache da aplicação.

```text
Backend
   |
   v
Redis Service
   |
   v
Redis Pod
```

O backend utiliza Redis para armazenar temporariamente determinadas respostas da aplicação.

O cache possui TTL e é invalidado quando necessário.

Redis foi projetado nesta arquitetura como uma dependência não crítica.

Caso Redis fique temporariamente indisponível, a API deve continuar funcionando utilizando PostgreSQL diretamente.

Isso permite demonstrar o conceito de **graceful degradation**.

---

# Observabilidade

Existe um namespace dedicado:

```text
monitoring
```

Nele executam:

```text
monitoring
|
+-- Prometheus
|
+-- Grafana
|
+-- kube-state-metrics
```

O Prometheus coleta métricas de diferentes componentes da plataforma.

---

# Fontes de métricas

Atualmente são coletadas métricas de:

- Backend API
- Kubernetes
- Pods
- Deployments
- Nodes
- Containers
- kube-state-metrics
- kubelet
- cAdvisor
- PostgreSQL
- Redis

---

# Métricas da aplicação

O backend disponibiliza um endpoint compatível com Prometheus:

```text
/metrics
```

Entre as métricas disponíveis estão:

```text
enterprise_http_requests_total
enterprise_http_request_duration_seconds
enterprise_http_errors_total
enterprise_postgresql_up
enterprise_redis_up
enterprise_app_uptime_seconds
```

Com isso é possível acompanhar:

- Quantidade de requisições
- Latência
- Erros HTTP
- Uptime
- Disponibilidade do PostgreSQL
- Disponibilidade do Redis

---

# Grafana

Grafana utiliza o Prometheus como Data Source.

Foi criado o dashboard:

```text
Enterprise Platform Overview
```

Acesso local:

```text
http://enterprise.local:8080/grafana
```

Os dados do Grafana possuem armazenamento persistente através de PVC.

---

# Endpoints

| Componente | Endpoint |
|---|---|
| Enterprise Platform | `http://enterprise.local:8080/` |
| API Status | `http://enterprise.local:8080/api/status` |
| Grafana | `http://enterprise.local:8080/grafana` |
| Métricas | `/metrics` através do Service interno da API |

---

# Estratégia de Health Check

A arquitetura diferencia:

```text
Saúde do processo
```

de:

```text
Saúde das dependências
```

## Liveness

O endpoint:

```text
/health
```

valida se o processo da API está funcionando.

Ele pode ser utilizado pela `livenessProbe` do Kubernetes.

Uma falha no PostgreSQL ou Redis não deve necessariamente provocar reinicializações infinitas dos Pods da API.

---

## Dependências

O endpoint:

```text
/api/status
```

realiza verificações das dependências.

Entre elas:

```text
PostgreSQL
Redis
```

Isso permite identificar falhas externas sem considerar automaticamente o processo da API como morto.

---

# Persistência

Atualmente existem volumes persistentes para componentes que precisam manter estado.

## PostgreSQL

Responsável pelos dados persistentes da aplicação.

## Grafana

Responsável pelos dados persistentes da plataforma de visualização.

Os PVCs podem ser consultados através de:

```bash
kubectl get pvc -A
```

---

# Testes de resiliência

Um dos principais objetivos do projeto é demonstrar o comportamento do Kubernetes diante de falhas reais.

## Falha de Worker Node

Um Worker Node foi manualmente interrompido:

```bash
docker stop enterprise-k8s-worker3
```

O Kubernetes detectou a indisponibilidade:

```text
enterprise-k8s-worker3
NotReady
```

Os Pods inicialmente permaneceram associados ao Node devido à toleration padrão configurada pelo Kubernetes.

Durante o teste foi possível observar:

```text
NodeNotReady
DisruptionTarget
```

Após o período de tolerância, workloads podem ser removidos do Node indisponível e reagendados em Nodes saudáveis.

O Worker foi posteriormente recuperado:

```bash
docker start enterprise-k8s-worker3
```

Fluxo demonstrado:

```text
Falha do Node
      |
      v
NodeNotReady
      |
      v
Toleration Window
      |
      v
Pod Eviction
      |
      v
Rescheduling
      |
      v
Service Recovery
```

---

# Teste de persistência PostgreSQL

A persistência foi validada através de um teste real.

Fluxo:

```text
Criar evento
      |
      v
Salvar no PostgreSQL
      |
      v
Excluir Pod PostgreSQL
      |
      v
StatefulSet recria o Pod
      |
      v
PVC é montado novamente
      |
      v
PostgreSQL inicia
      |
      v
Evento continua armazenado
```

Esse teste demonstra a separação entre:

```text
Ciclo de vida do Pod
```

e:

```text
Ciclo de vida dos dados
```

---

# Networking Kubernetes

A comunicação interna utiliza Kubernetes Services e DNS.

Não utilizamos IPs fixos de Pods.

Exemplos:

```text
enterprise-api.production.svc.cluster.local

postgresql.production.svc.cluster.local

redis.production.svc.cluster.local
```

PostgreSQL e Redis são serviços internos.

Eles não possuem exposição através de:

- Ingress
- NodePort
- LoadBalancer

Somente componentes HTTP necessários são publicados externamente.

---

# Segurança

Algumas práticas implementadas:

- PostgreSQL não possui exposição pública.
- Redis não possui exposição pública.
- Credenciais são fornecidas através de Kubernetes Secrets.
- Credenciais reais não são armazenadas no Git.
- Secrets locais são ignorados pelo `.gitignore`.
- Templates de Secrets utilizam placeholders.
- Credenciais não são enviadas ao frontend.
- Serviços internos utilizam ClusterIP.

Arquivos contendo credenciais locais utilizam:

```text
secret.local.yaml
```

Esses arquivos são ignorados pelo Git.

Templates públicos utilizam:

```text
secret.example.yaml
```

com valores como:

```text
CHANGE_ME
```

> Kubernetes Secrets em Base64 não devem ser considerados armazenamento criptografado de credenciais.

Uma etapa futura poderá implementar gerenciamento externo de Secrets.

---

# Estrutura do repositório

```text
enterprise-kubernetes-platform/
|
+-- applications/
|   |
|   +-- backend/
|   |
|   +-- frontend/
|
+-- infrastructure/
|
+-- kubernetes/
|   |
|   +-- base/
|       |
|       +-- backend/
|       +-- frontend/
|       +-- ingress/
|       +-- monitoring/
|       +-- namespaces/
|       +-- postgresql/
|       +-- redis/
|
+-- docs/
|
+-- scripts/
|
+-- README.md
```

---

# Ambiente local

Atualmente a plataforma executa sobre:

```text
Windows 10
     |
     v
Docker Desktop
     |
     v
KIND
     |
     v
Kubernetes Multi-Node
```

O KIND permite simular uma arquitetura Kubernetes com múltiplos Nodes sem a necessidade de criar diversas máquinas virtuais.

Isso torna o ambiente adequado para:

- Laboratórios Kubernetes
- Testes de infraestrutura
- Simulação de falhas
- Estudos de SRE
- Observabilidade
- GitOps
- Platform Engineering

---

# GitHub

O código-fonte da plataforma está versionado no GitHub.

Repositório:

`CassianoMeneghetti/enterprise-kubernetes-platform`

A branch principal é:

```text
main
```

Fluxo atual:

```text
Desenvolvimento
      |
      v
git commit
      |
      v
git push
      |
      v
GitHub
```

---

# GitOps

A próxima evolução da plataforma será implementar Argo CD.

A arquitetura passará a utilizar:

```text
Desenvolvedor
      |
      v
GitHub
      |
      v
Argo CD
      |
      v
Kubernetes
```

O Git passará a representar o **Desired State** da plataforma.

---

# Drift Detection

Um dos testes planejados será modificar manualmente o estado do cluster.

Exemplo:

Git declara:

```yaml
replicas: 3
```

Alguém executa manualmente:

```bash
kubectl scale deployment enterprise-frontend \
  -n production \
  --replicas=1
```

O estado passa a ser:

```text
Git
replicas = 3

Cluster
replicas = 1
```

O Argo CD deverá detectar:

```text
OutOfSync
```

e reconciliar automaticamente:

```text
Cluster
replicas = 3
```

Isso demonstrará:

- Git como Source of Truth
- Desired State
- Continuous Reconciliation
- Drift Detection
- Self-Healing

---

# Roadmap

## Concluído

- [x] Cluster Kubernetes multi-node
- [x] Control Plane
- [x] 3 Worker Nodes
- [x] Namespaces
- [x] Backend containerizado
- [x] Frontend containerizado
- [x] Múltiplas réplicas
- [x] Kubernetes Services
- [x] NGINX Ingress Controller
- [x] PostgreSQL
- [x] StatefulSet
- [x] PersistentVolumeClaim
- [x] Teste de persistência
- [x] Redis
- [x] Cache
- [x] Prometheus
- [x] Grafana
- [x] kube-state-metrics
- [x] Métricas da aplicação
- [x] Métricas de infraestrutura
- [x] Teste de falha de Worker Node
- [x] Git
- [x] GitHub

## Próximas etapas

- [ ] Argo CD
- [ ] GitOps
- [ ] Auto Sync
- [ ] Drift Detection
- [ ] Self-Healing
- [ ] Horizontal Pod Autoscaler
- [ ] Load Testing
- [ ] Network Policies
- [ ] RBAC Hardening
- [ ] Loki
- [ ] Centralização de logs
- [ ] GitHub Actions
- [ ] CI/CD
- [ ] Container Registry
- [ ] Build automatizado de imagens
- [ ] Testes adicionais de Disaster Recovery
- [ ] Overlays para diferentes ambientes

---

# Objetivo do projeto

Este projeto foi desenvolvido para explorar de forma prática os principais componentes envolvidos na construção e operação de uma plataforma Kubernetes moderna.

Mais do que simplesmente executar containers, o objetivo é estudar o comportamento completo da infraestrutura:

```text
Deploy
  |
  v
Networking
  |
  v
Persistência
  |
  v
Observabilidade
  |
  v
Falhas
  |
  v
Recuperação
  |
  v
Automação
  |
  v
GitOps
```

O ambiente continuará evoluindo com novas camadas de automação, segurança, escalabilidade e recuperação de falhas.

---

# Aviso

Este projeto é um ambiente de laboratório e portfólio.

A arquitetura utiliza conceitos inspirados em ambientes corporativos e de produção, porém um ambiente Kubernetes real exigiria decisões adicionais relacionadas a:

- Segurança
- Backup
- Disaster Recovery
- Alta disponibilidade do Control Plane
- Alta disponibilidade do banco de dados
- Gerenciamento externo de Secrets
- TLS
- DNS
- Storage distribuído
- Registry privado
- Políticas de segurança
- Monitoramento externo
- Estratégias de atualização
- Gestão de custos