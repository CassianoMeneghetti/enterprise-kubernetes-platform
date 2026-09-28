# Enterprise Kubernetes Platform Data Layer

This lab environment adds two internal data services to the `production` namespace:

- PostgreSQL: persistent relational data store, exposed only through the internal `postgresql` Service.
- Redis: internal cache service, exposed only through the internal `redis` Service.

PostgreSQL runs as a single-replica StatefulSet using the `standard` StorageClass provided by KIND local-path storage. The initial PVC request is `2Gi`.

The committed PostgreSQL Secret contains a development-only lab credential so the local cluster can be recreated easily. Do not reuse this Secret value in a real production environment. Replace it with an externally managed secret before using this platform outside a local lab.
