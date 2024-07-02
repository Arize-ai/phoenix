import { InferencesRole } from "@phoenix/types";

export function getInferencesRoleFromEventId(eventId: string): InferencesRole {
  if (eventId.includes("PRIMARY")) {
    return InferencesRole.primary;
  } else if (eventId.includes("CORPUS")) {
    return InferencesRole.corpus;
  } else {
    return InferencesRole.reference;
  }
}
/**
 * A function to split event ids by inferences
 * @param eventIds
 * @returns
 */
export function splitEventIdsByInferenceSet(eventIds: string[]): {
  primaryEventIds: string[];
  referenceEventIds: string[];
  corpusEventIds: string[];
} {
  const primaryEventIds: string[] = [];
  const referenceEventIds: string[] = [];
  const corpusEventIds: string[] = [];
  eventIds.forEach((id) => {
    const inferencesRole = getInferencesRoleFromEventId(id);
    if (inferencesRole == InferencesRole.primary) {
      primaryEventIds.push(id);
    } else if (inferencesRole == InferencesRole.corpus) {
      corpusEventIds.push(id);
    } else {
      referenceEventIds.push(id);
    }
  });
  return { primaryEventIds, referenceEventIds, corpusEventIds };
}
