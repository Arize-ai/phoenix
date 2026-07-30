import { css } from "@emotion/react";
import { useId, useState } from "react";

import {
  ContextualHelp,
  Counter,
  DisclosureArrow,
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

import { SpanDetailsSectionHeading } from "../SpanDetailsSectionHeading";

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

const attributesSectionToggleCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  border-radius: var(--global-rounding-small);
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`;

export type SpanAttributesSectionProps = {
  attributes: string;
  bordered?: boolean;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

/**
 * The hydrated contents of the span's Attributes section.
 *
 * The provider wraps both the section heading and body because the count and
 * toolbar describe the same JSON view as the table or JSON document below.
 */
export function SpanAttributesSection({
  attributes,
  bordered = true,
  defaultOpen = true,
  isOpen,
  onOpenChange,
}: SpanAttributesSectionProps) {
  return (
    <JSONViewProvider
      value={attributes}
      defaultMode="table"
      indexNotation="dot"
    >
      <SpanAttributesSectionContents
        bordered={bordered}
        defaultOpen={defaultOpen}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    </JSONViewProvider>
  );
}

function SpanAttributesSectionContents({
  bordered,
  defaultOpen,
  isOpen: controlledIsOpen,
  onOpenChange,
}: Omit<SpanAttributesSectionProps, "attributes"> & {
  defaultOpen: boolean;
}) {
  const { entries, isViewable } = useJSONView();
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const toggleId = useId();
  const bodyId = useId();

  const toggleOpen = () => {
    const nextIsOpen = !isOpen;
    setUncontrolledIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };

  return (
    <>
      <SpanDetailsSectionHeading
        bordered={bordered}
        isCollapsed={!isOpen}
        onTitleClick={toggleOpen}
        titleExtra={
          <>
            {isViewable ? (
              <Counter variant="quiet">{entries.length}</Counter>
            ) : null}
            {attributesContextualHelp}
          </>
        }
        extra={
          isOpen ? (
            <JSONViewToolbar searchPlaceholder="Search attributes" />
          ) : null
        }
      >
        <button
          id={toggleId}
          type="button"
          className="button--reset"
          css={attributesSectionToggleCSS}
          aria-controls={bodyId}
          aria-expanded={isOpen}
          onClick={toggleOpen}
        >
          <DisclosureArrow isExpanded={isOpen} />
          Attributes
        </button>
      </SpanDetailsSectionHeading>
      <div
        id={bodyId}
        aria-labelledby={toggleId}
        hidden={!isOpen}
        data-attributes-section-body
      >
        <JSONViewBody
          emptyMessage="This span has no attributes"
          noResultsMessage="No matching attributes"
        />
      </div>
    </>
  );
}
