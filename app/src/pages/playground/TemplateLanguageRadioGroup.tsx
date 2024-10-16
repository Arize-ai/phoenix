import React from "react";

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
      <Radio label="Mustache" value={TemplateLanguages.Mustache}>
        Mustache
      </Radio>
      <Radio label="F-String" value={TemplateLanguages.FString}>
        F-String
      </Radio>
    </RadioGroup>
  );
}
