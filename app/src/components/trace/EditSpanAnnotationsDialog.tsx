import { Dialog } from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";

import {
  SpanAnnotationsEditor,
  SpanAnnotationsEditorProps,
} from "./SpanAnnotationsEditor";

type EditSpanAnnotationsDialogProps = SpanAnnotationsEditorProps;
export function EditSpanAnnotationsDialog(
  props: EditSpanAnnotationsDialogProps
) {
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Annotate</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <SpanAnnotationsEditor {...props} />
      </DialogContent>
    </Dialog>
  );
}
