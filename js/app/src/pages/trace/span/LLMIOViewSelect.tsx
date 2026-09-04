import { useState } from "react";

import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";

export type LLMIOView = {
  /** The stable id of the view, used as the select key */
  id: string;
  /** The human readable label shown in the select */
  label: string;
};

/**
 * Tracks the selected view for an LLM Input / Output card. Defaults to the
 * first available view (callers push the primary view first) and falls back to
 * it when the current selection is no longer available (e.g. the span changed).
 */
export function useLLMIOView(views: LLMIOView[]) {
  const defaultView = views[0]?.id;
  const [selectedView, setSelectedView] = useState<string | undefined>(
    defaultView
  );
  const view = views.some((v) => v.id === selectedView)
    ? selectedView
    : defaultView;
  return { view, setView: setSelectedView };
}

/**
 * A compact segmented control rendered in the header of an LLM Input / Output
 * card that switches which view is shown in the card body.
 */
export function LLMIOViewSelect({
  label,
  views,
  value,
  onChange,
}: {
  /** Accessible label for the control */
  label: string;
  /** The available views to choose from */
  views: LLMIOView[];
  /** The id of the currently selected view */
  value: string;
  /** Called with the id of the newly selected view */
  onChange: (view: string) => void;
}) {
  return (
    <SegmentedControl
      aria-label={label}
      size="S"
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      {views.map((view) => (
        <SegmentedControlItem key={view.id} id={view.id}>
          {view.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
