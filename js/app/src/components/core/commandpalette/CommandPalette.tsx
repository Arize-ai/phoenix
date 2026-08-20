import { css } from "@emotion/react";
import type { ReactNode } from "react";
import type {
  AutocompleteProps as AriaAutocompleteProps,
  Key,
} from "react-aria-components";
import {
  Autocomplete,
  Header,
  Input,
  MenuSection,
} from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { Dialog } from "@phoenix/components/core/dialog";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchField, SearchIcon } from "@phoenix/components/core/field";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { KeyboardToken } from "@phoenix/components/core/KeyboardToken";
import { Menu } from "@phoenix/components/core/menu";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay";

const commandPaletteModalCSS = css`
  /* Pin the palette near the top of the viewport instead of centering it so
     the list can grow and shrink without the dialog jumping around */
  &&[data-variant="default"] .react-aria-Dialog {
    top: 15vh;
    transform: translate(-50%, 0);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`;

const commandPaletteCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 0;

  .command-palette__field {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: none;
    gap: var(--global-dimension-size-100);
    padding-right: var(--global-dimension-size-100);
    border-bottom: 1px solid var(--global-border-color-default);

    .search-field {
      flex: 1 1 auto;
    }

    .react-aria-Input {
      font-size: var(--global-font-size-m);
      height: var(--global-dimension-size-550);
    }
  }

  .command-palette__menu {
    max-height: 50vh;
    overflow-y: auto;
    /* Fade results in/out as they settle so a new search transition reads as a
       smooth update rather than a hard swap. */
    transition: opacity 0.15s ease;
  }

  .command-palette__menu[data-empty] {
    /* When the menu is empty React Aria collapses it around the empty state;
       stretch it so the empty state can fill the available width instead of
       centering a collapsed box that gets clipped at the top and bottom. */
    align-items: stretch;
    padding: 0;
  }

  &[data-pending="true"] .command-palette__menu {
    /* While a search transition is in flight React keeps the prior results
       mounted (see startTransition in GlobalSearchPalette); dim them slightly
       to signal the refresh without unmounting anything. */
    opacity: 0.5;
  }

  .command-palette__section:not(:first-child) {
    margin-top: var(--global-dimension-size-100);
  }

  .command-palette__section-header {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .command-palette__footer {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: none;
    gap: var(--global-dimension-size-200);
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    border-top: 1px solid var(--global-border-color-default);
  }

  .command-palette__hint {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
  }

  .command-palette__empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: var(--global-dimension-size-1600);
    box-sizing: border-box;
  }
`;

export interface CommandPaletteProps {
  /**
   * Whether the command palette is open
   */
  isOpen: boolean;
  /**
   * Handler called when the open state changes (e.g. Escape, backdrop click)
   */
  onOpenChange: (isOpen: boolean) => void;
  /**
   * The search input value (controlled)
   */
  inputValue?: string;
  /**
   * Handler called when the search input value changes
   */
  onInputChange?: (value: string) => void;
  /**
   * An optional filter applied to the menu items based on the input value.
   * Omit when the items are already filtered (e.g. server-side search).
   */
  filter?: AriaAutocompleteProps<object>["filter"];
  /**
   * Placeholder text for the search input
   * @default "Search…"
   */
  placeholder?: string;
  /**
   * Accessible label for the palette
   * @default "Command palette"
   */
  "aria-label"?: string;
  /**
   * Handler called when a menu item without its own handler is actioned
   */
  onAction?: (key: Key) => void;
  /**
   * Menu contents: CommandPaletteSection / CommandPaletteItem elements
   */
  children: ReactNode;
  /**
   * Content rendered when no items match. Receives no arguments; close over
   * the input value for a contextual message.
   */
  renderEmptyState?: () => ReactNode;
  /**
   * Footer content. Defaults to keyboard navigation hints.
   */
  footer?: ReactNode;
  /**
   * Whether a search/results refresh is in flight. When true the results are
   * dimmed to signal the pending update while the prior results stay mounted.
   */
  isPending?: boolean;
}

/**
 * A command palette (⌘K style) dialog: a search input wired to a menu of
 * commands or search results via React Aria's Autocomplete, giving virtual
 * focus — arrow keys move through results while focus stays in the input —
 * along with Enter to select and Escape to dismiss.
 */
export function CommandPalette({
  isOpen,
  onOpenChange,
  inputValue,
  onInputChange,
  filter,
  placeholder = "Search…",
  "aria-label": ariaLabel = "Command palette",
  onAction,
  children,
  renderEmptyState,
  footer,
  isPending,
}: CommandPaletteProps) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal size="M" css={commandPaletteModalCSS}>
        <Dialog
          aria-label={ariaLabel}
          className="command-palette"
          css={commandPaletteCSS}
          data-pending={isPending ? "true" : undefined}
        >
          <Autocomplete
            inputValue={inputValue}
            onInputChange={onInputChange}
            filter={filter}
          >
            <div className="command-palette__field">
              <SearchField
                aria-label={ariaLabel}
                variant="quiet"
                size="L"
                autoFocus
              >
                <SearchIcon />
                <Input placeholder={placeholder} />
              </SearchField>
            </div>
            <Menu
              className="command-palette__menu"
              aria-label={ariaLabel}
              onAction={onAction}
              renderEmptyState={() => (
                <div className="command-palette__empty-state">
                  {renderEmptyState ? (
                    renderEmptyState()
                  ) : (
                    // CompactEmptyState reads the Autocomplete's live query
                    // from context, so a non-empty search renders the search
                    // icon + "No results" automatically.
                    <CompactEmptyState
                      icon={<Icon svg={<Icons.Search />} />}
                      description="No results"
                    />
                  )}
                </div>
              )}
            >
              {children}
            </Menu>
            <div className="command-palette__footer">
              {footer ?? <CommandPaletteHints />}
            </div>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CommandPaletteHints() {
  return (
    <>
      <span className="command-palette__hint">
        <KeyboardToken>↑↓</KeyboardToken>
        <Text size="XS" color="text-500">
          to navigate
        </Text>
      </span>
      <span className="command-palette__hint">
        <KeyboardToken>↵</KeyboardToken>
        <Text size="XS" color="text-500">
          to select
        </Text>
      </span>
      <span className="command-palette__hint">
        <KeyboardToken>esc</KeyboardToken>
        <Text size="XS" color="text-500">
          to close
        </Text>
      </span>
    </>
  );
}

export interface CommandPaletteSectionProps {
  /**
   * The section heading, e.g. "Recently viewed"
   */
  title: string;
  children: ReactNode;
}

/**
 * A titled group of command palette items. Sections whose items are all
 * filtered out are hidden automatically.
 */
export function CommandPaletteSection({
  title,
  children,
}: CommandPaletteSectionProps) {
  return (
    <MenuSection className="command-palette__section">
      <Header className="command-palette__section-header">{title}</Header>
      {children}
    </MenuSection>
  );
}
