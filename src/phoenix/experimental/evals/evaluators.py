from typing import List, Mapping, Optional

from phoenix.experimental.evals.models import set_verbosity
from phoenix.utilities.logging import printif

from .models import BaseEvalModel
from .templates import ClassificationTemplate, PromptTemplate

Record = Mapping[str, str]

NOT_PARSABLE = "NOT_PARSABLE"


class LLMEvaluator:
    """
    Leverages an LLM to evaluate individual records.
    """

    def __init__(
        self,
        model: BaseEvalModel,
        template: ClassificationTemplate,
        name: str,
        verbose: bool = False,
    ) -> None:
        """Initializer for LLMEvaluator.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.
            template (ClassificationTemplate): The evaluation template.
            name (str): The name of the evaluator.
            verbose (bool, optional): Whether to print verbose output.
        """
        self._model = model
        self._template = template
        self.name = name
        self._verbose = verbose

    def evaluate(self, record: Record) -> str:
        """Evaluates a single record.

        Args:
            record (Record): The record to evaluate.

        Returns:
            EvaluationResult: The result of the evaluation
        """
        prompt = self._template.format(record)
        with set_verbosity(self._model, self._verbose) as verbose_model:
            unparsed_output = verbose_model(prompt)
        parsed_output = _snap_to_rail(unparsed_output, self._template.rails, self._verbose)
        return parsed_output

    async def aevaluate(self, record: Record) -> str:
        """Evaluates a single record.

        Args:
            record (Record): The record to evaluate.

        Returns:
            EvaluationResult: The result of the evaluation
        """
        prompt = self._template.format(dict(record))
        with set_verbosity(self._model, self._verbose) as verbose_model:
            unparsed_output = await verbose_model._async_generate(prompt)
        parsed_output = _snap_to_rail(unparsed_output, self._template.rails, self._verbose)
        return parsed_output


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
        map_prompt_template: PromptTemplate,
        reduce_prompt_template: PromptTemplate,
    ) -> None:
        """Initializes an instance.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.

            map_prompt_template (PromptTemplate): The template that is mapped
            over each chunk to produce intermediate outputs. Must contain the
            {chunk} placeholder.

            reduce_prompt_template (PromptTemplate): The template that combines
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
        initial_prompt_template: PromptTemplate,
        refine_prompt_template: PromptTemplate,
        synthesize_prompt_template: Optional[PromptTemplate] = None,
    ) -> None:
        """Initializes an instance.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.

            initial_prompt_template (PromptTemplate): The template for the
            initial invocation of the model that will generate the initial
            accumulator. Should contain the {chunk} placeholder.

            refine_prompt_template (PromptTemplate): The template for refining
            the accumulator across all subsequence chunks. Must contain the
            {chunk} and {accumulator} placeholders.

            synthesize_prompt_template (Optional[PromptTemplate], optional): An
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


def _snap_to_rail(raw_string: Optional[str], rails: List[str], verbose: bool = False) -> str:
    """
    Snaps a string to the nearest rail, or returns None if the string cannot be
    snapped to a rail.

    Args:
        raw_string (str): An input to be snapped to a rail.

        rails (List[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or "UNPARSABLE" if the input
        string could not be snapped.
    """
    if not raw_string:
        return NOT_PARSABLE
    snap_string = raw_string.lower()
    rails = list(set(rail.lower() for rail in rails))
    rails.sort(key=len, reverse=True)
    found_rails = set()
    for rail in rails:
        if rail in snap_string:
            found_rails.add(rail)
            snap_string = snap_string.replace(rail, "")
    if len(found_rails) != 1:
        printif(verbose, f"- Cannot snap {repr(raw_string)} to rails")
        return NOT_PARSABLE
    rail = list(found_rails)[0]
    printif(verbose, f"- Snapped {repr(raw_string)} to rail: {rail}")
    return rail
