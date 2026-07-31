import {
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Text,
} from "@phoenix/components";

import { PreBlock, ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { ExpandableSpanContent } from "./ExpandableSpanContent";
import type { SpanPromptTemplate } from "./types";
import { formatJSONForCopy } from "./utils";

/**
 * Displays the prompt template and its variables for an LLM span.
 */
export function LLMPromptTemplate({
  promptTemplate,
}: {
  promptTemplate: SpanPromptTemplate;
}) {
  return (
    <DisclosureGroup
      defaultExpandedKeys={["prompt-template", "template-variables"]}
    >
      {promptTemplate.template != null && (
        <Disclosure id="prompt-template">
          <DisclosureTrigger
            arrowPosition="start"
            justifyContent="space-between"
          >
            <Text>Prompt Template</Text>
            <CopyToClipboardButton text={promptTemplate.template} />
          </DisclosureTrigger>
          <DisclosurePanel>
            <ExpandableSpanContent>
              <PreBlock>{promptTemplate.template}</PreBlock>
            </ExpandableSpanContent>
          </DisclosurePanel>
        </Disclosure>
      )}
      {promptTemplate.variables != null && (
        <Disclosure id="template-variables">
          <DisclosureTrigger
            arrowPosition="start"
            justifyContent="space-between"
          >
            <Text>Template Variables</Text>
            <CopyToClipboardButton
              text={formatJSONForCopy(promptTemplate.variables)}
            />
          </DisclosureTrigger>
          <DisclosurePanel>
            <ExpandableSpanContent>
              <ReadonlyJSONBlock>
                {formatJSONForCopy(promptTemplate.variables)}
              </ReadonlyJSONBlock>
            </ExpandableSpanContent>
          </DisclosurePanel>
        </Disclosure>
      )}
    </DisclosureGroup>
  );
}
