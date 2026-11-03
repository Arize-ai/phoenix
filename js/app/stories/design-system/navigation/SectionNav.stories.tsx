import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import { useId, useRef } from "react";

import {
  Dialog,
  Drawer,
  DrawerPlane,
  Flex,
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
 * Navigation for one scrolling pane: a bar of links above the sections, or a
 * rail beside them, where every section stays rendered. Clicking a link
 * scrolls the pane to its section and moves focus into it. Scrolling moves the
 * current link to the section at the top of the pane, and to the last section
 * once the pane is scrolled to its end. It shares the tab bar's look but is a
 * `<nav>` of in-page links marked with `aria-current`, not a tablist.
 *
 * Scroll a pane or click a link to see the current link follow. Smooth
 * scrolling and the indicator's slide turn off when the operating system asks
 * for reduced motion. Hover and keyboard focus are drawn only while the
 * pointer or focus is on a link, so the stories cannot hold them.
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

const SHORT_SECTIONS: RunSection[] = [
  {
    id: "input",
    label: "Input",
    paragraphs: ["What is the refund window for annual plans?"],
  },
  {
    id: "output",
    label: "Output",
    paragraphs: ["Annual plans can be refunded within 30 days of purchase."],
  },
  {
    id: "metadata",
    label: "Metadata",
    paragraphs: ["model: gpt-4o-mini · latency: 0.92s · tokens: 312"],
  },
];

// The bar (or rail) sits beside the scrolling body rather than inside it, so
// the scrollbar spans only the sections
const paneCSS = css`
  display: flex;
  box-sizing: border-box;
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-background-color-default);
  &[data-orientation="horizontal"] {
    flex-direction: column;
  }
  &[data-orientation="vertical"] {
    flex-direction: row;
  }
`;

const paneBodyCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
`;

// Lines the rail's first link up with the first section's heading
const railCSS = css`
  padding-block: var(--global-dimension-size-100);
  padding-inline-start: var(--global-dimension-size-100);
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
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

/**
 * Section ids must be unique in the document, and both a Docs page and the
 * side-by-side theme layout render a story more than once
 */
function withIdPrefix({
  prefix,
  sections,
}: {
  prefix: string;
  sections: RunSection[];
}): RunSection[] {
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
  defaultActiveId,
  isScrollAnimated,
}: {
  orientation?: SectionNavOrientation;
  width?: string;
  height?: string;
  sections?: RunSection[];
  /** Unprefixed id of the section the pane opens on */
  defaultActiveId?: string;
  isScrollAnimated?: boolean;
}) {
  const idPrefix = useId();
  const prefixedSections = withIdPrefix({ prefix: idPrefix, sections });
  const bodyRef = useRef<HTMLDivElement>(null);
  return (
    <div css={paneCSS} data-orientation={orientation} style={{ width, height }}>
      <SectionNav
        aria-label="Run details"
        orientation={orientation}
        sections={prefixedSections}
        scrollContainerRef={bodyRef}
        defaultActiveId={
          defaultActiveId == null ? undefined : `${idPrefix}-${defaultActiveId}`
        }
        isScrollAnimated={isScrollAnimated}
        css={orientation === "vertical" ? railCSS : undefined}
      />
      <div ref={bodyRef} css={paneBodyCSS}>
        <Sections sections={prefixedSections} />
      </div>
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
 * `defaultActiveId` opens the pane scrolled to a section other than the
 * first, as when restoring one from the URL hash, and keeps it current until
 * you scroll. `isScrollAnimated={false}` opens it there without motion.
 */
export const DefaultActiveSection: StoryFn = () => (
  <Flex direction="row" gap="size-300" wrap>
    <RunDetailsPane defaultActiveId="output" isScrollAnimated={false} />
    <RunDetailsPane
      orientation="vertical"
      width="560px"
      defaultActiveId="reference-output"
      isScrollAnimated={false}
    />
  </Flex>
);
DefaultActiveSection.tags = ["!dev"];
DefaultActiveSection.parameters = { themeLayout: "column" };

/**
 * In a narrow pane the bar scrolls sideways, fading the edge with links
 * hidden beyond it; labels never wrap or truncate.
 */
export const Overflow: StoryFn = () => (
  <RunDetailsPane width="280px" height="200px" sections={MANY_SECTIONS} />
);
Overflow.tags = ["!dev"];
Overflow.parameters = { themeLayout: "row" };

function RunDetailsDrawer({
  sections,
  height = "360px",
}: {
  sections: RunSection[];
  height?: string;
}) {
  const idPrefix = useId();
  const prefixedSections = withIdPrefix({ prefix: idPrefix, sections });
  const bodyRef = useRef<HTMLDivElement>(null);
  return (
    <OverlayFrameProvider>
      <div css={drawerFrameCSS} style={{ height }}>
        <DrawerPlane style={{ inset: 0, position: "absolute" }} />
        <Drawer isOpen onClose={() => {}} defaultSize="80%">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run 3 of 12</DialogTitle>
              </DialogHeader>
              <SectionNav
                aria-label="Run details"
                sections={prefixedSections}
                scrollContainerRef={bodyRef}
              />
              <div ref={bodyRef} css={paneBodyCSS}>
                <Sections sections={prefixedSections} />
              </div>
            </DialogContent>
          </Dialog>
        </Drawer>
      </div>
    </OverlayFrameProvider>
  );
}

/**
 * In a detail drawer, the nav sits under the drawer's header and only the
 * body below it scrolls.
 */
export const InDrawer: StoryFn = () => (
  <RunDetailsDrawer sections={MANY_SECTIONS} />
);
// Off the Docs page: the drawer's dialog takes focus when it mounts
InDrawer.tags = ["!autodocs"];
InDrawer.parameters = { themeLayout: "column" };

/**
 * When the drawer is taller than its content, clicking a link still brings
 * its section to the top: the nav adds space below the last section so the
 * body can scroll.
 */
export const ShortContentInDrawer: StoryFn = () => (
  <RunDetailsDrawer sections={SHORT_SECTIONS} height="480px" />
);
// Off the Docs page: the drawer's dialog takes focus when it mounts
ShortContentInDrawer.tags = ["!autodocs"];
ShortContentInDrawer.parameters = { themeLayout: "column" };
