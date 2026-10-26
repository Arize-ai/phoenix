import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/**
 * Decisions are listed and viewed under /prompts. Sends any /decisions URL to
 * the matching /prompts URL, keeping the rest of the path and the query.
 */
export function decisionsRedirectLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  const rest = params["*"];
  const { search } = new URL(request.url);
  return redirect(`/prompts${rest ? `/${rest}` : ""}${search}`);
}
