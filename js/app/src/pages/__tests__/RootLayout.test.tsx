import { act } from "react";
import { Link } from "react-aria-components";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";

import { RootLayout } from "../RootLayout";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

function NavigationLinks() {
  return (
    <>
      <Link href="/target">Internal link</Link>
      <Link href="https://example.com" target="_blank">
        External link
      </Link>
    </>
  );
}

function CurrentRoute() {
  const { pathname } = useLocation();
  return <output>{pathname}</output>;
}

function createTestRouter() {
  return createMemoryRouter(
    [
      {
        path: "/",
        element: <RootLayout />,
        children: [
          { index: true, element: <NavigationLinks /> },
          { path: "target", element: <CurrentRoute /> },
        ],
      },
    ],
    { basename: "/phoenix", initialEntries: ["/phoenix/"] }
  );
}

describe("RootLayout", () => {
  it("uses React Router for same-origin React Aria links", async () => {
    const router = createTestRouter();

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    const internalLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/phoenix/target"]'
    );
    expect(internalLink).not.toBeNull();

    await act(async () => {
      internalLink?.click();
    });

    expect(container.querySelector("output")?.textContent).toBe("/target");
  });

  it("leaves targeted external links to native navigation", async () => {
    const router = createTestRouter();

    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });
    const navigate = vi.spyOn(router, "navigate");
    const externalLink = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com"]'
    );
    expect(externalLink).not.toBeNull();
    expect(externalLink?.target).toBe("_blank");

    await act(async () => {
      externalLink?.click();
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/phoenix/");
  });
});
