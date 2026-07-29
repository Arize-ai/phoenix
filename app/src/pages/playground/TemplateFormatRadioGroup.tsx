import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";
import type { SizingProps } from "@phoenix/components/core/types";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { isTemplateFormat } from "@phoenix/components/templateEditor/types";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export type TemplateFormatRadioGroupProps = SizingProps & {
  /**
   * Whether to show the "None" option
   * @default true
   */
  showNoneOption?: boolean;
};

export function TemplateFormatRadioGroup({
  size,
  showNoneOption = true,
}: TemplateFormatRadioGroupProps) {
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const setTemplateFormat = usePlaygroundContext(
    (state) => state.setTemplateFormat
  );
  return (
    <SegmentedControl
      size={size}
      selectedKey={templateFormat}
      aria-label="Template Format"
      onSelectionChange={(format) => {
        if (typeof format === "string" && isTemplateFormat(format)) {
          setTemplateFormat(format);
        }
      }}
    >
      <SegmentedControlItem aria-label="Mustache" id={TemplateFormats.Mustache}>
        Mustache
      </SegmentedControlItem>
      <SegmentedControlItem aria-label="F-String" id={TemplateFormats.FString}>
        F-String
      </SegmentedControlItem>
      {showNoneOption && (
        <SegmentedControlItem aria-label="None" id={TemplateFormats.NONE}>
          None
        </SegmentedControlItem>
      )}
    </SegmentedControl>
  );
}
