import { CopyToClipboardButton, Counter } from "@phoenix/components";

import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { LLMToolSchemasList } from "./LLMToolSchemasList";
import type { SpanInfoSectionProps } from "./types";
import { formatJSONStringsForCopy } from "./utils";

/**
 * The top-level collection of tool definitions advertised to an LLM.
 * Individual schemas stay nested so the number of top-level sections remains
 * bounded regardless of how many tools the model can call.
 */
export function LLMToolDefinitions({
  toolSchemas,
  sectionId,
  bordered,
}: {
  toolSchemas: string[];
} & SpanInfoSectionProps) {
  const sectionProps = useSpanInfoCardProps("toolDefinitions");
  return (
    <SpanDetailsDisclosureSection
      sectionId={sectionId}
      bordered={bordered}
      title="Tool Definitions"
      titleExtra={<Counter variant="quiet">{toolSchemas.length}</Counter>}
      extra={
        <CopyToClipboardButton text={formatJSONStringsForCopy(toolSchemas)} />
      }
      {...sectionProps}
    >
      <LLMToolSchemasList toolSchemas={toolSchemas} />
    </SpanDetailsDisclosureSection>
  );
}
