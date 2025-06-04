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
