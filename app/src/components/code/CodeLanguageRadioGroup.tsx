import React from "react";

import { Radio, RadioGroup } from "@phoenix/components";
import { SizingProps } from "@phoenix/components/types";

export type CodeLanguage = "Python" | "TypeScript";

export function CodeLanguageRadioGroup({
  language,
  onChange,
  size,
}: {
  language: CodeLanguage;
  onChange: (language: CodeLanguage) => void;
} & SizingProps) {
  return (
    <RadioGroup
      size={size}
      defaultValue={language}
      aria-label="Code Language"
      onChange={(v) => {
        if (v === "Python" || v === "TypeScript") {
          onChange(v);
        } else {
          throw new Error(`Unknown language: ${v}`);
        }
      }}
    >
      <Radio aria-label="Python" value={"Python"}>
        Python
      </Radio>
      <Radio aria-label="TypeScript" value={"TypeScript"}>
        TypeScript
      </Radio>
    </RadioGroup>
  );
}
