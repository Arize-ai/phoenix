import type { Spec } from "@json-render/core";
import { buildSpecFromParts, type DataPart } from "@json-render/react";

import { isPlainObject } from "@phoenix/utils/jsonUtils";

import {
  GENERATIVE_UI_TOOL_NAME,
  JSON_RENDER_DATA_PART_TYPE,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
  renderGenerativeUISpecSchema,
} from "../generativeUICatalog";

/**
 * Returns true when a message part can supply a generative UI render spec.
 * Completed tool calls are included only when their input still validates, so
 * stale or failed render attempts fall back to normal tool-call rendering.
 */
export function isGenerativeUIPart(part: DataPart): boolean {
  return (
    part.type === JSON_RENDER_DATA_PART_TYPE ||
    part.type === LEGACY_JSON_RENDER_DATA_PART_TYPE ||
    isRenderGenerativeUIToolPart(part)
  );
}

/**
 * Extracts the first valid render spec and optional json-render state from the
 * grouped message parts. Supports the current `data-spec` transport, the legacy
 * `data-json-render` shape, and durable completed tool-call input rehydration.
 */
export function getSpecAndState(parts: DataPart[]): {
  spec: Spec | null;
  state: Record<string, unknown>;
} {
  const spec =
    getDataPartSpec(parts) ?? getLegacySpec(parts) ?? getToolSpec(parts);
  const state = getState(parts);
  return { spec, state };
}

/** Returns the spec embedded in a completed render_generative_ui tool call. */
function getToolSpec(parts: DataPart[]): Spec | null {
  for (const part of parts) {
    if (!isRenderGenerativeUIToolPart(part)) {
      continue;
    }
    const input = getToolInput(part);
    if (isPlainObject(input)) {
      const spec = parseSpec(input.spec);
      if (spec) {
        return spec;
      }
    }
  }
  return null;
}

/** Builds a spec from json-render data parts produced by the current transport. */
function getDataPartSpec(parts: DataPart[]): Spec | null {
  try {
    return parseSpec(buildSpecFromParts(parts));
  } catch {
    return null;
  }
}

/** Reads historical data-json-render parts kept for transcript compatibility. */
function getLegacySpec(parts: DataPart[]): Spec | null {
  for (const part of parts) {
    if (part.type !== LEGACY_JSON_RENDER_DATA_PART_TYPE) {
      continue;
    }
    const payload = part.data;
    const spec = parseSpec(payload);
    if (spec) {
      return spec;
    }
    if (isPlainObject(payload)) {
      const nestedSpec = parseSpec(payload.spec);
      if (nestedSpec) {
        return nestedSpec;
      }
    }
  }
  return null;
}

/** Finds optional initial json-render state colocated with the accepted spec. */
function getState(parts: DataPart[]): Record<string, unknown> {
  for (const part of parts) {
    if (!isGenerativeUIPart(part)) {
      continue;
    }
    const payload = part.data;
    if (isPlainObject(payload) && isPlainObject(payload.state)) {
      return payload.state;
    }
    if (
      isPlainObject(payload) &&
      isPlainObject(payload.spec) &&
      isPlainObject(payload.spec.state)
    ) {
      return payload.spec.state;
    }
    if (isRenderGenerativeUIToolPart(part)) {
      const input = getToolInput(part);
      if (isPlainObject(input) && isPlainObject(input.state)) {
        return input.state;
      }
    }
  }
  return {};
}

/**
 * Identifies completed render_generative_ui tool parts that can be rendered.
 * Streaming, failed, and malformed tool calls are intentionally excluded to
 * avoid flicker and to preserve user-visible tool errors.
 */
function isRenderGenerativeUIToolPart(part: DataPart): boolean {
  if ((part as { state?: unknown }).state !== "output-available") {
    return false;
  }
  if (part.type === `tool-${GENERATIVE_UI_TOOL_NAME}`) {
    return hasRenderableToolInput(part);
  }
  if (part.type !== "dynamic-tool") {
    return false;
  }
  const candidate = part as { toolName?: unknown; tool?: unknown };
  return (
    (candidate.toolName === GENERATIVE_UI_TOOL_NAME ||
      candidate.tool === GENERATIVE_UI_TOOL_NAME) &&
    hasRenderableToolInput(part)
  );
}

/** Returns true when a tool part carries a plain input object with a valid spec. */
function hasRenderableToolInput(part: DataPart): boolean {
  const input = getToolInput(part);
  return isPlainObject(input) && parseSpec(input.spec) !== null;
}

/** Reads the AI SDK tool input without depending on a specific tool part union. */
function getToolInput(part: DataPart): unknown {
  return (part as { input?: unknown }).input;
}

/** Validates an unknown value against the generative UI render spec contract. */
function parseSpec(value: unknown): Spec | null {
  const result = renderGenerativeUISpecSchema.safeParse(value);
  return result.success ? (result.data as Spec) : null;
}
