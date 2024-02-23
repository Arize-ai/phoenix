from textwrap import indent
from typing import List, Mapping, Optional, Tuple, Type

from phoenix.evals.default_templates import EvalCriteria
from phoenix.evals.models import BaseModel, OpenAIModel, set_verbosity
from phoenix.evals.templates import (
    ClassificationTemplate,
    PromptOptions,
    PromptTemplate,
)
from phoenix.evals.utils import (
    NOT_PARSABLE,
    openai_function_call_kwargs,
    parse_openai_function_call,
    printif,
    snap_to_rail,
)

Record = Mapping[str, str]
_TAB = " " * 4


class LLMEvaluator:
    """
    Leverages an LLM to evaluate individual records.
    """

    def __init__(
        self,
        model: BaseModel,
        template: ClassificationTemplate,
    ) -> None:
        """Initializer for LLMEvaluator.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation.
            template (ClassificationTemplate): The evaluation template.
        """
        self._model = model
        self._template = template

    @property
    def default_concurrency(self) -> int:
        return self._model.default_concurrency

    def reload_client(self) -> None:
        self._model.reload_client()

    def evaluate(
        self,
        record: Record,
        provide_explanation: bool = False,
        use_function_calling_if_available: bool = True,
        verbose: bool = False,
    ) -> Tuple[str, Optional[float], Optional[str]]:
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
            Tuple[str, Optional[float], Optional[str]]: A tuple containing:
            - label
            - score (if scores for each label are specified by the template)
            - explanation (if requested)
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
        score = self._template.score(label)
        return label, score, explanation

    async def aevaluate(
        self,
        record: Record,
        provide_explanation: bool = False,
        use_function_calling_if_available: bool = True,
        verbose: bool = False,
    ) -> Tuple[str, Optional[float], Optional[str]]:
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
            Tuple[str, Optional[float], Optional[str]]: A tuple containing:
            - label
            - score (if scores for each label are specified by the template)
            - explanation (if requested)
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
        score = self._template.score(label)
        return label, score, explanation


def _create_llm_evaluator_subclass(
    class_name: str, template: ClassificationTemplate, docstring: str
) -> Type[LLMEvaluator]:
    """A factory method that dynamically creates subclasses of LLMEvaluator.

    Args:
        class_name (str): Name of the class to be created (should match the name
        of the assignment variable).

        template (ClassificationTemplate): The classification template to use
        for evaluation.

        docstring (str): The docstring that will be attached to the subclass.

    Returns:
        Type[LLMEvaluator]: The dynamically created subclass.
    """

    def __init__(self: LLMEvaluator, model: BaseModel) -> None:
        LLMEvaluator.__init__(self, model, template)

    __init__.__doc__ = f"""
        Initializer for {class_name}.

        Args:
            model (BaseEvalModel): The LLM model to use for evaluation."""

    docstring += f" Outputs railed classes {', '.join(template.rails)}."
    docstring += "\n\nThe template used for evaluation (without explanation) is:\n\n"
    docstring += indent(template.template, 2 * _TAB)

    return type(class_name, (LLMEvaluator,), {"__init__": __init__, "__doc__": docstring})


(
    HallucinationEvaluator,
    RelevanceEvaluator,
    ToxicityEvaluator,
    QAEvaluator,
    SummarizationEvaluator,
) = map(
    lambda args: _create_llm_evaluator_subclass(*args),
    (
        (
            "HallucinationEvaluator",
            EvalCriteria.HALLUCINATION.value,
            'Leverages an LLM to evaluate whether a response (stored under an "output" column) is a hallucination given a query (stored under an "input" column) and one or more retrieved documents (stored under a "reference" column).',  # noqa: E501
        ),
        (
            "RelevanceEvaluator",
            EvalCriteria.RELEVANCE.value,
            'Leverages an LLM to evaluate whether a retrieved document (stored under a "reference" column) is relevant or irrelevant to the corresponding query (stored under the "input" column).',  # noqa: E501
        ),
        (
            "ToxicityEvaluator",
            EvalCriteria.TOXICITY.value,
            'Leverages an LLM to evaluate whether the string stored under the "input" column contains racist, sexist, chauvinistic, biased, or otherwise toxic content.',  # noqa: E501
        ),
        (
            "QAEvaluator",
            EvalCriteria.QA.value,
            'Leverages an LLM to evaluate whether a response (stored under an "output" column) is correct or incorrect given a query (stored under an "input" column) and one or more retrieved documents (stored under a "reference" column).',  # noqa: E501
        ),
        (
            "SummarizationEvaluator",
            EvalCriteria.SUMMARIZATION.value,
            'Leverages an LLM to evaluate whether a summary (stored under an "output" column) provides an accurate synopsis of an input document (stored under a "input" column).',  # noqa: E501
        ),
    ),
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
        model: BaseModel,
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
        model: BaseModel,
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
