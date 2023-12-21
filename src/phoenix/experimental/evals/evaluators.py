from typing import List, Mapping, Optional, Tuple

from phoenix.exceptions import PhoenixException
from phoenix.experimental.evals.models import set_verbosity
from phoenix.experimental.evals.templates.default_templates import (
    EvalCriteria,
)
from phoenix.experimental.evals.utils import (
    NOT_PARSABLE,
    openai_function_call_kwargs,
    parse_openai_function_call,
    snap_to_rail,
)
from phoenix.utilities.logging import printif

from .models import BaseEvalModel, OpenAIModel
from .templates import ClassificationTemplate, PromptOptions, PromptTemplate

Record = Mapping[str, str]


class InvalidEvalCriteriaError(PhoenixException):
    pass


class LLMEvaluator:
    """
    Leverages an LLM to evaluate individual records.
    """

    def __init__(
        self,
        model: BaseEvalModel,
        template: ClassificationTemplate,
    ) -> None:
        """Initializer for LLMEvaluator.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.
            template (ClassificationTemplate): The evaluation template.
        """
        self._model = model
        self._template = template

    def evaluate(
        self,
        record: Record,
        provide_explanation: bool = False,
        use_function_calling_if_available: bool = True,
        verbose: bool = False,
    ) -> Tuple[str, Optional[str]]:
        """
        Evaluates a single record.

        Args:
            record (Record): The record to evaluate.

            provide_explanation (bool, optional): Whether to provide an
            explanation.

            use_function_calling_if_available (bool, optional): If True, use
            function calling (if available) as a means to constrain the LLM
            outputs. With function calling, the LLM is instructed to provide its
            response as a structured JSON object, which is easier to parse.

            use_function_calling_if_available (bool, optional): If True, use
            function calling (if available) as a means to constrain the LLM
            outputs. With function calling, the LLM is instructed to provide its
            response as a structured JSON object, which is easier to parse.

            verbose (bool, optional): Whether to print verbose output.

        Returns:
            Tuple[str, Optional[str]]: The label and explanation (if provided).
        """
        use_openai_function_call = (
            use_function_calling_if_available
            and isinstance(self._model, OpenAIModel)
            and self._model.supports_function_calling
        )
        prompt = self._template.format(
            record, options=PromptOptions(provide_explanation=provide_explanation)
        )
        with set_verbosity(self._model, verbose) as verbose_model:
            unparsed_output = verbose_model(
                prompt,
                **(
                    openai_function_call_kwargs(self._template.rails, provide_explanation)
                    if use_openai_function_call
                    else {}
                ),
            )
        label, explanation = _extract_label_and_explanation(
            unparsed_output=unparsed_output,
            template=self._template,
            provide_explanation=provide_explanation,
            use_openai_function_call=use_openai_function_call,
            verbose=verbose,
        )
        return label, explanation

    async def aevaluate(
        self,
        record: Record,
        provide_explanation: bool = False,
        use_function_calling_if_available: bool = True,
        verbose: bool = False,
    ) -> Tuple[str, Optional[str]]:
        """
        Evaluates a single record.

        Args:
            record (Record): The record to evaluate.

            provide_explanation (bool, optional): Whether to provide an
            explanation.

            use_function_calling_if_available (bool, optional): If True, use
            function calling (if available) as a means to constrain the LLM
            outputs. With function calling, the LLM is instructed to provide its
            response as a structured JSON object, which is easier to parse.

            verbose (bool, optional): Whether to print verbose output.

        Returns:
            Tuple[str, Optional[str]]: The label and explanation (if provided).
        """
        use_openai_function_call = (
            use_function_calling_if_available
            and isinstance(self._model, OpenAIModel)
            and self._model.supports_function_calling
        )
        prompt = self._template.format(
            record, options=PromptOptions(provide_explanation=provide_explanation)
        )
        with set_verbosity(self._model, verbose) as verbose_model:
            unparsed_output = await verbose_model._async_generate(
                prompt,
                **(
                    openai_function_call_kwargs(self._template.rails, provide_explanation)
                    if use_openai_function_call
                    else {}
                ),
            )
        label, explanation = _extract_label_and_explanation(
            unparsed_output=unparsed_output,
            template=self._template,
            provide_explanation=provide_explanation,
            use_openai_function_call=use_openai_function_call,
            verbose=verbose,
        )
        return label, explanation

    @classmethod
    def from_criteria(
        cls,
        criteria: EvalCriteria,
        model: BaseEvalModel,
    ) -> "LLMEvaluator":
        """
        Instantiates an LLMEvaluator from an eval criteria.

        Args:
            criteria (EvalCriteria): The eval criteria.

            model (BaseEvalModel): The model to use for evaluation.

        Returns:
            LLMEvaluator: The instantiate evaluator.
        """
        return cls(
            model=model,
            template=criteria.value,
        )


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


def _extract_label_and_explanation(
    unparsed_output: str,
    template: ClassificationTemplate,
    provide_explanation: bool,
    use_openai_function_call: bool,
    verbose: bool,
) -> Tuple[str, Optional[str]]:
    """
    Extracts the label and explanation from the unparsed output.

    Args:
        unparsed_output (str): The raw output to be parsed.

        template (ClassificationTemplate): The template used to generate the
        output.

        provide_explanation (bool): Whether the output includes an explanation.

        use_openai_function_call (bool): Whether the output was generated using
        function calling.

        verbose (bool): If True, print verbose output to stdout.

    Returns:
        Tuple[str, Optional[str]]: A tuple containing the label and an
        explanation (if one is provided).
    """
    if not use_openai_function_call:
        if provide_explanation:
            unrailed_label, explanation = (
                template.extract_label_from_explanation(unparsed_output),
                unparsed_output,
            )
            printif(
                verbose and unrailed_label == NOT_PARSABLE,
                f"- Could not parse {repr(unparsed_output)}",
            )
        else:
            unrailed_label = unparsed_output
            explanation = None
    else:
        unrailed_label, explanation = parse_openai_function_call(unparsed_output)
    return snap_to_rail(unrailed_label, template.rails, verbose=verbose), explanation
