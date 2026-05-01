export function chunkArray<T>({
  items,
  size,
}: {
  items: T[];
  size: number;
}): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
