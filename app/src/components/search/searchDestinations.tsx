import type { RouteNavigationEntry } from "@phoenix/routing/routeNavigation";
import { getRegisteredRouteNavigationCatalog } from "@phoenix/routing/routeNavigation";

export type SearchDestinationSection = {
  title: string;
  destinations: readonly RouteNavigationEntry[];
};

const SECTION_ORDER = ["Pages", "Profile"] as const;

/**
 * Groups destinations derived from the React Router tree for Command-K.
 */
export function getSearchDestinationSections(
  catalog: readonly RouteNavigationEntry[] = getRegisteredRouteNavigationCatalog()
): SearchDestinationSection[] {
  return SECTION_ORDER.map((title) => ({
    title,
    destinations: catalog.filter(
      (destination) => destination.metadata.section === title
    ),
  })).filter((section) => section.destinations.length > 0);
}

export function getMatchingSearchDestinationSections({
  sections = getSearchDestinationSections(),
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
        const { metadata } = destination;
        const isVisible = !metadata.requiresViewer || hasViewer;
        const matchesSearch =
          inputValue.length === 0 ||
          matchesSectionTitle ||
          contains(metadata.label, inputValue) ||
          contains(metadata.description, inputValue);
        return isVisible && matchesSearch;
      });
      return { title: section.title, destinations };
    })
    .filter((section) => section.destinations.length > 0);
}
