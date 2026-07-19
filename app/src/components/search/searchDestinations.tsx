import type { ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components";
import { PROFILE_ROUTES } from "@phoenix/pages/profile/profileRoutes";

export type SearchDestination = {
  path: string;
  label: string;
  description: string;
  icon: ReactNode;
  requiresViewer?: boolean;
};

export type SearchDestinationSection = {
  title: string;
  destinations: readonly SearchDestination[];
};

const PAGE_DESTINATIONS: readonly SearchDestination[] = [
  {
    path: "/projects",
    label: "Tracing",
    description: "Projects, traces, and spans",
    icon: <Icon svg={<Icons.Trace />} />,
  },
  {
    path: "/dashboards",
    label: "Dashboards",
    description: "Monitor projects and metrics",
    icon: <Icon svg={<Icons.Grid />} />,
  },
  {
    path: "/datasets",
    label: "Datasets & Experiments",
    description: "Curate data and run experiments",
    icon: <Icon svg={<Icons.Database />} />,
  },
  {
    path: "/playground",
    label: "Playground",
    description: "Experiment with prompts and models",
    icon: <Icon svg={<Icons.PlayCircle />} />,
  },
  {
    path: "/evaluators",
    label: "Evaluators",
    description: "Evaluate application output",
    icon: <Icon svg={<Icons.Scale />} />,
  },
  {
    path: "/prompts",
    label: "Prompts",
    description: "Manage and version prompts",
    icon: <Icon svg={<Icons.MessageSquare />} />,
  },
  {
    path: "/apis/rest",
    label: "REST API",
    description: "REST API reference",
    icon: <Icon svg={<Icons.Code />} />,
  },
  {
    path: "/apis/graphql",
    label: "GraphQL",
    description: "GraphQL API explorer",
    icon: <Icon svg={<Icons.GraphQL />} />,
  },
  {
    path: "/settings/general",
    label: "Settings",
    description: "Platform configuration",
    icon: <Icon svg={<Icons.Options />} />,
  },
];

export const PROFILE_DESTINATIONS: readonly SearchDestination[] = [
  {
    path: PROFILE_ROUTES.account.path,
    label: PROFILE_ROUTES.account.tabLabel,
    description: PROFILE_ROUTES.account.paletteDescription,
    icon: <Icon svg={<Icons.Person />} />,
    requiresViewer: true,
  },
  {
    path: PROFILE_ROUTES["api-keys"].path,
    label: PROFILE_ROUTES["api-keys"].tabLabel,
    description: PROFILE_ROUTES["api-keys"].paletteDescription,
    icon: <Icon svg={<Icons.Key />} />,
    requiresViewer: true,
  },
  {
    path: PROFILE_ROUTES.apps.path,
    label: PROFILE_ROUTES.apps.tabLabel,
    description: PROFILE_ROUTES.apps.paletteDescription,
    icon: <Icon svg={<Icons.Link2 />} />,
    requiresViewer: true,
  },
  {
    path: PROFILE_ROUTES.preferences.path,
    label: PROFILE_ROUTES.preferences.tabLabel,
    description: PROFILE_ROUTES.preferences.paletteDescription,
    icon: <Icon svg={<Icons.Options />} />,
  },
];

export const SEARCH_DESTINATION_SECTIONS: readonly SearchDestinationSection[] =
  [
    { title: "Pages", destinations: PAGE_DESTINATIONS },
    { title: "Profile", destinations: PROFILE_DESTINATIONS },
  ];

export function getMatchingSearchDestinationSections({
  sections = SEARCH_DESTINATION_SECTIONS,
  inputValue,
  contains,
  hasViewer,
}: {
  sections?: readonly SearchDestinationSection[];
  inputValue: string;
  contains: (value: string, substring: string) => boolean;
  hasViewer: boolean;
}): SearchDestinationSection[] {
  return sections
    .map((section) => {
      const matchesSectionTitle =
        inputValue.length > 0 && contains(section.title, inputValue);
      const destinations = section.destinations.filter((destination) => {
        const isVisible = !destination.requiresViewer || hasViewer;
        const matchesSearch =
          inputValue.length === 0 ||
          matchesSectionTitle ||
          contains(destination.label, inputValue) ||
          contains(destination.description, inputValue);
        return isVisible && matchesSearch;
      });
      return { title: section.title, destinations };
    })
    .filter((section) => section.destinations.length > 0);
}
