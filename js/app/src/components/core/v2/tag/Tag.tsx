import type { CSSProperties, ReactNode } from "react";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";

import { Icon, Icons } from "@phoenix/components/core/icon";
import { useTheme } from "@phoenix/contexts/ThemeContext";

import { FamilyRouterProvider } from "../routing";
import type { FamilySize } from "../types";
import type { TagColor } from "./styles";
import { tagCSS } from "./styles";

/**
 * A tag's hue, from one of two sources that never mix. Phoenix picks from the
 * named palette; a color a person chose is passed through as stored.
 */
export type TagColorProps =
  | {
      /**
       * A named hue. Use it whenever Phoenix chooses the color, such as a
       * release tag colored by its name.
       * @default "neutral"
       */
      color?: TagColor;
      userColor?: never;
    }
  | {
      /**
       * A color a person picked, passed through exactly as it is stored,
       * such as a prompt label's hex. Any CSS color. Only for user-supplied
       * values: when Phoenix chooses the color, use `color`.
       */
      userColor: string;
      color?: never;
    };

/**
 * The inline style and `data-color` that put either color source on a tag.
 */
export function tagColorAttributes({ color, userColor }: TagColorProps) {
  if (userColor !== undefined) {
    return {
      "data-color": "user",
      style: { "--family-base-color": userColor } as CSSProperties,
    };
  }
  return { "data-color": color ?? "neutral", style: undefined };
}

interface TagBaseProps {
  /**
   * The name of the attached object.
   */
  children: ReactNode;
  /**
   * The object's name as plain text, for the remove button's accessible name
   * and the truncation tooltip. Required when `children` is not a string.
   */
  textValue?: string;
  /**
   * An icon or swatch set before the name.
   */
  leadingVisual?: ReactNode;
  /**
   * `S` inside menu items and pickers; `M` everywhere else, table cells
   * included.
   * @default "M"
   */
  size?: FamilySize;
  /**
   * The width past which the name truncates with an ellipsis.
   */
  maxWidth?: CSSProperties["maxWidth"];
  /**
   * The tag's one primary action: open the object's detail. To go to the
   * object's page, pass `href` instead.
   */
  onPress?: () => void;
  /**
   * The object's page. The tag (or its body, when it is also removable) is
   * then a real link, so it opens in a new tab and copies as a link.
   */
  href?: string;
  /**
   * Removes the tag. Pass it only where the person is editing the set; the
   * same tag is read-only everywhere else.
   */
  onRemove?: () => void;
  isDisabled?: boolean;
}

export type TagProps = TagBaseProps &
  TagColorProps &
  ({ onPress?: () => void; href?: never } | { href: string; onPress?: never });

function RemoveButton({
  name,
  isDisabled,
  onRemove,
}: {
  name: string | undefined;
  isDisabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <AriaButton
      className="tag-v2__remove"
      aria-label={name ? `Remove ${name}` : "Remove"}
      isDisabled={isDisabled}
      onPress={onRemove}
    >
      <Icon svg={<Icons.Close />} />
    </AriaButton>
  );
}

export function TagContent({
  leadingVisual,
  children,
  title,
}: {
  leadingVisual?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <>
      {leadingVisual ? (
        <span className="tag-v2__leading-visual" aria-hidden>
          {leadingVisual}
        </span>
      ) : null}
      <span className="tag-v2__text" title={title}>
        {children}
      </span>
    </>
  );
}

/**
 * A Tag: a separate object attached to a thing, with its own identity, such
 * as a prompt label, a dataset label, a release tag or a project reference.
 * Cornered, like the rest of Phoenix's operable controls, because it is the
 * one member of this family that may be a hit target.
 *
 * Its interaction follows from the props it is given, and never more than
 * one primary action and one secondary:
 *
 * - **read-only**: neither `onPress` nor `onRemove`. Not focusable.
 * - **operational**: `onPress`. The whole tag is one button.
 * - **dismissible**: `onRemove`. A remove button follows the name.
 * - **press and remove**: both, as two focus stops. This is the shape of a
 *   PXI context attachment: the body opens the attachment, the button
 *   removes it.
 *
 * Selection is a gesture on a set, not on one tag: a selectable tag lives in
 * a `TagGroup` with a `selectionMode`. Use `TagGroup` for any set of tags.
 */
export function Tag({
  children,
  textValue,
  color,
  userColor,
  leadingVisual,
  size = "M",
  maxWidth,
  onPress,
  href,
  onRemove,
  isDisabled,
}: TagProps) {
  const { theme } = useTheme();
  const name =
    textValue ?? (typeof children === "string" ? children : undefined);
  const colorAttributes = tagColorAttributes(
    userColor !== undefined ? { userColor } : { color }
  );
  const rootProps = {
    className: "tag-v2",
    css: tagCSS,
    style: {
      ...colorAttributes.style,
      ...(maxWidth !== undefined && { "--tag-max-width": maxWidth }),
    } as CSSProperties,
    "data-color": colorAttributes["data-color"],
    "data-size": size,
    "data-theme": theme,
    ...((onPress || href) && { "data-interactive": true }),
    ...(onRemove && { "data-removable": true }),
    ...(isDisabled && { "data-disabled": true }),
  };
  const content = (
    <TagContent
      leadingVisual={leadingVisual}
      title={maxWidth !== undefined ? name : undefined}
    >
      {children}
    </TagContent>
  );

  if (href !== undefined && !onRemove) {
    return (
      <FamilyRouterProvider>
        <AriaLink {...rootProps} href={href} isDisabled={isDisabled}>
          {content}
        </AriaLink>
      </FamilyRouterProvider>
    );
  }
  if (onPress && !onRemove) {
    return (
      <AriaButton {...rootProps} onPress={onPress} isDisabled={isDisabled}>
        {content}
      </AriaButton>
    );
  }
  return (
    <span {...rootProps}>
      {href !== undefined ? (
        <FamilyRouterProvider>
          <AriaLink
            className="tag-v2__body"
            href={href}
            isDisabled={isDisabled}
          >
            {content}
          </AriaLink>
        </FamilyRouterProvider>
      ) : onPress ? (
        <AriaButton
          className="tag-v2__body"
          onPress={onPress}
          isDisabled={isDisabled}
        >
          {content}
        </AriaButton>
      ) : (
        content
      )}
      {onRemove ? (
        <RemoveButton name={name} isDisabled={isDisabled} onRemove={onRemove} />
      ) : null}
    </span>
  );
}
