import { OVERVIEW_STORY_NAME } from "../../stories/_meta/taxonomy";
import { whenBodyReady } from "./whenBodyReady";

/**
 * Storybook's name for a docs entry that declares none (`docs.defaultName`):
 * every autodocs page, and MDX attached to its stories with `<Meta of>`.
 */
const DEFAULT_DOCS_NAME = "Docs";
/** A search result's text: its title line, then its path line. */
const RESULT_LABEL_SELECTOR = ".search-result-item--label";
const HIDDEN_TITLE_ATTRIBUTE = "data-phoenix-docs-title-hidden";
const HIDDEN_SEGMENT_ATTRIBUTE = "data-phoenix-overview-segment-hidden";
const SUBJECT_TITLE_CLASS = "phoenix-docs-subject-title";
const STYLE_ELEMENT_ID = "phoenix-search-docs-title-styles";

/**
 * Drop the trailing `Overview` from a subject Overview's path, so
 * `Typography` reads `Design System / Typography`. In the sidebar the Overview
 * is its folder (`subjectOverviews.ts` hides its row and opens it from the
 * folder), so the path names the folder the result opens, and ends in the
 * result's own name as every docs result's path does.
 *
 * React reuses these segment elements across results as the query changes, so
 * the mark is re-derived on every sync and removed when it no longer applies.
 */
function syncOverviewPath(title: Element, path: Element) {
  const segment = path.lastElementChild;
  if (!segment) {
    return;
  }
  const isOverview =
    segment.textContent === OVERVIEW_STORY_NAME &&
    segment.previousElementSibling?.textContent === title.textContent;
  if (segment.hasAttribute(HIDDEN_SEGMENT_ATTRIBUTE) !== isOverview) {
    segment.toggleAttribute(HIDDEN_SEGMENT_ATTRIBUTE, isOverview);
  }
}

/**
 * Keep one result's title in step with its path. A result titled "Docs" shows
 * its subject instead: the last path segment, which for a docs page is the
 * component it documents. Any other result is left as Storybook drew it.
 */
function syncResult(label: Element) {
  const [title, path] = Array.from(label.children).filter(
    (child) => !child.classList.contains(SUBJECT_TITLE_CLASS)
  );
  if (!title || !path) {
    return;
  }
  syncOverviewPath(title, path);
  const subject = label.querySelector(`:scope > .${SUBJECT_TITLE_CLASS}`);
  const segment = path.lastElementChild;
  if (title.textContent !== DEFAULT_DOCS_NAME || !segment) {
    subject?.remove();
    title.removeAttribute(HIDDEN_TITLE_ATTRIBUTE);
    return;
  }
  if (!title.hasAttribute(HIDDEN_TITLE_ATTRIBUTE)) {
    title.setAttribute(HIDDEN_TITLE_ATTRIBUTE, "");
  }
  let replacement = subject;
  if (!replacement) {
    replacement = document.createElement("div");
    title.after(replacement);
  }
  const className = `${title.className} ${SUBJECT_TITLE_CLASS}`;
  if (replacement.className !== className) {
    replacement.className = className;
  }
  if (replacement.innerHTML !== segment.outerHTML) {
    replacement.replaceChildren(segment.cloneNode(true));
  }
}

/**
 * Title docs search results by their subject rather than "Docs".
 *
 * Search swaps a matched component for its docs page, and titles each result
 * with the entry's `name`; `sidebar.renderLabel` is not applied there. Every
 * autodocs page is named "Docs" and Storybook offers no per-page name, so a
 * search for "Button" would list "Docs" with the component only in the small
 * path line beneath.
 *
 * The subject is already the last segment of that path line, and Storybook
 * has highlighted in it whatever the query matched. So the title becomes a
 * copy of that rendered segment, highlight marks included, and matches every
 * other result without re-deriving the match. Storybook's own title element
 * stays in place, hidden, and the copy is a sibling after it: nothing React
 * rendered is removed or rewritten, so React's updates still land.
 *
 * Results re-render on every keystroke, so a MutationObserver re-syncs them,
 * writing only when something differs so its own writes settle.
 *
 * Overview pages are named after their subject in `<Meta name>`, which also
 * lets search rank them by that name, so they are never retitled; only their
 * path is trimmed (see `syncOverviewPath`).
 */
export function installSearchDocsTitles() {
  if (!document.getElementById(STYLE_ELEMENT_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
      ${RESULT_LABEL_SELECTOR} > [${HIDDEN_TITLE_ATTRIBUTE}],
      ${RESULT_LABEL_SELECTOR} [${HIDDEN_SEGMENT_ATTRIBUTE}] { display: none; }
    `;
    document.head.appendChild(style);
  }

  const sync = () => {
    document.querySelectorAll(RESULT_LABEL_SELECTOR).forEach(syncResult);
  };
  whenBodyReady(() => {
    new MutationObserver(sync).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    sync();
  });
}
