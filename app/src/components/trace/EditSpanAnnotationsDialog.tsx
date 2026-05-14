import { Dialog } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

import type { SpanAnnotationsEditorProps } from "./SpanAnnotationsEditor";
import { SpanAnnotationsEditor } from "./SpanAnnotationsEditor";

type EditSpanAnnotationsDialogProps = SpanAnnotationsEditorProps & {
  isDrawer?: boolean;
};
export function EditSpanAnnotationsDialog(
  props: EditSpanAnnotationsDialogProps
) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annotate</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" isDrawer={props.isDrawer} />
          </DialogTitleExtra>
        </DialogHeader>
        <SpanAnnotationsEditor {...props} />
      </DialogContent>
    </Dialog>
  );
}
