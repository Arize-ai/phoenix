import { type PageViewRouterLike, trackPageViews } from "./pageViewTracking";
import type { PhoenixAnalyticsProperties } from "./sanitizeAnalyticsEvent";

type PostHogConfig = NonNullable<Window["Config"]["posthog"]>;

/**
 * Starts anonymous product analytics when the server configured PostHog.
 * The SDK is loaded on demand, so deployments without PostHog (including
 * opted-out and air-gapped ones) never download or run it.
 *
 * Only page views are sent, keyed by route pattern. The SDK runs with no
 * persistence, no person profiles, no autocapture, no session recording,
 * no remote config, and no external scripts.
 *
 * @param params - Startup inputs.
 * @param params.router - The app's data router.
 * @param params.config - PostHog settings; null disables analytics.
 * @param params.phoenixVersion - The Phoenix version attached to each event.
 */
export async function startPostHogAnalytics({
  router,
  config = window.Config.posthog,
  phoenixVersion = window.Config.platformVersion,
}: {
  router: PageViewRouterLike;
  config?: PostHogConfig | null;
  phoenixVersion?: string;
}): Promise<void> {
  if (!config) {
    return;
  }
  const [{ posthog }, { sanitizeAnalyticsEvent }] = await Promise.all([
    import("posthog-js/dist/module.slim.no-external"),
    import("./sanitizeAnalyticsEvent"),
  ]);
  posthog.init(config.apiKey, {
    api_host: config.apiHost,
    persistence: "memory",
    person_profiles: "never",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    save_referrer: false,
    save_campaign_params: false,
    before_send: (event) => (event ? sanitizeAnalyticsEvent({ event }) : null),
  });
  trackPageViews({
    router,
    onPageView: (routePattern) => {
      const properties: PhoenixAnalyticsProperties = {
        route: routePattern,
        phoenix_version: phoenixVersion,
      };
      posthog.capture("$pageview", properties);
    },
  });
}
