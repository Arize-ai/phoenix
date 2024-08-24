import React from "react";

import { Radio, RadioGroup } from "@arizeai/components";

export type CodeLanguage = "Python" | "TypeScript";

export function CodeLanguageRadioGroup({
  language,
  onChange,
}: {
  language: CodeLanguage;
  onChange: (language: CodeLanguage) => void;
}) {
  return (
    <RadioGroup
      defaultValue={language}
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (v === "Python" || v === "TypeScript") {
          onChange(v);
        } else {
          throw new Error(`Unknown language: ${v}`);
        }
      }}
    >
      <Radio label="Python" value={"Python"}>
        Python
      </Radio>
      <Radio label="TypeScript" value={"TypeScript"}>
        TypeScript
      </Radio>
    </RadioGroup>
  );
}
