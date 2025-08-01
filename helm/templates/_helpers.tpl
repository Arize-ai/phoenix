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
{{- if and .Values.persistence.enabled .Values.postgresql.enabled (not .Values.database.url) }}
{{- fail "ERROR: Invalid persistence configuration detected!\n\nYou cannot enable both 'persistence.enabled=true' and 'postgresql.enabled=true' simultaneously without an external database URL.\n\nThis would create conflicting data storage strategies. Please choose ONE of the following:\n\n  1. SQLite with persistent storage:\n     - Set persistence.enabled=true\n     - Set postgresql.enabled=false\n     - Leave database.url empty\n\n  2. Built-in PostgreSQL:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=true\n\n  3. External database:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=false\n     - Configure database.url with your external database connection string\n\nFor more information, see the persistence configuration comments in values.yaml" }}
{{- end }}
{{- if and .Values.persistence.enabled .Values.database.url }}
{{- fail "ERROR: Invalid SQLite configuration detected!\n\nWhen using SQLite with persistent storage (persistence.enabled=true), the 'database.url' must be empty.\n\nSQLite will automatically use the persistent volume at the working directory.\n\nTo fix this:\n  - Set persistence.enabled=true\n  - Set postgresql.enabled=false\n  - Set database.url to empty string\n\nIf you want to use an external database instead:\n  - Set persistence.enabled=false\n  - Set postgresql.enabled=false\n  - Configure database.url with your external database connection string" }}
{{- end }}
{{- if and (not .Values.persistence.enabled) (not .Values.postgresql.enabled) (not .Values.database.url) }}
{{- fail "ERROR: No database configuration detected!\n\nYou must configure at least one database option:\n\n  1. SQLite with persistent storage:\n     - Set persistence.enabled=true\n     - Set postgresql.enabled=false\n     - Leave database.url empty\n\n  2. Built-in PostgreSQL:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=true\n     - Leave database.url empty\n\n  3. External database:\n     - Set persistence.enabled=false\n     - Set postgresql.enabled=false\n     - Configure database.url with your external database connection string\n\nWithout any database configuration, Phoenix will use a temporary SQLite database that will be lost when the pod restarts." }}
{{- end }}
{{- if and .Values.database.url .Values.postgresql.enabled }}
{{- fail "ERROR: Conflicting database configuration detected!\n\nYou cannot specify both 'database.url' and enable the built-in PostgreSQL (postgresql.enabled=true).\n\nTo fix this, choose ONE option:\n\n  1. Use external database:\n     - Set postgresql.enabled=false\n     - Keep database.url configured with your external database\n\n  2. Use built-in PostgreSQL:\n     - Set postgresql.enabled=true\n     - Set database.url to empty string\n\nThe database.url setting overrides PostgreSQL settings, so having both enabled creates ambiguity." }}
{{- end }}
{{- end }}


{{/*
Validate external database configuration for consistency
*/}}
{{- define "phoenix.validateExternalDatabase" -}}
{{- if and (not .Values.postgresql.enabled) (not .Values.persistence.enabled) (not .Values.database.url) }}
{{- $hasCustomHost := ne .Values.database.postgres.host "phoenix-postgresql" }}
{{- $hasCustomPassword := ne .Values.database.postgres.password "postgres" }}
{{- if or $hasCustomHost $hasCustomPassword }}
{{- printf "WARNING: You have configured custom PostgreSQL settings (host: %s) but no database.url is set.\n\nFor external databases, it's recommended to use database.url instead of individual postgres settings for better validation and clarity.\n\nConsider setting:\n  database.url: \"postgresql://%s:%s@%s:%v/%s\"\n\nOr ensure all database.postgres.* settings are correctly configured for your external database." .Values.database.postgres.host .Values.database.postgres.user .Values.database.postgres.password .Values.database.postgres.host .Values.database.postgres.port .Values.database.postgres.db | printf | fail }}
{{- end }}
{{- end }}
{{- end }}
