/**
 * Make a column id safe for use in a table
 * @param name - The name of the column
 * @returns A safe column id
 */
export function makeSafeColumnId(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "-");
}
