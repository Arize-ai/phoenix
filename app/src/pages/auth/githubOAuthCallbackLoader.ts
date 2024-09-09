// import { redirect } from "react-router";
import { LoaderFunctionArgs } from "react-router-dom";

export async function githubOAuthCallbackLoader(args: LoaderFunctionArgs) {
  const queryParameters = new URL(args.request.url).searchParams;
  const authorizationCode = queryParameters.get("code");
  if (authorizationCode == undefined) {
    // todo: display error message
    return null;
  }
  try {
    const response = await fetch("/auth/github-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: authorizationCode }),
    });
    if (!response.ok) {
      // todo: parse response body and display error message
      return null;
    }
  } catch (error) {
    // todo: display error
  }
  // redirect("/");
  return null;
}
