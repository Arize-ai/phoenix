import React, { useMemo, useState } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Accordion, AccordionItem, Card } from "@arizeai/components";

import { CopyToClipboardButton, Flex, View } from "@phoenix/components";
import {
  CodeLanguage,
  CodeLanguageRadioGroup,
  PythonBlock,
  TypeScriptBlock,
} from "@phoenix/components/code";

import { PromptCodeExportCard__main$key } from "./__generated__/PromptCodeExportCard__main.graphql";
import { mapPromptToSnippet } from "./promptCodeSnippets";

export function PromptCodeExportCard({
  promptVersion,
}: {
  promptVersion: PromptCodeExportCard__main$key;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  const data = useFragment<PromptCodeExportCard__main$key>(
    graphql`
      fragment PromptCodeExportCard__main on PromptVersion {
        invocationParameters
        modelName
        modelProvider
        outputSchema {
          definition
        }
        tools {
          definition
        }
        template {
          __typename
          ... on PromptChatTemplate {
            messages {
              ... on JSONPromptMessage {
                role
                jsonContent: content
              }
              ... on TextPromptMessage {
                role
                content
              }
            }
          }
          ... on PromptStringTemplate {
            template
          }
        }
        templateFormat
        templateType
      }
    `,
    promptVersion
  );
  const snippet = useMemo(
    () => mapPromptToSnippet({ promptVersion: data, language }),
    [data, language]
  );
  return (
    <Card
      title="Code"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex gap="size-100">
          <CodeLanguageRadioGroup language={language} onChange={setLanguage} />
          <CopyToClipboardButton text={snippet} />
        </Flex>
      }
    >
      <Accordion>
        <AccordionItem title="Snippet" id="snippet">
          <View padding="size-100">
            {language === "Python" ? (
              <PythonBlock value={snippet} />
            ) : language === "TypeScript" ? (
              <TypeScriptBlock value={snippet} />
            ) : null}
          </View>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
