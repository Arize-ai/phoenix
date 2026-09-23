import {
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Text,
} from "@phoenix/components";
import type { AttributePromptTemplate } from "@phoenix/openInference/tracing/types";

import { PreBlock, ReadonlyJSONBlock } from "../ReadonlyJSONBlock";

/**
 * Displays the prompt template and its variables for an LLM span.
 */
export function LLMPromptTemplate({
  promptTemplate,
}: {
  promptTemplate: AttributePromptTemplate;
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
            <PreBlock>{promptTemplate.template}</PreBlock>
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
              text={JSON.stringify(promptTemplate.variables)}
            />
          </DisclosureTrigger>
          <DisclosurePanel>
            <ReadonlyJSONBlock>
              {JSON.stringify(promptTemplate.variables)}
            </ReadonlyJSONBlock>
          </DisclosurePanel>
        </Disclosure>
      )}
    </DisclosureGroup>
  );
}
