import { Dialog } from "@arizeai/components";

import {
  SpanAnnotationsEditor,
  SpanAnnotationsEditorProps,
} from "./SpanAnnotationsEditor";

type EditSpanAnnotationsDialogProps = SpanAnnotationsEditorProps;
export function EditSpanAnnotationsDialog(
  props: EditSpanAnnotationsDialogProps
) {
  return (
    <Dialog title="Annotate" size="M" isDismissable>
      <SpanAnnotationsEditor {...props} />
    </Dialog>
  );
}
