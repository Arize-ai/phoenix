import { LoaderFunctionArgs, redirect } from "react-router";

/**
 * Home route loader: redirects to projects.
 */
export async function homeLoader(_args: LoaderFunctionArgs) {
  return redirect("/projects");
}
