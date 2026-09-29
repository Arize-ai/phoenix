import { typography } from "storybook/theming";

import { whenBodyReady } from "./whenBodyReady";

const ROOT_HEADING_STYLE_ELEMENT_ID = "phoenix-sidebar-root-heading-styles";
const ROOT_HEADING_MARKER_ATTRIBUTE = "data-phoenix-root-heading";
/** Storybook's root toggle: a ghost `Button` inside `.sidebar-subheading`. */
const ROOT_TOGGLE_SELECTOR =
  '.sidebar-subheading [data-action="collapse-root"]';

function ensureRootHeadingStyles({
  themeAttribute,
  textColor,
}: RootHeadingOptions) {
  if (document.getElementById(ROOT_HEADING_STYLE_ELEMENT_ID)) {
    return;
  }
  const colorRules = (["light", "dark"] as const).map(
    (mode) => `
      [${themeAttribute}="${mode}"] ${ROOT_TOGGLE_SELECTOR} {
        color: ${textColor[mode]};
      }`
  );
  const style = document.createElement("style");
  style.id = ROOT_HEADING_STYLE_ELEMENT_ID;
  style.textContent = `
    ${ROOT_TOGGLE_SELECTOR},
    ${ROOT_TOGGLE_SELECTOR}:hover,
    ${ROOT_TOGGLE_SELECTOR}:active {
      background: transparent;
      cursor: default;
      font-size: ${typography.size.m1}px;
      font-weight: 700;
      height: auto;
      letter-spacing: normal;
      line-height: 1.25;
      padding: 0 8px;
      text-transform: none;
      user-select: text;
    }
    ${ROOT_TOGGLE_SELECTOR} > :first-child {
      display: none;
    }
    ${colorRules.join("\n")}
  `;
  document.head.appendChild(style);
}

function makeRootTogglesHeadings(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>(
      `${ROOT_TOGGLE_SELECTOR}:not([${ROOT_HEADING_MARKER_ATTRIBUTE}])`
    )
    .forEach((toggle) => {
      toggle.setAttribute(ROOT_HEADING_MARKER_ATTRIBUTE, "");
      toggle.setAttribute("tabindex", "-1");
      toggle.setAttribute("role", "heading");
      toggle.setAttribute("aria-level", "2");
      toggle.removeAttribute("aria-expanded");
      toggle.removeAttribute("aria-label");
    });
}

function lockRootsOpen() {
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(ROOT_TOGGLE_SELECTOR)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true }
  );
  const observe = () => {
    new MutationObserver(() => makeRootTogglesHeadings(document)).observe(
      document.body,
      { childList: true, subtree: true }
    );
    makeRootTogglesHeadings(document);
  };
  whenBodyReady(observe);
}

type RootHeadingOptions = {
  /** The `<html>` attribute that carries the resolved sidebar theme. */
  themeAttribute: string;
  /** The heading text color for each resolved theme. */
  textColor: Readonly<Record<"light" | "dark", string>>;
};

/**
 * Taxonomy roots (Design System, Domains, …) are always-open headings, not
 * collapsible sections.
 *
 * Storybook 10 has no option for this: every root renders a `CollapseButton`
 * (small, bold, 0.16em-tracked uppercase, muted) whose click toggles the
 * root's expanded state. Roots already start expanded — only `collapsedRoots`
 * would start one collapsed, and we set none — so the remaining work is to
 * restyle that button as a heading and make it inert:
 *
 * - CSS hides its chevron, drops the uppercase treatment, and removes the
 *   ghost-button hover/active/cursor affordances.
 * - A document capture-phase click listener swallows its activation before
 *   React's root listener sees it. Enter/Space on a native button dispatch
 *   `click`, so this covers keyboard activation too. (The tree's own
 *   ArrowLeft handler reads `aria-expanded` from the root `div`, which has
 *   none, so it never collapses a root itself.)
 * - A MutationObserver strips its toggle semantics — out of the tab order,
 *   exposed as a heading instead of a "Collapse" button — whenever Storybook
 *   (re)mounts one. React only patches attributes whose props change, and
 *   `isExpanded` can no longer change, so the patch sticks.
 *
 * The adjacent "Expand all / Collapse all" action is untouched: it toggles a
 * root's descendants, never the root.
 */
export function installRootHeadings(options: RootHeadingOptions) {
  ensureRootHeadingStyles(options);
  lockRootsOpen();
}
