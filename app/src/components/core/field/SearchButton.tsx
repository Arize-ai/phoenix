import { css } from "@emotion/react";
import type { CSSProperties } from "react";
import { useRef } from "react";
import { Button, Input } from "react-aria-components";

import type { DebouncedSearchProps } from "./DebouncedSearch";
import type { SearchFieldProps } from "./SearchField";
import { SearchField, SearchIcon } from "./SearchField";
import { useDebouncedChange } from "./useDebouncedChange";

export interface SearchButtonProps
  extends Omit<DebouncedSearchProps, "size" | "variant" | "children"> {
  /**
   * CSS width of the expanded field
   * @default var(--global-dimension-size-3000)
   */
  expandedWidth?: string;
  /**
   * The chrome of the collapsed button, matching the `Button` vocabulary.
   * - "default": bordered, like the default `Button` — for toolbars whose
   *   other controls are bordered buttons.
   * - "quiet": borderless, like an `IconButton`.
   * The expanded field looks the same either way.
   * @default "default"
   */
  variant?: "default" | "quiet";
  /**
   * What opens the collapsed field.
   * - "focus": the field itself is the tab stop and expands whenever it gains
   *   focus — including as Tab passes through on the way somewhere else.
   * - "press": the collapsed control is a real icon-only button. Tabbing rests
   *   on the button without opening anything; pressing it opens the field, and
   *   Escape from an empty field returns focus to the button.
   * @default "focus"
   */
  trigger?: "focus" | "press";
}

const searchButtonCSS = css`
  --search-button-collapsed-size: var(--global-button-height-s);
  position: relative;
  width: var(--search-button-expanded-width, var(--global-dimension-size-3000));
  transition: width 0.2s ease-in-out;

  // the shared field min-width would stop the input shrinking to the square
  .search-field .react-aria-Input {
    min-width: 0;
  }

  .search-field .search-field__icon {
    transition: left 0.2s ease-in-out, font-size 0.2s ease-in-out,
      color 0.2s ease-in-out, opacity 0.2s ease-in-out;
    // clicks on the icon fall through to the input beneath, so the collapsed
    // square is one hit target
    pointer-events: none;
  }

  // the placeholder fades in slightly after the field starts widening so its
  // text is never seen squeezed into a half-open field
  .search-field .react-aria-Input::placeholder {
    opacity: 1;
    transition: opacity 0.15s ease-in-out 0.1s;
  }

  // The press trigger: a transparent hit target laid over the collapsed
  // square. The field beneath paints all of the chrome, so the button carries
  // only the semantics — and its own focus ring, since the field shows no
  // focus treatment while the button is what holds focus. It exists only
  // while the field is collapsed (see below): once the field is open the
  // trigger has no job, and leaving the tab order means Tab moves on from the
  // input rather than onto an invisible button.
  .search-button__trigger {
    display: none;
    position: absolute;
    inset: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: var(--global-rounding-small);
    outline: none;

    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }

  // Collapsed: nothing typed and the field itself unfocused. Focusing the
  // field expands; blurring while empty collapses. Held as CSS rather than
  // React state so the two appearances are one set of elements — nothing
  // mounts, moves focus, or flashes at the moment of transition. Scoped to
  // the field's own focus so that in press mode, focus resting on the trigger
  // button does not open the field.
  &:has(.search-field[data-empty]):not(:has(.search-field:focus-within)) {
    width: var(--search-button-collapsed-size);

    .search-button__trigger {
      display: block;
    }

    // Each variant only names the tokens; the collapsed square itself is
    // dressed once, below.
    //
    // Quiet: the field chrome is silenced at the token level, leaving an
    // IconButton — dimmed glyph on a bare square, background only on hover.
    &[data-variant="quiet"] {
      --search-button-collapsed-icon-size: var(--global-font-size-l);
      --search-button-collapsed-icon-color: var(--global-text-color-700);
      --search-button-collapsed-icon-opacity: 0.7;
      --field-background-color: transparent;
      --field-border-color: transparent;
      --field-border-color-active: transparent;

      &:hover {
        --field-background-color: var(--hover-background);
      }
    }

    // Default: the field's resting tokens already carry the default Button's
    // border and background, so the square reads as a bordered icon-only
    // Button as it stands. The hover trades the field's border highlight for
    // the Button's background change, and the glyph takes a Button icon's
    // size and color.
    &[data-variant="default"] {
      // Icon renders at 1.2em of the Button font size
      --search-button-collapsed-icon-size: calc(
        var(--global-dimension-font-size-100) * 1.2
      );
      --search-button-collapsed-icon-color: var(--global-text-color-900);
      --field-border-color-active: var(--field-border-color);

      &:hover {
        --field-background-color: var(
          --global-input-field-background-color-hover
        );
      }
    }

    .search-field .react-aria-Input {
      cursor: pointer;
      caret-color: transparent;
      // the expanded side padding would force the border box wider than the
      // square; the shared rules carry !important so this must too
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .search-field .react-aria-Input::placeholder {
      opacity: 0;
      transition-delay: 0s;
    }

    .search-field .search-field__icon {
      // at rest the glyph takes the variant's button icon size and color,
      // centered in the square, easing into the field's own icon as it expands
      font-size: var(--search-button-collapsed-icon-size);
      color: var(--search-button-collapsed-icon-color);
      opacity: var(--search-button-collapsed-icon-opacity, 1);
      left: calc(
        (
            var(--search-button-collapsed-size) -
              var(--search-button-collapsed-icon-size)
          ) / 2
      );
    }

    &:hover .search-field .search-field__icon {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &,
    .search-field .react-aria-Input,
    .search-field .search-field__icon,
    .search-field .react-aria-Input::placeholder {
      transition: none;
    }
  }
`;

/**
 * A search field that rests as an icon button. It expands when opened —
 * focused by default, pressed with `trigger="press"` — and collapses back to
 * the button when it loses focus while empty; while it holds a query it stays
 * open showing it. For toolbars and card headers too tight to give an idle
 * search field its full width.
 *
 * The collapsed button and the expanded field are the same search input
 * throughout, so nothing jumps at the moment of transition and no focus
 * management is involved. `trigger="press"` lays a real icon-only button over
 * the collapsed square, so it announces as a button and Tab can pass through
 * without opening it. Only the `S` size exists.
 */
export function SearchButton({
  onChange: propsOnChange,
  debounceMs = 200,
  placeholder,
  expandedWidth,
  trigger = "focus",
  variant = "default",
  onKeyDown: propsOnKeyDown,
  ...props
}: SearchButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isPress = trigger === "press";

  const onChange = useDebouncedChange(propsOnChange, debounceMs);

  // carried as a custom property rather than composed into the css prop, so
  // the stylesheet stays a single cached serialization
  const style: CSSProperties | undefined = expandedWidth
    ? {
        // @ts-expect-error custom CSS properties
        "--search-button-expanded-width": expandedWidth,
      }
    : undefined;

  const onKeyDown: SearchFieldProps["onKeyDown"] = (e) => {
    // The field itself clears on Escape while it holds text; once empty the
    // event reaches here, and dismissing the field entirely is the natural
    // second step.
    if (
      e.key === "Escape" &&
      e.target instanceof HTMLInputElement &&
      e.target.value === ""
    ) {
      e.target.blur();
      // hand focus back to the trigger rather than dropping it on the page.
      // The blur above collapses the field, which is what lets the hidden
      // trigger take focus again.
      triggerRef.current?.focus();
    }
    propsOnKeyDown?.(e);
  };

  return (
    <div
      className="search-button"
      data-variant={variant}
      css={searchButtonCSS}
      style={style}
    >
      <SearchField
        size="S"
        onChange={onChange}
        onKeyDown={onKeyDown}
        {...props}
      >
        {({ isEmpty }) => (
          <>
            <SearchIcon />
            <Input
              ref={inputRef}
              placeholder={placeholder}
              // in press mode the trigger button is the collapsed tab stop,
              // so the empty input steps out of the tab order; holding text
              // it is the thing to reach, and takes the stop back
              tabIndex={isPress && isEmpty ? -1 : undefined}
            />
          </>
        )}
      </SearchField>
      {isPress && (
        <Button
          ref={triggerRef}
          className="search-button__trigger"
          aria-label={props["aria-label"]}
          isDisabled={props.isDisabled}
          onPress={() => inputRef.current?.focus()}
        />
      )}
    </div>
  );
}
