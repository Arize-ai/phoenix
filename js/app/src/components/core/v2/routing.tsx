import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { useHref, useNavigate } from "react-router";

/**
 * Routes React Aria links (`href` on a Tag or a TagGroup item) through the
 * app's router, so they navigate client-side while keeping real `<a>`
 * semantics: open in a new tab, copy link, middle-click.
 */
export function FamilyRouterProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <RouterProvider navigate={(href) => navigate(href)} useHref={useHref}>
      {children}
    </RouterProvider>
  );
}
