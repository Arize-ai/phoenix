import { ReactNode } from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { assertUnreachable } from "@phoenix/typeUtils";
import { isAudioUrl, isVideoUrl } from "@phoenix/utils/urlUtils";

import { Shape, ShapeIcon } from "./ShapeIcon";

type EventItemSize = "small" | "medium" | "large";

/**
 * The type of preview to display for the event item. For a large display, the top two previews are shown
 */
type EventPreviewType =
  | "raw"
  | "prompt_response"
  | "image"
  | "video"
  | "audio"
  | "event_metadata"
  | "document";
type EventItemProps = {
  /**
   * The event's raw textual data (e.g. NLP text)
   */
  rawData: string | null;
  /**
   * The event's URL to the data (e.x. CV image)
   */
  linkToData: string | null;
  /**
   * the event's prediction label
   */
  predictionLabel: string | null;
  /**
   * the event's actual label
   */
  actualLabel: string | null;
  /**
   * The event's prompt / response (LLM use-case)
   */
  promptAndResponse: PromptResponse | null;
  /**
   * Which inferences the event belongs to
   */
  inferencesName: string;
  /**
   * event handler for when the user clicks on the event item
   */
  onClick?: () => void;
  /**
   * event handler for when the user hovers on the event item
   */
  onMouseOver?: () => void;
  /**
   * event handler when the hover ends
   */
  onMouseOut?: () => void;
  /**
   * The event's current grouping (color group)
   */
  group: string;
  /**
   * The color accent for the event. Corresponds to the color of the group the event belongs to
   */
  color: string;
  /**
   * The size of the event item
   */
  size: EventItemSize;
  /**
   * In the case the event captures a document (e.g. a corpus record)
   */
  documentText: string | null;
  /**
   * Auto-play the audio preview
   * @default false
   */
  autoPlay: boolean;
};

/**
 * Get the primary preview type for the event item. This is the preview that is shown first
 */
function getPrimaryPreviewType(props: EventItemProps): EventPreviewType {
  const { rawData, linkToData, promptAndResponse, documentText } = props;
  if (documentText != null) {
    return "document";
  }
  if (promptAndResponse != null) {
    return "prompt_response";
  }
  if (linkToData != null) {
    if (isVideoUrl(linkToData)) {
      return "video";
    }
    if (isAudioUrl(linkToData)) {
      return "audio";
    }
    return "image";
  } else if (rawData != null) {
    return "raw";
  } else {
    return "event_metadata";
  }
}

/**
 * Get the secondary preview type for the event item.
 */
function getSecondaryPreviewType(
  primaryPreviewType: EventPreviewType,
  props: EventItemProps
): EventPreviewType | null {
  const { rawData } = props;
  switch (primaryPreviewType) {
    case "document":
      return null;
    case "prompt_response":
      return null;
    case "image":
      return rawData != null ? "raw" : null;
    case "video":
      return rawData != null ? "raw" : null;
    case "audio":
      return rawData != null ? "raw" : null;
    case "raw":
      return "event_metadata";
    case "event_metadata":
      return null;
    default:
      assertUnreachable(primaryPreviewType);
  }
}

/**
 * An item that represents a single model event. To be displayed in a grid / list
 */
export function EventItem(props: EventItemProps) {
  const {
    onClick,
    onMouseOver,
    onMouseOut,
    color,
    size,
    inferencesName,
    group,
  } = props;
  // Prioritize the image preview over raw text
  const primaryPreviewType = getPrimaryPreviewType(props);
  // only show the secondary preview for large size
  const secondaryPreviewType =
    size === "large"
      ? getSecondaryPreviewType(primaryPreviewType, props)
      : null;

  return (
    <div
      data-testid="event-item"
      role="button"
      data-size={size}
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-style: solid;
        border-radius: 4px;
        overflow: hidden;

        display: flex;
        flex-direction: column;
        cursor: pointer;
        overflow: hidden;

        border-width: 1px;
        border-color: ${color};
        border-radius: var(--ac-global-rounding-medium);
        transition: border-color 0.2s ease-in-out;
        transition: transform 0.2s ease-in-out;
        &:hover {
          transform: scale(1.04);
        }
        &[data-size="small"] {
          border-width: 2px;
        }
      `}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      <div
        className="event-item__preview-wrap"
        data-size={size}
        css={css`
          display: flex;
          flex-direction: row;
          flex: 1 1 auto;
          overflow: hidden;
          & > *:nth-child(1) {
            flex: 1 1 auto;
            overflow: hidden;
          }
          & > *:nth-child(2) {
            flex: none;
            width: 43%;
          }
          &[data-size="large"] {
            & > *:nth-child(1) {
              margin: var(--ac-global-dimension-static-size-100);
              border-radius: 8px;
            }
          }
        `}
      >
        <EventPreview previewType={primaryPreviewType} {...props} />
        {secondaryPreviewType != null && (
          <EventPreview previewType={secondaryPreviewType} {...props} />
        )}
      </div>
      {size !== "small" && (
        <EventItemFooter
          color={color}
          group={group}
          inferencesName={inferencesName}
          showInferences={size === "large"}
        />
      )}
    </div>
  );
}

/**
 * Higher order component that renders a specific preview type for the event item
 */
function EventPreview(
  props: { previewType: EventPreviewType } & EventItemProps
) {
  const { previewType } = props;
  let preview: ReactNode | null = null;
  switch (previewType) {
    case "document": {
      preview = <DocumentPreview {...props} />;
      break;
    }
    case "prompt_response": {
      preview = <PromptResponsePreview {...props} />;
      break;
    }
    case "image": {
      preview = <ImagePreview {...props} />;
      break;
    }
    case "video": {
      preview = <VideoPreview {...props} />;
      break;
    }
    case "audio": {
      preview = <AudioPreview {...props} />;
      break;
    }
    case "raw": {
      preview = <RawTextPreview {...props} />;
      break;
    }
    case "event_metadata": {
      preview = <EventMetadataPreview {...props} />;
      break;
    }
    default:
      assertUnreachable(previewType);
  }
  return preview;
}

/**
 * Shows an image preview of the event's data
 */
function ImagePreview(props: Pick<EventItemProps, "linkToData" | "color">) {
  return (
    <img
      src={props.linkToData || "[error] unexpected missing url"}
      css={css`
        min-height: 0;
        // Maintain aspect ratio while having normalized height
        object-fit: contain;
        transition: background-color 0.2s ease-in-out;
        background-color: ${transparentize(0.85, props.color)};
      `}
    />
  );
}

/**
 * Shows a video preview of the event's data
 */
function VideoPreview(props: Pick<EventItemProps, "linkToData" | "color">) {
  return (
    <video
      src={props.linkToData || "[error] unexpected missing url"}
      css={css`
        min-height: 0;
        // Maintain aspect ratio while having normalized height
        object-fit: contain;
        transition: background-color 0.2s ease-in-out;
        background-color: ${transparentize(0.85, props.color)};
      `}
    />
  );
}

/**
 * Shows a audio preview of the event's data
 */
function AudioPreview(
  props: Pick<EventItemProps, "linkToData" | "color" | "autoPlay">
) {
  return (
    <audio
      src={props.linkToData || "[error] unexpected missing url"}
      autoPlay={props.autoPlay}
      controls
    />
  );
}

/**
 * Shows textual preview of the event's raw data
 */
function PromptResponsePreview(
  props: Pick<EventItemProps, "promptAndResponse" | "size">
) {
  return (
    <div
      data-size={props.size}
      css={css`
        --prompt-response-preview-background-color: var(
          --ac-global-color-grey-200
        );
        background-color: var(--prompt-response-preview-background-color);
        &[data-size="small"] {
          display: flex;
          flex-direction: column;
          padding: var(--ac-global-dimension-static-size-50);
          font-size: var(--ac-global-dimension-static-font-size-75);
          section {
            flex: 1 1 0;
            overflow: hidden;
            header {
              display: none;
            }
          }
        }
        &[data-size="medium"] {
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-static-size-50);
          padding: var(--ac-global-dimension-static-size-100);
          section {
            flex: 1 1 0;
            overflow: hidden;
          }
        }
        &[data-size="large"] {
          display: flex;
          flex-direction: row;
          section {
            padding: var(--ac-global-dimension-static-size-50);
            flex: 1 1 0;
          }
        }
        & > section {
          position: relative;

          header {
            font-weight: bold;
            margin-bottom: var(--ac-global-dimension-static-size-50);
          }
          &:before {
            content: "";
            width: 100%;
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
            background: linear-gradient(
              transparent 80%,
              var(--prompt-response-preview-background-color) 100%
            );
          }
        }
      `}
    >
      <section>
        <header>prompt</header>
        {props.promptAndResponse?.prompt}
      </section>
      <section>
        <header>response</header>
        {props.promptAndResponse?.response}
      </section>
    </div>
  );
}

/**
 * Shows textual preview of the event's document
 */
function DocumentPreview(props: Pick<EventItemProps, "size" | "documentText">) {
  return (
    <p
      data-size={props.size}
      css={css`
        flex: 1 1 auto;
        padding: var(--ac-global-dimension-static-size-100);
        margin-block-start: 0;
        margin-block-end: 0;
        position: relative;
        --text-preview-background-color: var(--ac-global-color-grey-100);
        background-color: var(--text-preview-background-color);

        &[data-size="small"] {
          padding: var(--ac-global-dimension-static-size-50);
          box-sizing: border-box;
        }
        &:before {
          content: "";
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          background: linear-gradient(
            transparent 90%,
            var(--text-preview-background-color) 98%,
            var(--text-preview-background-color) 100%
          );
        }
      `}
    >
      {props.documentText}
    </p>
  );
}

/**
 * Shows textual preview of the event's raw data
 */
function RawTextPreview(props: Pick<EventItemProps, "rawData" | "size">) {
  return (
    <p
      data-size={props.size}
      css={css`
        flex: 1 1 auto;
        padding: var(--ac-global-dimension-static-size-100);
        margin-block-start: 0;
        margin-block-end: 0;
        position: relative;
        --text-preview-background-color: var(--ac-background-color-light);
        background-color: var(--text-preview-background-color);

        &[data-size="small"] {
          padding: var(--ac-global-dimension-static-size-50);
          font-size: var(--ac-global-color-gray-600);
          box-sizing: border-box;
        }
        &:before {
          content: "";
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          background: linear-gradient(
            transparent 90%,
            var(--text-preview-background-color) 98%,
            var(--text-preview-background-color) 100%
          );
        }
      `}
    >
      {props.rawData}
    </p>
  );
}

/**
 * Shows an image preview of the event's metadata (e.g. the conclusion of the model)
 */
function EventMetadataPreview(
  props: Pick<EventItemProps, "predictionLabel" | "actualLabel">
) {
  return (
    <dl
      css={css`
        margin: 0;
        padding: var(--ac-global-dimension-static-size-200);
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: var(--ac-global-dimension-static-size-100);

        dt {
          font-weight: bold;
        }
        dd {
          margin-inline-start: var(--ac-global-dimension-static-size-100);
        }
      `}
    >
      <div>
        <dt>prediction label</dt>
        <dd>{props.predictionLabel || "--"}</dd>
      </div>
      <div>
        <dt>actual label</dt>
        <dd>{props.actualLabel || "--"}</dd>
      </div>
    </dl>
  );
}

function EventItemFooter({
  color,
  group,
  showInferences,
  inferencesName,
}: Pick<EventItemProps, "group" | "color" | "inferencesName"> & {
  showInferences: boolean;
}) {
  return (
    <footer
      css={css`
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        padding: var(--ac-global-dimension-static-size-50)
          var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-50) 7px;
        border-top: 1px solid var(--ac-global-border-color-dark);
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: var(--ac-global-dimension-static-size-50);
        `}
      >
        <ShapeIcon shape={Shape.circle} color={color} />
        {group}
      </div>
      {showInferences ? (
        <div title="the inferences the point belongs to">{inferencesName}</div>
      ) : null}
    </footer>
  );
}
