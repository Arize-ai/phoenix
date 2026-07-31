import { useCallback, useMemo } from "react";

import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/promptSchemas";
import type { ChatMessage } from "@phoenix/store";

/** Everything a message editor needs to show and edit the message's media. */
export type MessageMediaState = {
  images: ImagePart[];
  imageVariables: ImageVariablePart[];
  files: FilePart[];
  fileVariables: FileVariablePart[];
  onImagesChange: (parts: ImagePart[]) => void;
  onImageVariablesChange: (parts: ImageVariablePart[]) => void;
  onFilesChange: (parts: FilePart[]) => void;
  onFileVariablesChange: (parts: FileVariablePart[]) => void;
  /** Only user turns may carry media, matching what the API accepts. */
  canAttachMedia: boolean;
};

/**
 * The media half of a message editor, kept out of the editor itself.
 *
 * Four lists and four setters is a lot of hook noise to sit in the middle of
 * `PlaygroundChatTemplate`, which upstream edits often and for reasons that have
 * nothing to do with media. Holding it here means the editor asks for the whole
 * lot in one line.
 */
export function useMessageMedia({
  message,
  updateMessage,
}: {
  message: ChatMessage;
  updateMessage: (patch: Partial<ChatMessage>) => void;
}): MessageMediaState {
  const images = useMemo(() => message.images ?? [], [message.images]);
  const imageVariables = useMemo(
    () => message.imageVariables ?? [],
    [message.imageVariables]
  );
  const files = useMemo(() => message.files ?? [], [message.files]);
  const fileVariables = useMemo(
    () => message.fileVariables ?? [],
    [message.fileVariables]
  );

  const onImagesChange = useCallback(
    (parts: ImagePart[]) => updateMessage({ images: parts }),
    [updateMessage]
  );
  const onImageVariablesChange = useCallback(
    (parts: ImageVariablePart[]) => updateMessage({ imageVariables: parts }),
    [updateMessage]
  );
  const onFilesChange = useCallback(
    (parts: FilePart[]) => updateMessage({ files: parts }),
    [updateMessage]
  );
  const onFileVariablesChange = useCallback(
    (parts: FileVariablePart[]) => updateMessage({ fileVariables: parts }),
    [updateMessage]
  );

  return {
    images,
    imageVariables,
    files,
    fileVariables,
    onImagesChange,
    onImageVariablesChange,
    onFilesChange,
    onFileVariablesChange,
    canAttachMedia: message.role === "user",
  };
}
