import {
  defineRailway,
  image,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const sides = ["base", "head"] as const;
const engines = ["sqlite", "postgres"] as const;
const instances = sides.flatMap((side, sideIndex) =>
  engines.map((engine, engineIndex) => ({
    name: `phoenix-${side}-${engine}`,
    engine,
    imageRef:
      side === "base"
        ? process.env.PREVIEW_BASE_IMAGE
        : process.env.PREVIEW_HEAD_IMAGE,
    receiverPort: 4318 + sideIndex * engines.length + engineIndex,
  }))
);

const databaseSchema = process.env.PREVIEW_DATABASE_SCHEMA;
if (!databaseSchema || !/^preview_[0-9]+$/.test(databaseSchema)) {
  throw new Error(
    "PREVIEW_DATABASE_SCHEMA must be preview_ followed by the workflow run ID"
  );
}

const lgtmData = volume("lgtm-data", {
  region: "us-east4-eqdc4a",
  sizeMB: 50000,
});
const lgtm = service("lgtm", {
  source: image(
    "grafana/otel-lgtm@sha256:1b852b77d7bcadb7699bfe7c78a51d059dff85168de674728cf7abf4474645e5"
  ),
  healthcheck: "/api/health",
  volumeMounts: { "/data": lgtmData },
  env: {
    PORT: "3000",
    GF_AUTH_ANONYMOUS_ENABLED: "false",
    GF_AUTH_DISABLE_LOGIN_FORM: "false",
    GF_USERS_ALLOW_SIGN_UP: "false",
    GF_SECURITY_ADMIN_PASSWORD:
      process.env.PREVIEW_GRAFANA_PASSWORD ?? preserve(),
    RAILWAY_RUN_UID: "0",
  },
});

const grafanaMcp = service("grafana-mcp", {
  source: image(
    "grafana/mcp-grafana@sha256:63d4501d3166c2b9242d8a2b5b7df8892c59c6c477be3a2a61bcf8a252671f31"
  ),
  start:
    "/bin/sh -c 'exec /app/mcp-grafana -t streamable-http --address 0.0.0.0:8000 --disable-write --allowed-hosts \"${RAILWAY_PUBLIC_DOMAIN:-grafana-mcp.railway.internal}\"'",
  env: {
    GRAFANA_URL: "http://lgtm.railway.internal:3000",
    GRAFANA_SERVICE_ACCOUNT_TOKEN: preserve(),
    MCP_GRAFANA_SERVER_TOKEN:
      process.env.PREVIEW_MCP_CALLER_TOKEN ?? preserve(),
    PORT: "8000",
  },
});

const collectorConfig = JSON.stringify({
  receivers: Object.fromEntries(
    instances.map(({ name, receiverPort }) => [
      `otlp/${name}`,
      { protocols: { http: { endpoint: `[::]:${receiverPort}` } } },
    ])
  ),
  processors: Object.fromEntries(
    instances.map(({ name }) => [
      `resource/${name}`,
      { attributes: [{ action: "upsert", key: "service.name", value: name }] },
    ])
  ),
  exporters: { otlphttp: { endpoint: "http://lgtm.railway.internal:4318" } },
  service: {
    pipelines: Object.fromEntries(
      instances.map(({ name }) => [
        `logs/${name}`,
        {
          receivers: [`otlp/${name}`],
          processors: [`resource/${name}`],
          exporters: ["otlphttp"],
        },
      ])
    ),
  },
});

const logCollector = service("log-collector", {
  source: image("otel/opentelemetry-collector:0.120.0"),
  start: "/otelcol --config=env:PREVIEW_COLLECTOR_CONFIG",
  env: { PREVIEW_COLLECTOR_CONFIG: collectorConfig },
});

export default defineRailway(({ projectName }) => {
  if (!projectName) {
    throw new Error(
      "Link the preview Railway project before applying the configuration"
    );
  }
  const phoenixResources = instances.flatMap(
    ({ name, engine, imageRef, receiverPort }) => {
      if (!imageRef) {
        throw new Error(`Missing preview image for ${name}`);
      }
      const database =
        engine === "postgres" ? postgres(`${name}-db`) : undefined;
      const phoenix = service(name, {
        source: image(imageRef),
        healthcheck: "/healthz",
        env: {
          PORT: "6006",
          PHOENIX_PORT: "6006",
          PHOENIX_ENABLE_AUTH: "false",
          PHOENIX_LOGGING_MODE: "structured",
          PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT: `http://log-collector.railway.internal:${receiverPort}`,
          ...(database && {
            PHOENIX_SQL_DATABASE_URL: database.env.DATABASE_URL,
            PHOENIX_SQL_DATABASE_SCHEMA: databaseSchema,
          }),
        },
      });
      return database ? [database, phoenix] : [phoenix];
    }
  );
  return project(projectName, {
    resources: [lgtmData, lgtm, grafanaMcp, logCollector, ...phoenixResources],
  });
});
