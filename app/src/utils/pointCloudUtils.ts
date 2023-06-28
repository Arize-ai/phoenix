import { DatasetRole } from "@phoenix/types";

export function getDatasetRoleFromEventId(eventId: string): DatasetRole {
  if (eventId.includes("PRIMARY")) {
    return DatasetRole.primary;
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
} {
  const primaryEventIds: string[] = [];
  const referenceEventIds: string[] = [];
  eventIds.forEach((id) => {
    const datasetRole = getDatasetRoleFromEventId(id);
    if (datasetRole == DatasetRole.primary) {
      primaryEventIds.push(id);
    } else {
      referenceEventIds.push(id);
    }
  });
  return { primaryEventIds, referenceEventIds };
}
