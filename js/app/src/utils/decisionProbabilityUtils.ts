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

/**
 * A yes/no answer as its two options, ranked like a choice's: the likelier
 * first, without an option that would display as 0%.
 * @param probability - the probability of true
 */
export function rankPredicateProbabilities(probability: number): {
  value: "True" | "False";
  probability: number;
}[] {
  return rankChoiceProbabilities({
    probabilities: [
      { value: "True", probability },
      { value: "False", probability: 1 - probability },
    ],
    getValue: (entry) => entry.value,
    chosen: probability >= 0.5 ? "True" : "False",
  });
}
