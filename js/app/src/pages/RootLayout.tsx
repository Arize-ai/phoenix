import { RouterProvider } from "react-aria-components";
import { Outlet, useHref, useNavigate } from "react-router";

// Match scheme-based (`https:`, `mailto:`) and protocol-relative (`//...`)
// URLs so React Router does not prepend the app basename.
const ABSOLUTE_HREF_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function useRouterHref(href: string) {
  const routerHref = useHref(href);
  return ABSOLUTE_HREF_PATTERN.test(href) ? href : routerHref;
}

export function RootLayout() {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={navigate} useHref={useRouterHref}>
      <Outlet />
    </RouterProvider>
  );
}
