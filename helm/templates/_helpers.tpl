{{/*
Truncate at 63 chars, kuberneteres DNS name limitation. 
*/}}
{{- define "phoenix.name" -}}
{{- default "phoenix" .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "phoenix.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "phoenix" .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "phoenix.postgres" -}}
  {{- printf "%s-postgresql" (include "phoenix.fullname" .) -}}
{{- end -}}
{{- define "phoenix.postgres-pvc" -}}
  {{- printf "%s-pvc" (include "phoenix.postgres" .) -}}
{{- end -}}
{{- define "phoenix.service" -}}
  {{- printf "%s-svc" (include "phoenix.fullname" .) -}}
{{- end -}}
{{- define "phoenix.ingress" -}}
  {{- printf "%s-ingress" (include "phoenix.fullname" .) -}}
{{- end -}}

{{- define "phoenix.tlsCoreSecretForIngress" -}}
  {{- if eq .Values.ingress.tls.certSource "none" -}}
    {{- printf "" -}}
  {{- else if eq .Values.ingress.tls.certSource "secret" -}}
    {{- .Values.ingress.tls.secret.secretName -}}
  {{- else -}}
    {{- include "phoenix.ingress" . -}}
  {{- end -}}
{{- end -}}

{{- define "phoenix.appPortName" -}}
  {{- printf "%s-app" (include "phoenix.fullname" .) -}}
{{- end -}}
{{- define "phoenix.appPort" -}}
  {{- .Values.server.port | default 6006 }}
{{- end -}}
{{- define "phoenix.metricsPortName" -}}
  {{- printf "%s-metrics" (include "phoenix.fullname" .) -}}
{{- end -}}
{{- define "phoenix.metricsPort" -}}
  {{- printf "9090" -}}
{{- end -}}
{{- define "phoenix.grpcPortName" -}}
  {{- printf "%s-grpc" (include "phoenix.fullname" .) -}}
{{- end -}}
{{- define "phoenix.grpcPort" -}}
  {{- .Values.server.grpcPort | default 4317 }} 
{{- end -}}

{{/*
Validate persistence configuration to prevent data storage conflicts
*/}}
{{- define "phoenix.validatePersistence" -}}
{{- $persistenceEnabled := .Values.persistence.enabled | toString | eq "true" }}
{{- $postgresqlEnabled := .Values.postgresql.enabled | toString | eq "true" }}
{{- $databaseUrlConfigured := and .Values.database.url (ne .Values.database.url "") }}
{{- if and $persistenceEnabled $postgresqlEnabled }}
{{- fail "ERROR: Invalid persistence configuration detected!\n\nYou cannot enable both 'persistence.enabled=true' and 'postgresql.enabled=true' simultaneously.\n\nThese options are mutually exclusive. Please choose ONE of the following:\n\n  1. SQLite with persistent storage:\n     - Set persistence.enabled=true\n     - Set postgresql.enabled=false\n     - Leave database.url empty\n\n  2. Built-in PostgreSQL:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=true\n     - Leave database.url empty\n\n  3. External database:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=false\n     - Configure database.url with your external database connection string\n\nFor more information, see the persistence configuration comments in values.yaml" }}
{{- end }}
{{- if and $persistenceEnabled $databaseUrlConfigured }}
{{- fail "ERROR: Invalid SQLite configuration detected!\n\nWhen using SQLite with persistent storage (persistence.enabled=true), the 'database.url' must be empty.\n\nSQLite will automatically use the persistent volume at the working directory.\n\nTo fix this:\n  - Set persistence.enabled=true\n  - Set postgresql.enabled=false\n  - Set database.url to empty string\n\nIf you want to use an external database instead:\n  - Set persistence.enabled=false\n  - Set postgresql.enabled=false\n  - Configure database.url with your external database connection string" }}
{{- end }}
{{- if and $databaseUrlConfigured $postgresqlEnabled }}
{{- fail "ERROR: Conflicting database configuration detected!\n\nYou cannot specify both 'database.url' and enable the built-in PostgreSQL (postgresql.enabled=true).\n\nTo fix this, choose ONE option:\n\n  1. Use external database:\n     - Set postgresql.enabled=false\n     - Keep database.url configured with your external database\n\n  2. Use built-in PostgreSQL:\n     - Set postgresql.enabled=true\n     - Set database.url to empty string\n\nThe database.url setting overrides PostgreSQL settings, so having both enabled creates ambiguity." }}
{{- end }}
{{- end }}

{{/*
Validate external database configuration for consistency
*/}}
{{- define "phoenix.validateExternalDatabase" -}}
{{- $postgresqlEnabled := .Values.postgresql.enabled | toString | eq "true" }}
{{- $persistenceEnabled := .Values.persistence.enabled | toString | eq "true" }}
{{- $databaseUrlConfigured := and .Values.database.url (ne .Values.database.url "") }}
{{- if and (not $postgresqlEnabled) (not $persistenceEnabled) }}
{{- $hasCustomHost := ne .Values.database.postgres.host "phoenix-postgresql" }}
{{- $hasCustomUser := ne .Values.database.postgres.user "postgres" }}
{{- $hasCustomPassword := ne .Values.database.postgres.password "postgres" }}
{{- $hasCustomDb := ne .Values.database.postgres.db "phoenix" }}
{{- $hasCustomPort := ne (.Values.database.postgres.port | toString) "5432" }}
{{- $hasCustomSchema := ne .Values.database.postgres.schema "" }}
{{- $hasCustomPostgresSettings := or $hasCustomHost $hasCustomUser $hasCustomPassword $hasCustomDb $hasCustomPort $hasCustomSchema }}
{{- if and $hasCustomPostgresSettings ($databaseUrlConfigured) }}
{{- fail (printf "ERROR: Inconsistent external database configuration detected!\n\nYou have configured custom PostgreSQL settings but no database.url is set.\n\nFor external databases, it's recommended to use database.url instead of individual postgres settings for better validation and clarity.\n\nTo fix this, set:\n  database.url: \"postgresql://%s:****@%s:%v/%s\"\n\nOr ensure all database.postgres.* settings are correctly configured for your external database." .Values.database.postgres.user .Values.database.postgres.host .Values.database.postgres.port .Values.database.postgres.db) }}
{{- end }}
{{- if and $databaseUrlConfigured $hasCustomPostgresSettings }}
{{- fail "ERROR: Conflicting database configuration detected!\n\nYou have both 'database.url' and custom 'database.postgres.*' settings configured.\n\nWhen using database.url, all database.postgres.* settings are ignored.\n\nTo fix this, choose ONE option:\n\n  1. Use database.url only:\n     - Keep database.url configured\n     - Remove custom database.postgres.* settings (or set them to defaults)\n\n  2. Use individual postgres settings:\n     - Set database.url to empty string\n     - Configure all required database.postgres.* settings" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Validate database URL format when provided
*/}}
{{- define "phoenix.validateDatabaseUrl" -}}
{{- $databaseUrlConfigured := and .Values.database.url (ne .Values.database.url "") }}
{{- $persistenceEnabled := .Values.persistence.enabled | toString | eq "true" }}
{{- if $databaseUrlConfigured }}
{{- $url := .Values.database.url }}
{{- if not (or (hasPrefix "postgresql://" $url) (hasPrefix "sqlite://" $url)) }}
{{- fail (printf "ERROR: Invalid database.url format detected!\n\nThe database.url must start with a valid scheme.\n\nProvided: %s\n\nSupported formats:\n  - PostgreSQL: postgresql://username:password@host:port/database\n  - SQLite: sqlite:///path/to/database.db\n\nExample PostgreSQL URL:\n  database.url: \"postgresql://myuser:mypass@db.example.com:5432/phoenix\"" $url) }}
{{- end }}
{{- if and (hasPrefix "sqlite://" $url) (not $persistenceEnabled) }}
{{- fail "ERROR: SQLite database URL provided without persistent storage!\n\nWhen using SQLite with database.url, you must enable persistent storage to prevent data loss.\n\nTo fix this:\n  - Set persistence.enabled=true\n  - Ensure the SQLite file path in database.url points to the persistent volume\n\nAlternatively, for SQLite with persistence, it's recommended to:\n  - Set persistence.enabled=true\n  - Set database.url to empty string (Phoenix will auto-configure SQLite)" }}
{{- end }}
{{- end }}
{{- end }}
