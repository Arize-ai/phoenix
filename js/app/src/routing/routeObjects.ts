import type { RouteObject } from "react-router";

export type FlattenedRouteObject = {
  path: string;
  route: RouteObject;
};

/**
 * Converts React Router paths into comparable root-relative patterns.
 */
export function normalizePath(path: string): string {
  if (path === "") {
    return "/";
  }
  const pathWithLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return pathWithLeadingSlash.length > 1
    ? pathWithLeadingSlash.replace(/\/+$/, "")
    : pathWithLeadingSlash;
}

function joinRoutePath({
  parentPath,
  routePath,
  isIndexRoute,
}: {
  parentPath: string;
  routePath: string | undefined;
  isIndexRoute: boolean | undefined;
}): string {
  if (isIndexRoute || routePath == null) {
    return parentPath;
  }
  if (routePath.startsWith("/")) {
    return normalizePath(routePath);
  }
  return normalizePath(
    parentPath === "/" ? `/${routePath}` : `${parentPath}/${routePath}`
  );
}

/**
 * Flattens a React Router tree while preserving its declaration order.
 */
export function flattenRouteObjects(
  routes: RouteObject[]
): FlattenedRouteObject[] {
  const flattenedRoutes: FlattenedRouteObject[] = [];

  const visit = (route: RouteObject, parentPath: string) => {
    const path = joinRoutePath({
      parentPath,
      routePath: route.path,
      isIndexRoute: route.index,
    });
    flattenedRoutes.push({ path, route });
    route.children?.forEach((childRoute) => visit(childRoute, path));
  };

  routes.forEach((route) => visit(route, "/"));
  return flattenedRoutes;
}
