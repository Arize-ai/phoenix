import { useMemo } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Card,
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
  CodeLanguageRadioGroup,
  PythonBlock,
  TypeScriptBlock,
} from "@phoenix/components/code";
import { usePreferencesContext } from "@phoenix/contexts";
import { ProgrammingLanguage } from "@phoenix/types/code";
import { assertUnreachable } from "@phoenix/typeUtils";

import { PromptCodeExportCard__main$key } from "./__generated__/PromptCodeExportCard__main.graphql";
import {
  mapPromptToClientSnippet,
  mapPromptToSDKSnippet,
} from "./promptCodeSnippets";

export function PromptCodeExportCard({
  promptVersion,
}: {
  promptVersion: PromptCodeExportCard__main$key;
}) {
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  const data = useFragment<PromptCodeExportCard__main$key>(
    graphql`
      fragment PromptCodeExportCard__main on PromptVersion {
        id
        invocationParameters
        modelName
        modelProvider
        responseFormat {
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
  const sdkSnippet = useMemo(
    () =>
      mapPromptToSDKSnippet({
        promptVersion: data,
        language: programmingLanguage,
      }),
    [data, programmingLanguage]
  );
  const clientSnippet = useMemo(() => {
    return mapPromptToClientSnippet({
      promptVersion: data,
      language: programmingLanguage,
    });
  }, [data, programmingLanguage]);
  return (
    <Card
      title="Code"
      extra={
        <Flex gap="size-100" alignItems="center">
          <CodeLanguageRadioGroup
            language={programmingLanguage}
            onChange={setProgrammingLanguage}
            size="S"
          />
        </Flex>
      }
    >
      <DisclosureGroup defaultExpandedKeys={["sdk-inline", "client"]}>
        <Disclosure id="sdk-inline">
          <DisclosureTrigger arrowPosition="start">
            <Flex
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap="size-100"
              width="100%"
            >
              <Text>SDK Inline</Text>
              {sdkSnippet ? <CopyToClipboardButton text={sdkSnippet} /> : null}
            </Flex>
          </DisclosureTrigger>
          <DisclosurePanel>
            {sdkSnippet == null ? (
              <View width="100%" padding="size-200">
                <Text color="text-300">
                  No code snippet available for this prompt
                </Text>
              </View>
            ) : (
              <CodeBlock language={programmingLanguage} value={sdkSnippet} />
            )}
          </DisclosurePanel>
        </Disclosure>
        <Disclosure id="client">
          <DisclosureTrigger arrowPosition="start">
            <Flex
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              width="100%"
              gap="size-100"
            >
              <Text>Using the Client</Text>
              {clientSnippet ? (
                <CopyToClipboardButton text={clientSnippet} />
              ) : null}
            </Flex>
          </DisclosureTrigger>
          <DisclosurePanel>
            {clientSnippet == null ? (
              <View width="100%" padding="size-200">
                <Text color="text-300">
                  No client code snippet available for this prompt
                </Text>
              </View>
            ) : (
              <CodeBlock language={programmingLanguage} value={clientSnippet} />
            )}
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Card>
  );
}

function CodeBlock({
  language,
  value,
}: {
  language: ProgrammingLanguage;
  value: string;
}) {
  switch (language) {
    case "Python":
      return <PythonBlock value={value} basicSetup={{ lineNumbers: true }} />;
    case "TypeScript":
      return (
        <TypeScriptBlock value={value} basicSetup={{ lineNumbers: true }} />
      );
    default:
      assertUnreachable(language);
  }
}
