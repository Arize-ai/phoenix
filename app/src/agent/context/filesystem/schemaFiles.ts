export function createTableSchemaFile(
  tables: Record<string, { format: "jsonl" | "json"; columns: string[] }>
) {
  return JSON.stringify(
    {
      tables,
    },
    null,
    2
  );
}
