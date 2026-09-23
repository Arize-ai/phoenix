import { css } from "@emotion/react";
import type { FocusEvent } from "react";
import { useRef, useState } from "react";
import { Button, Input } from "react-aria-components";
import { flushSync } from "react-dom";

import { useDebouncedChange } from "@phoenix/hooks/useDebouncedChange";

import type { BaseVariant, QuietVariant } from "../types";
import type { DebouncedSearchProps } from "./DebouncedSearch";
import type { SearchFieldProps } from "./SearchField";
import { SearchField, SearchIcon } from "./SearchField";

export interface SearchButtonProps extends Omit<
  DebouncedSearchProps,
  "size" | "variant" | "children"
> {
  /**
   * The chrome of the collapsed button, matching the `Button` vocabulary.
   * - "default": bordered, like the default `Button` — for toolbars whose
   *   other controls are bordered buttons.
   * - "quiet": borderless, like an `IconButton`.
   * The expanded field looks the same either way.
   * @default "default"
   */
  variant?: Extract<BaseVariant, "default"> | QuietVariant;
}

const searchButtonCSS = css`
  --search-button-collapsed-size: var(--global-button-height-s);
  // the field's comfortable min-width would stop the input shrinking to the
  // collapsed square, so the floor moves out to this wrapper — the element a
  // tight toolbar actually squeezes — where it can be the collapsed square
  // while collapsed and the field's usual minimum once open. It animates
  // alongside the width so the widths never disagree mid-transition.
  --field-min-width: 0;
  position: relative;
  width: var(--global-dimension-size-3000);
  min-width: var(--global-input-field-min-width);
  transition:
    width 0.2s ease-in-out,
    min-width 0.2s ease-in-out;

  .search-field .search-field__icon {
    transition:
      left 0.2s ease-in-out,
      font-size 0.2s ease-in-out,
      color 0.2s ease-in-out,
      opacity 0.2s ease-in-out;
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

  // The trigger: a transparent hit target laid over the collapsed square. The
  // field beneath paints all of the chrome, so the button carries only the
  // semantics — and its own focus ring, since the field shows no focus
  // treatment while the button is what holds focus. It exists only while the
  // field is collapsed: once the field is open the trigger has no job, and
  // leaving the tab order means Tab moves on from the input rather than onto
  // an invisible button.
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

  // Collapsed and expanded are the same elements throughout — only this
  // attribute changes, so nothing mounts, moves focus, or flashes at the
  // moment of transition.
  &[data-collapsed="true"] {
    width: var(--search-button-collapsed-size);
    min-width: var(--search-button-collapsed-size);

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

    // the expanded side insets would force the border box wider than the square
    --searchfield-input-padding-start: 0;
    --searchfield-input-padding-end: 0;

    .search-field .react-aria-Input {
      cursor: pointer;
      caret-color: transparent;
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
        (var(--search-button-collapsed-size) -
            var(--search-button-collapsed-icon-size)) /
          2
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
 * A search field that rests as an icon button. Pressing the button expands it
 * into an S-size search field; it collapses back to the button when it loses
 * focus while empty, and while it holds a query it stays open showing it. For
 * toolbars and card headers too tight to give an idle search field its full
 * width.
 *
 * The collapsed button and the expanded field are the same elements
 * throughout, so nothing jumps at the moment of transition. The button laid
 * over the collapsed square is a real one, so it announces as a button and Tab
 * rests on it rather than opening the field in passing. Only the `S` size
 * exists.
 */
export function SearchButton({
  onChange: propsOnChange,
  debounceMs = 200,
  placeholder,
  variant = "default",
  onKeyDown: propsOnKeyDown,
  ...props
}: SearchButtonProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Collapsed is one predicate, read by the input's inert state below and —
  // through data-collapsed — by every rule in the stylesheet.
  const [isFieldFocused, setIsFieldFocused] = useState(false);
  const [hasText, setHasText] = useState(() => Boolean(props.defaultValue));
  const isCollapsed = !hasText && !isFieldFocused;

  const debouncedOnChange = useDebouncedChange({
    onChange: propsOnChange,
    debounceMs,
  });
  const onChange = (value: string) => {
    setHasText(value !== "");
    debouncedOnChange(value);
  };

  // Focus tracked on the wrapper but attributed to the field, so that focus
  // resting on the trigger leaves the field collapsed, while a hop from the
  // input to the clear button — a blur and a focus in immediate succession —
  // does not collapse it mid-interaction.
  const isInField = (node: Element | null) =>
    node != null && fieldRef.current?.contains(node) === true;
  const onFocus = (e: FocusEvent<HTMLDivElement>) =>
    setIsFieldFocused(isInField(e.target));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    // A blur with no relatedTarget is either focus landing somewhere
    // unfocusable or the whole window going away; only the first took focus out
    // of the field. On a window blur the input stays the active element and
    // gets focus straight back, so collapsing on it would slam the field shut
    // and re-open it as the user tabs between apps.
    if (e.relatedTarget == null && !document.hasFocus()) {
      return;
    }
    setIsFieldFocused(isInField(e.relatedTarget));
  };

  const onKeyDown: SearchFieldProps["onKeyDown"] = (e) => {
    // The field itself clears on Escape while it holds text; once empty the
    // event reaches here, and dismissing the field entirely is the natural
    // second step.
    if (
      e.key === "Escape" &&
      e.target instanceof HTMLInputElement &&
      e.target.value === ""
    ) {
      // hand focus back to the trigger rather than dropping it on the page.
      // Collapsing has to reach the DOM first: the trigger is display:none
      // while the field is open, and a hidden button cannot take focus.
      flushSync(() => setIsFieldFocused(false));
      triggerRef.current?.focus();
      // Dismissing the field is the whole of this Escape. React Aria hands an
      // empty field's Escape onward — `continuePropagation` — for an enclosing
      // dialog to close on, which is exactly what we have just spent it on, so
      // take the propagation back.
      e.preventDefault();
      e.stopPropagation();
    }
    propsOnKeyDown?.(e);
  };

  return (
    <div
      className="search-button"
      data-variant={variant}
      data-collapsed={isCollapsed}
      css={searchButtonCSS}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <SearchField
        ref={fieldRef}
        size="S"
        onChange={onChange}
        onKeyDown={onKeyDown}
        {...props}
      >
        <SearchIcon />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          // While collapsed the trigger is the entire control, and the field
          // behind it is an icon square with no room to type in. `inert` takes
          // the input out of the tab order and out of the accessibility tree
          // together, so the collapsed state announces as one button rather
          // than as a button beside a second, identically named searchbox that
          // a screen reader can land on and type into unseen.
          inert={isCollapsed}
        />
      </SearchField>
      <Button
        ref={triggerRef}
        className="search-button__trigger"
        aria-label={props["aria-label"]}
        aria-expanded={!isCollapsed}
        isDisabled={props.isDisabled}
        onPress={() => {
          // Opening has to reach the DOM first: the input is inert while the
          // field is collapsed, and an inert input cannot take focus.
          flushSync(() => setIsFieldFocused(true));
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}
