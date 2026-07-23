import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  useIsAdminOrAuthDisabled,
  useIsAuthenticatedAdmin,
  ViewerContext,
  type ViewerContextType,
} from "../ViewerContext";

let container: HTMLDivElement;
let root: Root;
let originalAuthenticationEnabled: boolean;

beforeEach(() => {
  originalAuthenticationEnabled = window.Config.authenticationEnabled;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.Config.authenticationEnabled = originalAuthenticationEnabled;
});

function AuthorizationStatus() {
  const isAdminOrAuthDisabled = useIsAdminOrAuthDisabled();
  const isAuthenticatedAdmin = useIsAuthenticatedAdmin();
  return (
    <output>
      {String(isAdminOrAuthDisabled)}|{String(isAuthenticatedAdmin)}
    </output>
  );
}

function buildViewer(role: string): NonNullable<ViewerContextType["viewer"]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test fixture; the real viewer type carries relay $fragmentSpreads that cannot be constructed here
  return {
    authMethod: "LOCAL",
    email: `${role.toLowerCase()}@localhost`,
    id: role,
    isManagementUser: false,
    profilePictureUrl: null,
    role: { name: role },
    username: role.toLowerCase(),
  } as NonNullable<ViewerContextType["viewer"]>;
}

function renderAuthorizationStatus({
  isAuthenticationEnabled,
  viewer,
}: {
  isAuthenticationEnabled: boolean;
  viewer: ViewerContextType["viewer"];
}) {
  window.Config.authenticationEnabled = isAuthenticationEnabled;
  act(() => {
    root.render(
      <ViewerContext.Provider value={{ viewer, refetchViewer: () => {} }}>
        <AuthorizationStatus />
      </ViewerContext.Provider>
    );
  });
}

describe("viewer authorization hooks", () => {
  it("distinguishes auth-disabled access from an authenticated admin", () => {
    renderAuthorizationStatus({
      isAuthenticationEnabled: false,
      viewer: null,
    });

    expect(container.textContent).toBe("true|false");
  });

  it("recognizes an authenticated admin", () => {
    renderAuthorizationStatus({
      isAuthenticationEnabled: true,
      viewer: buildViewer("ADMIN"),
    });

    expect(container.textContent).toBe("true|true");
  });

  it("does not treat a missing viewer as admin when authentication is enabled", () => {
    renderAuthorizationStatus({
      isAuthenticationEnabled: true,
      viewer: null,
    });

    expect(container.textContent).toBe("false|false");
  });

  it("rejects an authenticated non-admin", () => {
    renderAuthorizationStatus({
      isAuthenticationEnabled: true,
      viewer: buildViewer("MEMBER"),
    });

    expect(container.textContent).toBe("false|false");
  });
});
