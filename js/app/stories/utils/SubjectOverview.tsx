import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { SELECT_STORY } from "storybook/internal/core-events";
import { addons } from "storybook/preview-api";
import { styled } from "storybook/theming";

import { OVERVIEW_STORY_NAME } from "../_meta/taxonomy";

/** The subset of a Storybook `index.json` entry this page reads. */
type IndexEntry = {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
};

type StoryIndex = { entries: Record<string, IndexEntry> };

/** One sidebar child of the subject: a component, a docs page, or a folder. */
type OverviewChild = {
  name: string;
  /** The entry the link opens: the child's docs page if it has one. */
  target: IndexEntry;
  storyCount: number;
  /** A folder's own children, by name; empty for a component or docs page. */
  entryNames: Set<string>;
};

/**
 * Groups every index entry beneath `title` by the sidebar child it belongs to.
 *
 * Built from the live index rather than a hand-written list, so a story added
 * to the subject appears here without touching this page. Children keep index
 * order, which is the sidebar's `storySort` order.
 */
function childrenOf(index: StoryIndex, title: string): OverviewChild[] {
  const prefix = `${title}/`;
  const byName = new Map<string, OverviewChild>();
  for (const entry of Object.values(index.entries)) {
    if (!entry.title.startsWith(prefix)) {
      continue;
    }
    const [name, entryName] = entry.title.slice(prefix.length).split("/");
    if (name === "Overview") {
      continue;
    }
    const nestedEntry =
      entryName && entryName !== OVERVIEW_STORY_NAME ? [entryName] : [];
    const child = byName.get(name);
    if (!child) {
      byName.set(name, {
        name,
        target: entry,
        storyCount: entry.type === "story" ? 1 : 0,
        entryNames: new Set(nestedEntry),
      });
      continue;
    }
    nestedEntry.forEach((nested) => child.entryNames.add(nested));
    if (entry.type === "story") {
      child.storyCount += 1;
    } else if (
      child.target.type !== "docs" ||
      // A folder's card opens its Overview, as its sidebar row does.
      entry.title === `${prefix}${name}/${OVERVIEW_STORY_NAME}`
    ) {
      child.target = entry;
    }
  }
  return [...byName.values()];
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A folder counts its entries before its stories, so its card is not read as
 * one component with the folder's combined story count.
 */
function countLabel({ storyCount, entryNames }: OverviewChild) {
  const stories = storyCount > 0 ? plural(storyCount, "story", "stories") : "";
  if (entryNames.size === 0) {
    return stories;
  }
  const entries = plural(entryNames.size, "entry", "entries");
  return stories ? `${entries} · ${stories}` : entries;
}

/**
 * Real links, so they can be opened in a new tab or copied. A plain click is
 * routed through the manager instead, which is what Storybook's own links do:
 * it navigates without reloading the manager.
 */
function onLinkClick(event: MouseEvent<HTMLAnchorElement>, storyId: string) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  addons.getChannel().emit(SELECT_STORY, { storyId });
}

/** The grid's width is what picks its column count, not the viewport's. */
const GridContainer = styled.div({
  containerType: "inline-size",
  margin: "24px 0",
});

/**
 * One to three columns. The steps sit where a 200px-minimum `auto-fill` grid
 * would gain its third and fourth columns, one column fewer at each.
 */
const Grid = styled.ul({
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr)",
  listStyle: "none",
  margin: 0,
  padding: 0,
  "@container (min-width: 632px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  "@container (min-width: 848px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
});

const CardLink = styled.a(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  color: theme.color.defaultText,
  display: "flex",
  // `sb-unstyled` drops the docs typography along with its prose styles.
  fontFamily: theme.typography.fonts.base,
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  textDecoration: "none",
  "&:hover": {
    borderColor: theme.color.secondary,
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: 2,
  },
}));

const Caption = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 12px",
  "& > :first-of-type": {
    fontSize: theme.typography.size.s3,
    fontWeight: theme.typography.weight.bold,
  },
  "& > :nth-of-type(2)": {
    // Not every converted theme carries the muted text variable.
    color: theme.textMutedColor ?? theme.color.mediumdark,
    fontSize: theme.typography.size.s2,
  },
}));

/**
 * The card grid on a subject's `Overview` page: every component and page
 * beneath `title`, each opening its docs page or, failing that, its first
 * story.
 */
export function SubjectOverview({ title }: { title: string }) {
  const [children, setChildren] = useState<OverviewChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Served beside `iframe.html` by both the dev server and a static build.
    fetch("./index.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`index.json responded ${response.status}`);
        }
        return response.json() as Promise<StoryIndex>;
      })
      .then((index) => {
        if (!cancelled) {
          setChildren(childrenOf(index, title));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  if (error) {
    return <p>Could not load the story index: {error}</p>;
  }
  if (!children) {
    return <p>Loading…</p>;
  }
  return (
    <GridContainer>
      {/* `sb-unstyled` opts the grid out of the docs page's prose typography. */}
      <Grid className="sb-unstyled">
        {children.map((child) => (
          <li key={child.name}>
            <CardLink
              href={`./?path=/${child.target.type}/${child.target.id}`}
              target="_top"
              onClick={(event) => onLinkClick(event, child.target.id)}
            >
              <Caption>
                <span>{child.name}</span>
                {countLabel(child) && <span>{countLabel(child)}</span>}
              </Caption>
            </CardLink>
          </li>
        ))}
      </Grid>
    </GridContainer>
  );
}
