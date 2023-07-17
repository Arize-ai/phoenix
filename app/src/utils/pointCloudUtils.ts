import { DatasetRole } from "@phoenix/types";

export function getDatasetRoleFromEventId(eventId: string): DatasetRole {
  if (eventId.includes("PRIMARY")) {
    return DatasetRole.primary;
  } else if (eventId.includes("CORPUS")) {
    return DatasetRole.corpus;
  } else {
    return DatasetRole.reference;
  }
}
/**
 * A function to split event ids by dataset
 * @param eventIds
 * @returns
 */
export function splitEventIdsByDataset(eventIds: string[]): {
  primaryEventIds: string[];
  referenceEventIds: string[];
  corpusEventIds: string[];
} {
  const primaryEventIds: string[] = [];
  const referenceEventIds: string[] = [];
  const corpusEventIds: string[] = [];
  eventIds.forEach((id) => {
    const datasetRole = getDatasetRoleFromEventId(id);
    if (datasetRole == DatasetRole.primary) {
      primaryEventIds.push(id);
    } else if (datasetRole == DatasetRole.corpus) {
      corpusEventIds.push(id);
    } else {
      referenceEventIds.push(id);
    }
  });
  return { primaryEventIds, referenceEventIds, corpusEventIds };
}
