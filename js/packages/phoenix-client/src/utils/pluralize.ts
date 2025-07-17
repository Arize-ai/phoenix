/**
 * Pluralize a word based on the count.
 *
 * @param word - The word to pluralize.
 * @param count - The count of the word.
 * @returns The pluralized word.
 */
export function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}
