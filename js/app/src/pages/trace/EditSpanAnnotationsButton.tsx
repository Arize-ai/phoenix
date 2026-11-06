import type { ButtonProps } from "@phoenix/components";
import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  ViewportModal,
  ViewportModalOverlay,
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
        leadingVisual={<Icon svg={<Icons.Edit />} />}
      >
        {buttonText}
      </Button>
      <ViewportModalOverlay>
        <ViewportModal size="L">
          <EditSpanAnnotationsDialog
            spanNodeId={spanNodeId}
            projectId={projectId}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
