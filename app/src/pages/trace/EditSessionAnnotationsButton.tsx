import type { ButtonProps } from "@phoenix/components";
import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { EditSessionAnnotationsDialog } from "@phoenix/components/trace/EditSessionAnnotationsDialog";

export function EditSessionAnnotationsButton({
  sessionNodeId,
  projectId,
  size = "M",
  buttonText = "Annotate",
}: {
  sessionNodeId: string;
  projectId: string;
  /**
   * The size of the button
   * @default M
   */
  size?: ButtonProps["size"];
  /**
   * The text of the button
   * @default "Annotate"
   */
  buttonText?: string | null;
}) {
  return (
    <DialogTrigger>
      <Button
        size={size}
        aria-label="Annotate Session"
        leadingVisual={<Icon svg={<Icons.Edit />} />}
      >
        {buttonText}
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <EditSessionAnnotationsDialog
            sessionNodeId={sessionNodeId}
            projectId={projectId}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
