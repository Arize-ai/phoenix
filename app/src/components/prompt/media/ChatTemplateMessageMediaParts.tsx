/**
 * How a prompt message's media renders on the prompt detail page.
 *
 * Separate from `ChatTemplateMessageCard` so the fork's contribution to that file is
 * a title import and nothing else. Each part gets its own renderer, and
 * {@link ChatTemplateMessageMediaPart} picks between them so a caller has one branch
 * to add rather than four.
 */
import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  ExternalLink,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { ChatTemplateMessagePartContainer } from "@phoenix/components/prompt/ChatTemplateMessageCard";
import { SpanImage } from "@phoenix/pages/trace/span/SpanImage";
import type {
  FilePart,
  FileVariablePart,
  ImagePart,
  ImageVariablePart,
} from "@phoenix/schemas/mediaPartSchemas";
import {
  asFilePart,
  asFileVariablePart,
  asImagePart,
  asImageVariablePart,
} from "@phoenix/utils/mediaParts";
import { mediaDisplayName, resolveMediaUrl } from "@phoenix/utils/mediaUtils";

import { MEDIA_PART_TYPE_TITLE as PART_TYPE_TITLE } from "./partTitles";

export type ChatTemplateMessageImagePartProps = {
  image: ImagePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageImagePart({
  image,
  isOnlyChild,
}: ChatTemplateMessageImagePartProps) {
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.image}
      isOnlyChild={isOnlyChild}
    >
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <SpanImage url={image.image.url} />
          <Text size="XS" color="text-700">
            {image.image.mediaType}
          </Text>
        </Flex>
      </View>
    </ChatTemplateMessagePartContainer>
  );
}

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

/**
 * The position a piece of media occupies in the message, when the prompt names it
 * rather than storing one.
 *
 * There is nothing to preview — the value arrives with the run's inputs — so this
 * shows which input fills the slot. Without it the part renders as nothing and the
 * message looks like it carries no media at all.
 */
function MediaVariablePart({
  variable,
  title,
  icon,
  isOnlyChild,
}: {
  variable: string;
  title: string;
  icon: ReactNode;
  isOnlyChild?: boolean;
}) {
  return (
    <ChatTemplateMessagePartContainer title={title} isOnlyChild={isOnlyChild}>
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <span css={variablePillCSS}>
            <Icon svg={icon} />
            {`{{${variable}}}`}
          </span>
          <Text size="XS" color="text-700">
            Supplied when the prompt runs
          </Text>
        </Flex>
      </View>
    </ChatTemplateMessagePartContainer>
  );
}

export type ChatTemplateMessageImageVariablePartProps = {
  imageVariable: ImageVariablePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageImageVariablePart({
  imageVariable,
  isOnlyChild,
}: ChatTemplateMessageImageVariablePartProps) {
  return (
    <MediaVariablePart
      variable={imageVariable.image.variable}
      title={PART_TYPE_TITLE.imageVariable}
      icon={<Icons.Image />}
      isOnlyChild={isOnlyChild}
    />
  );
}

export type ChatTemplateMessageFileVariablePartProps = {
  fileVariable: FileVariablePart;
  isOnlyChild?: boolean;
};

export function ChatTemplateMessageFileVariablePart({
  fileVariable,
  isOnlyChild,
}: ChatTemplateMessageFileVariablePartProps) {
  return (
    <MediaVariablePart
      variable={fileVariable.file.variable}
      title={PART_TYPE_TITLE.fileVariable}
      icon={<Icons.FileText />}
      isOnlyChild={isOnlyChild}
    />
  );
}

export type ChatTemplateMessageFilePartProps = {
  file: FilePart;
  isOnlyChild?: boolean;
};

/**
 * A document stored on the prompt.
 *
 * Opens in a new tab rather than rendering inline: a PDF viewer is a heavy thing
 * to embed in a template preview, and the useful action here is to check which
 * document the prompt carries.
 */
export function ChatTemplateMessageFilePart({
  file,
  isOnlyChild,
}: ChatTemplateMessageFilePartProps) {
  return (
    <ChatTemplateMessagePartContainer
      title={PART_TYPE_TITLE.file}
      isOnlyChild={isOnlyChild}
    >
      <View paddingX="size-200" paddingY="size-100">
        <Flex direction="column" gap="size-100" alignItems="start">
          <ExternalLink href={resolveMediaUrl(file.file.url)}>
            <Flex direction="row" gap="size-75" alignItems="center">
              <Icon svg={<Icons.FileText />} />
              {mediaDisplayName(file.file.url, file.file.mediaType)}
            </Flex>
          </ExternalLink>
          <Text size="XS" color="text-700">
            {file.file.mediaType}
          </Text>
        </Flex>
      </View>
    </ChatTemplateMessagePartContainer>
  );
}

/**
 * The renderer for whichever media a content part carries, or null when it carries
 * none.
 *
 * One entry point rather than four sequential checks at the call site: the caller's
 * dispatch stays a single branch, and a new media kind is added here instead of
 * there.
 */
export function ChatTemplateMessageMediaPart({
  part,
  isOnlyChild,
}: {
  part: unknown;
  isOnlyChild?: boolean;
}) {
  const image = asImagePart(part);
  if (image) {
    return (
      <ChatTemplateMessageImagePart image={image} isOnlyChild={isOnlyChild} />
    );
  }
  const imageVariable = asImageVariablePart(part);
  if (imageVariable) {
    return (
      <ChatTemplateMessageImageVariablePart
        imageVariable={imageVariable}
        isOnlyChild={isOnlyChild}
      />
    );
  }
  const file = asFilePart(part);
  if (file) {
    return (
      <ChatTemplateMessageFilePart file={file} isOnlyChild={isOnlyChild} />
    );
  }
  const fileVariable = asFileVariablePart(part);
  if (fileVariable) {
    return (
      <ChatTemplateMessageFileVariablePart
        fileVariable={fileVariable}
        isOnlyChild={isOnlyChild}
      />
    );
  }
  return null;
}
