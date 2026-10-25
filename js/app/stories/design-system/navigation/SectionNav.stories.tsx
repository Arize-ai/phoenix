import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useId } from "react";

import {
  Dialog,
  Drawer,
  DrawerPlane,
  OverlayFrameProvider,
  SectionNav,
  SectionNavSection,
  Text,
} from "@phoenix/components";
import type {
  SectionNavItem,
  SectionNavOrientation,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";

/**
 * Navigation over one scrolling pane: a sticky bar of links (or a rail beside
 * the sections) where every section stays rendered. Clicking a link scrolls
 * its section to just below the bar and moves focus into it; scrolling the
 * pane moves the current link to the section under the bar, and to the last
 * section once the pane is scrolled to its end. It shares the tab bar's look
 * but is a `<nav>` of in-page links marked with `aria-current`, not a tablist.
 *
 * Scroll the panes below or click a link to see the current link follow.
 * Smooth scrolling and the indicator's slide follow the operating system's
 * reduced-motion setting, so they are not toggled here. Each nav shows the
 * current link beside links that are not current; hover and keyboard focus
 * are drawn only while the pointer or focus is on a link.
 */
const meta: Meta = {
  title: "Design System/Navigation/Section Nav",
  component: SectionNav,
  subcomponents: { SectionNavSection },
  tags: ["updated", "unreviewed", "incomplete", "unused"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type RunSection = SectionNavItem & { paragraphs: string[] };

const RUN_SECTIONS: RunSection[] = [
  {
    id: "annotations",
    label: "Annotations",
    paragraphs: [
      "correctness: correct (score 1.0), explained by the judge as matching the reference answer on every fact.",
      "hallucination: factual (score 0). No claims beyond the retrieved documents.",
    ],
  },
  {
    id: "input",
    label: "Input",
    paragraphs: [
      "What is the refund window for annual plans purchased through the self-serve checkout, and does it differ for plans bought through a reseller?",
      "Context: the customer is on the Team plan and renewed eleven days ago.",
    ],
  },
  {
    id: "reference-output",
    label: "Reference output",
    paragraphs: [
      "Annual plans bought through self-serve checkout can be refunded in full within 30 days of purchase or renewal.",
      "Reseller purchases follow the reseller's own refund policy; direct the customer to their reseller.",
    ],
  },
  {
    id: "output",
    label: "Output",
    paragraphs: [
      "You renewed eleven days ago, so you're within the 30-day refund window for annual plans bought through self-serve checkout.",
      "If you bought your plan through a reseller, their refund policy applies instead — reach out to them directly.",
      "To request the refund yourself, open Settings › Billing, choose your annual plan, and select Request refund. Refunds go back to the original payment method.",
      "Most refunds post within 5–10 business days, depending on your bank. You'll get an email confirmation as soon as the refund is issued.",
      "Your workspace stays on the Team plan until the refund is processed, then moves to the Free plan. Projects and traces are kept, but members beyond the Free plan's seat limit lose access.",
      "Would you like me to start the refund now?",
    ],
  },
  {
    id: "metadata",
    label: "Metadata",
    paragraphs: ["model: gpt-4o-mini · latency: 1.84s · tokens: 1,204"],
  },
];

const MANY_SECTIONS: RunSection[] = [
  ...RUN_SECTIONS,
  {
    id: "evaluator-traces",
    label: "Evaluator traces",
    paragraphs: ["2 evaluator runs, both succeeded."],
  },
  {
    id: "span-attributes",
    label: "Span attributes",
    paragraphs: [
      "llm.model_name, llm.token_count.total, llm.invocation_parameters",
    ],
  },
];

const paneCSS = css`
  overflow-y: auto;
  box-sizing: border-box;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-background-color-default);
`;

const railRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding-block: var(--global-dimension-size-100);
`;

const sectionsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  padding: var(--global-dimension-size-200);
  min-width: 0;
  flex: 1 1 auto;
  .section-nav-section {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }
`;

const drawerFrameCSS = css`
  position: relative;
  width: 720px;
  height: 360px;
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const drawerBodyCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

/**
 * Section ids must be unique in the document, and both a Docs page and the
 * side-by-side theme layout render a story more than once
 */
function withIdPrefix(prefix: string, sections: RunSection[]): RunSection[] {
  return sections.map((section) => ({
    ...section,
    id: `${prefix}-${section.id}`,
  }));
}

function Sections({ sections }: { sections: RunSection[] }) {
  return (
    <div css={sectionsCSS}>
      {sections.map((section) => (
        <SectionNavSection
          key={section.id}
          id={section.id}
          heading={section.label}
        >
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} elementType="p">
              {paragraph}
            </Text>
          ))}
        </SectionNavSection>
      ))}
    </div>
  );
}

function RunDetailsPane({
  orientation = "horizontal",
  width = "480px",
  height = "280px",
  sections = RUN_SECTIONS,
}: {
  orientation?: SectionNavOrientation;
  width?: string;
  height?: string;
  sections?: RunSection[];
}) {
  const idPrefix = useId();
  const prefixedSections = withIdPrefix(idPrefix, sections);
  const nav = (
    <SectionNav
      aria-label="Run details"
      orientation={orientation}
      sections={prefixedSections}
    />
  );
  return (
    <div css={paneCSS} style={{ width, height }}>
      {orientation === "horizontal" ? (
        <>
          {nav}
          <Sections sections={prefixedSections} />
        </>
      ) : (
        <div css={railRowCSS}>
          {nav}
          <Sections sections={prefixedSections} />
        </div>
      )}
    </div>
  );
}

export const Default: StoryFn = () => <RunDetailsPane />;
Default.parameters = { themeLayout: "column" };

export const Rail: StoryFn = () => (
  <RunDetailsPane orientation="vertical" width="560px" />
);
Rail.tags = ["!dev"];
Rail.parameters = { themeLayout: "column" };

/**
 * In a narrow pane the bar scrolls sideways, fading the edge with links
 * hidden beyond it; labels never wrap or truncate.
 */
export const Overflow: StoryFn = () => (
  <RunDetailsPane width="280px" height="200px" sections={MANY_SECTIONS} />
);
Overflow.tags = ["!dev"];
Overflow.parameters = { themeLayout: "row" };

/**
 * In a drawer's scrolling body, the way a run's details read in a detail
 * panel. The drawer is held open; scroll its body or click a link. Kept off
 * the Docs page because the drawer's dialog takes focus when it mounts.
 */
export const InDrawer: StoryFn = () => {
  const idPrefix = useId();
  const sections = withIdPrefix(idPrefix, MANY_SECTIONS);
  return (
    <OverlayFrameProvider>
      <div css={drawerFrameCSS}>
        <DrawerPlane style={{ inset: 0, position: "absolute" }} />
        <Drawer isOpen onClose={() => {}} defaultSize="80%">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run 3 of 12</DialogTitle>
              </DialogHeader>
              <div css={drawerBodyCSS}>
                <SectionNav aria-label="Run details" sections={sections} />
                <Sections sections={sections} />
              </div>
            </DialogContent>
          </Dialog>
        </Drawer>
      </div>
    </OverlayFrameProvider>
  );
};
InDrawer.tags = ["!autodocs"];
InDrawer.parameters = { themeLayout: "column" };
