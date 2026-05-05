import { css } from "@emotion/react";

// ---------------------------------------------------------------------------
// Attachments (root container)
// Layout switches by data-variant on the container.
// ---------------------------------------------------------------------------

export const attachmentsCSS = css`
  display: flex;
  align-items: flex-start;
  gap: var(--global-dimension-size-75);

  &[data-variant="grid"] {
    flex-wrap: wrap;
    margin-left: auto;
    width: fit-content;
  }

  &[data-variant="inline"] {
    flex-wrap: wrap;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-150) 0;
  }

  &[data-variant="list"] {
    flex-direction: column;
    width: 100%;
  }
`;

// ---------------------------------------------------------------------------
// Attachment (item)
// ---------------------------------------------------------------------------

export const attachmentCSS = css`
  position: relative;
  box-sizing: border-box;

  &[data-variant="grid"] {
    width: var(--global-dimension-size-1200);
    height: var(--global-dimension-size-1200);
    overflow: hidden;
    border-radius: var(--global-rounding-medium);
    background-color: var(--global-color-gray-200);
  }

  &[data-variant="inline"] {
    --attachment-base-color: var(--global-color-info);
    --attachment-bg-color: lch(
      from var(--attachment-base-color) 96 calc(c * 0.3) h
    );
    --attachment-border-color: lch(
      from var(--attachment-base-color) 88 calc(c * 0.4) h
    );
    --attachment-text-color: lch(from var(--attachment-base-color) 45 c h);

    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    height: var(--global-dimension-size-300);
    padding: 0 var(--global-dimension-size-100);
    border: var(--global-border-size-thin) solid var(--attachment-border-color);
    border-radius: var(--global-rounding-medium);
    background-color: var(--attachment-bg-color);
    color: var(--attachment-text-color);
    font-size: var(--global-font-size-s);
    line-height: 1;
    user-select: none;
  }

  &[data-variant="inline"][data-theme="dark"] {
    --attachment-bg-color: lch(
      from var(--attachment-base-color) 18 calc(c * 0.2) h
    );
    --attachment-border-color: lch(
      from var(--attachment-base-color) 28 calc(c * 0.3) h
    );
    --attachment-text-color: lch(
      from var(--attachment-base-color) 90 calc(c * 0.8) h
    );
  }

  &[data-variant="list"] {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    width: 100%;
    padding: var(--global-dimension-size-150);
    border: var(--global-border-size-thin) solid var(--global-border-color);
    border-radius: var(--global-rounding-medium);
  }
`;

// ---------------------------------------------------------------------------
// AttachmentPreview (icon / image / video slot)
// ---------------------------------------------------------------------------

export const attachmentPreviewCSS = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: inherit;

  &[data-variant="grid"] {
    width: 100%;
    height: 100%;
    background-color: var(--global-color-gray-200);
  }

  &[data-variant="inline"] {
    width: var(--global-dimension-size-200);
    height: var(--global-dimension-size-200);
    .icon-wrap {
      font-size: var(--global-font-size-s);
      line-height: 0;
    }
  }

  &[data-variant="list"] {
    width: var(--global-dimension-size-500);
    height: var(--global-dimension-size-500);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-color-gray-200);
  }

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

// ---------------------------------------------------------------------------
// AttachmentInfo (label + optional media type)
// ---------------------------------------------------------------------------

export const attachmentInfoCSS = css`
  min-width: 0;
  flex: 1 1 auto;

  .attachment-info__label {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .attachment-info__media-type {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
  }
`;

// ---------------------------------------------------------------------------
// AttachmentRemove (close button)
// ---------------------------------------------------------------------------

export const attachmentRemoveCSS = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  outline: none;
  transition: opacity 0.2s ease;

  &[data-variant="grid"] {
    position: absolute;
    top: var(--global-dimension-size-75);
    right: var(--global-dimension-size-75);
    width: var(--global-dimension-size-300);
    height: var(--global-dimension-size-300);
    border-radius: 50%;
    background-color: var(--global-color-gray-50);
    opacity: 0;
  }

  &[data-variant="inline"] {
    width: var(--global-dimension-size-200);
    height: var(--global-dimension-size-200);
    opacity: 0;
  }

  &[data-variant="list"] {
    width: var(--global-dimension-size-400);
    height: var(--global-dimension-size-400);
    border-radius: var(--global-rounding-small);
    flex: none;
  }

  [data-attachment]:hover &[data-variant="grid"],
  [data-attachment]:hover &[data-variant="inline"] {
    opacity: 1;
  }

  &[data-focus-visible] {
    opacity: 1;
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  .icon-wrap {
    font-size: var(--global-font-size-s);
    line-height: 0;
  }
`;
