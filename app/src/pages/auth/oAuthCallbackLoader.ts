// import { redirect } from "react-router";
import { LoaderFunctionArgs } from "react-router-dom";

export async function oAuthCallbackLoader(args: LoaderFunctionArgs) {
  const queryParameters = new URL(args.request.url).searchParams;
  const authorizationCode = queryParameters.get("code");
  const state = queryParameters.get("state");
  const actualState = sessionStorage.getItem("oAuthState");
  sessionStorage.removeItem("oAuthState");
  if (
    authorizationCode == undefined ||
    state == undefined ||
    actualState == undefined ||
    state !== actualState
  ) {
    // todo: display error message
    return null;
  }
  const origin = new URL(window.location.href).origin;
  const redirectUri = `${origin}/oauth-callback`;
  try {
    const response = await fetch("/auth/oauth-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authorization_code: authorizationCode,
        redirect_uri: redirectUri,
      }),
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
