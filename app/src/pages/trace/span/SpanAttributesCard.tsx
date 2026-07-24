import {
  Card,
  ContextualHelp,
  ExternalLink,
  Heading,
  Text,
} from "@phoenix/components";
import { AttributesJSONBlock } from "@phoenix/components/code";

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
 * A card that displays all the attributes of a span as pretty-printed JSON.
 */
export function SpanAttributesCard({ attributes }: { attributes: string }) {
  return (
    <Card
      title="All Attributes"
      titleExtra={attributesContextualHelp}
      {...defaultCardProps}
    >
      <AttributesJSONBlock attributes={attributes} />
    </Card>
  );
}
