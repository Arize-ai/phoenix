import {
  Button,
  ButtonProps,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";

export function EditSpanAnnotationsButton({
  spanNodeId,
  projectId,
  size = "M",
  buttonText = "Annotate",
}: {
  spanNodeId: string;
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
  buttonText: string | null;
}) {
  return (
    <DialogTrigger>
      <Button
        size={size}
        aria-label="Edit Span Annotations"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
      >
        {buttonText}
      </Button>
      <ModalOverlay>
        <Modal variant="slideover" size="L">
          <EditSpanAnnotationsDialog
            spanNodeId={spanNodeId}
            projectId={projectId}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
