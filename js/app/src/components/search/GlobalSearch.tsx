import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Pressable, VisuallyHidden } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import {
  ErrorBoundary,
  Icon,
  Icons,
  KeyboardToken,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { navLinkCSS } from "@phoenix/components/nav/Navbar";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

import { GlobalSearchPalette } from "./GlobalSearchPalette";
import { RecentlyViewedTracker } from "./RecentlyViewedTracker";

const SEARCH_HOTKEY = "mod+k";

const searchButtonCSS = css`
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;

  .keyboard-token {
    // Match the trailing counter geometry (Navbar's .counter) so the ⌘K
    // hint right-aligns with the numeric counts on sibling nav items: same
    // trailing margin and same horizontal padding.
    margin-inline-end: var(--global-dimension-size-100);
    padding-inline: var(--global-dimension-size-50);
  }
`;

/**
 * The global search affordance: a search entry in the side navigation plus
 * the ⌘K keyboard shortcut, opening a command palette that searches
 * projects, datasets, experiments, prompts, pages, and recently viewed
 * resources.
 */
export function GlobalSearch({ isExpanded }: { isExpanded: boolean }) {
  const [isOpen, setOpen] = useState(false);
  const modifierKey = useModifierKey();
  const modifierGlyph = modifierKey === "Cmd" ? "⌘" : "Ctrl";

  useHotkeys(
    SEARCH_HOTKEY,
    (event) => {
      event.preventDefault();
      setOpen((isCurrentlyOpen) => !isCurrentlyOpen);
    },
    { preventDefault: true, enableOnFormTags: true },
    [setOpen]
  );

  return (
    <>
      <RecentlyViewedTracker />
      <TooltipTrigger delay={0} isDisabled={isExpanded}>
        <Pressable>
          <button
            css={css(navLinkCSS, searchButtonCSS)}
            onClick={() => setOpen(true)}
            data-testid="global-search-trigger"
          >
            <Icon svg={<Icons.Search />} />
            <Text>Search</Text>
            <KeyboardToken variant="quiet" className="keyboard-token">
              <VisuallyHidden>{modifierKey}</VisuallyHidden>
              <span aria-hidden="true">{modifierGlyph}</span>K
            </KeyboardToken>
          </button>
        </Pressable>
        <Tooltip placement="right" offset={10}>
          Search
        </Tooltip>
      </TooltipTrigger>
      {isOpen && (
        // The ErrorBoundary remounts each time the palette opens (keyed on
        // isOpen), so a failed search resets on the next open. A null fallback
        // simply closes the palette rather than crashing the surrounding app.
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <GlobalSearchPalette isOpen={isOpen} onOpenChange={setOpen} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
