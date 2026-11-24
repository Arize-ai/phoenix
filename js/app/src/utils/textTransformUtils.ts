/**
 * Folds accented letters to their base letter (e.g. "café" → "cafe") by
 * decomposing to NFD and dropping the combining marks, so live input
 * transforms keep the letter instead of deleting it as an unsupported
 * character.
 */
export function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
