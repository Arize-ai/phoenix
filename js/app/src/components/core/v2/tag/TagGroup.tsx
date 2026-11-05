import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type { Key, Selection } from "react-aria-components";
import {
  Button as AriaButton,
  DialogTrigger,
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
} from "react-aria-components";
import { useControlledState } from "react-stately/useControlledState";

import { Dialog } from "@phoenix/components/core/dialog";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Popover } from "@phoenix/components/core/overlay";
import { useTheme } from "@phoenix/contexts/ThemeContext";

import { Identifier } from "../identifier";
import { FamilyRouterProvider } from "../routing";
import type { FamilySize } from "../types";
import { tagCSS } from "./styles";
import type { TagColorProps } from "./Tag";
import { Tag, TagContent, tagColorAttributes } from "./Tag";

export type TagGroupItem = {
  id: string;
  /** The name of the attached object. */
  label: string;
  leadingVisual?: ReactNode;
  isDisabled?: boolean;
  /**
   * The label is the object's identifier, for an object with no name of its
   * own (a trace, a span). It is set as an `Identifier`.
   */
  isIdentifier?: boolean;
} & TagColorProps;

/**
 * A tag that goes somewhere. Only a set that does not select takes them.
 */
export type TagGroupLinkItem = TagGroupItem & {
  /**
   * The object's page. A tag with an `href` is a real link, so it opens in a
   * new tab and copies as a link.
   */
  href?: string;
};

type ReadOrActionProps = {
  /**
   * @default "none"
   */
  selectionMode?: "none";
  /**
   * Each tag's one primary action: go to the object, or open its detail.
   */
  onAction?: (id: string) => void;
  /**
   * The tags, in the order they show: the person's own order, else
   * alphabetical. Keep it stable from one render to the next.
   */
  items: readonly TagGroupLinkItem[];
  selectedKeys?: never;
  defaultSelectedKeys?: never;
  onSelectionChange?: never;
};

type SelectionProps = {
  /**
   * The tags toggle membership in a set, as a filter does. A selectable tag
   * never also navigates, so `onAction` is not available.
   */
  selectionMode: "single" | "multiple";
  selectedKeys?: Iterable<string>;
  defaultSelectedKeys?: Iterable<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onAction?: never;
  /** Selectable tags never navigate, so items take no `href`. */
  items: readonly TagGroupItem[];
};

type WrapProps = {
  /**
   * `wrap` lays every tag out on as many rows as it needs, where vertical
   * space is free. `collapse` keeps one row and adds a `+N` control that
   * opens the rest.
   * @default "wrap"
   */
  overflow?: "wrap";
  limit?: never;
  isOverflowOpen?: never;
  onOverflowOpenChange?: never;
  overflowBoundaryElement?: never;
};

type CollapseProps = {
  overflow: "collapse";
  /**
   * How many tags show before the `+N` control. Leave it out to show as many
   * as fit the group's width, as a table cell needs; the group then fills
   * its container's width.
   */
  limit?: number;
  /** Whether the popover listing the hidden tags is open. */
  isOverflowOpen?: boolean;
  onOverflowOpenChange?: (isOpen: boolean) => void;
  /** The element the overflow popover is kept within. */
  overflowBoundaryElement?: Element;
};

export type TagGroupProps = {
  /** Names the set for assistive technology. */
  "aria-label": string;
  /**
   * Removes tags. Pass it only where the person is editing the set. Delete
   * and Backspace remove the focused tag, and focus moves to the next one.
   */
  onRemove?: (ids: Set<string>) => void;
  /**
   * `S` inside menu items and pickers; `M` everywhere else, table cells
   * included.
   * @default "M"
   */
  size?: FamilySize;
  /**
   * The width past which a tag's name truncates, with the full name as its
   * tooltip. The remove button is never truncated.
   * @default "var(--global-dimension-size-2000)"
   */
  itemMaxWidth?: CSSProperties["maxWidth"];
} & (ReadOrActionProps | SelectionProps) &
  (WrapProps | CollapseProps);

const tagGroupCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;
  max-width: 100%;

  &[data-overflow="wrap"] .tag-group-v2__list {
    flex-wrap: wrap;
  }
  &[data-overflow="collapse"] .tag-v2 {
    min-width: 0;
  }
  &[data-fit] {
    position: relative;
    width: 100%;
  }
  .tag-group-v2__measure {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: var(--global-dimension-size-50);
    width: max-content;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .tag-group-v2__list {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-width: 0;
    outline: none;
  }
  .tag-group-v2__item {
    display: contents;
  }
`;

const overflowListCSS = css`
  max-width: var(--global-dimension-size-3600);
  padding: var(--global-dimension-size-100);
`;

type TagSetProps = {
  label: string;
  items: readonly TagGroupLinkItem[];
  size: FamilySize;
  itemMaxWidth: CSSProperties["maxWidth"];
  onRemove?: (ids: Set<string>) => void;
  onAction?: (id: string) => void;
  selectionMode: "none" | "single" | "multiple";
  selectedKeys: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
};

function labelOf(item: TagGroupItem): ReactNode {
  return item.isIdentifier ? <Identifier value={item.label} /> : item.label;
}

function colorPropsOf(item: TagGroupItem): TagColorProps {
  return item.userColor !== undefined
    ? { userColor: item.userColor }
    : { color: item.color };
}

/**
 * Read-only tags are plain list items: nothing to focus and nothing to
 * navigate between with the keyboard.
 */
function StaticTagSet({ label, items, size, itemMaxWidth }: TagSetProps) {
  return (
    <div className="tag-group-v2__list" role="list" aria-label={label}>
      {items.map((item) => (
        <span key={item.id} className="tag-group-v2__item" role="listitem">
          <Tag
            {...colorPropsOf(item)}
            leadingVisual={item.leadingVisual}
            size={size}
            maxWidth={itemMaxWidth}
            isDisabled={item.isDisabled}
            textValue={item.label}
          >
            {labelOf(item)}
          </Tag>
        </span>
      ))}
    </div>
  );
}

function InteractiveTagSet({
  label,
  items,
  size,
  itemMaxWidth,
  onRemove,
  onAction,
  selectionMode,
  selectedKeys,
  onSelectionChange,
}: TagSetProps) {
  const { theme } = useTheme();
  const isPressable = selectionMode !== "none" || onAction !== undefined;
  return (
    <FamilyRouterProvider>
      <AriaTagGroup
        aria-label={label}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onSelectionChange={(keys: Selection) => {
          onSelectionChange(
            keys === "all"
              ? new Set(items.map((item) => item.id))
              : new Set([...keys].map(String))
          );
        }}
        onRemove={
          onRemove
            ? (keys: Set<Key>) => onRemove(new Set([...keys].map(String)))
            : undefined
        }
        disabledKeys={items.filter((item) => item.isDisabled).map((i) => i.id)}
      >
        <AriaTagList className="tag-group-v2__list" items={items}>
          {(item) => (
            <AriaTag
              id={item.id}
              textValue={item.label}
              className="tag-v2"
              css={tagCSS}
              style={
                {
                  ...tagColorAttributes(colorPropsOf(item)).style,
                  "--tag-max-width": itemMaxWidth,
                } as CSSProperties
              }
              data-color={tagColorAttributes(colorPropsOf(item))["data-color"]}
              data-size={size}
              data-theme={theme}
              {...((isPressable || item.href !== undefined) && {
                "data-interactive": true,
              })}
              {...(onRemove && { "data-removable": true })}
              href={item.href}
              onAction={onAction ? () => onAction(item.id) : undefined}
            >
              {({ allowsRemoving }) => (
                <>
                  <TagContent
                    leadingVisual={item.leadingVisual}
                    title={item.isIdentifier ? undefined : item.label}
                  >
                    {labelOf(item)}
                  </TagContent>
                  {allowsRemoving ? (
                    <AriaButton
                      slot="remove"
                      className="tag-v2__remove"
                      aria-label={`Remove ${item.label}`}
                    >
                      <Icon svg={<Icons.Close />} />
                    </AriaButton>
                  ) : null}
                </>
              )}
            </AriaTag>
          )}
        </AriaTagList>
      </AriaTagGroup>
    </FamilyRouterProvider>
  );
}

function TagSet(props: TagSetProps) {
  const isStatic =
    props.selectionMode === "none" &&
    props.onAction === undefined &&
    props.onRemove === undefined &&
    props.items.every((item) => item.href === undefined);
  return isStatic ? (
    <StaticTagSet {...props} />
  ) : (
    <InteractiveTagSet {...props} />
  );
}

/**
 * How many tags fit one row of the group's width, leaving room for the `+N`
 * control when some are hidden. Every tag is measured in a hidden row that
 * does not depend on the result, so the count cannot feed back into its own
 * measurement.
 */
function useFittedCount({
  isEnabled,
  items,
  size,
  itemMaxWidth,
  isRemovable,
}: {
  isEnabled: boolean;
  items: readonly TagGroupItem[];
  size: FamilySize;
  itemMaxWidth: CSSProperties["maxWidth"];
  isRemovable: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!isEnabled || !container || !measure) {
      return undefined;
    }
    const update = () => {
      const available = container.clientWidth;
      if (available === 0) {
        return;
      }
      const children = Array.from(measure.children) as HTMLElement[];
      const more = children.pop();
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      const moreWidth = (more?.offsetWidth ?? 0) + gap;
      let used = 0;
      let fitted = 0;
      for (let index = 0; index < children.length; index++) {
        const width = children[index].offsetWidth + (index > 0 ? gap : 0);
        const isLast = index === children.length - 1;
        if (used + width + (isLast ? 0 : moreWidth) > available) {
          break;
        }
        used += width;
        fitted++;
      }
      setCount(Math.max(1, fitted));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isEnabled, items, size, itemMaxWidth, isRemovable]);

  const measure = isEnabled ? (
    <div ref={measureRef} className="tag-group-v2__measure" aria-hidden inert>
      {items.map((item) => (
        <Tag
          key={item.id}
          {...colorPropsOf(item)}
          leadingVisual={item.leadingVisual}
          size={size}
          maxWidth={itemMaxWidth}
          onRemove={isRemovable ? () => {} : undefined}
          textValue={item.label}
        >
          {labelOf(item)}
        </Tag>
      ))}
      <Tag size={size}>{`+${items.length}`}</Tag>
    </div>
  ) : null;

  return { containerRef, count, measure };
}

/**
 * The set of Tags attached to one thing. It owns their layout, overflow,
 * keyboard navigation, selection and removal, so no surface lays tags out in
 * a row of its own.
 *
 * The interaction is the surface's, and the same set can be read-only on one
 * surface and editable on another:
 *
 * - **read-only**: no `selectionMode`, `onAction` or `onRemove`. A plain
 *   list; nothing is focusable.
 * - **operational**: `onAction`. Each tag does one thing.
 * - **selectable**: `selectionMode`. The tags toggle membership in a set.
 * - **removable**: `onRemove`, alone or with either of the above.
 *
 * An empty set renders nothing. Where the person is editing the set, put the
 * way to add a tag beside the group.
 */
export function TagGroup(props: TagGroupProps) {
  const {
    "aria-label": label,
    items,
    onRemove,
    size = "M",
    itemMaxWidth = "var(--global-dimension-size-2000)",
  } = props;
  const selectionMode = props.selectionMode ?? "none";
  const [selectedKeys, setSelectedKeys] = useControlledState<Set<string>>(
    props.selectedKeys ? new Set(props.selectedKeys) : undefined,
    new Set(props.defaultSelectedKeys ?? []),
    props.onSelectionChange
  );
  const [isOverflowOpen, setIsOverflowOpen] = useControlledState<boolean>(
    props.overflow === "collapse" ? props.isOverflowOpen : undefined,
    false,
    props.overflow === "collapse" ? props.onOverflowOpenChange : undefined
  );
  const { theme } = useTheme();
  const isFit = props.overflow === "collapse" && props.limit === undefined;
  const fittedCount = useFittedCount({
    isEnabled: isFit,
    items,
    size,
    itemMaxWidth,
    isRemovable: onRemove !== undefined,
  });
  if (items.length === 0) {
    return null;
  }
  const limit =
    props.overflow === "collapse"
      ? (props.limit ?? fittedCount.count)
      : items.length;
  const visibleItems = items.slice(0, limit);
  const hiddenItems = items.slice(limit);
  const setProps = {
    label,
    size,
    itemMaxWidth,
    onRemove,
    onAction: props.onAction,
    selectionMode,
    selectedKeys,
    onSelectionChange: setSelectedKeys,
  };
  return (
    <div
      ref={fittedCount.containerRef}
      className="tag-group-v2"
      css={tagGroupCSS}
      data-overflow={props.overflow ?? "wrap"}
      {...(isFit && { "data-fit": true })}
    >
      {isFit ? fittedCount.measure : null}
      <TagSet {...setProps} items={visibleItems} />
      {hiddenItems.length > 0 ? (
        <DialogTrigger isOpen={isOverflowOpen} onOpenChange={setIsOverflowOpen}>
          <AriaButton
            className="tag-v2 tag-group-v2__more"
            css={tagCSS}
            data-color="neutral"
            data-size={size}
            data-theme={theme}
            data-interactive
            aria-label={`Show ${hiddenItems.length} more`}
          >
            +{hiddenItems.length}
          </AriaButton>
          <Popover
            placement="bottom start"
            isNonModal
            closeOnInteractOutside
            boundaryElement={
              props.overflow === "collapse"
                ? props.overflowBoundaryElement
                : undefined
            }
          >
            <Dialog aria-label={label}>
              <div
                className="tag-group-v2"
                css={[tagGroupCSS, overflowListCSS]}
                data-overflow="wrap"
              >
                <TagSet {...setProps} items={hiddenItems} />
              </div>
            </Dialog>
          </Popover>
        </DialogTrigger>
      ) : null}
    </div>
  );
}
