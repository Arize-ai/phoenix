import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import {
  Card,
  ContextualHelp,
  DocumentationHelp,
  ExternalLink,
  Flex,
  Heading,
  Label,
  Text,
} from "@phoenix/components";

/**
 * Contextual help is the small help or info icon that sits beside a label,
 * column header, or card title and explains it in a tooltip. It opens on
 * hover or focus with no delay.
 *
 * - **`ContextualHelp`** takes any tooltip content as children. `variant`
 *   picks the glyph: `help` (the default, a question mark) or `info`. Give
 *   `triggerAriaLabel` when "More information" does not describe the icon,
 *   and pass tooltip props such as `placement` through.
 * - **`DocumentationHelp`** is `ContextualHelp` bound to a registered Phoenix
 *   documentation topic. It renders the `info` variant with the icon as a
 *   link to the topic's documentation, a short description, and a "View
 *   documentation" link. Prefer it wherever a documentation page exists.
 *
 * These stories open on hover or focus rather than rendering open. Neither
 * component exposes a controlled open state: `ContextualHelp` owns its
 * `TooltipTrigger` internally, and React Aria positions a tooltip from its
 * trigger's state, so an `isOpen` passed through to the inner `Tooltip`
 * renders it unpositioned in the corner of the page. `DocumentationHelp`
 * accepts only `topic` and its description.
 */
const meta = {
  title: "Design System/Overlays/Contextual Help",
  component: ContextualHelp,
  parameters: {
    layout: "centered",
    themeLayout: "column",
  },
  tags: ["updated", "unreviewed", "complete"],
} satisfies Meta<typeof ContextualHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One labeled cell of the gallery. */
function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100" width="280px">
      <Text size="XS" color="text-700">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

/**
 * The shapes production gives contextual help, each beside the label it
 * explains. Hover or focus an icon to open its tooltip, which opens with no
 * delay: a heading and sentence on a table column header (`help`), a
 * heading and sentence on a form label (`info`), a bare sentence on a card
 * title, and a longer explanation on a card title that ends in an external
 * link.
 */
export const Default: Story = {
  name: "Contextual Help",
  render: () => (
    <Flex direction="row" gap="size-400" wrap="wrap" width="620px">
      <Case label="help — column header">
        <Flex direction="row" gap="size-50" alignItems="center">
          <span>annotations</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Annotations
            </Heading>
            <Text>
              Evaluations and human annotations logged via the API or set via
              the UI.
            </Text>
          </ContextualHelp>
        </Flex>
      </Case>
      <Case label="info — form label">
        <Flex direction="row" alignItems="center" gap="size-50">
          <Label>Data</Label>
          <ContextualHelp variant="info">
            <Heading weight="heavy" level={4}>
              Spans vs. Traces
            </Heading>
            <Text>
              Spans downloads only the selected spans. Traces downloads every
              span with a matching trace ID.
            </Text>
          </ContextualHelp>
        </Flex>
      </Case>
      <Case label="info — plain text on a card title">
        <Card
          title="Annotation Configs"
          titleExtra={
            <ContextualHelp variant="info">
              Annotation Configs are configured globally and can be associated
              with multiple projects. Select the annotation configs you want to
              use for this project.
            </ContextualHelp>
          }
        />
      </Case>
      <Case label="help — long content with a link">
        <Card
          title="Attributes"
          titleExtra={
            <ContextualHelp>
              <Heading weight="heavy" level={4}>
                Span Attributes
              </Heading>
              <Text>
                Attributes are key-value pairs that represent metadata
                associated with a span. For detailed descriptions of specific
                attributes, consult the semantic conventions section of the
                OpenInference tracing specification.
              </Text>
              <footer>
                <ExternalLink href="https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md">
                  Semantic Conventions
                </ExternalLink>
              </footer>
            </ContextualHelp>
          }
        />
      </Case>
    </Flex>
  ),
};

/**
 * `DocumentationHelp` on a registered topic. Hover or focus the icon to
 * open its tooltip; pressing the icon opens the topic's documentation.
 */
export const DocumentationTopic: Story = {
  name: "Documentation Help",
  render: () => (
    <Card
      title="System API Keys"
      width="480px"
      titleExtra={
        <DocumentationHelp topic="apiKeys">
          Create system-wide credentials for automated and programmatic access
          to Phoenix.
        </DocumentationHelp>
      }
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ alignSelf: "flex-end" }}>
      <Flex direction="row" alignItems="center" gap="size-50">
        <Label>Data</Label>
        <ContextualHelp variant="info">
          <Heading weight="heavy" level={4}>
            Spans vs. Traces
          </Heading>
          <Text>Spans downloads only the selected spans.</Text>
        </ContextualHelp>
      </Flex>
    </div>
  ),
  // No controllable open state (see above); its tooltip opens on hover of
  // the help button.
  parameters: { thumbnail: { hover: "button" } },
};
