import type { API } from "storybook/manager-api";

import { whenBodyReady } from "./whenBodyReady";

const LOCAL_ROW = '.sidebar-item[data-ref-id="storybook_internal"]';
/**
 * A local folder row's toggle: the row's first child. Rows also hold a
 * context-menu button, which must not open the Overview.
 */
const GROUP_TOGGLE_SELECTOR = `${LOCAL_ROW}[data-nodetype="group"] > button:first-child`;
const OVERVIEW_ROW_ATTRIBUTE = "data-phoenix-overview-row";
const OVERVIEW_STYLE_ELEMENT_ID = "phoenix-sidebar-overview-styles";

/**
 * The docs id of a folder's `Overview` page (`<Folder>/Overview.mdx`). The
 * page is named after its folder (`<Meta name="<Folder>" />`, enforced by
 * `pnpm lint:stories`) so search lists it by subject rather than as "Docs",
 * and Storybook derives the id's story part from that name.
 */
function overviewIdFor(api: API, folderId: string) {
  const folder = api.resolveStory(folderId);
  return folder ? api.storyId(`${folderId}-overview`, folder.name) : undefined;
}

/**
 * Overview folder rows, marked by `sync` so the split composition below never
 * touches a plain folder, whose whole row is (correctly) one toggle.
 */
const OVERVIEW_FOLDER_ATTRIBUTE = "data-phoenix-overview-folder";
const OVERVIEW_FOLDER = `.sidebar-item[${OVERVIEW_FOLDER_ATTRIBUTE}]`;
const FOLDER_BUTTON = `${OVERVIEW_FOLDER} > button:first-child`;
/**
 * The chevron: first child of the button's leading icon wrapper, rendered only
 * for expandable rows (otherwise the wrapper starts with the type-icon `svg`,
 * which this does not match).
 */
const CHEVRON_IN_BUTTON = "div:first-child > div:first-child";
/**
 * Storybook's row indent: 8px ahead of a chevron (22px on a row without one,
 * so its label lines up with a sibling folder's), plus 18px per level.
 */
const BASE_PADDING = 8;
const LEAF_BASE_PADDING = 22;
const STORYBOOK_INDENT_STEP = 18;
/** The per-level indent every local row is given instead. */
const INDENT_STEP = 12;
const DEPTH_ATTRIBUTE = "data-phoenix-depth";
/** Storybook's 8px chevron glyph, and the row's 28px minimum height. */
const CHEVRON_GLYPH = 8;
const ROW_HEIGHT = 28;
/**
 * The chevron's hit target and hover fill: a little narrower than tall, and
 * inset from the row by the same amount on the left as on top and bottom.
 */
const CHEVRON_TARGET_WIDTH = 20;
const CHEVRON_TARGET_HEIGHT = 24;
const CHEVRON_INSET = (ROW_HEIGHT - CHEVRON_TARGET_HEIGHT) / 2;
const CHEVRON_TARGET_PAD_X = (CHEVRON_TARGET_WIDTH - CHEVRON_GLYPH) / 2;
const CHEVRON_TARGET_PAD_Y = (CHEVRON_TARGET_HEIGHT - CHEVRON_GLYPH) / 2;
/** The button's left padding, which places the glyph centred in its target. */
const CHEVRON_GLYPH_LEFT = CHEVRON_INSET + CHEVRON_TARGET_PAD_X;
/** Seam between the chevron and label targets, matching the chevron's inset. */
const TARGET_GAP = CHEVRON_INSET;
/** The label target's left edge within the button. */
const LABEL_START = CHEVRON_INSET + CHEVRON_TARGET_WIDTH + TARGET_GAP;
/** The label content's inset from the label target's left edge. */
const LABEL_INSET = 6;
/**
 * Extra space before the label content, which Storybook places 6px after the
 * chevron glyph, to put it `LABEL_INSET` inside the label target. Applied
 * before the type icon, or after the chevron where that icon is hidden.
 */
const LABEL_CONTENT_SHIFT =
  LABEL_START + LABEL_INSET - (CHEVRON_GLYPH_LEFT + CHEVRON_GLYPH + 6);

/**
 * Storybook's gap between a row's leading icon wrapper and its label, which
 * stays in place when the wrapper is empty.
 */
const ICON_GAP = 6;
/**
 * The icon wrapper keeps the hidden icon's 14px height: it vertically centres
 * the chevron, and without the icon it would shrink to the 8px glyph and lift
 * the chevron 3px off the row's centre line.
 */
const TYPE_ICON_SIZE = 14;
/**
 * Storybook's per-type row icons (the component grid, docs page, story
 * bookmark, and folder) are hidden on every local row: the chevron already
 * says what expands, and the icons add colour without adding meaning.
 *
 * Every label then moves right by `LABEL_CONTENT_SHIFT`, the offset an
 * Overview folder needs to sit inside its label target, so labels at one
 * depth line up whether their row is an Overview folder, a plain folder, a
 * component, or a page. A leaf's wrapper holds only the icon, so it empties to
 * zero width while Storybook's `ICON_GAP` after it remains; the leaf's margin
 * is reduced by that gap, which lands its label where a sibling component's
 * sits.
 */
const TYPE_ICON_STYLES = `
  ${LOCAL_ROW} > :first-child > div:first-child > svg[type] {
    display: none;
  }
  ${LOCAL_ROW} > button:first-child > div:first-child {
    min-height: ${TYPE_ICON_SIZE}px;
    margin-right: ${LABEL_CONTENT_SHIFT}px;
  }
  ${LOCAL_ROW} > a:first-child > div:first-child {
    margin-right: ${LABEL_CONTENT_SHIFT - ICON_GAP}px;
  }
`;

/**
 * Recompose an Overview folder row as a chevron button followed by a label
 * button, while it stays one Storybook `<button>` underneath.
 *
 * Storybook paints hover on the whole row and puts the depth indent inside
 * the button's padding, so the entire row reads as one target. Here:
 *
 * - The indent moves from the button's padding to its margin (set inline per
 *   row by `sync`, since it depends on depth), so the indent is inert row
 *   space and the button begins at the row's edge, inset-padded to the chevron.
 * - The chevron is padded out, with matching negative margin so its layout
 *   box is unchanged, into a hit target inset evenly from the row's left,
 *   top and bottom edges, with its own hover fill. The label sits inside the
 *   label target through the shift every row gets (`TYPE_ICON_STYLES`).
 * - The row's hover fill is suppressed. The label's fill is a `::before`
 *   starting after the chevron, shown only while the chevron is not hovered.
 *
 * Selection keeps Storybook's full-row fill, matching every other row; over
 * it the chevron's hover is a translucent white, since the hover token is a
 * pale grey that would wash out the accent. Storybook's keyboard highlight
 * (`HighlightStyles`) outranks these rules and still fills the full row.
 */
const SPLIT_ROW_STYLES = `
  ${OVERVIEW_FOLDER}:not([data-selected="true"]):hover {
    background: transparent;
  }
  ${FOLDER_BUTTON} {
    position: relative;
    isolation: isolate;
  }
  ${FOLDER_BUTTON}::before {
    content: "";
    position: absolute;
    inset: 0 0 0 ${LABEL_START}px;
    border-radius: 4px;
    pointer-events: none;
    z-index: -1;
  }
  ${OVERVIEW_FOLDER}:not([data-selected="true"])
    > button:first-child:hover:not(:has(> ${CHEVRON_IN_BUTTON}:hover))::before {
    background: var(--tree-node-background-hover);
  }
  ${FOLDER_BUTTON} > ${CHEVRON_IN_BUTTON} {
    box-sizing: content-box;
    padding: ${CHEVRON_TARGET_PAD_Y}px ${CHEVRON_TARGET_PAD_X}px;
    margin: -${CHEVRON_TARGET_PAD_Y}px -${CHEVRON_TARGET_PAD_X}px;
    border-radius: 4px;
    /*
     * Storybook rotates this element 90deg when expanded. Now that it is a
     * non-square target with its own fill, the rotation would swap its width
     * and height, so only the glyph turns.
     */
    transform: none;
    transition: none;
  }
  ${FOLDER_BUTTON} > ${CHEVRON_IN_BUTTON} > svg {
    display: block;
    transition: transform 0.1s ease-out;
  }
  ${FOLDER_BUTTON}[aria-expanded="true"] > ${CHEVRON_IN_BUTTON} > svg {
    transform: rotateZ(90deg);
  }
  ${FOLDER_BUTTON} > ${CHEVRON_IN_BUTTON}:hover {
    background: var(--tree-node-background-hover);
  }
  ${OVERVIEW_FOLDER}[data-selected="true"] > button:first-child > ${CHEVRON_IN_BUTTON}:hover {
    background: rgba(255, 255, 255, 0.24);
  }
`;

/**
 * Whether a click landed on the chevron target. That target keeps Storybook's
 * plain expand/collapse, so a folder can be unfolded without opening it.
 * Keyboard Enter/Space target the button itself, so they still open the
 * Overview; the tree's ArrowRight/ArrowLeft expand and collapse on their own.
 */
function isChevronClick(toggle: HTMLElement, target: EventTarget | null) {
  const chevron = toggle.querySelector(`:scope > ${CHEVRON_IN_BUTTON}`);
  return chevron !== null && target instanceof Node && chevron.contains(target);
}

/**
 * A row's base padding: whether Storybook drew a chevron. Only an expandable
 * branch lists the children it controls.
 */
function basePaddingOf(node: HTMLElement) {
  return node.getAttribute("aria-controls") ? BASE_PADDING : LEAF_BASE_PADDING;
}

/**
 * Re-indent a row's button or link at `INDENT_STEP` per level. Storybook
 * exposes no depth on the row, only the emotion class's
 * `padding-left: base + depth * 18`, so the depth is read from that once per
 * element, before the inline override replaces it, and kept on the element.
 * React leaves these properties alone (it only manages `color` here), and a
 * re-mounted row is a new element that `sync` sees and reads again.
 *
 * An Overview folder's indent moves from padding to margin (see
 * `SPLIT_ROW_STYLES`).
 */
function indentRow(node: HTMLElement, isOverviewFolder: boolean) {
  let depth = Number(node.getAttribute(DEPTH_ATTRIBUTE));
  if (!node.hasAttribute(DEPTH_ATTRIBUTE)) {
    const padding = parseFloat(getComputedStyle(node).paddingLeft);
    if (Number.isNaN(padding)) {
      return;
    }
    depth = Math.round((padding - basePaddingOf(node)) / STORYBOOK_INDENT_STEP);
    node.setAttribute(DEPTH_ATTRIBUTE, String(depth));
  }
  const indent = depth * INDENT_STEP;
  const marginLeft = isOverviewFolder ? `${indent}px` : "";
  const paddingLeft = `${isOverviewFolder ? CHEVRON_GLYPH_LEFT : basePaddingOf(node) + indent}px`;
  if (node.style.marginLeft !== marginLeft) {
    node.style.marginLeft = marginLeft;
  }
  if (node.style.paddingLeft !== paddingLeft) {
    node.style.paddingLeft = paddingLeft;
  }
}

/**
 * Folders with an `Overview` page act as that page: clicking the folder opens
 * it, the Overview's own row is hidden, and the folder row carries the
 * selection highlight while the Overview is open.
 *
 * Storybook 10 renders every folder ("group") row as a pure expand/collapse
 * toggle, with no option to make it navigate, and has no way to hide an entry
 * that must stay navigable (a sidebar `filters` function drops the entry from
 * the index, so it could no longer be selected). So:
 *
 * - A document capture-phase click listener runs ahead of the folder row's
 *   React handler. Native Enter/Space on the focused row dispatch `click`, so
 *   keyboard activation takes this path too.
 *   - Chevron (see `isChevronClick`): plain toggle, never navigates. The
 *     row is styled as a chevron button beside a label button; see
 *     `SPLIT_ROW_STYLES`.
 *   - Collapsed folder: open the Overview and let the toggle expand it.
 *   - Expanded folder, elsewhere: open the Overview and swallow the toggle, so
 *     the folder stays open rather than collapsing and then being re-expanded
 *     by Storybook's "expand the selection's ancestors" effect.
 *   - Already on the Overview: plain toggle, so the folder can still collapse.
 * - A MutationObserver keeps two things in step whenever Storybook re-renders
 *   rows or moves the selection:
 *   - The Overview row is marked for CSS to hide, and dropped from arrow-key
 *     navigation, which walks every `[data-highlightable=true]` row whether
 *     visible or not. React rewrites that attribute when the folder expands or
 *     collapses, which the observer sees and undoes.
 *   - The folder row gets `data-selected`, so Storybook's own selected-row
 *     styling applies in both themes. React never rewrites it: a folder's
 *     `isSelected` is always false, so the prop never changes. The truth is
 *     the URL, not the Overview row, which is unmounted while its folder is
 *     collapsed.
 *   - Every local row is re-indented at `INDENT_STEP` (see `indentRow`).
 *   Every write is skipped when the value already matches: a write records a
 *   mutation even when unchanged, which would re-trigger the observer forever.
 */
export function installSubjectOverviews(api: API) {
  if (!document.getElementById(OVERVIEW_STYLE_ELEMENT_ID)) {
    const style = document.createElement("style");
    style.id = OVERVIEW_STYLE_ELEMENT_ID;
    style.textContent = `
      .sidebar-item[${OVERVIEW_ROW_ATTRIBUTE}] { display: none; }
      ${TYPE_ICON_STYLES}
      ${SPLIT_ROW_STYLES}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener(
    "click",
    (event) => {
      const toggle =
        event.target instanceof Element &&
        event.target.closest<HTMLElement>(GROUP_TOGGLE_SELECTOR);
      const folderId = toggle && toggle.parentElement?.dataset.itemId;
      if (!toggle || !folderId) {
        return;
      }
      const overviewId = overviewIdFor(api, folderId);
      if (
        !overviewId ||
        !api.getData(overviewId) ||
        isChevronClick(toggle, event.target)
      ) {
        return;
      }
      if (api.getUrlState().storyId === overviewId) {
        return;
      }
      if (toggle.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        event.stopPropagation();
      }
      api.selectStory(overviewId);
    },
    { capture: true }
  );

  const sync = () => {
    document
      .querySelectorAll<HTMLElement>(`${LOCAL_ROW}[data-nodetype="document"]`)
      .forEach((row) => {
        const { itemId, parentId } = row.dataset;
        if (!parentId || itemId !== overviewIdFor(api, parentId)) {
          return;
        }
        if (!row.hasAttribute(OVERVIEW_ROW_ATTRIBUTE)) {
          row.setAttribute(OVERVIEW_ROW_ATTRIBUTE, "");
        }
        if (row.dataset.highlightable !== "false") {
          row.dataset.highlightable = "false";
        }
      });
    const currentId = api.getUrlState().storyId;
    document
      .querySelectorAll<HTMLElement>(`${LOCAL_ROW}[data-nodetype="group"]`)
      .forEach((folder) => {
        const folderId = folder.dataset.itemId;
        const overviewId = folderId && overviewIdFor(api, folderId);
        if (!overviewId || !api.getData(overviewId)) {
          return;
        }
        if (!folder.hasAttribute(OVERVIEW_FOLDER_ATTRIBUTE)) {
          folder.setAttribute(OVERVIEW_FOLDER_ATTRIBUTE, "");
        }
        const selected = String(currentId === overviewId);
        if (folder.dataset.selected !== selected) {
          folder.dataset.selected = selected;
        }
      });
    document
      .querySelectorAll<HTMLElement>(
        `${LOCAL_ROW} > button:first-child, ${LOCAL_ROW} > a:first-child`
      )
      .forEach((node) => {
        indentRow(
          node,
          node.parentElement?.hasAttribute(OVERVIEW_FOLDER_ATTRIBUTE) ?? false
        );
      });
  };
  const observe = () => {
    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-selected", "data-highlightable"],
      childList: true,
      subtree: true,
    });
    sync();
  };
  whenBodyReady(observe);
}
