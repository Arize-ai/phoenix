import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import {
  SpanDownloadDialog,
  type SpanDownloadDialogProps,
} from "@phoenix/components/trace/SpanDownloadDialog";

type SpanSelectionDownloadButtonProps = SpanDownloadDialogProps;

/** Opens the bulk span and trace download dialog. */
export function SpanSelectionDownloadButton(
  props: SpanSelectionDownloadButtonProps
) {
  return (
    <DialogTrigger>
      <Button
        size="M"
        aria-label="Download selection"
        leadingVisual={<Icon svg={<Icons.Download />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <SpanDownloadDialog {...props} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
