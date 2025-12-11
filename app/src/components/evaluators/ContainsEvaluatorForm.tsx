import React, { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { css } from "@emotion/react";

import {
  Card,
  Checkbox,
  ComboBox,
  ComboBoxItem,
  FieldError,
  Flex,
  Input,
  Label,
  Text,
  TextField,
} from "@phoenix/components";
import {
  type CodeLanguage,
  CodeLanguageRadioGroup,
} from "@phoenix/components/code";
import { CodeBlock } from "@phoenix/components/CodeBlock";
import type { EvaluatorFormValues } from "@phoenix/components/evaluators/EvaluatorForm";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import type { EvaluatorInput } from "@phoenix/components/evaluators/utils";

const PYTHON_CODE = `
def contains(
  text: str,
  words: str,
  case_sensitive: bool = False,
) -> bool:
  words = [word.strip() for word in words.split(",")]
  if case_sensitive:
    return any(word in text for word in words)
  else:
    return any(word.lower() in text.lower() for word in words)
`.trim();

const TYPESCRIPT_CODE = `
function contains(
  text: string,
  words: string,
  caseSensitive: boolean = false,
): boolean {
  words = words.split(",").map((word) => word.trim());
  if (caseSensitive) {
    return words.some((word) => text.includes(word));
  }
  return words.some((word) => text.toLowerCase().includes(word.toLowerCase()));
}
`.trim();

type ContainsEvaluatorFormProps = {
  evaluatorInputObject: EvaluatorInput | null;
};

export const ContainsEvaluatorForm = ({
  evaluatorInputObject,
}: ContainsEvaluatorFormProps) => {
  const { control, getValues } = useFormContext<EvaluatorFormValues>();
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  const [containsTextPath, setContainsTextPath] = useState<string>(
    () => getValues("inputMapping.pathMapping.text") ?? ""
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(evaluatorInputObject);
  return (
    <Flex direction="column" gap="size-200">
      <Card
        title="Code"
        extra={
          <Flex gap="size-100" alignItems="center">
            <CodeLanguageRadioGroup
              language={language}
              onChange={setLanguage}
              size="S"
            />
          </Flex>
        }
      >
        <CodeBlock
          language={language}
          value={language === "Python" ? PYTHON_CODE : TYPESCRIPT_CODE}
        />
      </Card>
      <Flex direction="column" gap="size-100">
        <Controller
          name={`inputMapping.pathMapping.text`}
          control={control}
          render={({ field }) => (
            <ComboBox
              aria-label={`Map an example field to the Text parameter`}
              placeholder="Map an example field to the Text parameter"
              defaultItems={allExampleKeys}
              selectedKey={field.value ?? ""}
              label="Text"
              size="L"
              description={`The text to search for the words in. Choose an example field from the list to map to the Text parameter.`}
              onSelectionChange={(key) => {
                field.onChange(key);
                setContainsTextPath(key as string);
              }}
              onInputChange={(value) => setContainsTextPath(value)}
              inputValue={containsTextPath ?? ""}
              css={css`
                width: 100%;
                min-width: 0 !important;
                // allow the combobox to shrink to prevent blowing up page layout
                .px-combobox-container {
                  min-width: 0 !important;
                  input {
                    min-width: 0 !important;
                  }
                }
              `}
            >
              {(item) => (
                <ComboBoxItem key={item.id} id={item.id} textValue={item.id}>
                  {item.label}
                </ComboBoxItem>
              )}
            </ComboBox>
          )}
        />
        <Controller
          control={control}
          name="inputMapping.literalMapping.words"
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              value={String(field.value)}
              isInvalid={!!error}
            >
              <Label>Words</Label>
              <Input />
              {!error && (
                <Text slot="description">
                  A comma separated list of words to search for in the text.
                </Text>
              )}
              {error && <FieldError>{error.message}</FieldError>}
            </TextField>
          )}
        />
        <Controller
          name="inputMapping.literalMapping.case_sensitive"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <Checkbox
              {...field}
              value={String(field.value ?? "")}
              onChange={(value) => field.onChange(value)}
              isSelected={Boolean(
                typeof field.value === "boolean"
                  ? field.value
                  : typeof field.value === "string"
                    ? field.value.toLowerCase() === "true"
                    : false
              )}
            >
              <Label>Case sensitive</Label>
              <Text slot="description">
                Whether to match the words case sensitive.
              </Text>
            </Checkbox>
          )}
        />
      </Flex>
    </Flex>
  );
};
