/**
 * A port of Relay's `RelayIncrementalDeliveryConverter` from
 * facebook/relay@c270fbf4b9d011892300e389240bfeaedfe714bb, which is in Relay's
 * nightly builds but not yet in a release; relay-runtime 21.0.1 applies only
 * label/path payloads. Upstream runs it inside `OperationExecutor`; until we
 * upgrade, the network layer runs it once per request.
 *
 * Delete this module when relay-runtime ships the converter, and pass the
 * server's parts to Relay unconverted. Its output has `label`/`path` or no
 * `hasNext`, which the upstream converter passes through unchanged.
 *
 * Upstream's `unannouncedFragment` is not ported: it needs the placeholders
 * Relay creates inside `OperationExecutor`. graphql-js leaves out a deferred
 * fragment whose fields earlier results all sent and announces only the
 * fragments deferred inside it, so until the upgrade, don't nest a `@defer`
 * inside a deferred fragment whose fields the rest of the query already
 * selects at the same path.
 *
 * Original source copyright (c) Meta Platforms, Inc. and affiliates, MIT
 * license.
 */
import type {
  GraphQLSingularResponse,
  PayloadData,
  PayloadError,
} from "relay-runtime";
import invariant from "tiny-invariant";
import { z } from "zod";

import { isStringKeyedObject } from "./typeUtils";

type Path = ReadonlyArray<string | number>;

type PayloadExtensions = Record<string, unknown>;

/** Relay 21's `PayloadError` type omits the spec's `extensions`. */
type PayloadErrorWithExtensions = PayloadError & {
  extensions?: PayloadExtensions;
};

type PendingResult = {
  label: string;
  path: Path;
  nextIndex: number | null;
};

const pathSchema = z.array(z.union([z.string(), z.number()]));

const payloadDataSchema = z.record(z.string(), z.unknown());

const extensionsSchema = z
  .record(z.string(), z.unknown())
  .nullish()
  .transform((extensions) => extensions ?? undefined);

const payloadErrorSchema = z.looseObject({
  message: z.string(),
  locations: z
    .array(z.object({ line: z.number(), column: z.number() }))
    .nullish()
    .transform((locations) => locations ?? undefined),
  path: pathSchema.nullish().transform((path) => path ?? undefined),
  severity: z.enum(["CRITICAL", "ERROR", "WARNING"]).optional(),
  extensions: extensionsSchema,
});

/** Any part the server streams, in either incremental delivery format. */
const streamedResponseSchema = z.looseObject({
  data: payloadDataSchema.nullish(),
  errors: z.array(payloadErrorSchema).optional(),
  extensions: extensionsSchema,
  label: z.string().nullish(),
  path: pathSchema.nullish(),
  hasNext: z.boolean().nullish(),
  pending: z.unknown().optional(),
  completed: z.unknown().optional(),
  incremental: z.array(z.looseObject({ id: z.unknown() })).optional(),
});

type StreamedResponse = z.infer<typeof streamedResponseSchema>;

/**
 * A part in GraphQL's incremental delivery format (graphql-js 17), whose
 * results are addressed by the `id` of a `pending` entry.
 */
const incrementalDeliveryResponseSchema = z.object({
  data: payloadDataSchema.nullish(),
  errors: z.array(payloadErrorSchema).optional(),
  extensions: extensionsSchema,
  pending: z
    .array(
      z.object({
        id: z.string(),
        path: pathSchema,
        label: z.string().nullish(),
      })
    )
    .optional(),
  incremental: z
    .array(
      z.object({
        id: z.string(),
        data: payloadDataSchema.nullish(),
        items: z.array(z.unknown()).nullish(),
        subPath: pathSchema.optional(),
        errors: z.array(payloadErrorSchema).optional(),
      })
    )
    .optional(),
  completed: z
    .array(
      z.object({
        id: z.string(),
        errors: z.array(payloadErrorSchema).optional(),
      })
    )
    .optional(),
  hasNext: z.boolean(),
});

/**
 * Creates a converter for one request's streamed parts. It turns parts in
 * GraphQL's incremental delivery format into the label/path payloads Relay
 * applies: each deferred fragment whole, from the data the request's parts
 * have sent so far, and each streamed item at `[...path, index]`. Parts in
 * any other format pass through.
 */
export function createIncrementalDeliveryConverter() {
  let sentData: unknown = undefined;
  const sentErrors: PayloadErrorWithExtensions[] = [];
  const pendingResults = new Map<string, PendingResult>();
  let isIncrementalDelivery = false;

  const getPendingResult = (id: string): PendingResult => {
    const pendingResult = pendingResults.get(id);
    invariant(
      pendingResult != null,
      `IncrementalDeliveryConverter: Expected a pending result with id \`${id}\`.`
    );
    return pendingResult;
  };

  const getErrorsUnder = (path: Path): PayloadErrorWithExtensions[] | null => {
    const errorsUnder = sentErrors
      .filter((error) => isPathUnder({ fullPath: error.path ?? [], path }))
      .map((error) => makeErrorRelative({ error, path }));
    return errorsUnder.length > 0 ? errorsUnder : null;
  };

  const buildPayload = ({
    label,
    path,
    value,
  }: {
    label: string;
    path: Path;
    value: unknown;
  }): GraphQLSingularResponse => {
    const data = toPayloadData(value);
    const errors = getErrorsUnder(path) ?? undefined;
    return data == null
      ? { errors: errors ?? [], label, path: [...path] }
      : { data, errors, label, path: [...path] };
  };

  const convert = (part: unknown): ReadonlyArray<GraphQLSingularResponse> => {
    const response = streamedResponseSchema.parse(part);
    if (
      !isIncrementalDeliveryResponse({
        response,
        isKnownFormat: isIncrementalDelivery,
      })
    ) {
      return [
        response.hasNext != null
          ? convertEarlierDraftResponse(response)
          : toRelayResponse(response),
      ];
    }
    isIncrementalDelivery = true;
    const {
      completed,
      data,
      errors,
      extensions,
      hasNext,
      incremental,
      pending,
    } = incrementalDeliveryResponseSchema.parse(part);
    const payloads: GraphQLSingularResponse[] = [];
    sentErrors.push(...(errors ?? []));
    if (data !== undefined) {
      sentData = data;
      const initialExtensions = { ...extensions, is_final: false };
      payloads.push(
        errors != null
          ? {
              data: data ?? undefined,
              errors: [...errors],
              extensions: initialExtensions,
            }
          : data != null
            ? { data, extensions: initialExtensions }
            : { data: null, extensions: initialExtensions }
      );
    }
    pending?.forEach(({ id, label, path }) => {
      invariant(
        label != null,
        `IncrementalDeliveryConverter: Expected pending result \`${id}\` to have a label.`
      );
      pendingResults.set(id, { label, nextIndex: null, path });
    });
    // Deferred data before streamed items, so a stream announced in the same
    // part finds its list.
    incremental?.forEach((entry) => {
      if (entry.data != null) {
        const { path } = getPendingResult(entry.id);
        sentData = mergeAt({
          value: sentData,
          path: [...path, ...(entry.subPath ?? [])],
          incoming: entry.data,
        });
        sentErrors.push(...(entry.errors ?? []));
      }
    });
    incremental?.forEach(({ errors: itemErrors, id, items }) => {
      if (items == null) {
        return;
      }
      sentErrors.push(...(itemErrors ?? []));
      const stream = getPendingResult(id);
      const list = getAt({ value: sentData, path: stream.path });
      const start = stream.nextIndex ?? (Array.isArray(list) ? list.length : 0);
      items.forEach((item, offset) => {
        const itemPath = [...stream.path, start + offset];
        sentData = mergeAt({ value: sentData, path: itemPath, incoming: item });
        payloads.push(
          buildPayload({ label: stream.label, path: itemPath, value: item })
        );
      });
      stream.nextIndex = start + items.length;
    });
    completed?.forEach(({ errors: failure, id }) => {
      const { label, path } = getPendingResult(id);
      pendingResults.delete(id);
      const value = getAt({ value: sentData, path });
      if (failure != null) {
        sentErrors.push(...failure);
        payloads.push(buildPayload({ label, path, value: null }));
      } else if (!Array.isArray(value)) {
        payloads.push(buildPayload({ label, path, value: value ?? {} }));
      }
    });
    if (hasNext === false) {
      const lastPayload = payloads.pop();
      payloads.push(
        lastPayload != null
          ? markFinal(lastPayload)
          : { data: null, extensions: { is_final: true } }
      );
    }
    return payloads;
  };

  return { convert };
}

function markFinal(payload: GraphQLSingularResponse): GraphQLSingularResponse {
  return {
    ...payload,
    extensions: { ...payload.extensions, is_final: true },
  };
}

/**
 * A plain response, or a label/path payload, as the Relay response it
 * already is.
 */
function toRelayResponse(response: StreamedResponse): GraphQLSingularResponse {
  const { data, errors, extensions } = response;
  const label = response.label ?? undefined;
  const path = response.path ?? undefined;
  if (data != null) {
    return { data, errors, extensions, label, path };
  }
  if (data === null && errors == null && extensions != null) {
    return { data: null, extensions };
  }
  return { errors: errors ?? [], extensions, label, path };
}

/**
 * A response of an earlier draft of incremental delivery (graphql-js 16's
 * experimental `@defer` and `@stream`), as Relay applies it: errors relative
 * to its `path`, and the bare `{hasNext: false}` that ends a stream as the end
 * of the request.
 */
function convertEarlierDraftResponse(
  response: StreamedResponse
): GraphQLSingularResponse {
  const isBareEndOfStream = Object.keys(response).length === 1;
  if (isBareEndOfStream) {
    return { data: null, extensions: { is_final: true } };
  }
  const { data, errors, extensions, label, path } = response;
  if (errors == null || path == null) {
    return toRelayResponse(response);
  }
  const relativeErrors = errors.map((error) =>
    isPathUnder({ fullPath: error.path ?? [], path })
      ? makeErrorRelative({ error, path })
      : error
  );
  const relayLabel = label ?? undefined;
  return data != null
    ? { data, errors: relativeErrors, extensions, label: relayLabel, path }
    : { errors: relativeErrors, extensions, label: relayLabel, path };
}

function makeErrorRelative({
  error,
  path,
}: {
  error: PayloadErrorWithExtensions;
  path: Path;
}): PayloadErrorWithExtensions {
  const { extensions, locations, message, path: errorPath, severity } = error;
  return {
    extensions,
    locations,
    message,
    path: errorPath?.slice(path.length),
    severity,
  };
}

function isPathUnder({
  fullPath,
  path,
}: {
  fullPath: Path;
  path: Path;
}): boolean {
  return (
    fullPath.length >= path.length &&
    path.every((segment, index) => String(fullPath[index]) === String(segment))
  );
}

/**
 * Whether `response` is in GraphQL's incremental delivery format: it has
 * `hasNext`, no `label` or `path`, and a field only this format has, or the
 * request's earlier parts were in this format. The first part of the 2022
 * draft format, `{data, hasNext}`, followed by label/path results, is not.
 */
function isIncrementalDeliveryResponse({
  response,
  isKnownFormat,
}: {
  response: StreamedResponse;
  isKnownFormat: boolean;
}): boolean {
  const hasFieldOnlyThisFormatHas =
    response.pending != null ||
    response.completed != null ||
    (response.incremental?.some((entry) => entry.id != null) ?? false);
  return (
    response.label == null &&
    response.path == null &&
    response.hasNext != null &&
    (isKnownFormat || hasFieldOnlyThisFormatHas)
  );
}

function isPayloadData(value: unknown): value is PayloadData {
  return isStringKeyedObject(value) && !Array.isArray(value);
}

function toPayloadData(value: unknown): PayloadData | null {
  return isPayloadData(value) ? value : null;
}

function getAt({ value, path }: { value: unknown; path: Path }): unknown {
  return path.reduce<unknown>(
    (current, segment) =>
      Array.isArray(current)
        ? current[Number(segment)]
        : toPayloadData(current)?.[String(segment)],
    value
  );
}

/**
 * `value` with `incoming` merged in at `path`, copying what it changes so
 * payloads already passed on stay as they were.
 */
function mergeAt({
  value,
  path,
  incoming,
}: {
  value: unknown;
  path: Path;
  incoming: unknown;
}): unknown {
  if (path.length === 0) {
    return mergeValues({ value, incoming });
  }
  const [head, ...rest] = path;
  if (typeof head === "number") {
    const list: unknown[] = Array.isArray(value) ? [...value] : [];
    list[head] = mergeAt({ value: list[head], path: rest, incoming });
    return list;
  }
  const object = toPayloadData(value);
  return {
    ...object,
    [head]: mergeAt({ value: object?.[head], path: rest, incoming }),
  };
}

function mergeValues({
  value,
  incoming,
}: {
  value: unknown;
  incoming: unknown;
}): unknown {
  const object = toPayloadData(value);
  const incomingObject = toPayloadData(incoming);
  if (object == null || incomingObject == null) {
    return incoming === undefined ? value : incoming;
  }
  return Object.fromEntries([
    ...Object.entries(object),
    ...Object.entries(incomingObject).map(([fieldName, fieldValue]) => [
      fieldName,
      mergeValues({ value: object[fieldName], incoming: fieldValue }),
    ]),
  ]);
}
