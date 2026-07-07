import debounce from "lodash/debounce";
import type { ReactNode } from "react";
import { startTransition, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import {
  CommandPalette,
  CommandPaletteItem,
  CommandPaletteSection,
  Icon,
  Icons,
  MatchText,
  useFilter,
} from "@phoenix/components";
import type {
  RecentlyViewedResource,
  RecentlyViewedResourceType,
} from "@phoenix/store/recentlyViewedStore";
import { useRecentlyViewedStore } from "@phoenix/store/recentlyViewedStore";

import type { GlobalSearchPaletteQuery } from "./__generated__/GlobalSearchPaletteQuery.graphql";

const SEARCH_DEBOUNCE_MS = 200;
const MAX_RECENTLY_VIEWED_SHOWN = 5;

type SearchDestination = {
  path: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

/**
 * Top-level pages reachable from the palette. Mirrors the side navigation.
 */
const DESTINATIONS: SearchDestination[] = [
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

const RESOURCE_ICONS: Record<RecentlyViewedResourceType, React.ReactNode> = {
  project: <Icon svg={<Icons.Trace />} />,
  dataset: <Icon svg={<Icons.Database />} />,
  experiment: <Icon svg={<Icons.Experiment />} />,
  prompt: <Icon svg={<Icons.MessageSquare />} />,
};

export function GlobalSearchPalette({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const navigate = useNavigate();
  const { contains } = useFilter({ sensitivity: "base" });
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const recentlyViewed = useRecentlyViewedStore((state) => state.resources);
  const recordResourceView = useRecentlyViewedStore(
    (state) => state.recordResourceView
  );
  // Stabilize the debounced setter across renders. A fresh debounce() per render
  // would never cancel the prior timer, defeating debouncing and firing one
  // request per keystroke. Matches the shared DebouncedSearch field's approach.
  const debouncedSetSearchQuery = useMemo(
    () =>
      debounce((value: string) => {
        startTransition(() => {
          setSearchQuery(value);
        });
      }, SEARCH_DEBOUNCE_MS),
    []
  );

  const onSelectResource = (resource: RecentlyViewedResource) => {
    recordResourceView(resource);
    onOpenChange(false);
    navigate(resource.path);
  };

  const matchingRecentlyViewed = recentlyViewed
    .filter((resource) => !inputValue || contains(resource.name, inputValue))
    .slice(0, MAX_RECENTLY_VIEWED_SHOWN);
  const matchingDestinations = DESTINATIONS.filter(
    (destination) => !inputValue || contains(destination.label, inputValue)
  );

  return (
    <SearchResultsLoader searchQuery={searchQuery.trim()}>
      {(resultSections) => (
        <CommandPalette
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          aria-label="Search Phoenix"
          placeholder="Search projects, datasets, experiments, prompts…"
          inputValue={inputValue}
          onInputChange={(value) => {
            setInputValue(value);
            debouncedSetSearchQuery(value);
          }}
        >
          {matchingRecentlyViewed.length > 0 && (
            <CommandPaletteSection title="Recently viewed">
              {matchingRecentlyViewed.map((resource) => (
                <CommandPaletteItem
                  key={`recent:${resource.id}`}
                  id={`recent:${resource.id}`}
                  textValue={resource.name}
                  icon={RESOURCE_ICONS[resource.type]}
                  onAction={() => onSelectResource(resource)}
                >
                  <MatchText text={resource.name} match={inputValue} />
                </CommandPaletteItem>
              ))}
            </CommandPaletteSection>
          )}
          {matchingDestinations.length > 0 && (
            <CommandPaletteSection title="Pages">
              {matchingDestinations.map((destination) => (
                <CommandPaletteItem
                  key={`page:${destination.path}`}
                  id={`page:${destination.path}`}
                  textValue={destination.label}
                  icon={destination.icon}
                  description={destination.description}
                  onAction={() => {
                    onOpenChange(false);
                    navigate(destination.path);
                  }}
                >
                  <MatchText text={destination.label} match={inputValue} />
                </CommandPaletteItem>
              ))}
            </CommandPaletteSection>
          )}
          {resultSections
            .filter((section) => section.resources.length > 0)
            .map((section) => (
              <CommandPaletteSection key={section.title} title={section.title}>
                {section.resources.map(({ resource, description }) => (
                  <CommandPaletteItem
                    key={`result:${resource.id}`}
                    id={`result:${resource.id}`}
                    textValue={resource.name}
                    icon={RESOURCE_ICONS[resource.type]}
                    description={
                      description ? (
                        <MatchText text={description} match={inputValue} />
                      ) : undefined
                    }
                    onAction={() => onSelectResource(resource)}
                  >
                    <MatchText text={resource.name} match={inputValue} />
                  </CommandPaletteItem>
                ))}
              </CommandPaletteSection>
            ))}
        </CommandPalette>
      )}
    </SearchResultsLoader>
  );
}

type ResultSection = {
  title: string;
  type: RecentlyViewedResourceType;
  resources: { resource: RecentlyViewedResource; description?: string }[];
};

type SearchResultsChildren = (resultSections: ResultSection[]) => ReactNode;

/**
 * Loads server search results and hands them to `children` as plain data.
 * When the query is empty it skips the network round-trip entirely. The query
 * (which suspends and throws on error) runs here — above CommandPalette rather
 * than inside its menu collection — so React Aria's detached collection render
 * cannot swallow a failure and the ErrorBoundary wrapping the palette catches
 * it, degrading gracefully instead of crashing the app.
 */
function SearchResultsLoader({
  searchQuery,
  children,
}: {
  searchQuery: string;
  children: SearchResultsChildren;
}) {
  if (!searchQuery) {
    return children([]);
  }
  return (
    <SearchResultsData searchQuery={searchQuery}>{children}</SearchResultsData>
  );
}

function SearchResultsData({
  searchQuery,
  children,
}: {
  searchQuery: string;
  children: SearchResultsChildren;
}) {
  const data = useLazyLoadQuery<GlobalSearchPaletteQuery>(
    graphql`
      query GlobalSearchPaletteQuery($searchQuery: String!) {
        searchResources(query: $searchQuery) {
          __typename
          ... on Project {
            id
            name
            description
          }
          ... on Dataset {
            id
            name
            description
          }
          ... on Experiment {
            id
            name
            description
            dataset {
              id
            }
          }
          ... on Prompt {
            id
            promptName: name
            description
          }
        }
      }
    `,
    { searchQuery },
    // Always revalidate: cached results render instantly while fresh results
    // are fetched, so reopening the palette never shows stale entities
    { fetchPolicy: "store-and-network" }
  );

  const resultSections: ResultSection[] = [
    { title: "Projects", type: "project", resources: [] },
    { title: "Datasets", type: "dataset", resources: [] },
    { title: "Experiments", type: "experiment", resources: [] },
    { title: "Prompts", type: "prompt", resources: [] },
  ];
  for (const result of data.searchResources) {
    switch (result.__typename) {
      case "Project":
        resultSections[0].resources.push({
          resource: {
            id: result.id,
            type: "project",
            name: result.name,
            path: `/projects/${result.id}`,
          },
          description: result.description ?? undefined,
        });
        break;
      case "Dataset":
        resultSections[1].resources.push({
          resource: {
            id: result.id,
            type: "dataset",
            name: result.name,
            path: `/datasets/${result.id}`,
          },
          description: result.description ?? undefined,
        });
        break;
      case "Experiment":
        resultSections[2].resources.push({
          resource: {
            id: result.id,
            type: "experiment",
            name: result.name,
            path: `/datasets/${result.dataset.id}/compare?experimentId=${result.id}`,
          },
          description: result.description ?? undefined,
        });
        break;
      case "Prompt":
        resultSections[3].resources.push({
          resource: {
            id: result.id,
            type: "prompt",
            name: result.promptName as string,
            path: `/prompts/${result.id}`,
          },
          description: result.description ?? undefined,
        });
        break;
    }
  }

  return children(resultSections);
}
