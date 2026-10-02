# Online eval Railway deployment

Deploy Phoenix from the `version-online-evals` branch of `Arize-ai/phoenix` in a
Railway project. Use the repository root as the build context and its root
`Dockerfile` for the Phoenix service. Name the service `phoenix` so that the
Prometheus private-network scrape target resolves. The root Dockerfile serves
the UI on port 6006 and Prometheus metrics on port 9090.

1. Add a PostgreSQL service and set `PHOENIX_SQL_DATABASE_URL` on Phoenix to its
   internal connection URL. Set `PHOENIX_ENABLE_PROMETHEUS=true`,
   `PHOENIX_ENABLE_AUTH=true`, `PHOENIX_USE_SECURE_COOKIES=true`, and provide
   a strong `PHOENIX_SECRET` and initial admin password. Expose only port 6006
   publicly; do not expose the metrics port.
2. Add a second service from this repository and set its Dockerfile path to
   `scripts/docker/railway/Dockerfile.prometheus`, with the repository root as
   build context. Deploy it from a branch containing this directory (it does
   not need to track the Phoenix branch). Keep this service private; do not
   generate a public domain for port 9090.
3. Attach a persistent Railway volume mounted at `/prometheus` to the
   Prometheus service so time-series data survives redeployments. Set
   `RAILWAY_RUN_UID=0` on the Prometheus service: Railway mounts volumes as
   root, while the Prometheus image runs as a non-root user by default. Deploy
   both services into the same Railway environment, with private networking
   enabled.
4. Verify Phoenix responds on `/healthz` and that Prometheus reports the
   `phoenix` scrape target as UP (`up{job="phoenix"} == 1`). The scrape target
   is `phoenix.railway.internal:9090/metrics` on the private network, not the
   public Phoenix URL. If the Phoenix service has a different name, update
   `prometheus.yml` to match before deploying Prometheus.

Railway project creation, secrets, and the actual deployment must be performed
in a Railway account with access to the intended project.
