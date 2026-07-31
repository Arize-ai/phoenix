import { css } from "@emotion/react";
import { useCallback, useRef, useState } from "react";

import {
  Alert,
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@phoenix/components/ai/attachment";
import type { MediaKind } from "@phoenix/schemas/mediaPartSchemas";
import {
  importMediaFromUrl,
  mediaDisplayName,
  resolveMediaUrl,
  uploadMedia,
} from "@phoenix/utils/mediaUtils";

const hiddenFileInputCSS = css`
  display: none;
`;

/* Takes the slack on the row so the two buttons keep their natural width. */
const urlFieldCSS = css`
  flex: 1;
  min-width: 0;
`;

const previewCSS = css`
  /*
   * These variants right-align themselves for a chat composer. Here the preview
   * sits under the variable's label, on the left.
   */
  & > [data-variant="grid"],
  & > [data-variant="inline"] {
    margin-left: 0;
  }
`;

/** What each kind of media is called, and what a file picker should accept. */
const KIND_COPY = {
  image: {
    noun: "image",
    accept: "image/*",
    urlPlaceholder: "…or paste an image URL",
    uploadFailed: "Could not upload the image.",
    importFailed: "Could not import that image URL.",
    urlMissing: "Paste an image URL.",
  },
  file: {
    noun: "document",
    // Only PDFs are supported today; naming the type keeps the picker honest
    // rather than offering files the server will reject.
    accept: "application/pdf",
    urlPlaceholder: "…or paste a PDF URL",
    uploadFailed: "Could not upload the document.",
    importFailed: "Could not import that PDF URL.",
    urlMissing: "Paste a PDF URL.",
  },
} as const satisfies Record<MediaKind, unknown>;

/**
 * Supplies the value for a media variable on the Inputs panel.
 *
 * The chosen media is stored immediately and the variable's value becomes the
 * reference to it, so a run substitutes it the same way it substitutes text.
 * Images preview as a thumbnail; documents show their name and type, having
 * nothing to show a picture of.
 */
export function MediaVariableEditor({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  /** Which kind of media the template declared for this variable. */
  kind: MediaKind;
  /** The current `phoenix://media/<sha256>` reference, or empty when unset. */
  value: string;
  onChange: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [mediaType, setMediaType] = useState<string | null>(null);
  const copy = KIND_COPY[kind];

  /** Stores the media, whether it arrived as a file or a URL. */
  const store = useCallback(
    async (
      fetchMedia: () => Promise<{ url: string; mediaType: string }>,
      fallback: string
    ) => {
      setIsBusy(true);
      setError(null);
      try {
        const media = await fetchMedia();
        setMediaType(media.mediaType);
        onChange(media.url);
        setUrlDraft("");
      } catch (storeError) {
        setError(storeError instanceof Error ? storeError.message : fallback);
      } finally {
        setIsBusy(false);
      }
    },
    [onChange]
  );

  const upload = useCallback(
    (file: File) => store(() => uploadMedia(file), copy.uploadFailed),
    [store, copy]
  );

  const importUrl = useCallback(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setError(copy.urlMissing);
      return;
    }
    void store(() => importMediaFromUrl(trimmed), copy.importFailed);
  }, [urlDraft, store, copy]);

  const hasMedia = value !== "";
  // The media type is only known once something has been stored this session; a
  // value restored from a previous one is described by the kind it was declared as.
  const resolvedMediaType =
    mediaType ?? (kind === "image" ? "image/*" : "application/pdf");

  return (
    <Flex direction="column" gap="size-100" width="100%">
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon
          svg={kind === "image" ? <Icons.Image /> : <Icons.FileText />}
          aria-hidden
        />
        <Text weight="heavy" size="XS">
          {label}
        </Text>
      </Flex>
      {error ? (
        <Alert
          variant="danger"
          banner
          dismissable
          onDismissClick={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}
      {hasMedia ? (
        <View css={previewCSS}>
          {/*
           * An image is worth a thumbnail. A document is not — it gets a compact
           * chip, so choosing one does not push the panel around.
           */}
          <Attachments
            variant={kind === "image" ? "grid" : "inline"}
            style={{ marginLeft: 0 }}
          >
            <Attachment
              data={{
                id: value,
                type: "file",
                mediaType: resolvedMediaType,
                filename: mediaDisplayName(value, resolvedMediaType),
                url: resolveMediaUrl(value),
              }}
              onRemove={() => {
                setMediaType(null);
                onChange("");
              }}
            >
              <AttachmentPreview />
              <AttachmentInfo />
              <AttachmentRemove label={`Remove ${copy.noun} for ${label}`} />
            </Attachment>
          </Attachments>
        </View>
      ) : null}
      {/*
       * Both ways of supplying the value sit on one line, so a media input takes
       * up no more room than the plain text input above it.
       */}
      <Flex direction="row" gap="size-100" alignItems="center">
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.CloudUpload />} />}
          isDisabled={isBusy}
          onPress={() => fileInputRef.current?.click()}
        >
          {isBusy ? "Working…" : hasMedia ? "Replace" : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          css={hiddenFileInputCSS}
          type="file"
          accept={copy.accept}
          aria-label={`Choose ${copy.noun} for ${label}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
            // Allow re-picking the same file after a removal.
            event.target.value = "";
          }}
        />
        <div css={urlFieldCSS}>
          <TextField
            value={urlDraft}
            onChange={setUrlDraft}
            isDisabled={isBusy}
            aria-label={`${kind === "image" ? "Image" : "PDF"} URL for ${label}`}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                importUrl();
              }
            }}
          >
            <Input placeholder={copy.urlPlaceholder} />
          </TextField>
        </div>
        <Button size="S" isDisabled={isBusy} onPress={importUrl}>
          Use URL
        </Button>
      </Flex>
    </Flex>
  );
}
