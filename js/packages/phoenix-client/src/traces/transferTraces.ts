import { createClient } from "../client";
import { TRANSFER_TRACES } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for moving traces to another project.
 */
export interface TransferTracesParams extends ClientFn {
  /**
   * Trace GlobalIDs or OpenTelemetry trace IDs to move. All traces must
   * currently belong to the same source project.
   */
  traceIdentifiers: string[];
  /**
   * The destination project name or GlobalID.
   */
  destinationProjectIdentifier: string;
}

/**
 * The result of moving traces to another project.
 */
export interface TransferTracesResult {
  /** The number of distinct traces moved. */
  transferredTraceCount: number;
  /** The destination project's GlobalID. */
  destinationProjectId: string;
}

/**
 * Move traces from one project to another.
 *
 * This operation re-parents the traces; it does not copy them. After the move,
 * the traces no longer appear in their original project. Every trace must
 * currently belong to the same source project.
 *
 * @param params - The parameters for moving traces.
 * @param params.traceIdentifiers - Trace GlobalIDs or OpenTelemetry trace IDs to move.
 * @param params.destinationProjectIdentifier - The destination project name or GlobalID.
 * @returns The number of traces moved and the destination project's GlobalID.
 * @throws {RangeError} If no trace identifiers are provided.
 * @throws {HttpError} If a trace or destination project is missing, the traces
 * belong to multiple source projects, or the transfer otherwise fails.
 *
 * @requires Phoenix server >= 20.4.0
 *
 * @example
 * ```ts
 * import { transferTraces } from "@arizeai/phoenix-client/traces";
 *
 * const result = await transferTraces({
 *   traceIdentifiers: ["8f3a...", "VHJhY2U6Mg=="],
 *   destinationProjectIdentifier: "production",
 * });
 *
 * console.log(result.transferredTraceCount);
 * console.log(result.destinationProjectId);
 * ```
 */
export async function transferTraces({
  client: _client,
  traceIdentifiers,
  destinationProjectIdentifier,
}: TransferTracesParams): Promise<TransferTracesResult> {
  if (traceIdentifiers.length === 0) {
    throw new RangeError("At least one trace identifier is required");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: TRANSFER_TRACES });

  const { data, error } = await client.POST("/v1/traces/transfer", {
    body: {
      trace_identifiers: traceIdentifiers,
      destination_project_identifier: destinationProjectIdentifier,
    },
  });

  if (error) throw error;
  if (!data?.data) {
    throw new Error("Failed to transfer traces: no data returned");
  }

  return {
    transferredTraceCount: data.data.transferred_trace_count,
    destinationProjectId: data.data.destination_project_id,
  };
}
