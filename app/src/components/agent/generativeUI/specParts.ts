import type { Spec } from "@json-render/core";
import { buildSpecFromParts, type DataPart } from "@json-render/react";

import { isPlainObject } from "@phoenix/utils/jsonUtils";

import {
  GENERATIVE_UI_TOOL_NAME,
  JSON_RENDER_DATA_PART_TYPE,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
  renderGenerativeUISpecSchema,
} from "../generativeUICatalog";

const EMPTY_STATE: Record<string, unknown> = {};

/**
 * Returns true when a message part should occupy an in-chat generative UI slot.
 * Pending render tool calls are included so they can show a skeleton while args
 * stream in. Completed tool calls are included only when their input validates,
 * so stale or failed render attempts fall back to normal tool-call rendering.
 */
export function isGenerativeUIPart(part: DataPart): boolean {
  return (
    part.type === JSON_RENDER_DATA_PART_TYPE ||
    part.type === LEGACY_JSON_RENDER_DATA_PART_TYPE ||
    isPendingRenderGenerativeUIToolPart(part) ||
    isRenderableRenderGenerativeUIToolPart(part)
  );
}

/** Returns true while a render_generative_ui tool call is still producing args/output. */
export function isPendingRenderGenerativeUIToolPart(part: DataPart): boolean {
  if (!isRenderGenerativeUIToolPart(part)) {
    return false;
  }
  const state = isPlainObject(part) ? part.state : undefined;
  return state !== "output-available" && state !== "output-error";
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
    if (!isRenderableRenderGenerativeUIToolPart(part)) {
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
    if (isRenderableRenderGenerativeUIToolPart(part)) {
      const input = getToolInput(part);
      if (isPlainObject(input) && isPlainObject(input.state)) {
        return input.state;
      }
    }
  }
  return EMPTY_STATE;
}

/**
 * Identifies completed render_generative_ui tool parts that can be rendered.
 * Failed and malformed tool calls are intentionally excluded to preserve
 * user-visible tool errors.
 */
function isRenderableRenderGenerativeUIToolPart(part: DataPart): boolean {
  const state = isPlainObject(part) ? part.state : undefined;
  if (state !== "output-available") {
    return false;
  }
  return isRenderGenerativeUIToolPart(part) && hasRenderableToolInput(part);
}

/** Identifies any render_generative_ui tool part regardless of execution state. */
function isRenderGenerativeUIToolPart(part: DataPart): boolean {
  if (part.type === `tool-${GENERATIVE_UI_TOOL_NAME}`) {
    return true;
  }
  if (part.type !== "dynamic-tool") {
    return false;
  }
  if (!isPlainObject(part)) {
    return false;
  }
  return (
    part.toolName === GENERATIVE_UI_TOOL_NAME ||
    part.tool === GENERATIVE_UI_TOOL_NAME
  );
}

/** Returns true when a tool part carries a plain input object with a valid spec. */
function hasRenderableToolInput(part: DataPart): boolean {
  const input = getToolInput(part);
  return isPlainObject(input) && parseSpec(input.spec) !== null;
}

/** Reads the AI SDK tool input without depending on a specific tool part union. */
function getToolInput(part: DataPart): unknown {
  return isPlainObject(part) ? part.input : undefined;
}

/** Validates an unknown value against the generative UI render spec contract. */
function parseSpec(value: unknown): Spec | null {
  const result = renderGenerativeUISpecSchema.safeParse(value);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by renderGenerativeUISpecSchema; zod output shape differs from the library Spec type
  return result.success ? (value as Spec) : null;
}
