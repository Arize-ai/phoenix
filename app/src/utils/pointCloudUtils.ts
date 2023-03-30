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
    if (id.includes("PRIMARY")) {
      primaryEventIds.push(id);
    } else {
      referenceEventIds.push(id);
    }
  });
  return { primaryEventIds, referenceEventIds };
}
