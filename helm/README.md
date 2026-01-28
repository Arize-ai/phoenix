# phoenix-helm

![Version: 4.0.34](https://img.shields.io/badge/Version-4.0.34-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 12.33.0](https://img.shields.io/badge/AppVersion-12.33.0-informational?style=flat-square)

<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=helm/README.md" />

Phoenix is an open-source AI observability platform designed for experimentation, evaluation, and troubleshooting. For instructions on how to deploy this Helm chart, see the [self-hosting docs](https://arize.com/docs/phoenix/self-hosting).
  - [**_Tracing_**](https://arize.com/docs/phoenix/tracing/llm-traces) - Trace your LLM application's runtime using OpenTelemetry-based instrumentation.
  - [**_Evaluation_**](https://arize.com/docs/phoenix/evaluation/llm-evals) - Leverage LLMs to benchmark your application's performance using response and retrieval evals.
  - [**_Datasets_**](https://arize.com/docs/phoenix/datasets-and-experiments/overview-datasets) - Create versioned datasets of examples for experimentation, evaluation, and fine-tuning.
  - [**_Experiments_**](https://arize.com/docs/phoenix/datasets-and-experiments/overview-datasets#experiments) - Track and evaluate changes to prompts, LLMs, and retrieval.
  - [**_Playground_**](https://arize.com/docs/phoenix/prompt-engineering/overview-prompts)- Optimize prompts, compare models, adjust parameters, and replay traced LLM calls.
  - [**_Prompt Management_**](https://arize.com/docs/phoenix/prompt-engineering/overview-prompts/prompt-management)- Manage and test prompt changes systematically using version control, tagging, and experimentation.

**Homepage:** <https://phoenix.arize.com/>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| arize | <phoenix-devs@arize.com> | <https://phoenix.arize.com/> |

## Source Code

* <https://github.com/Arize-ai/phoenix>

## Requirements

| Repository | Name | Version |
|------------|------|---------|
| https://groundhog2k.github.io/helm-charts/ | postgresql(postgres) | 1.5.8 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| additionalEnv | list | `[]` | Additional environment variables to add to the deployments pod spec For supported environment variables see https://arize.com/docs/phoenix/self-hosting/configuration#environment-variables Should only be used for capabilities not exposed via the helm chart directly |
| auth.accessTokenExpiryMinutes | int | `60` | Duration in minutes before access tokens expire and require renewal (PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES) |
| auth.admins | string | `""` | Semicolon-separated list of username and email pairs to create as admin users on startup (PHOENIX_ADMINS) Format: "username=email;username2=email2" (e.g., "John Doe=john@example.com;Jane Doe=jane@example.com") These users will be created with random passwords that must be reset on first login |
| auth.allowedOrigins | list | `[]` | List of allowed CORS origins for cross-origin requests to the Phoenix API (PHOENIX_ALLOWED_ORIGINS) |
| auth.cookiesPath | string | `"/"` | Cookie path for authentication cookies (PHOENIX_COOKIES_PATH) Set this when Phoenix is hosted under a sub-path |
| auth.createSecret | bool | `true` | Create Secret Boolean - Should the secret be created. If False and auth is enabled, this must preexist |
| auth.csrfTrustedOrigins | list | `[]` | List of trusted origins for CSRF protection to prevent cross-site request forgery attacks (PHOENIX_CSRF_TRUSTED_ORIGINS) |
| auth.defaultAdminPassword | string | `"admin"` | Default password for the admin user on initial setup (PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD) |
| auth.disableBasicAuth | bool | `false` | Disable password-based authentication (PHOENIX_DISABLE_BASIC_AUTH) When true, users can only authenticate via OAuth2/OIDC. Useful for SSO-only deployments. |
| auth.enableAuth | bool | `true` | Enable authentication and authorization for Phoenix (PHOENIX_ENABLE_AUTH) |
| auth.ldap.allowSignUp | bool | `true` | Allow automatic user creation on first LDAP login. Set to false to require pre-provisioned users. |
| auth.ldap.attrDisplayName | string | `"displayName"` | LDAP attribute containing user's display name. |
| auth.ldap.attrEmail | string | `"mail"` | LDAP attribute containing user's email address. Valid values:   - "mail" (or other attribute name): Use that LDAP attribute for email   - "null": No-email mode for directories without email When using no-email mode ("null"):   - attrUniqueId is REQUIRED (users identified by unique ID instead of email)   - allowSignUp must be true (users auto-provisioned on first login)   - auth.admins cannot be used (use groupRoleMappings for admin assignment) |
| auth.ldap.attrMemberOf | string | `"memberOf"` | LDAP attribute containing group memberships (default: "memberOf"). Used when groupSearchFilter is not set (Active Directory mode). Typical values: "memberOf" (AD, OpenLDAP with memberOf overlay) |
| auth.ldap.attrUniqueId | string | `""` | LDAP attribute containing an immutable unique identifier. REQUIRED when attrEmail is "null" (no-email mode). Also recommended if you expect user emails to change frequently. Active Directory: "objectGUID", OpenLDAP: "entryUUID", 389 DS: "nsUniqueId" |
| auth.ldap.bindDn | string | `""` | Service account DN for binding to LDAP server. Example: "CN=svc-phoenix,OU=Service Accounts,DC=corp,DC=com" |
| auth.ldap.bindPassword | string | `""` | Service account password for binding to LDAP server. Can be set directly here or via auth.secret with key PHOENIX_LDAP_BIND_PASSWORD |
| auth.ldap.enabled | bool | `false` | Enable LDAP authentication |
| auth.ldap.groupRoleMappings | string | `"[]"` | JSON array mapping LDAP groups to Phoenix roles. Format: [{"group_dn": "CN=Phoenix Admins,OU=Groups,DC=corp,DC=com", "role": "ADMIN"}] Supported roles: "ADMIN", "MEMBER", "VIEWER" (case-insensitive) Special group_dn value "*" matches all users (wildcard for default role) |
| auth.ldap.groupSearchBaseDns | list | `[]` | List of base DNs for group searches. Required when groupSearchFilter is set. Example: ["ou=groups,dc=example,dc=com"] Multiple: ["ou=groups,dc=corp,dc=com", "ou=teams,dc=corp,dc=com"] |
| auth.ldap.groupSearchFilter | string | `""` | LDAP filter for finding groups. Use %s as placeholder for user identifier. Two modes:   - AD Mode (not set, recommended for Active Directory): Reads memberOf from user entry   - Search Mode (set): Searches for groups containing the user Example for POSIX: "(&(objectClass=posixGroup)(memberUid=%s))" |
| auth.ldap.groupSearchFilterUserAttr | string | `""` | LDAP attribute from the user entry to substitute for %s in groupSearchFilter. When set: Reads the specified attribute from the user's LDAP entry When not set (default): Uses the login username directly Understanding group types:   - POSIX (memberUid): Contains usernames like "jdoe" → use default or "uid"   - groupOfNames (member): Contains full DNs → use "distinguishedName" (AD only) Note: OpenLDAP does not expose DN as an attribute. For groupOfNames with OpenLDAP, use memberOf overlay instead (AD mode). |
| auth.ldap.host | string | `""` | LDAP server hostname (required when enabled). Comma-separated for multiple servers with failover. Examples: "ldap.corp.com" or "dc1.corp.com,dc2.corp.com,dc3.corp.com" |
| auth.ldap.port | string | `""` | LDAP server port. Defaults to 389 for StartTLS, 636 for LDAPS. |
| auth.ldap.tlsCaCertFile | string | `""` | Path to custom CA certificate file (PEM format) for TLS verification. Use when LDAP server uses a private/internal CA not in the system trust store. |
| auth.ldap.tlsClientCertFile | string | `""` | Path to client certificate file (PEM format) for mutual TLS authentication. Requires tlsClientKeyFile to also be set. |
| auth.ldap.tlsClientKeyFile | string | `""` | Path to client private key file (PEM format) for mutual TLS authentication. Requires tlsClientCertFile to also be set. |
| auth.ldap.tlsMode | string | `"starttls"` | TLS connection mode: "starttls", "ldaps", or "none" - starttls: Upgrade from plaintext to TLS on port 389 (recommended) - ldaps: TLS from connection start on port 636 - none: No encryption (testing only, credentials sent in plaintext) |
| auth.ldap.tlsVerify | bool | `true` | Verify TLS certificates. Should always be true in production. |
| auth.ldap.userSearchBaseDns | list | `[]` | List of base DNs for user searches (required when enabled). Searched in order. Example: ["OU=Users,DC=corp,DC=com"] Multiple: ["OU=Employees,DC=corp,DC=com", "OU=Contractors,DC=corp,DC=com"] |
| auth.ldap.userSearchFilter | string | `"(&(objectClass=user)(sAMAccountName=%s))"` | LDAP filter for finding users. Use %s as placeholder for username. Default for Active Directory: "(&(objectClass=user)(sAMAccountName=%s))" OpenLDAP example: "(&(objectClass=inetOrgPerson)(uid=%s))" |
| auth.name | string | `"phoenix-secret"` | Name of the Kubernetes secret containing authentication credentials |
| auth.oauth2.enabled | bool | `false` | Enable OAuth2/OIDC authentication |
| auth.oauth2.providers | string | `nil` | List of OAuth2 identity providers to configure Each provider requires client_id, client_secret (unless token_endpoint_auth_method="none"), and oidc_config_url You can also define corresponding ENVs via auth.secrets[].valueFrom to use existing secrets ENVs: PHOENIX_OAUTH2_{{ $provider_upper }}_{{ setting }}, e.g. PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET |
| auth.passwordResetTokenExpiryMinutes | int | `60` | Duration in minutes before password reset tokens expire (PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES) |
| auth.refreshTokenExpiryMinutes | int | `43200` | Duration in minutes before refresh tokens expire (PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES) |
| auth.secret[0] | object | `{"key":"PHOENIX_SECRET","value":""}` | Environment variable name for the main Phoenix secret key used for encryption |
| auth.secret[0].value | string | `""` | Autogenerated if empty |
| auth.secret[1] | object | `{"key":"PHOENIX_ADMIN_SECRET","value":""}` | Environment variable name for the admin secret key |
| auth.secret[1].value | string | `""` | Autogenerated if empty |
| auth.secret[2] | object | `{"key":"PHOENIX_POSTGRES_PASSWORD","value":"postgres"}` | Environment variable name for the PostgreSQL password |
| auth.secret[2].value | string | `"postgres"` | If using postgres in this chart, password must match with database.postgres.password |
| auth.secret[3] | object | `{"key":"PHOENIX_SMTP_PASSWORD","value":""}` | Environment variable name for the SMTP password |
| auth.secret[3].value | string | `""` | Autogenerated if empty |
| auth.secret[4] | object | `{"key":"PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD","value":""}` | Environment variable name for the default admin password |
| auth.secret[4].value | string | `""` | Default password for the admin user on initial setup, uses defaultAdminPassword if empty |
| auth.useSecureCookies | bool | `false` | Enable secure cookies (should be true when using HTTPS) |
| database.allocatedStorageGiB | int | `20` | Storage allocation in GiB for the database persistent volume |
| database.defaultRetentionPolicyDays | int | `0` | Default retention policy for traces in days (PHOENIX_DEFAULT_RETENTION_POLICY_DAYS) Set to 0 to disable automatic trace cleanup. When set to a positive value, traces older than this many days will be automatically removed from the database. |
| database.postgres.awsIamTokenLifetimeSeconds | int | `840` | Token lifetime in seconds for AWS RDS IAM authentication pool recycling (PHOENIX_POSTGRES_AWS_IAM_TOKEN_LIFETIME_SECONDS) AWS RDS IAM tokens are valid for 15 minutes (900 seconds). Set slightly lower to ensure tokens are refreshed before expiration. Only used when useAwsIamAuth is true. |
| database.postgres.db | string | `"phoenix"` | Name of the PostgreSQL database (PHOENIX_POSTGRES_DB) |
| database.postgres.host | string | `""` | Postgres Host (PHOENIX_POSTGRES_HOST) Default points to the groundhog2k PostgreSQL service when postgresql.enabled=true IMPORTANT: Only change this when using external PostgreSQL (postgresql.enabled=false, database.url empty) Examples: "localhost", "postgres.example.com", "your-rds-endpoint.region.rds.amazonaws.com" |
| database.postgres.password | string | `"postgres"` | PostgreSQL password (should match auth.secret."PHOENIX_POSTGRES_PASSWORD", PHOENIX_POSTGRES_PASSWORD) |
| database.postgres.port | int | `5432` | Port number for PostgreSQL connections (PHOENIX_POSTGRES_PORT) |
| database.postgres.schema | string | `""` | PostgreSQL schema to use (PHOENIX_SQL_DATABASE_SCHEMA) |
| database.postgres.useAwsIamAuth | bool | `false` | Enable AWS RDS IAM authentication for PostgreSQL (PHOENIX_POSTGRES_USE_AWS_IAM_AUTH) When enabled, Phoenix will use AWS IAM credentials to generate short-lived authentication tokens instead of using a static password. Requires boto3 to be installed: pip install 'arize-phoenix[aws]' IMPORTANT: When enabled, do not set database.postgres.password |
| database.postgres.user | string | `"postgres"` | PostgreSQL username (PHOENIX_POSTGRES_USER) |
| database.url | string | `""` | Full database connection URL (overrides postgres settings if provided) IMPORTANT: Only set this for external databases (Strategy 3) - When using SQLite (Strategy 1): MUST be empty - SQLite auto-uses persistent volume - When using built-in PostgreSQL (Strategy 2): MUST be empty - auto-configured - When using external database (Strategy 3): MUST be configured with full connection string  Examples for external databases: PostgreSQL: "postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/phoenix" SQLite: "sqlite:///path/to/database.db" (only for external SQLite files, not recommended)  WARNING: Setting this will override all database.postgres.* settings and disable built-in PostgreSQL validation |
| deployment.affinity | object | `{}` |  |
| deployment.nodeSelector | object | `{}` |  |
| deployment.strategy | object | `{"rollingUpdate":{"maxSurge":"25%","maxUnavailable":"25%"},"type":"RollingUpdate"}` | Deployment strategy |
| deployment.tolerations | list | `[]` | Tolerations, nodeSelector and affinity For Pod scheduling strategy on the nodes |
| extraVolumeMounts | list | `[]` | Extra Volume Mounts |
| extraVolumes | list | `[]` | Extra Volumes configuration |
| healthChecks | object | `{"livenessProbe":{"failureThreshold":3,"initialDelaySeconds":0,"periodSeconds":10,"successThreshold":1,"timeoutSeconds":5},"readinessProbe":{"failureThreshold":3,"initialDelaySeconds":0,"periodSeconds":5,"successThreshold":1,"timeoutSeconds":3},"startupProbe":{"enabled":true,"failureThreshold":30,"initialDelaySeconds":1,"periodSeconds":1,"successThreshold":1,"timeoutSeconds":1}}` | Health check configuration |
| healthChecks.livenessProbe | object | `{"failureThreshold":3,"initialDelaySeconds":0,"periodSeconds":10,"successThreshold":1,"timeoutSeconds":5}` | Liveness probe configuration |
| healthChecks.livenessProbe.failureThreshold | int | `3` | Number of failures before container is restarted |
| healthChecks.livenessProbe.initialDelaySeconds | int | `0` | Initial delay before liveness probe starts |
| healthChecks.livenessProbe.periodSeconds | int | `10` | How often to perform the liveness probe |
| healthChecks.livenessProbe.successThreshold | int | `1` | Number of consecutive successes for the probe to be considered successful |
| healthChecks.livenessProbe.timeoutSeconds | int | `5` | Timeout for liveness probe |
| healthChecks.readinessProbe | object | `{"failureThreshold":3,"initialDelaySeconds":0,"periodSeconds":5,"successThreshold":1,"timeoutSeconds":3}` | Readiness probe configuration |
| healthChecks.readinessProbe.failureThreshold | int | `3` | Number of failures before pod is marked unready |
| healthChecks.readinessProbe.initialDelaySeconds | int | `0` | Initial delay before readiness probe starts |
| healthChecks.readinessProbe.periodSeconds | int | `5` | How often to perform the readiness probe |
| healthChecks.readinessProbe.successThreshold | int | `1` | Number of consecutive successes for the probe to be considered successful |
| healthChecks.readinessProbe.timeoutSeconds | int | `3` | Timeout for readiness probe |
| healthChecks.startupProbe | object | `{"enabled":true,"failureThreshold":30,"initialDelaySeconds":1,"periodSeconds":1,"successThreshold":1,"timeoutSeconds":1}` | Startup probe configuration |
| healthChecks.startupProbe.enabled | bool | `true` | Enable startup probe |
| healthChecks.startupProbe.failureThreshold | int | `30` | Number of failures before container is considered failed to start |
| healthChecks.startupProbe.initialDelaySeconds | int | `1` | Initial delay before startup probe starts |
| healthChecks.startupProbe.periodSeconds | int | `1` | How often to perform the startup probe |
| healthChecks.startupProbe.successThreshold | int | `1` | Number of consecutive successes for the probe to be considered successful |
| healthChecks.startupProbe.timeoutSeconds | int | `1` | Timeout for startup probe |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy for Phoenix container (Always, IfNotPresent, or Never) |
| image.registry | string | `"docker.io"` | Docker image registry for Phoenix |
| image.repository | string | `"arizephoenix/phoenix"` | Docker image repository for Phoenix |
| image.tag | string | `"version-12.33.0-nonroot"` | Docker image tag/version to deploy |
| ingress.annotations | object | `{}` | Annotations to add to the ingress resource |
| ingress.apiPath | string | `"/"` | Path prefix for the Phoenix API |
| ingress.enabled | bool | `true` | Enable ingress controller for external access |
| ingress.host | string | `""` | Hostname for ingress |
| ingress.labels | object | `{}` | Labels to add to the ingress resource |
| ingress.pathType | string | `"Prefix"` | Ingress path type (Prefix, Exact, or ImplementationSpecific) |
| ingress.tls.enabled | bool | `false` | Enable TLS/HTTPS for ingress |
| instrumentation.otlpTraceCollectorGrpcEndpoint | string | `""` | OpenTelemetry collector gRPC endpoint for sending traces (PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT) |
| instrumentation.otlpTraceCollectorHttpEndpoint | string | `""` | OpenTelemetry collector HTTP endpoint for sending traces (PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT) |
| logging.dbLevel | string | `"warning"` | Database logging level (debug, info, warning, error) PHOENIX_DB_LOGGING_LEVEL |
| logging.level | string | `"info"` | Application logging level (debug, info, warning, error) PHOENIX_LOGGING_LEVEL |
| logging.logMigrations | bool | `true` | Enable logging of database migration operations (PHOENIX_LOG_MIGRATIONS) |
| logging.mode | string | `"default"` | Logging mode configuration - PHOENIX_LOGGING_MODE (default|structured) |
| persistence.accessModes | list | `["ReadWriteOnce"]` | Access modes for the persistent volume |
| persistence.annotations | object | `{}` | Annotations to add to the PVC |
| persistence.enabled | bool | `false` | Enable persistent storage for Phoenix home directory When enabled, Phoenix uses SQLite for local storage stored in the persistent volume IMPORTANT: Cannot be enabled simultaneously with postgresql.enabled=true NOTE: This setting is ignored when database.url="sqlite:///:memory:" (in-memory database) Choose one persistence strategy:   - SQLite: persistence.enabled=true, postgresql.enabled=false   - SQLite In-memory: persistence.inMemory=true , postgresql.enabled=false   - groundhog2k PostgreSQL: persistence.enabled=false, postgresql.enabled=true   - External DB: persistence.enabled=false, postgresql.enabled=false, database.url configured |
| persistence.inMemory | bool | `false` | Enable in-memory configuration of sqlite strategy |
| persistence.labels | object | `{}` | Labels to add to the PVC |
| persistence.size | string | `"20Gi"` | Size of the persistent volume for Phoenix home directory |
| persistence.storageClass | string | `""` | Kubernetes storage class for Phoenix home volume |
| postgresql.enabled | bool | `true` | Enable PostgreSQL deployment. Set to false if you have your own postgres instance (e.g., RDS, CloudSQL) When disabled, you must configure database.url or database.postgres settings to point to your external database IMPORTANT: Cannot be enabled simultaneously with persistence.enabled=true (for SQLite) Choose one persistence strategy:   - groundhog2k PostgreSQL: postgresql.enabled=true, persistence.enabled=false   - SQLite: postgresql.enabled=false, persistence.enabled=true   - External DB: postgresql.enabled=false, persistence.enabled=false, database.url configured |
| postgresql.image.registry | string | `"docker.io"` |  |
| postgresql.image.repository | string | `"postgres"` |  |
| postgresql.image.tag | string | `"16"` |  |
| postgresql.podSecurityContext | object | `{"fsGroup":999,"supplementalGroups":[999]}` | Security context for PostgreSQL container |
| postgresql.resources | object | `{"limits":{"cpu":"500m","memory":"512Mi"},"requests":{"cpu":"100m","memory":"256Mi"}}` | Resource limits |
| postgresql.securityContext.allowPrivilegeEscalation | bool | `false` |  |
| postgresql.securityContext.privileged | bool | `false` |  |
| postgresql.securityContext.readOnlyRootFilesystem | bool | `true` |  |
| postgresql.securityContext.runAsGroup | int | `999` |  |
| postgresql.securityContext.runAsNonRoot | bool | `true` |  |
| postgresql.securityContext.runAsUser | int | `999` |  |
| postgresql.service | object | `{"port":5432,"type":"ClusterIP"}` | Service configuration |
| postgresql.settings | object | `{"superuserPassword":{"value":"postgres"}}` | Database settings |
| postgresql.storage | object | `{"accessModes":["ReadWriteOnce"],"requestedSize":"20Gi"}` | Storage configuration |
| postgresql.userDatabase | object | `{"name":{"value":"phoenix"},"password":{"value":"phoenix"},"user":{"value":"phoenix"}}` | User database configuration |
| replicaCount | int | `1` | Number of Phoenix pod replicas |
| resources | object | `{"limits":{"cpu":"1000m","memory":"2Gi"},"requests":{"cpu":"500m","memory":"1Gi"}}` | Resource configuration |
| securityContext | object | `{"container":{"allowPrivilegeEscalation":false,"capabilities":{"add":[],"drop":["ALL"]},"enabled":false,"privileged":false,"procMount":"Default","readOnlyRootFilesystem":true,"runAsGroup":65532,"runAsNonRoot":true,"runAsUser":65532,"seLinuxOptions":{},"seccompProfile":{"type":"RuntimeDefault"},"windowsOptions":{}},"pod":{"enabled":false,"fsGroup":65532,"fsGroupChangePolicy":"OnRootMismatch","runAsGroup":65532,"runAsNonRoot":true,"runAsUser":65532,"seLinuxOptions":{},"seccompProfile":{"type":"RuntimeDefault"},"supplementalGroups":[],"sysctls":[],"windowsOptions":{}}}` | Security context configuration |
| securityContext.container | object | `{"allowPrivilegeEscalation":false,"capabilities":{"add":[],"drop":["ALL"]},"enabled":false,"privileged":false,"procMount":"Default","readOnlyRootFilesystem":true,"runAsGroup":65532,"runAsNonRoot":true,"runAsUser":65532,"seLinuxOptions":{},"seccompProfile":{"type":"RuntimeDefault"},"windowsOptions":{}}` | Container-level security context settings |
| securityContext.pod | object | `{"enabled":false,"fsGroup":65532,"fsGroupChangePolicy":"OnRootMismatch","runAsGroup":65532,"runAsNonRoot":true,"runAsUser":65532,"seLinuxOptions":{},"seccompProfile":{"type":"RuntimeDefault"},"supplementalGroups":[],"sysctls":[],"windowsOptions":{}}` | Pod-level security context settings |
| server.allowExternalResources | bool | `true` | Allows calls to external resources, like Google Fonts in the web interface (PHOENIX_ALLOW_EXTERNAL_RESOURCES) Set to false in air-gapped environments to prevent external requests that can cause UI loading delays |
| server.annotations | object | `{}` | Annotations to add to the Phoenix service |
| server.enablePrometheus | bool | `false` | Enable Prometheus metrics endpoint on port 9090 |
| server.grpcPort | int | `4317` | Port for OpenTelemetry gRPC collector (PHOENIX_GRPC_PORT) |
| server.host | string | `"::"` | Host IP to bind Phoenix server (PHOENIX_HOST) |
| server.hostRootPath | string | `""` | Root path prefix for Phoenix UI and API (PHOENIX_HOST_ROOT_PATH) |
| server.labels | object | `{}` | Labels to add to the Phoenix service |
| server.maxSpansQueueSize | int | `20000` | Maximum number of spans to hold in the processing queue before rejecting new requests (PHOENIX_MAX_SPANS_QUEUE_SIZE) This is a heuristic to prevent memory issues when spans accumulate faster than they can be written to the database. Memory usage: ~50KiB per span means 20,000 spans = ~1GiB. Adjust based on available memory and database throughput. |
| server.port | int | `6006` | Port for Phoenix web UI and HTTP API (PHOENIX_PORT) |
| server.rootUrl | string | `""` | External root URL for Phoenix (PHOENIX_ROOT_URL) |
| server.telemetryEnabled | bool | `true` | Enable telemetry for analytics tracking (PHOENIX_TELEMETRY_ENABLED) When set to false, disables all analytics tracking in the Phoenix |
| server.workingDir | string | `"/data"` | The working directory for saving, loading, and exporting data (PHOENIX_WORKING_DIR) Set to empty string to use container's $HOME directory (not recommended for persistence) Use `/data` as a default for volume mount - enables proper permissions in both strict and normal security contexts IMPORTANT: When persistence.enabled=true, this directory must be writable by the Phoenix container (UID 65532) The fsGroup setting in securityContext.pod ensures proper permissions when enabled |
| service.annotations | object | `{}` | Annotations to add to the Phoenix service (useful for service mesh configurations) |
| service.labels | object | `{}` | Labels to add to the Phoenix service |
| service.type | string | `"NodePort"` | Service type for Phoenix service (ClusterIP, NodePort, LoadBalancer, or ExternalName) Use ClusterIP for service mesh deployments (Istio, Linkerd, etc.) Use NodePort for direct external access without ingress |
| serviceAccount | object | `{"annotations":{},"create":false,"imagePullSecrets":[],"name":""}` | ServiceAccount configuration |
| serviceAccount.annotations | object | `{}` | Annotations to add to the ServiceAccount |
| serviceAccount.create | bool | `false` | Create a ServiceAccount for Phoenix |
| serviceAccount.imagePullSecrets | list | `[]` | List of Kubernetes secrets to use for pulling images from private registries |
| serviceAccount.name | string | `""` | Name of the ServiceAccount to use. If not set and create is true, a name is generated using the release name. If not set and create is false, uses default ServiceAccount |
| smtp.hostname | string | `""` | SMTP server hostname for sending emails (PHOENIX_SMTP_HOSTNAME) |
| smtp.mailFrom | string | `"noreply@arize.com"` | Email address to use as sender for system emails (PHOENIX_SMTP_MAIL_FROM) |
| smtp.password | string | `""` | SMTP authentication password (PHOENIX_SMTP_PASSWORD) |
| smtp.port | int | `587` | SMTP server port (typically 587 for TLS, PHOENIX_SMTP_PORT) |
| smtp.username | string | `""` | SMTP authentication username (PHOENIX_SMTP_USERNAME) |
| smtp.validateCerts | bool | `true` | Validate SMTP server TLS certificates (PHOENIX_SMTP_VALIDATE_CERTS) |
| tls.caFile | string | `""` | Path to CA certificate file for TLS (PHOENIX_TLS_CA_FILE) |
| tls.certFile | string | `""` | Path to TLS certificate file (PHOENIX_TLS_CERT_FILE) |
| tls.enabled | bool | `false` | Enable TLS for Phoenix server (PHOENIX_TLS_ENABLED) |
| tls.enabledForGrpc | bool | `false` | Enable TLS for gRPC endpoints (PHOENIX_TLS_ENABLED_FOR_GRPC) |
| tls.enabledForHttp | bool | `false` | Enable TLS for HTTP endpoints (PHOENIX_TLS_ENABLED_FOR_HTTP) |
| tls.keyFile | string | `""` | Path to TLS private key file (PHOENIX_TLS_KEY_FILE) |
| tls.keyFilePassword | string | `""` | Password for encrypted TLS private key (PHOENIX_TLS_KEY_FILE_PASSWORD) |
| tls.verifyClient | bool | `false` | Enable client certificate verification for mutual TLS (PHOENIX_TLS_VERIFY_CLIENT) |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.14.2](https://github.com/norwoodj/helm-docs/releases/v1.14.2)
