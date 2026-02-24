import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/**
 * Home route loader: redirects to projects.
 */
export async function homeLoader(_args: LoaderFunctionArgs) {
  return redirect("/projects");
}
