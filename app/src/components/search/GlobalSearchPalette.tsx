import debounce from "lodash/debounce";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
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
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { RouteNavigationIcon } from "@phoenix/routing/RouteNavigationIcon";
import type {
  RecentlyViewedResource,
  RecentlyViewedResourceType,
} from "@phoenix/store/recentlyViewedStore";
import { useRecentlyViewedStore } from "@phoenix/store/recentlyViewedStore";

import type { GlobalSearchPaletteQuery } from "./__generated__/GlobalSearchPaletteQuery.graphql";
import { getMatchingSearchDestinationSections } from "./searchDestinations";

const SEARCH_DEBOUNCE_MS = 200;
const MAX_RECENTLY_VIEWED_SHOWN = 5;

const RESOURCE_ICONS: Record<RecentlyViewedResourceType, ReactNode> = {
  project: <Icon svg={<Icons.Trace />} />,
  dataset: <Icon svg={<Icons.Database />} />,
  experiment: <Icon svg={<Icons.Experiment />} />,
  prompt: <Icon svg={<Icons.MessageSquare />} />,
};

/**
 * Search result sections, in the order they render. Results are collected into
 * a map keyed by resource type and flattened against this list at render time,
 * so no code depends on a section's position in an array.
 */
const RESULT_SECTIONS: { title: string; type: RecentlyViewedResourceType }[] = [
  { title: "Projects", type: "project" },
  { title: "Datasets", type: "dataset" },
  { title: "Experiments", type: "experiment" },
  { title: "Prompts", type: "prompt" },
];

export function GlobalSearchPalette({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const navigate = useNavigate();
  const { viewer } = useViewer();
  const { contains, startsWith } = useFilter({ sensitivity: "base" });
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // The results query suspends, so drive it through a transition: React keeps
  // the prior results mounted while the next batch loads instead of throwing to
  // the Suspense fallback (which would blank the palette). isPending dims the
  // results while that refresh is in flight.
  const [isPending, startTransition] = useTransition();
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
    [startTransition]
  );

  const onSelectResource = (resource: RecentlyViewedResource) => {
    recordResourceView(resource);
    onOpenChange(false);
    navigate(resource.path);
  };

  const matchingRecentlyViewed = recentlyViewed
    .filter((resource) => !inputValue || contains(resource.name, inputValue))
    .slice(0, MAX_RECENTLY_VIEWED_SHOWN);
  const matchingDestinationSections = getMatchingSearchDestinationSections({
    inputValue,
    contains,
    startsWith,
    hasViewer: viewer !== null,
  });

  return (
    <SearchResultsLoader searchQuery={searchQuery.trim()}>
      {(resultsByType) => (
        <CommandPalette
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          aria-label="Search Phoenix"
          placeholder="Search pages, projects, datasets, experiments, prompts…"
          inputValue={inputValue}
          isPending={isPending}
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
                  description={resource.description}
                  onAction={() => onSelectResource(resource)}
                >
                  <MatchText text={resource.name} match={inputValue} />
                </CommandPaletteItem>
              ))}
            </CommandPaletteSection>
          )}
          {matchingDestinationSections.map((section) => (
            <CommandPaletteSection key={section.title} title={section.title}>
              {section.destinations.map((destination) => (
                <CommandPaletteItem
                  key={`page:${destination.path}`}
                  id={`page:${destination.path}`}
                  textValue={destination.metadata.label}
                  icon={
                    <RouteNavigationIcon icon={destination.metadata.icon} />
                  }
                  description={destination.metadata.description}
                  onAction={() => {
                    onOpenChange(false);
                    navigate(destination.path);
                  }}
                >
                  <MatchText
                    text={destination.metadata.label}
                    match={inputValue}
                  />
                </CommandPaletteItem>
              ))}
            </CommandPaletteSection>
          ))}
          {RESULT_SECTIONS.map((section) => {
            const entries = resultsByType.get(section.type) ?? [];
            if (entries.length === 0) {
              return null;
            }
            return (
              <CommandPaletteSection key={section.type} title={section.title}>
                {entries.map((resource) => (
                  <CommandPaletteItem
                    key={`result:${resource.id}`}
                    id={`result:${resource.id}`}
                    textValue={resource.name}
                    icon={RESOURCE_ICONS[resource.type]}
                    description={
                      resource.description ? (
                        <MatchText
                          text={resource.description}
                          match={inputValue}
                        />
                      ) : undefined
                    }
                    onAction={() => onSelectResource(resource)}
                  >
                    <MatchText text={resource.name} match={inputValue} />
                  </CommandPaletteItem>
                ))}
              </CommandPaletteSection>
            );
          })}
        </CommandPalette>
      )}
    </SearchResultsLoader>
  );
}

/**
 * Search results grouped by resource type. Consumers flatten this against
 * {@link RESULT_SECTIONS} to render sections in a stable order. Entries are
 * full {@link RecentlyViewedResource}s (description included) so selecting one
 * records it into the recently viewed store losslessly.
 */
type SearchResultsByType = Map<
  RecentlyViewedResourceType,
  RecentlyViewedResource[]
>;

type SearchResultsChildren = (results: SearchResultsByType) => ReactNode;

/**
 * Loads server search results and hands them to `children` as plain data.
 *
 * The query (which suspends and throws on error) runs here — above
 * CommandPalette rather than inside its menu collection — so React Aria's
 * detached collection render cannot swallow a failure and the ErrorBoundary
 * wrapping the palette catches it, degrading gracefully instead of crashing.
 *
 * Crucially this component is rendered unconditionally regardless of whether
 * there is a query: it always calls the same hook at the same tree position and
 * always renders `children` at the same depth. That stability is what keeps the
 * CommandPalette (and its modal overlay) mounted across the empty↔non-empty
 * boundary — swapping element types there would remount the modal and flash the
 * backdrop. When the query is empty we read `store-only` so no network request
 * is made and the hook never suspends.
 */
function SearchResultsLoader({
  searchQuery,
  children,
}: {
  searchQuery: string;
  children: SearchResultsChildren;
}) {
  const hasQuery = searchQuery.length > 0;
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
    // With a query: always revalidate so cached results render instantly while
    // fresh results are fetched, and reopening never shows stale entities.
    // Without a query: `store-only` reads whatever is cached without a network
    // request, so the hook resolves synchronously and never suspends — keeping
    // the palette mounted and responsive before the user types anything.
    { fetchPolicy: hasQuery ? "store-and-network" : "store-only" }
  );

  const resultsByType: SearchResultsByType = new Map();
  if (!hasQuery) {
    return children(resultsByType);
  }
  const addEntry = (resource: RecentlyViewedResource) => {
    const entries = resultsByType.get(resource.type);
    if (entries) {
      entries.push(resource);
    } else {
      resultsByType.set(resource.type, [resource]);
    }
  };
  for (const result of data.searchResources) {
    switch (result.__typename) {
      case "Project":
        addEntry({
          id: result.id,
          type: "project",
          name: result.name,
          description: result.description ?? undefined,
          path: `/projects/${result.id}`,
        });
        break;
      case "Dataset":
        addEntry({
          id: result.id,
          type: "dataset",
          name: result.name,
          description: result.description ?? undefined,
          path: `/datasets/${result.id}`,
        });
        break;
      case "Experiment":
        addEntry({
          id: result.id,
          type: "experiment",
          name: result.name,
          description: result.description ?? undefined,
          path: `/datasets/${result.dataset.id}/compare?experimentId=${result.id}`,
        });
        break;
      case "Prompt":
        addEntry({
          id: result.id,
          type: "prompt",
          name: result.promptName as string,
          description: result.description ?? undefined,
          path: `/prompts/${result.id}`,
        });
        break;
    }
  }

  return children(resultsByType);
}
