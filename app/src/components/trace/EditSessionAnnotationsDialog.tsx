import { Dialog } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

import type { SessionAnnotationsEditorProps } from "./SessionAnnotationsEditor";
import { SessionAnnotationsEditor } from "./SessionAnnotationsEditor";

type EditSessionAnnotationsDialogProps = SessionAnnotationsEditorProps;
export function EditSessionAnnotationsDialog(
  props: EditSessionAnnotationsDialogProps
) {
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Annotate Session</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton slot="close" />
        </DialogTitleExtra>
      </DialogHeader>
      <DialogContent>
        <SessionAnnotationsEditor {...props} />
      </DialogContent>
    </Dialog>
  );
}
