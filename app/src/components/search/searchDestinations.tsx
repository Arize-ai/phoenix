import type { RouteNavigationEntry } from "@phoenix/routing/routeNavigation";
import {
  getRegisteredRouteNavigationCatalog,
  isRouteNavigationEntryVisible,
  routeNavigationSections,
} from "@phoenix/routing/routeNavigation";

export type SearchDestinationSection = {
  title: string;
  destinations: readonly RouteNavigationEntry[];
};

/**
 * Groups destinations derived from the React Router tree for Command-K.
 */
export function getSearchDestinationSections(
  catalog: readonly RouteNavigationEntry[] = getRegisteredRouteNavigationCatalog()
): SearchDestinationSection[] {
  return routeNavigationSections
    .map((title) => ({
      title,
      destinations: catalog.filter(
        (destination) => destination.metadata.section === title
      ),
    }))
    .filter((section) => section.destinations.length > 0);
}

export function getMatchingSearchDestinationSections({
  sections = getSearchDestinationSections(),
  inputValue,
  contains,
  startsWith,
  hasViewer,
}: {
  sections?: readonly SearchDestinationSection[];
  inputValue: string;
  contains: (value: string, substring: string) => boolean;
  startsWith: (value: string, substring: string) => boolean;
  hasViewer: boolean;
}): SearchDestinationSection[] {
  return sections
    .map((section) => {
      // A section-title match surfaces the whole section (e.g. "profile"
      // shows every Profile destination), so it is prefix-only — otherwise
      // incidental substrings like "file" in "Profile" would match too.
      const matchesSectionTitle =
        inputValue.length > 0 && startsWith(section.title, inputValue);
      const destinations = section.destinations.filter((destination) => {
        const { metadata } = destination;
        const isVisible = isRouteNavigationEntryVisible({
          entry: destination,
          hasViewer,
        });
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
