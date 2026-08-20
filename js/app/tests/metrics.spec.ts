import { expect, test } from "@playwright/test";

/**
 * Prometheus is enabled for the e2e test server (see tests/utils/testServer.mjs),
 * which mounts PrometheusMiddleware on every request and exposes the metrics
 * exporter on :9090.
 *
 * Beyond asserting "we are at least producing metrics", this guards the FastAPI
 * 0.137 `_IncludedRouter` route-resolution regression: that bug raised
 * `AttributeError: '_IncludedRouter' object has no attribute 'path'` inside the
 * middleware whenever a request matched an included router. Exercising an
 * included-router request and then confirming a templated `path` label is
 * recorded proves the middleware resolved the route instead of crashing.
 */
test.describe("Prometheus metrics", () => {
  // The exporter binds a hardcoded :9090 (start_http_server in
  // src/phoenix/server/prometheus.py), independent of PHOENIX_PORT.
  const metricsURL = "http://localhost:9090/metrics";

  test("exposes request metrics for included-router routes", async ({
    page,
    request,
  }) => {
    // Drive traffic through the app so the middleware records requests against
    // the GraphQL/REST included routers.
    await page.goto("/projects");
    await page.waitForURL("**/projects");
    await expect(
      page.getByRole("button", { name: "New Project" })
    ).toBeVisible();

    const response = await request.get(metricsURL);
    expect(response.ok()).toBe(true);

    const body = await response.text();
    // The per-request summary defined in prometheus.py is emitted. A Summary
    // exports `_count`/`_sum` series labeled by method and the resolved path.
    expect(body).toContain(
      "starlette_requests_processing_time_seconds_summary"
    );
    // A recorded, non-empty `path` label proves the middleware resolved the
    // route (descending into the included router) rather than raising
    // AttributeError on FastAPI 0.137's `_IncludedRouter`.
    expect(body).toMatch(
      /starlette_requests_processing_time_seconds_summary_count\{[^}]*path="\/[^"]+"/
    );
  });
});
