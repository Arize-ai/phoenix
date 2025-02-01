import React, { useMemo, useState } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";
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
              role
              content {
                ... on TextContentPart {
                  __typename
                  text {
                    text
                  }
                }
                ... on ImageContentPart {
                  __typename
                  image {
                    url
                  }
                }
                ... on ToolCallContentPart {
                  __typename
                  toolCall {
                    toolCallId
                    toolCall {
                      name
                      arguments
                    }
                  }
                }
                ... on ToolResultContentPart {
                  __typename
                  toolResult {
                    toolCallId
                    result
                  }
                }
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
  if (!snippet) {
    return (
      <Card title="Code" variant="compact" bodyStyle={{ padding: 0 }}>
        <View padding="size-100">
          <Flex justifyContent="center" alignItems="center">
            <Text color="text-300">
              No code snippet available for this prompt
            </Text>
          </Flex>
        </View>
      </Card>
    );
  }
  return (
    <Card
      title="Code"
      variant="compact"
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex gap="size-100" alignItems="center">
          <CodeLanguageRadioGroup language={language} onChange={setLanguage} />
          <CopyToClipboardButton text={snippet} />
        </Flex>
      }
    >
      <DisclosureGroup defaultExpandedKeys={["snippet"]}>
        <Disclosure id="snippet">
          <DisclosureTrigger>Code</DisclosureTrigger>
          <DisclosurePanel>
            <View padding="size-100">
              {language === "Python" ? (
                <PythonBlock value={snippet} />
              ) : language === "TypeScript" ? (
                <TypeScriptBlock value={snippet} />
              ) : null}
            </View>
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Card>
  );
}
