import { Dialog } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
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
