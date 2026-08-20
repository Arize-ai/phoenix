import { useState } from "react";

import type { CardProps } from "@phoenix/components";
import {
  Card,
  ContextualHelp,
  Counter,
  ExternalLink,
  Heading,
  Text,
} from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
  useJSONView,
} from "@phoenix/components/code";

import { defaultCardProps } from "./constants";

const attributesContextualHelp = (
  <ContextualHelp>
    <Heading weight="heavy" level={4}>
      Span Attributes
    </Heading>
    <Text>
      Attributes are key-value pairs that represent metadata associated with a
      span. For detailed descriptions of specific attributes, consult the
      semantic conventions section of the OpenInference tracing specification.
    </Text>
    <footer>
      <ExternalLink href="https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md">
        Semantic Conventions
      </ExternalLink>
    </footer>
  </ContextualHelp>
);

/**
 * The card body and header, inside the provider so both can read the same
 * view state — the header needs the attribute count, the body the entries.
 */
function AttributesCardContents({
  defaultOpen,
  ...collapseProps
}: { defaultOpen: boolean } & SpanAttributesCardCollapseProps) {
  // Every flattened key, not the rows currently listed: the count describes
  // the span, so it should not drop as the user narrows the search
  const { entries, isViewable } = useJSONView();
  const [isCollapsed, setIsCollapsed] = useState(!defaultOpen);
  return (
    <Card
      {...defaultCardProps}
      {...collapseProps}
      title="Attributes"
      defaultOpen={defaultOpen}
      titleExtra={
        <>
          {/* attributes that could not be parsed have no keys to count, and the
              body shows them verbatim -- a "0" beside that would contradict it */}
          {isViewable ? (
            <Counter variant="quiet">{entries.length}</Counter>
          ) : null}
          {attributesContextualHelp}
        </>
      }
      // the title now holds a counter and a help popover, so the collapse
      // toggle is a standalone arrow rather than a button wrapping them
      interactiveTitle
      collapseButtonLabel="Attributes"
      onCollapseChange={setIsCollapsed}
      // searching, copying and switching views have nothing to act on while
      // the body is hidden
      extra={
        isCollapsed ? null : (
          <JSONViewToolbar searchPlaceholder="Search attributes" />
        )
      }
    >
      <JSONViewBody
        emptyMessage="This span has no attributes"
        noResultsMessage="No matching attributes"
      />
    </Card>
  );
}

/**
 * The card's open state, when the caller owns it. The info tab passes these so
 * its expand/collapse control reaches the card; the attributes tab, where the
 * card is the whole view, leaves them unset.
 */
type SpanAttributesCardCollapseProps = Pick<
  CardProps,
  "isOpen" | "onOpenChange"
>;

/**
 * A card that displays all the attributes of a span, either as a searchable
 * table of the flattened attribute keys or as the JSON document itself.
 *
 * The view's controls live in the card header rather than in a toolbar above
 * the content, which is why the state is lifted into `JSONViewProvider`.
 */
export function SpanAttributesCard({
  attributes,
  defaultOpen = true,
  ...collapseProps
}: {
  attributes: string;
  /**
   * Whether the card starts expanded. Set `false` where the card is a
   * reference appended below the span's own view rather than the thing the
   * reader came for.
   * @default true
   */
  defaultOpen?: boolean;
} & SpanAttributesCardCollapseProps) {
  return (
    // OpenTelemetry addresses list items with a dotted index
    // (`llm.input_messages.0.message.content`), so the keys read exactly as
    // they do on the wire and can be pasted straight into instrumentation
    <JSONViewProvider
      value={attributes}
      defaultMode="table"
      indexNotation="dot"
    >
      <AttributesCardContents defaultOpen={defaultOpen} {...collapseProps} />
    </JSONViewProvider>
  );
}
