---
description: How to customize your self-hosted deployment of Phoenix
---

# Configuration

## Ports

Phoenix is an all-in-one solution that has a tracing UI as well as a trace collector over both HTTP and gRPC.\
\
By default, the container exposes the following ports:

<table><thead><tr><th width="93">Port</th><th width="100">Protocol</th><th width="137">Endpoint</th><th width="193">Function</th><th>Env Var</th></tr></thead><tbody><tr><td>6006</td><td>HTTP</td><td><code>/</code></td><td>User interface (UI) of the web application.</td><td><code>PHOENIX_PORT</code></td></tr><tr><td>6006</td><td>HTTP</td><td><code>/v1/traces</code></td><td>Accepts traces in <a href="https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md">OpenTelemetry OTLP format </a> (Protobuf).</td><td><code>PHOENIX_PORT</code></td></tr><tr><td>4317</td><td>gRPC</td><td>n/a</td><td>Accepts traces in <a href="https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md">OpenTelemetry OTLP format </a> (Protobuf).</td><td><code>PHOENIX_GRPC_PORT</code></td></tr></tbody></table>

If the above ports need to be modified, consult the section below.

## Environment Variables

Phoenix is highly configurable via environment variables. Below is a comprehensive list, organized by category. For SMTP/email settings, see the [Email Configuration](./email) guide.

### Server Configuration
- **PHOENIX_PORT:** The port to run the Phoenix web server. Defaults to 6006.
- **PHOENIX_GRPC_PORT:** The port to run the gRPC OTLP trace collector. Defaults to 4317.
- **PHOENIX_HOST:** The host to run the Phoenix server. Defaults to 0.0.0.0.
- **PHOENIX_HOST_ROOT_PATH:** The root path prefix for your application. Allows Phoenix to run behind a reverse proxy at a subpath.
- **PHOENIX_WORKING_DIR:** Directory to save, load, and export data. Must be accessible by both the Phoenix server and notebook environment. Defaults to `~/.phoenix/`.
- **PHOENIX_ROOT_URL:** The full URL used to access Phoenix from a web browser. Important for reverse proxy setups. If a sub-path is needed, also set PHOENIX_HOST_ROOT_PATH.
- **PHOENIX_ENABLE_PROMETHEUS:** Whether to enable Prometheus metrics. Defaults to false.
- **PHOENIX_DATABASE_ALLOCATED_STORAGE_CAPACITY_GIBIBYTES:** Allocated storage capacity for the Phoenix database in GiB (used for UI display).
- **PHOENIX_ALLOWED_ORIGINS:** Comma-separated list of allowed origins for CORS. Defaults to None (CORS disabled).

### Database Configuration
- **PHOENIX_SQL_DATABASE_URL:** SQL database URL for logging traces and evals. Supports SQLite and PostgreSQL. If not set, defaults to file-based SQLite in the working directory.
- **PHOENIX_POSTGRES_HOST:** Alternative to SQL_DATABASE_URL. Host for PostgreSQL database.
- **PHOENIX_POSTGRES_PORT:** Port for PostgreSQL database.
- **PHOENIX_POSTGRES_USER:** User for PostgreSQL database.
- **PHOENIX_POSTGRES_PASSWORD:** Password for PostgreSQL database.
- **PHOENIX_POSTGRES_DB:** Database name for PostgreSQL.
- **PHOENIX_SQL_DATABASE_SCHEMA:** Optional PostgreSQL schema for tables. Ignored for SQLite.

### Authentication & Security
- **PHOENIX_ENABLE_AUTH:** Enable authentication. Defaults to false.
- **PHOENIX_DISABLE_BASIC_AUTH:** Forbid login via password and disable creation of local users. Useful when using OAuth2 only.
- **PHOENIX_DISABLE_RATE_LIMIT:** Disable rate limiting. Defaults to false.
- **PHOENIX_SECRET:** Secret key for signing JWTs. Must be at least 32 characters, with at least one digit and one lowercase letter.
- **PHOENIX_ADMIN_SECRET:** Secret key that can be used as a bearer token for admin access. Must be at least 32 characters, with at least one digit and one lowercase letter, and different from PHOENIX_SECRET.
- **PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD:** Initial password for the default admin account. Defaults to 'admin'.
- **PHOENIX_API_KEY:** API key for authenticating client requests.
- **PHOENIX_USE_SECURE_COOKIES:** Use secure cookies (HTTPS only). Defaults to false.
- **PHOENIX_COOKIES_PATH:** Path for cookies. Defaults to '/'.
- **PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES:** Minutes before access tokens expire.
- **PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES:** Minutes before refresh tokens expire.
- **PHOENIX_PASSWORD_RESET_TOKEN_EXPIRY_MINUTES:** Minutes before password reset tokens expire.
- **PHOENIX_CSRF_TRUSTED_ORIGINS:** Comma-separated list of origins allowed to bypass CSRF protection. Recommended for OAuth2 or password reset flows.
- **PHOENIX_ADMINS:** Semicolon-separated list of `username=email` pairs to create as admin users on startup. Passwords are randomly generated and must be reset by the user.

### OAuth2 Identity Providers
- **PHOENIX_OAUTH2_{IDP_NAME}_CLIENT_ID:** OAuth2 client ID for the specified identity provider.
- **PHOENIX_OAUTH2_{IDP_NAME}_CLIENT_SECRET:** OAuth2 client secret for the specified identity provider.
- **PHOENIX_OAUTH2_{IDP_NAME}_OIDC_CONFIG_URL:** OpenID Connect configuration URL for the identity provider.
- **PHOENIX_OAUTH2_{IDP_NAME}_DISPLAY_NAME:** User-friendly display name for the identity provider.
- **PHOENIX_OAUTH2_{IDP_NAME}_ALLOW_SIGN_UP:** Whether to allow new user registration via this provider. Defaults to true.
- **PHOENIX_OAUTH2_{IDP_NAME}_AUTO_LOGIN:** Whether to automatically redirect to this provider's login page. Defaults to false.

### TLS/HTTPS Configuration
- **PHOENIX_TLS_ENABLED:** Enable TLS for HTTP and gRPC servers.
- **PHOENIX_TLS_ENABLED_FOR_HTTP:** Enable TLS for HTTP server (overrides PHOENIX_TLS_ENABLED).
- **PHOENIX_TLS_ENABLED_FOR_GRPC:** Enable TLS for gRPC server (overrides PHOENIX_TLS_ENABLED).
- **PHOENIX_TLS_CERT_FILE:** Path to TLS certificate file for HTTPS connections.
- **PHOENIX_TLS_KEY_FILE:** Path to TLS private key file for HTTPS connections.
- **PHOENIX_TLS_KEY_FILE_PASSWORD:** Password for the TLS private key file (if encrypted).
- **PHOENIX_TLS_CA_FILE:** Path to Certificate Authority file for client certificate verification (mTLS).
- **PHOENIX_TLS_VERIFY_CLIENT:** Enable client certificate verification for mTLS.

### Logging & Monitoring
- **PHOENIX_LOGGING_MODE:** Logging mode ('default' or 'structured').
- **PHOENIX_LOGGING_LEVEL:** Logging level for Phoenix backend ('debug', 'info', 'warning', 'error', 'critical'). Defaults to 'info'.
- **PHOENIX_DB_LOGGING_LEVEL:** Logging level for Phoenix ORM. Defaults to 'warning'.
- **PHOENIX_LOG_MIGRATIONS:** Whether to log migrations. Defaults to true.
- **PHOENIX_DANGEROUSLY_DISABLE_MIGRATIONS:** Disable migrations (for development only).
- **PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT:** HTTP endpoint for OTLP trace collector (enables OpenTelemetry tracer/exporter).
- **PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_GRPC_ENDPOINT:** gRPC endpoint for OTLP trace collector (enables OpenTelemetry tracer/exporter).

### Email/SMTP Configuration
See the [Email Configuration](./email) guide for all SMTP-related environment variables including PHOENIX_SMTP_HOSTNAME, PHOENIX_SMTP_PORT, PHOENIX_SMTP_USERNAME, PHOENIX_SMTP_PASSWORD, PHOENIX_SMTP_MAIL_FROM, and PHOENIX_SMTP_VALIDATE_CERTS.

### Client/Notebook Configuration
- **PHOENIX_NOTEBOOK_ENV:** The notebook environment (e.g., 'sagemaker'). Usually not required.
- **PHOENIX_COLLECTOR_ENDPOINT:** Endpoint to which traces and evals are sent. Must be set if Phoenix server is remote.
- **PHOENIX_PROJECT_NAME:** Project name under which traces will be sent. Defaults to 'default'.
- **PHOENIX_CLIENT_HEADERS:** Headers to set when talking to the Phoenix server (e.g., authentication headers).

### Advanced/Extension Settings
- **PHOENIX_FASTAPI_MIDDLEWARE_PATHS:** Comma-separated list of `file_path:ClassName` for custom FastAPI middleware.
- **PHOENIX_GQL_EXTENSION_PATHS:** Comma-separated list of `file_path:ClassName` for custom GraphQL extensions.
- **PHOENIX_GRPC_INTERCEPTOR_PATHS:** Comma-separated list of `file_path:ClassName` for custom gRPC interceptors.

## FAQs

### Permission denied writing to disc

Some phoenix containers run as nonroot and therefore must be granted explicit write permissions to the mounted disc (see [https://kubernetes.io/docs/tasks/configure-pod-container/security-context/](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)). Phoenix 4.1.3 and above run as root by default to avoid this. However there are `debug` and `nonroot` variants of the image as well.

### Using gRPC for trace collection

Phoenix does natively support gRPC for trace collection post 4.0 release. See for details.
