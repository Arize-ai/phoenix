import { listDatasetsInputSchema } from "./schemas";
import type { ListDatasetsInput } from "./types";

export function parseListDatasetsInput(
  input: unknown
): ListDatasetsInput | null {
  return listDatasetsInputSchema.safeParse(input).data ?? null;
}
