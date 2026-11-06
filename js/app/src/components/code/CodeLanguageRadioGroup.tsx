import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";
import type { SizingProps } from "@phoenix/components/core/types";
import type { ProgrammingLanguage } from "@phoenix/types/code";
import { isProgrammingLanguage } from "@phoenix/types/code";

export function CodeLanguageRadioGroup({
  language,
  onChange,
  size,
}: {
  language: ProgrammingLanguage;
  onChange: (language: ProgrammingLanguage) => void;
} & SizingProps) {
  return (
    <SegmentedControl
      size={size}
      selectedKey={language}
      aria-label="Code Language"
      onSelectionChange={(selectedLanguage) => {
        if (isProgrammingLanguage(selectedLanguage)) {
          onChange(selectedLanguage);
        } else {
          throw new Error(`Unknown language: ${selectedLanguage}`);
        }
      }}
    >
      <SegmentedControlItem aria-label="Python" id="Python">
        Python
      </SegmentedControlItem>
      <SegmentedControlItem aria-label="TypeScript" id="TypeScript">
        TypeScript
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
