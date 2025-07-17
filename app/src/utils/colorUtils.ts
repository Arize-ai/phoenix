import { interpolateSinebow } from "d3-scale-chromatic";

export const getWordColor = (word: string) => {
  const charCode = word.charCodeAt(0);
  return interpolateSinebow((charCode % 26) / 26);
};
