import type { ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components";

import type { RouteNavigationMetadata } from "./routeNavigation";

const ROUTE_NAVIGATION_ICONS: Record<
  RouteNavigationMetadata["icon"],
  ReactNode
> = {
  Code: <Icons.Code />,
  Database: <Icons.Database />,
  GraphQL: <Icons.GraphQL />,
  Grid: <Icons.Grid />,
  Key: <Icons.Key />,
  Link2: <Icons.Link2 />,
  MessageSquare: <Icons.MessageSquare />,
  Options: <Icons.Options />,
  Person: <Icons.Person />,
  PlayCircle: <Icons.PlayCircle />,
  Scale: <Icons.Scale />,
  Trace: <Icons.Trace />,
};

export function RouteNavigationIcon({
  icon,
}: {
  icon: RouteNavigationMetadata["icon"];
}) {
  return <Icon svg={ROUTE_NAVIGATION_ICONS[icon]} />;
}
