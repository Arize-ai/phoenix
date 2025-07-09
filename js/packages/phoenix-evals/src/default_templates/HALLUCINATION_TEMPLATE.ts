export const HALLUCINATION_TEMPLATE = `
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters. "hallucinated" indicates that the answer
provides factually inaccurate information to the query based on the reference text. "factual"
indicates that the answer to the question is correct relative to the reference text, and does not
contain made up information. Please read the query and reference text carefully before determining
your response.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Is the answer above factual or hallucinated based on the query and reference text?
`;

export const HALLUCINATION_CHOICES = {
  factual: 1,
  hallucinated: 0,
};
