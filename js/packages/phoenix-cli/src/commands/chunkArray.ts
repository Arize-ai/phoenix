export function chunkArray<Item>({
  items,
  size,
}: {
  items: Item[];
  size: number;
}): Item[][] {
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
