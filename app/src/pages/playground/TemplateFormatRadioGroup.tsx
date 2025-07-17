import { css } from "@emotion/react";

import { ToggleButton, ToggleButtonGroup } from "@phoenix/components";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { isTemplateFormat } from "@phoenix/components/templateEditor/types";
import { SizingProps } from "@phoenix/components/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function TemplateFormatRadioGroup({ size }: SizingProps) {
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const setTemplateFormat = usePlaygroundContext(
    (state) => state.setTemplateFormat
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
        defaultSelectedKeys={[templateFormat]}
        aria-label="Template Format"
        onSelectionChange={(v) => {
          if (v.size === 0) {
            return;
          }
          const format = v.keys().next().value;
          if (typeof format === "string" && isTemplateFormat(format)) {
            setTemplateFormat(format);
          }
        }}
      >
        <ToggleButton aria-label="None" id={TemplateFormats.NONE}>
          None
        </ToggleButton>
        <ToggleButton aria-label="Mustache" id={TemplateFormats.Mustache}>
          Mustache
        </ToggleButton>
        <ToggleButton aria-label="F-String" id={TemplateFormats.FString}>
          F-String
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
