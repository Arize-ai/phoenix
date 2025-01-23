import React from "react";
import { css } from "@emotion/react";

import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { isTemplateLanguage } from "@phoenix/components/templateEditor/types";
import { SizingProps } from "@phoenix/components/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function TemplateLanguageRadioGroup({ size }: SizingProps) {
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
      <ToggleButtonGroup
        size={size}
        defaultSelectedKeys={[language]}
        aria-label="Template Language"
        onSelectionChange={(v) => {
          if (v.size === 0) {
            return;
          }
          const lang = v.keys().next().value;
          if (isTemplateLanguage(lang)) {
            setLanguage(lang);
          }
        }}
      >
        <ToggleButton aria-label="None" id={TemplateLanguages.NONE}>
          None
        </ToggleButton>
        <ToggleButton aria-label="Mustache" id={TemplateLanguages.Mustache}>
          Mustache
        </ToggleButton>
        <ToggleButton aria-label="F-String" id={TemplateLanguages.FString}>
          F-String
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
