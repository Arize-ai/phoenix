import type { CaptureResult } from "posthog-js/dist/module.slim.no-external";

/**
 * The SDK properties PostHog needs to ingest an event, plus coarse device
 * facts. Everything else the SDK attaches (URLs, host, referrer, page title,
 * raw user agent, timezone, language) can identify a deployment and is
 * dropped. An allowlist keeps new SDK properties out by default.
 */
const DEFAULT_ALLOWED_SDK_PROPERTIES: ReadonlySet<string> = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$pageview_id",
  "$insert_id",
  "$time",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "$is_identified",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_width",
  "$screen_height",
  "$viewport_width",
  "$viewport_height",
]);

/**
 * Properties Phoenix itself attaches to the events it captures.
 */
export type PhoenixAnalyticsProperties = {
  /** The route pattern of the page, e.g. `/projects/:projectId`. */
  route: string;
  /** The Phoenix server version serving the web interface. */
  phoenix_version: string;
};

/**
 * Strips an outgoing PostHog event down to anonymous properties. Events that
 * Phoenix did not capture itself (they lack a route) are dropped.
 *
 * @param params - Sanitizer inputs.
 * @param params.event - The event PostHog is about to send.
 * @param params.allowedSdkProperties - SDK properties allowed through.
 * @returns The sanitized event, or null to drop it.
 */
export function sanitizeAnalyticsEvent({
  event,
  allowedSdkProperties = DEFAULT_ALLOWED_SDK_PROPERTIES,
}: {
  event: CaptureResult;
  allowedSdkProperties?: ReadonlySet<string>;
}): CaptureResult | null {
  const { route, phoenix_version: phoenixVersion } = event.properties;
  if (typeof route !== "string" || typeof phoenixVersion !== "string") {
    return null;
  }
  const sdkProperties = Object.fromEntries(
    Object.entries(event.properties).filter(([name]) =>
      allowedSdkProperties.has(name)
    )
  );
  const phoenixProperties: PhoenixAnalyticsProperties = {
    route,
    phoenix_version: phoenixVersion,
  };
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties: {
      ...sdkProperties,
      ...phoenixProperties,
      $current_url: route,
      $pathname: route,
    },
  };
}
