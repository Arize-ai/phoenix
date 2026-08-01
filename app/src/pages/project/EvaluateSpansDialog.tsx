import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  View,
} from "@phoenix/components";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { usePreferencesContext } from "@phoenix/contexts";

import { PythonEvaluateSpansGuide } from "./PythonEvaluateSpansGuide";
import { TypeScriptEvaluateSpansGuide } from "./TypeScriptEvaluateSpansGuide";

/**
 * A slide-over guide that bridges tracing to evaluation: given the spans the
 * user selected, it shows a ready-to-run snippet that pulls those spans, runs
 * an evaluator over them, and logs the results back as span annotations.
 */
export function EvaluateSpansDialog({
  projectName,
  spanIds,
}: {
  projectName: string;
  /**
   * The OpenTelemetry span IDs of the selected spans
   */
  spanIds: string[];
}) {
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Evaluate the Selected Spans</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-100">
            <CodeLanguageRadioGroup
              language={programmingLanguage}
              onChange={setProgrammingLanguage}
            />
          </View>
          {programmingLanguage === "Python" ? (
            <PythonEvaluateSpansGuide
              projectName={projectName}
              spanIds={spanIds}
            />
          ) : (
            <TypeScriptEvaluateSpansGuide
              projectName={projectName}
              spanIds={spanIds}
            />
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
