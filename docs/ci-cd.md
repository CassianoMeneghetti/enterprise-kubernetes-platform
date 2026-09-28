# CI/CD

## Etapa 8A - CI Foundation

Esta etapa adiciona a primeira camada de integracao continua do projeto Enterprise Kubernetes Platform usando GitHub Actions.

O workflow atual executa em pushes e pull requests para a branch `main`.

## O que o CI valida

- Backend Node.js com `npm ci`.
- Scripts reais de teste e lint do backend, quando existirem no `package.json`.
- Sintaxe do backend com `node --check`.
- Inicializacao basica da API e chamada ao endpoint `/health`.
- Existencia e consistencia minima dos arquivos estaticos do frontend.
- Build local das imagens Docker do backend e frontend.
- Sintaxe YAML dos arquivos versionados.
- Manifests Kubernetes em `kubernetes/base` com validacao offline via schemas.
- Higiene de secrets para impedir versionamento de arquivos locais como `secret.local.yaml`, `*-secret.local.yaml` e `live-postgresql-config.yaml`.

## O que ainda nao existe nesta etapa

O CI ainda nao publica imagens Docker em registry.

Tambem nao existe automacao para atualizar tags de imagem nos manifests Kubernetes.

O processo de CD continua sendo realizado pelo Argo CD, que reconcilia o estado declarado no Git com o cluster Kubernetes.

## Etapa 8B - GHCR image publishing

A publicacao de imagens utiliza o GitHub Container Registry:

- `ghcr.io/cassianomeneghetti/enterprise-platform-api`
- `ghcr.io/cassianomeneghetti/enterprise-platform-frontend`

As imagens sao publicadas somente em eventos de `push` para a branch `main`.

Em `pull_request`, o CI continua executando validacoes e build local das imagens, mas nao faz login no GHCR e nao publica containers.

## Tags e rastreabilidade

Cada imagem publicada recebe uma tag baseada no commit SHA gerado pelo GitHub Actions. Essa tag e a referencia principal para rastrear exatamente qual commit produziu a imagem.

A tag mutavel `main` tambem e publicada como conveniencia para inspecao manual e testes, mas nao substitui a rastreabilidade por SHA.

## Autenticacao e permissoes

O workflow usa a autenticacao nativa do GitHub Actions com `GITHUB_TOKEN`.

Somente o job de publicacao possui permissao adicional:

```yaml
permissions:
  contents: read
  packages: write
```

Os demais jobs permanecem com permissao global somente de leitura do repositorio.

## Build cache

O job de publicacao usa Docker Buildx com cache do GitHub Actions:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

Isso reduz o tempo de builds futuros sem exigir registry externo de cache.

## Kubernetes

Nesta etapa, Kubernetes ainda nao consome as imagens do GHCR.

Os manifests em `kubernetes/base` continuam usando as imagens locais atuais. A troca dos manifests para GHCR sera realizada somente na Etapa 8C.

## Proximos passos

- Consumir as imagens do GHCR nos manifests Kubernetes.
- Automatizar atualizacao controlada de tags ou digests nos manifests.
- Evoluir o pipeline para validacoes adicionais de seguranca e qualidade.
