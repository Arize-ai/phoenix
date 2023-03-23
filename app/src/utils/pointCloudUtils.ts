/**
 * A function to split point ids by dataset
 * @param pointIds
 * @returns
 */
export function splitPointIdsByDataset(pointIds: string[]): {
  primaryPointIds: string[];
  referencePointIds: string[];
} {
  const primaryPointIds: string[] = [];
  const referencePointIds: string[] = [];
  pointIds.forEach((id) => {
    if (id.includes("PRIMARY")) {
      primaryPointIds.push(id);
    } else {
      referencePointIds.push(id);
    }
  });
  return { primaryPointIds, referencePointIds };
}
