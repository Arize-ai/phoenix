from typing import List, Optional

from phoenix.experimental.evals import ClassificationTemplate
from phoenix.experimental.evals.models import BaseEvalModel


class MapReducer:
    """
    Evaluates data that is too large to fit into a single context window using a
    map-reduce strategy. The data must first be divided into "chunks" that
    individually fit into an LLM's context window. Each chunk of data is
    individually evaluated (the "map" step), producing intermediate outputs that
    are combined into a single result (the "reduce" step).

    This is the simplest strategy for evaluating long-context data.
    """

    def __init__(
        self,
        model: BaseEvalModel,
        map_prompt_template: ClassificationTemplate,
        reduce_prompt_template: ClassificationTemplate,
    ) -> None:
        """Initializes an instance.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.

            map_prompt_template (ClassificationTemplate): The template that is mapped
            over each chunk to produce intermediate outputs. Must contain the
            {chunk} placeholder.

            reduce_prompt_template (ClassificationTemplate): The template that combines
            the intermediate outputs into a single result. Must contain the
            {mapped} placeholder, which will be formatted as a list of the
            intermediate outputs produced by the map step.
        """
        self._model = model
        self._map_prompt_template = map_prompt_template
        self._reduce_prompt_template = reduce_prompt_template

    def evaluate(self, chunks: List[str]) -> str:
        """Evaluates a list of two or more chunks.

        Args:
            chunks (List[str]): A list of chunks to be evaluated. Each chunk is
            inserted into the map_prompt_template and must therefore fit within
            the LLM's context window and still leave room for the rest of the
            prompt.

        Returns:
            str: The output of the map-reduce process.
        """
        if len(chunks) < 2:
            raise ValueError(
                "The map-reduce strategy is not needed to evaluate data "
                "that fits within a single context window. "
                "Consider using llm_classify instead."
            )
        model = self._model
        mapped_records = []
        for chunk in chunks:
            map_prompt = self._map_prompt_template.format({"chunk": chunk})
            intermediate_output = model(map_prompt)
            mapped_records.append(intermediate_output)
        reduce_prompt = self._reduce_prompt_template.format({"mapped": repr(mapped_records)})
        return model(reduce_prompt)


class Refiner:
    """
    Evaluates data that is too large to fit into a single context window using a
    refine strategy. The data must first be divided into "chunks" that
    individually fit into an LLM's context window. An initial "accumulator" is
    generated from the first chunk of data. The accumulator is subsequently
    refined by iteratively updating and incorporating new information from each
    subsequent chunk. An optional synthesis step can be used to synthesize the
    final accumulator into a desired format.
    """

    def __init__(
        self,
        model: BaseEvalModel,
        initial_prompt_template: ClassificationTemplate,
        refine_prompt_template: ClassificationTemplate,
        synthesize_prompt_template: Optional[ClassificationTemplate] = None,
    ) -> None:
        """Initializes an instance.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.

            initial_prompt_template (ClassificationTemplate): The template for the
            initial invocation of the model that will generate the initial
            accumulator. Should contain the {chunk} placeholder.

            refine_prompt_template (ClassificationTemplate): The template for refining
            the accumulator across all subsequence chunks. Must contain the
            {chunk} and {accumulator} placeholders.

            synthesize_prompt_template (Optional[ClassificationTemplate], optional): An
            optional template to synthesize the final version of the
            accumulator. Must contain the {accumulator} placeholder.
        """
        self._model = model
        self._initial_prompt_template = initial_prompt_template
        self._refine_prompt_template = refine_prompt_template
        self._synthesize_prompt_template = synthesize_prompt_template

    def evaluate(self, chunks: List[str]) -> str:
        """Evaluates a list of two or more chunks.

        Args:
            chunks (List[str]): A list of chunks to be evaluated. Each chunk is
            inserted into the initial_prompt_template and refine_prompt_template
            and must therefore fit within the LLM's context window and still
            leave room for the rest of the prompt.

        Returns:
            str: The output of the refine process.
        """
        if len(chunks) < 2:
            raise ValueError(
                "The refine strategy is not needed to evaluate data "
                "that fits within a single context window. "
                "Consider using llm_classify instead."
            )
        model = self._model
        initial_prompt = self._initial_prompt_template.format({"chunk": chunks[0]})
        accumulator = model(initial_prompt)
        for chunk in chunks[1:]:
            refine_prompt = self._refine_prompt_template.format(
                {"accumulator": accumulator, "chunk": chunk}
            )
            accumulator = model(refine_prompt)
        if not self._synthesize_prompt_template:
            return accumulator
        reduce_prompt = self._synthesize_prompt_template.format({"accumulator": accumulator})
        return model(reduce_prompt)
