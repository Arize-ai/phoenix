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
  {{- if .Values.database.postgres.host -}}
    {{- .Values.database.postgres.host -}}
  {{- else -}}
    {{- printf "%s-postgresql" .Release.Name -}}
  {{- end -}}
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
Common labels
*/}}
{{- define "phoenix.labels" -}}
app.kubernetes.io/name: {{ include "phoenix.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Validate persistence configuration to prevent data storage conflicts
*/}}
{{- define "phoenix.validatePersistence" -}}
{{- $persistenceEnabled := .Values.persistence.enabled | toString | eq "true" }}
{{- $postgresqlEnabled := .Values.postgresql.enabled | toString | eq "true" }}
{{- $databaseUrlConfigured := and .Values.database.url (ne .Values.database.url "") }}
{{- $isMemoryDatabase := .Values.persistence.inMemory | toString | eq "true" }}
{{- if and $isMemoryDatabase $persistenceEnabled }}
{{- fail "ERROR: Invalid persistence configuration detected!\n\nYou cannot enable both 'persistence.enabled=true' and 'persistence.inMemory=true' simultaneously.\n\nThese options are mutually exclusive. Please choose ONE:\n\n  1. SQLite with persistent storage:\n     - Set persistence.enabled=true\n     - Set persistence.inMemory=false\n     - Set postgresql.enabled=false\n\n  2. SQLite in-memory (demo/testing only):\n     - Set persistence.enabled=false\n     - Set persistence.inMemory=true\n     - Set postgresql.enabled=false\n\nNote: In-memory mode will lose ALL data when the pod restarts." }}
{{- end }}
{{- if and $isMemoryDatabase $postgresqlEnabled }}
{{- fail "ERROR: In-memory database configuration conflict!\n\nWhen using SQLite In-memory (database.url=\"sqlite:///:memory:\"), PostgreSQL must be disabled.\n\nTo fix this:\n  - Set database.url=\"sqlite:///:memory:\"\n  - Set postgresql.enabled=false\n\nNote: In-memory mode is for demos/testing only. All data will be lost when the pod restarts." }}
{{- end }}
{{- if and $persistenceEnabled $postgresqlEnabled (not $isMemoryDatabase) }}
{{- fail "ERROR: Invalid persistence configuration detected!\n\nYou cannot enable both 'persistence.enabled=true' and 'postgresql.enabled=true' simultaneously.\n\nThese options are mutually exclusive. Please choose ONE of the following:\n\n  1. SQLite with persistent storage:\n     - Set persistence.enabled=true\n     - Set postgresql.enabled=false\n     - Leave database.url empty\n\n  2. Built-in PostgreSQL:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=true\n     - Leave database.url empty\n\n  3. External database:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=false\n     - Configure database.url with your external database connection string\n\nFor more information, see the persistence configuration comments in values.yaml" }}
{{- end }}
{{- if and $persistenceEnabled $databaseUrlConfigured (not $isMemoryDatabase) }}
{{- fail "ERROR: Invalid SQLite configuration detected!\n\nWhen using SQLite with persistent storage (persistence.enabled=true), the 'database.url' must be empty.\n\nSQLite will automatically use the persistent volume at the working directory.\n\nTo fix this:\n  - Set persistence.enabled=true\n  - Set postgresql.enabled=false\n  - Set database.url to empty string\n\nIf you want to use an external database instead:\n  - Set persistence.enabled=false\n  - Set postgresql.enabled=false\n  - Configure database.url with your external database connection string" }}
{{- end }}
{{- if and $databaseUrlConfigured $postgresqlEnabled (not $isMemoryDatabase) }}
{{- fail "ERROR: Conflicting database configuration detected!\n\nYou cannot specify both 'database.url' and enable the built-in PostgreSQL (postgresql.enabled=true).\n\nTo fix this, choose ONE option:\n\n  1. Use external database:\n     - Set postgresql.enabled=false\n     - Keep database.url configured with your external database\n\n  2. Use built-in PostgreSQL:\n     - Set postgresql.enabled=true\n     - Set database.url to empty string\n\nThe database.url setting overrides PostgreSQL settings, so having both enabled creates ambiguity." }}
{{- end }}
{{- end }}

{{/*
Validate external database configuration for consistency
*/}}
{{- define "phoenix.validateExternalDatabase" -}}
{{- $postgresqlEnabled := .Values.postgresql.enabled | toString | eq "true" }}
{{- $persistenceEnabled := .Values.persistence.enabled | toString | eq "true" }}
{{- $isMemoryDatabase := .Values.persistence.inMemory | toString | eq "true" }}
{{- $databaseUrlConfigured := and .Values.database.url (ne .Values.database.url "") }}
{{- /* Skip validation when using in-memory database - custom postgres settings are irrelevant */ -}}
{{- if and (not $postgresqlEnabled) (not $persistenceEnabled) (not $isMemoryDatabase) }}
{{- $hasCustomHost := ne .Values.database.postgres.host "phoenix-postgresql" }}
{{- $hasCustomUser := ne .Values.database.postgres.user "postgres" }}
{{- $hasCustomPassword := ne .Values.database.postgres.password "postgres" }}
{{- $hasCustomDb := ne .Values.database.postgres.db "phoenix" }}
{{- $hasCustomPort := ne (.Values.database.postgres.port | toString) "5432" }}
{{- $hasCustomSchema := ne .Values.database.postgres.schema "" }}
{{- $hasCustomPostgresSettings := or $hasCustomHost $hasCustomUser $hasCustomPassword $hasCustomDb $hasCustomPort $hasCustomSchema }}
{{- if and $hasCustomPostgresSettings ($databaseUrlConfigured) }}
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
{{- $isMemoryDatabase := .Values.persistence.inMemory | toString | eq "true" }}
{{- if $databaseUrlConfigured }}
{{- $url := .Values.database.url }}
{{- if not (or (hasPrefix "postgresql://" $url) (hasPrefix "sqlite://" $url)) }}
{{- fail (printf "ERROR: Invalid database.url format detected!\n\nThe database.url must start with a valid scheme.\n\nProvided: %s\n\nSupported formats:\n  - PostgreSQL: postgresql://username:password@host:port/database\n  - SQLite: sqlite:///path/to/database.db\n\nExample PostgreSQL URL:\n  database.url: \"postgresql://myuser:mypass@db.example.com:5432/phoenix\"" $url) }}
{{- end }}
{{- if and (hasPrefix "sqlite://" $url) (not $persistenceEnabled) (not $isMemoryDatabase) }}
{{- fail "ERROR: SQLite database URL provided without persistent storage!\n\nWhen using SQLite with database.url, you must enable persistent storage to prevent data loss.\n\nTo fix this:\n  - Set persistence.enabled=true\n  - Ensure the SQLite file path in database.url points to the persistent volume\n\nAlternatively, for SQLite with persistence, it's recommended to:\n  - Set persistence.enabled=true\n  - Set database.url to empty string (Phoenix will auto-configure SQLite)" }}
{{- end }}
{{- if and (not (hasPrefix "sqlite:///:memory:" $url)) (not $persistenceEnabled) ($isMemoryDatabase) }}
{{- fail "ERROR: Sqlite database URL is using in-memory setting without proper `sqlite:///:memory:` prefix." }}
{{- end }}
{{- end }}
{{- end }}
