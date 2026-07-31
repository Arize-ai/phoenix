import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons, Text } from "@phoenix/components";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@phoenix/components/ai/attachment";
import type { FilePart, ImagePart } from "@phoenix/schemas/promptSchemas";
import { mediaDisplayName, resolveMediaUrl } from "@phoenix/utils/mediaUtils";

import type { MessageMediaState } from "./media/useMessageMedia";

const mediaContainerCSS = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-250);

  & > [data-variant="grid"] {
    margin-left: 0;
  }
`;

const variablePillCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  border: 1px solid var(--global-color-primary);
  border-radius: var(--global-rounding-small);
  color: var(--global-color-primary);
  font-family: var(--global-font-family-code);
  font-size: var(--global-dimension-static-font-size-75);
`;

const storedListCSS = css`
  width: 100%;

  & > [data-variant="list"] {
    margin-left: 0;
  }
`;

/** A named media slot, shown where it sits in the message. */
function MediaVariablePill({
  name,
  icon,
  onRemove,
  removeLabel,
}: {
  name: string;
  icon: React.ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span css={variablePillCSS}>
      <Icon svg={icon} />
      {`{{${name}}}`}
      <Button
        size="S"
        variant="quiet"
        aria-label={removeLabel}
        leadingVisual={<Icon svg={<Icons.Close />} />}
        onPress={onRemove}
      />
    </span>
  );
}

/**
 * The media a message carries: the images and documents it names, and any it
 * still stores.
 *
 * Read-and-remove only. Media is declared on the message toolbar and supplied on
 * the Inputs panel; this shows where each piece sits in the message and lets it
 * be taken back out. A stored reference from a prompt authored through the API is
 * shown here too, so that opening such a prompt and saving it back does not
 * quietly drop the media.
 */
export function PlaygroundMessageMedia({
  imageVariables,
  images,
  fileVariables,
  files,
  onImageVariablesChange,
  onImagesChange,
  onFileVariablesChange,
  onFilesChange,
}: MessageMediaState) {
  const hasVariables = imageVariables.length > 0 || fileVariables.length > 0;
  return (
    <div css={mediaContainerCSS}>
      {hasVariables ? (
        <Flex direction="row" gap="size-100" wrap="wrap">
          {imageVariables.map((part) => (
            <MediaVariablePill
              key={`image-${part.image.variable}`}
              name={part.image.variable}
              icon={<Icons.Image />}
              removeLabel={`Remove image ${part.image.variable}`}
              onRemove={() =>
                onImageVariablesChange(
                  imageVariables.filter(
                    (other) => other.image.variable !== part.image.variable
                  )
                )
              }
            />
          ))}
          {fileVariables.map((part) => (
            <MediaVariablePill
              key={`file-${part.file.variable}`}
              name={part.file.variable}
              icon={<Icons.FileText />}
              removeLabel={`Remove document ${part.file.variable}`}
              onRemove={() =>
                onFileVariablesChange(
                  fileVariables.filter(
                    (other) => other.file.variable !== part.file.variable
                  )
                )
              }
            />
          ))}
        </Flex>
      ) : null}
      {images.length > 0 || files.length > 0 ? (
        <Flex direction="column" gap="size-50" alignItems="start" width="100%">
          <Text size="XS" color="text-700">
            Stored on this prompt
          </Text>
          {images.length > 0 ? (
            <Attachments variant="grid" style={{ marginLeft: 0 }}>
              {images.map((part, index) => (
                <Attachment
                  key={`${part.image.url}-${index}`}
                  data={{
                    id: `${part.image.url}-${index}`,
                    type: "file",
                    mediaType: part.image.mediaType,
                    url: resolveMediaUrl(part.image.url),
                  }}
                  onRemove={() =>
                    onImagesChange(images.filter((_, other) => other !== index))
                  }
                >
                  <AttachmentPreview />
                  <AttachmentRemove label="Remove image" />
                </Attachment>
              ))}
            </Attachments>
          ) : null}
          {files.length > 0 ? (
            <div css={storedListCSS}>
              <Attachments variant="list" style={{ marginLeft: 0 }}>
                {files.map((part, index) => (
                  <Attachment
                    key={`${part.file.url}-${index}`}
                    data={{
                      id: `${part.file.url}-${index}`,
                      type: "file",
                      mediaType: part.file.mediaType,
                      filename: mediaDisplayName(
                        part.file.url,
                        part.file.mediaType
                      ),
                      url: resolveMediaUrl(part.file.url),
                    }}
                    onRemove={() =>
                      onFilesChange(files.filter((_, other) => other !== index))
                    }
                  >
                    <AttachmentPreview />
                    <AttachmentInfo showMediaType />
                    <AttachmentRemove label="Remove document" />
                  </Attachment>
                ))}
              </Attachments>
            </div>
          ) : null}
        </Flex>
      ) : null}
    </div>
  );
}
