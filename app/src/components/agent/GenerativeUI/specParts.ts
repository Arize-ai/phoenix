import type { Spec } from "@json-render/core";
import { buildSpecFromParts, type DataPart } from "@json-render/react";

import {
  GENERATIVE_UI_TOOL_NAME,
  JSON_RENDER_DATA_PART_TYPE,
  LEGACY_JSON_RENDER_DATA_PART_TYPE,
  renderGeneratedUISpecSchema,
} from "../generativeUICatalog";

export function isGenerativeUIPart(part: DataPart): boolean {
  return (
    part.type === JSON_RENDER_DATA_PART_TYPE ||
    part.type === LEGACY_JSON_RENDER_DATA_PART_TYPE ||
    isRenderGeneratedUIToolPart(part)
  );
}

export function getSpecAndState(parts: DataPart[]): {
  spec: Spec | null;
  state: Record<string, unknown>;
} {
  const spec =
    getDataPartSpec(parts) ?? getLegacySpec(parts) ?? getToolSpec(parts);
  const state = getState(parts);
  return { spec, state };
}

function getToolSpec(parts: DataPart[]): Spec | null {
  for (const part of parts) {
    if (!isRenderGeneratedUIToolPart(part)) {
      continue;
    }
    const input = getToolInput(part);
    if (isRecord(input)) {
      const spec = parseSpec(input.spec);
      if (spec) {
        return spec;
      }
    }
  }
  return null;
}

function getDataPartSpec(parts: DataPart[]): Spec | null {
  try {
    return parseSpec(buildSpecFromParts(parts));
  } catch {
    return null;
  }
}

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
    if (isRecord(payload)) {
      const nestedSpec = parseSpec(payload.spec);
      if (nestedSpec) {
        return nestedSpec;
      }
    }
  }
  return null;
}

function getState(parts: DataPart[]): Record<string, unknown> {
  for (const part of parts) {
    if (!isGenerativeUIPart(part)) {
      continue;
    }
    const payload = part.data;
    if (isRecord(payload) && isRecord(payload.state)) {
      return payload.state;
    }
    if (
      isRecord(payload) &&
      isRecord(payload.spec) &&
      isRecord(payload.spec.state)
    ) {
      return payload.spec.state;
    }
    if (isRenderGeneratedUIToolPart(part)) {
      const input = getToolInput(part);
      if (isRecord(input) && isRecord(input.state)) {
        return input.state;
      }
    }
  }
  return {};
}

function isRenderGeneratedUIToolPart(part: DataPart): boolean {
  if ((part as { state?: unknown }).state === "output-error") {
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

function hasRenderableToolInput(part: DataPart): boolean {
  const input = getToolInput(part);
  return isRecord(input) && parseSpec(input.spec) !== null;
}

function getToolInput(part: DataPart): unknown {
  return (part as { input?: unknown }).input;
}

function parseSpec(value: unknown): Spec | null {
  const result = renderGeneratedUISpecSchema.safeParse(value);
  return result.success ? (result.data as Spec) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
