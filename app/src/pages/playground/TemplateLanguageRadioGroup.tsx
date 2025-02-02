import React from "react";
import { css } from "@emotion/react";

import { Radio, RadioGroup } from "@arizeai/components";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { isTemplateLanguage } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function TemplateLanguageRadioGroup() {
  const language = usePlaygroundContext((state) => state.templateLanguage);
  const setLanguage = usePlaygroundContext(
    (state) => state.setTemplateLanguage
  );
  return (
    <div
      css={css`
        & * {
          white-space: nowrap;
        }
      `}
    >
      <RadioGroup
        value={language}
        variant="inline-button"
        aria-label="Template Language"
        size="compact"
        onChange={(v) => {
          if (isTemplateLanguage(v)) {
            setLanguage(v);
          }
        }}
      >
        <Radio label="None" value={TemplateLanguages.NONE}>
          None
        </Radio>
        <Radio label="Mustache" value={TemplateLanguages.Mustache}>
          Mustache
        </Radio>
        <Radio label="F-String" value={TemplateLanguages.FString}>
          F-String
        </Radio>
      </RadioGroup>
    </div>
  );
}
