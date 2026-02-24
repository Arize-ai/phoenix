import { Dialog } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

import type { SpanAnnotationsEditorProps } from "./SpanAnnotationsEditor";
import { SpanAnnotationsEditor } from "./SpanAnnotationsEditor";

type EditSpanAnnotationsDialogProps = SpanAnnotationsEditorProps;
export function EditSpanAnnotationsDialog(
  props: EditSpanAnnotationsDialogProps
) {
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Annotate</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton slot="close" />
        </DialogTitleExtra>
      </DialogHeader>
      <DialogContent>
        <SpanAnnotationsEditor {...props} />
      </DialogContent>
    </Dialog>
  );
}
