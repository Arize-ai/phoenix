/**
 * A choice question's probabilities, most likely first, without the options
 * that would display as 0%. The chosen option is always kept.
 * @param params.probabilities - the option probabilities; ties keep this order
 * @param params.getValue - reads an entry's option value
 * @param params.chosen - the option the model picked, if any
 */
export function rankChoiceProbabilities<T extends { probability: number }>({
  probabilities,
  getValue,
  chosen,
}: {
  probabilities: readonly T[];
  getValue: (entry: T) => string;
  chosen: string | null | undefined;
}): T[] {
  return probabilities
    .filter(
      (entry) =>
        Math.round(entry.probability * 100) > 0 || getValue(entry) === chosen
    )
    .sort((left, right) => right.probability - left.probability);
}
