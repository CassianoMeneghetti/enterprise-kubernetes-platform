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

## Proximos passos

- Configurar um registry, como GHCR ou Docker Hub.
- Publicar imagens versionadas em builds autenticados.
- Automatizar atualizacao controlada de tags ou digests nos manifests.
- Evoluir o pipeline para validacoes adicionais de seguranca e qualidade.
