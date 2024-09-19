import React, { ReactNode } from "react";
import { css } from "@emotion/react";

import { Button } from "@arizeai/components";

type OAuth2LoginProps = {
  idpName: string;
  idpDisplayName: string;
  returnUrl?: string | null;
};

const loginCSS = css`
  button {
    width: 100%;
  }
  i {
    display: block;
    width: 20px;
    height: 20px;
    padding-right: var(--ac-global-dimension-size-50);
  }
  &[data-provider^="aws"],
  &[data-provider^="google"] {
    button {
      background-color: white;
      color: black;
      &:hover {
        background-color: #ececec !important;
      }
    }
  }
`;

export function OAuth2Login({
  idpName,
  idpDisplayName,
  returnUrl,
}: OAuth2LoginProps) {
  return (
    <form
      action={`/oauth2/${idpName}/login${returnUrl ? `?returnUrl=${returnUrl}` : ""}`}
      method="post"
      css={loginCSS}
      data-provider={idpName}
    >
      <Button
        variant="default"
        type="submit"
        icon={<IDPIcon idpName={idpName} />}
      >
        Login with {idpDisplayName}
      </Button>
    </form>
  );
}

function IDPIcon({ idpName }: { idpName: string }): ReactNode {
  const hasIcon =
    idpName === "github" ||
    idpName === "google" ||
    idpName === "microsoft_entra_id" ||
    idpName.startsWith("aws");
  if (!hasIcon) {
    return null;
  }
  return (
    <i>
      <div
        css={css`
          display: inline-block;
          width: 20px;
          height: 20px;
          position: relative;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: 50%;
          &[data-provider^="github"] {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0C4.477 0 0 4.36 0 9.74c0 4.304 2.865 7.955 6.839 9.243.5.09.682-.211.682-.47 0-.23-.008-.843-.013-1.656-2.782.588-3.369-1.306-3.369-1.306-.454-1.125-1.11-1.425-1.11-1.425-.908-.604.069-.592.069-.592 1.003.069 1.531 1.004 1.531 1.004.892 1.488 2.341 1.059 2.91.81.092-.63.35-1.06.636-1.303-2.22-.245-4.555-1.081-4.555-4.814 0-1.063.39-1.933 1.029-2.613-.103-.247-.446-1.238.098-2.578 0 0 .84-.262 2.75.998A9.818 9.818 0 0 1 10 4.71c.85.004 1.705.112 2.504.328 1.909-1.26 2.747-.998 2.747-.998.546 1.34.203 2.331.1 2.578.64.68 1.028 1.55 1.028 2.613 0 3.742-2.339 4.566-4.566 4.807.359.3.678.895.678 1.804 0 1.301-.012 2.352-.012 2.671 0 .261.18.564.688.47C17.137 17.69 20 14.042 20 9.74 20 4.36 15.522 0 10 0z' fill='%23161514' fill-rule='evenodd'/%3E%3C/svg%3E");
          }

          &[data-provider^="google"] {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 48 48'%3E%3Cdefs%3E%3Cpath id='a' d='M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z'/%3E%3C/defs%3E%3CclipPath id='b'%3E%3Cuse xlink:href='%23a' overflow='visible'/%3E%3C/clipPath%3E%3Cpath clip-path='url(%23b)' fill='%23FBBC05' d='M0 37V11l17 13z'/%3E%3Cpath clip-path='url(%23b)' fill='%23EA4335' d='M0 11l17 13 7-6.1L48 14V0H0z'/%3E%3Cpath clip-path='url(%23b)' fill='%2334A853' d='M0 37l30-23 7.9 1L48 0v48H0z'/%3E%3Cpath clip-path='url(%23b)' fill='%234285F4' d='M48 48L17 24l-4-3 35-10z'/%3E%3C/svg%3E");
          }
          &[data-provider^="microsoft"] {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='21' height='21'%3E%3Cpath fill='%23f25022' d='M1 1h9v9H1z'/%3E%3Cpath fill='%2300a4ef' d='M1 11h9v9H1z'/%3E%3Cpath fill='%237fba00' d='M11 1h9v9h-9z'/%3E%3Cpath fill='%23ffb900' d='M11 11h9v9h-9z'/%3E%3C/svg%3E");
          }
          &[data-provider^="aws"] {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg width='400' height='334' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M236.578 94.824c-9.683.765-20.854 1.502-32.021 3.006-17.12 2.211-34.24 5.219-48.386 11.907-27.544 11.208-46.163 35.053-46.163 70.114 0 44.018 28.298 66.354 64.026 66.354 11.93 0 21.606-1.466 30.522-3.71 14.156-4.481 26.07-12.67 40.209-27.596 8.192 11.205 10.413 16.428 24.575 28.338 3.725 1.502 7.448 1.502 10.413-.742 8.932-7.458 24.561-20.873 32.773-28.33 3.71-3.012 2.955-7.463.739-11.204-8.198-10.435-16.381-19.401-16.381-39.506V96.324c0-28.359 2.214-54.453-18.614-73.822C261.147 6.815 234.34.86 213.5.86h-8.947c-37.965 2.247-78.169 18.635-87.122 65.629-1.462 5.955 3.012 8.198 5.989 8.962l41.677 5.224c4.471-.773 6.691-4.491 7.432-8.233 3.74-16.388 17.136-24.583 32.024-26.087h2.998c8.905 0 18.586 3.743 23.813 11.168 5.932 8.965 5.21 20.904 5.21 31.339v5.961h.004v.001zm0 43.278c0 17.162.723 30.571-8.195 45.461-5.208 10.437-14.141 17.154-23.827 19.4-1.481 0-3.698.766-5.947.766-16.371 0-26.077-12.673-26.077-31.334 0-23.856 14.159-35.056 32.023-40.277 9.687-2.241 20.86-2.982 32.021-2.982v8.966h.002z'/%3E%3Cpath d='M373.71 315.303c18.201-15.398 25.89-43.349 26.29-57.939v-2.44c0-3.255-.803-5.661-1.6-6.88-3.646-4.445-30.369-8.523-53.402-1.627-6.468 2.045-12.146 4.865-17.396 8.507-4.051 2.854-3.238 6.464.802 6.08 4.447-.823 10.126-1.208 16.594-2.048 14.159-1.18 30.742-1.592 34.784 3.662 5.642 6.87-6.468 36.868-11.749 49.838-1.593 4.065 2.03 5.696 5.677 2.847z' fill='%23FE9900'/%3E%3Cpath d='M2.008 257.364c52.17 47.404 120.925 75.775 197.791 75.775 47.725 0 102.727-13.381 145.199-38.899 5.676-3.27 11.316-6.912 16.565-10.952 7.286-5.25.817-13.38-6.463-10.147-3.229 1.215-6.873 2.857-10.103 4.066-46.539 18.248-95.441 26.76-140.762 26.76-72.008 0-141.56-19.87-197.786-52.684-5.259-2.822-8.907 2.428-4.441 6.081z' fill='%23FE9900'/%3E%3C/svg%3E");
          }
        `}
        data-provider={idpName}
      />
    </i>
  );
}
