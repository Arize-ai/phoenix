from __future__ import annotations

import asyncio
import json
import logging
import signal
import traceback
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    Iterable,
    List,
    Optional,
    Sequence,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from tqdm.auto import tqdm

from phoenix.experimental.evals.models import BaseEvalModel, OpenAIModel, set_verbosity
from phoenix.experimental.evals.templates import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    ClassificationTemplate,
    PromptOptions,
    PromptTemplate,
    map_template,
    normalize_classification_template,
)
from phoenix.experimental.evals.utils import get_tqdm_progress_bar_formatter
from phoenix.trace.semantic_conventions import DOCUMENT_CONTENT, INPUT_VALUE, RETRIEVAL_DOCUMENTS
from phoenix.utilities.logging import printif

logger = logging.getLogger(__name__)


OPENINFERENCE_QUERY_COLUMN_NAME = "attributes." + INPUT_VALUE
OPENINFERENCE_DOCUMENT_COLUMN_NAME = "attributes." + RETRIEVAL_DOCUMENTS

# argument keys in the default openai function call,
# defined here only to prevent typos
_RESPONSE = "response"
_EXPLANATION = "explanation"


class Unset:
    pass


_unset = Unset()


class AsyncExecutor:
    """
    A class that provides asynchronous execution of tasks using a producer-consumer pattern.

    An async interface is provided by the `execute` method, which returns a coroutine, and a sync
    interface is provided by the `run` method.

    Args:
        generation_fn (Callable[[Any], Coroutine[Any, Any, Any]]): A coroutine function that
        generates tasks to be executed.

        concurrency (int, optional): The number of concurrent consumers. Defaults to 3.

        tqdm_bar_format (Optional[str], optional): The format string for the progress bar. Defaults
        to None.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
        Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
        that encounter errors. Defaults to _unset.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Coroutine[Any, Any, Any]],
        concurrency: int = 3,
        tqdm_bar_format: Optional[str] = None,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.concurrency = concurrency
        self.tqdm_bar_format = tqdm_bar_format
        self.exit_on_error = exit_on_error

        self._TERMINATE = asyncio.Event()

    def _signal_handler(self, signum: int, frame: Any) -> None:
        self._TERMINATE.set()
        tqdm.write("Process was interrupted. The return value will be incomplete...")

    async def producer(
        self,
        inputs: Sequence[Any],
        queue: asyncio.Queue[Tuple[int, Any]],
        done_producing: asyncio.Event,
    ) -> None:
        try:
            for index, input in enumerate(inputs):
                if self._TERMINATE.is_set():
                    break
                await queue.put((index, input))
        finally:
            done_producing.set()

    async def consumer(
        self,
        output: List[Any],
        queue: asyncio.Queue[Tuple[int, Any]],
        done_producing: asyncio.Event,
        progress_bar: tqdm[Any],
    ) -> None:
        termination_signal_task = None
        while True:
            marked_done = False
            try:
                item = await asyncio.wait_for(queue.get(), timeout=1)
            except asyncio.TimeoutError:
                if done_producing.is_set() and queue.empty():
                    break
                continue
            if self._TERMINATE.is_set():
                # discard any remaining items in the queue
                queue.task_done()
                marked_done = True
                continue

            index, payload = item
            try:
                generate_task = asyncio.create_task(self.generate(payload))
                termination_signal_task = asyncio.create_task(self._TERMINATE.wait())
                done, pending = await asyncio.wait(
                    [generate_task, termination_signal_task],
                    timeout=60,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if generate_task in done:
                    output[index] = generate_task.result()
                    progress_bar.update()
                elif self._TERMINATE.is_set():
                    # discard the pending task and remaining items in the queue
                    if not generate_task.done():
                        generate_task.cancel()
                        try:
                            # allow any cleanup to finish for the cancelled task
                            await generate_task
                        except asyncio.CancelledError:
                            # Handle the cancellation exception
                            pass
                    queue.task_done()
                    marked_done = True
                    continue
                else:
                    tqdm.write(f"Worker timeout, requeuing: {payload}")
                    await queue.put(item)
            except Exception:
                tqdm.write(f"Exception in worker: {traceback.format_exc()}")
                if self.exit_on_error:
                    self._TERMINATE.set()
                else:
                    progress_bar.update()
            finally:
                if not marked_done:
                    queue.task_done()
                if termination_signal_task and not termination_signal_task.done():
                    termination_signal_task.cancel()

    async def execute(self, inputs: Sequence[Any]) -> List[Any]:
        signal.signal(signal.SIGINT, self._signal_handler)
        outputs = [self.fallback_return_value] * len(inputs)
        progress_bar = tqdm(total=len(inputs), bar_format=self.tqdm_bar_format)

        queue: asyncio.Queue[Tuple[int, Any]] = asyncio.Queue(maxsize=2 * self.concurrency)
        done_producing = asyncio.Event()

        producer = asyncio.create_task(self.producer(inputs, queue, done_producing))
        consumers = [
            asyncio.create_task(self.consumer(outputs, queue, done_producing, progress_bar))
            for _ in range(self.concurrency)
        ]

        await asyncio.gather(producer, *consumers)
        join_task = asyncio.create_task(queue.join())
        termination_signal_task = asyncio.create_task(self._TERMINATE.wait())
        done, pending = await asyncio.wait(
            [join_task, termination_signal_task], return_when=asyncio.FIRST_COMPLETED
        )
        if termination_signal_task in done:
            # Cancel all tasks
            if not join_task.done():
                join_task.cancel()
            if not producer.done():
                producer.cancel()
            for task in consumers:
                if not task.done():
                    task.cancel()

        if not termination_signal_task.done():
            termination_signal_task.cancel()
        return outputs

    def run(self, inputs: Sequence[Any]) -> List[Any]:
        return asyncio.run(self.execute(inputs))


class SyncExecutor:
    """
    Synchronous executor for generating outputs from inputs using a given generation function.

    Args:
        generation_fn (Callable[[Any], Any]): The generation function that takes an input and
        returns an output.

        tqdm_bar_format (Optional[str], optional): The format string for the progress bar. Defaults
        to None.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
        Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
        that encounter errors. Defaults to _unset.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Any],
        tqdm_bar_format: Optional[str] = None,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.tqdm_bar_format = tqdm_bar_format
        self.exit_on_error = exit_on_error

        self._TERMINATE = False

    def _signal_handler(self, signum: int, frame: Any) -> None:
        tqdm.write("Process was interrupted. The return value will be incomplete...")
        self._TERMINATE = True

    def run(self, inputs: Sequence[Any]) -> List[Any]:
        signal.signal(signal.SIGINT, self._signal_handler)
        outputs = [self.fallback_return_value] * len(inputs)
        progress_bar = tqdm(total=len(inputs), bar_format=self.tqdm_bar_format)

        for index, input in enumerate(inputs):
            if self._TERMINATE:
                break
            try:
                result = self.generate(input)
                outputs[index] = result
                progress_bar.update()
            except Exception as e:
                tqdm.write(f"Exception in worker: {e}")
                if self.exit_on_error:
                    break
                else:
                    progress_bar.update()
        return outputs


def get_executor_on_sync_context(
    sync_fn: Callable[[Any], Any],
    async_fn: Callable[[Any], Coroutine[Any, Any, Any]],
    concurrency: int = 3,
    tqdm_bar_format: Optional[str] = None,
    exit_on_error: bool = True,
    fallback_return_value: Union[Unset, Any] = _unset,
) -> Union[AsyncExecutor, SyncExecutor]:
    try:
        asyncio.get_running_loop()
        if getattr(asyncio, "_nest_patched", False):
            return AsyncExecutor(
                async_fn,
                concurrency=concurrency,
                tqdm_bar_format=tqdm_bar_format,
                exit_on_error=exit_on_error,
                fallback_return_value=fallback_return_value,
            )
        else:
            logger.warning(
                "🐌!! If running llm_classify inside a notebook, patching the event loop with "
                "nest_asyncio will allow asynchronous eval submission, and is significantly "
                "faster. To patch the event loop, run `nest_asyncio.apply()`."
            )
            return SyncExecutor(
                sync_fn,
                tqdm_bar_format=tqdm_bar_format,
                exit_on_error=exit_on_error,
                fallback_return_value=fallback_return_value,
            )
    except RuntimeError:
        return AsyncExecutor(
            async_fn,
            concurrency=concurrency,
            tqdm_bar_format=tqdm_bar_format,
            exit_on_error=exit_on_error,
            fallback_return_value=fallback_return_value,
        )


def llm_classify(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[ClassificationTemplate, PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    use_function_calling_if_available: bool = True,
    provide_explanation: bool = False,
    concurrency: int = 20,
) -> pd.DataFrame:
    """Classifies each input row of the dataframe using an LLM. Returns a pandas.DataFrame
    where the first column is named `label` and contains the classification labels. An optional
    column named `explanation` is added when `provide_explanation=True`.

    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[ClassificationTemplate, PromptTemplate, str]): The prompt template as
        either an instance of PromptTemplate, ClassificationTemplate or a string. If a string, the
        variable names should be surrounded by curly braces so that a call to `.format` can be made
        to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        rails (List[str]): A list of strings representing the possible output classes of the model's
        predictions.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed info to stdout such as model invocation
        parameters and details about retries and snapping to rails. Default False.

        use_function_calling_if_available (bool, default=True): If True, use function calling
        (if available) as a means to constrain the LLM outputs. With function calling, the LLM
        is instructed to provide its response as a structured JSON object, which is easier
        to parse.

        provide_explanation (bool, default=False): If True, provides an explanation for each
        classification label. A column named `explanation` is added to the output dataframe.
        Currently, this is only available for models with function calling.

        concurrency (int, default=3): The number of concurrent evals.

    Returns:
        pandas.DataFrame: A dataframe where the `label` column (at column position 0) contains
        the classification labels. If provide_explanation=True, then an additional column named
        `explanation` is added to contain the explanation for each label. The dataframe has
        the same length and index as the input dataframe. The classification label values are
        from the entries in the rails argument or "NOT_PARSABLE" if the model's output could
        not be parsed.
    """
    tqdm_bar_format = get_tqdm_progress_bar_formatter("llm_classify")
    use_openai_function_call = (
        use_function_calling_if_available
        and isinstance(model, OpenAIModel)
        and model.supports_function_calling
    )

    model_kwargs: Dict[str, Any] = {}
    if use_openai_function_call:
        openai_function = _default_openai_function(rails, provide_explanation)
        model_kwargs["functions"] = [openai_function]
        model_kwargs["function_call"] = {"name": openai_function["name"]}

    eval_template = normalize_classification_template(rails=rails, template=template)

    prompt_options = PromptOptions(provide_explanation=provide_explanation)
    prompts = map_template(dataframe, eval_template, options=prompt_options)

    labels: List[Optional[str]] = [None] * len(dataframe)
    explanations: List[Optional[str]] = [None] * len(dataframe)

    printif(verbose, f"Using prompt:\n\n{eval_template.prompt(prompt_options)}")
    if generation_info := model.verbose_generation_info():
        printif(verbose, generation_info)

    def _process_response(response: str) -> Tuple[str, Optional[str]]:
        if not use_openai_function_call:
            if provide_explanation:
                unrailed_label, explanation = (
                    eval_template.extract_label_from_explanation(response),
                    response,
                )
                printif(
                    verbose and unrailed_label == NOT_PARSABLE,
                    f"- Could not parse {repr(response)}",
                )
            else:
                unrailed_label = response
                explanation = None
        else:
            try:
                function_arguments = json.loads(response, strict=False)
                unrailed_label = function_arguments.get(_RESPONSE)
                explanation = function_arguments.get(_EXPLANATION)
            except json.JSONDecodeError:
                unrailed_label = response
                explanation = None
        return _snap_to_rail(unrailed_label, rails, verbose=verbose), explanation

    async def _run_llm_classification_async(prompt: str) -> Tuple[str, Optional[str]]:
        with set_verbosity(model, verbose) as verbose_model:
            response = await verbose_model._async_generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        return _process_response(response)

    def _run_llm_classification_sync(prompt: str) -> Tuple[str, Optional[str]]:
        with set_verbosity(model, verbose) as verbose_model:
            response = verbose_model._generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        return _process_response(response)

    executor: Union[AsyncExecutor, SyncExecutor] = get_executor_on_sync_context(
        _run_llm_classification_sync,
        _run_llm_classification_async,
        concurrency=concurrency,
        tqdm_bar_format=tqdm_bar_format,
        exit_on_error=True,
        fallback_return_value=(None, None),
    )

    results = executor.run(prompts.tolist())
    labels, explanations = zip(*results)

    return pd.DataFrame(
        data={
            "label": labels,
            **({"explanation": explanations} if provide_explanation else {}),
        },
        index=dataframe.index,
    )


def run_relevance_eval(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[ClassificationTemplate, str] = RAG_RELEVANCY_PROMPT_TEMPLATE,
    rails: List[str] = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    system_instruction: Optional[str] = None,
    query_column_name: str = "input",
    document_column_name: str = "reference",
    verbose: bool = False,
) -> List[List[str]]:
    """
    Given a pandas dataframe containing queries and retrieved documents, classifies the relevance of
    each retrieved document to the corresponding query using an LLM.

    Args:
        dataframe (pd.DataFrame): A pandas dataframe containing queries and retrieved documents. If
        both query_column_name and reference_column_name are present in the input dataframe, those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the documents column must be lists of strings. Each list may contain an
          arbitrary number of document texts retrieved for the corresponding query.

        If the input dataframe is lacking either query_column_name or reference_column_name but has
        query and retrieved document columns in OpenInference trace format named
        "attributes.input.value" and "attributes.retrieval.documents", respectively, then those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the document column must be lists of OpenInference document objects, each
          object being a dictionary that stores the document text under the key "document.content".

        This latter format is intended for running evaluations on exported OpenInference trace
        dataframes. For more information on the OpenInference tracing specification, see
        https://github.com/Arize-ai/open-inference-spec/.

        model (BaseEvalModel): The model used for evaluation.

        template (Union[PromptTemplate, str], optional): The template used for evaluation.

        rails (List[str], optional): A list of strings representing the possible output classes of
        the model's predictions.

        query_column_name (str, optional): The name of the query column in the dataframe, which
        should also be a template variable.

        reference_column_name (str, optional): The name of the document column in the dataframe,
        which should also be a template variable.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed information to stdout such as model
        invocation parameters and retry info. Default False.

    Returns:
        List[List[str]]: A list of relevant and not relevant classifications. The "shape" of the
        list should mirror the "shape" of the retrieved documents column, in the sense that it has
        the same length as the input dataframe and each sub-list has the same length as the
        corresponding list in the retrieved documents column. The values in the sub-lists are either
        entries from the rails argument or "NOT_PARSABLE" in the case where the LLM output could not
        be parsed.
    """

    with set_verbosity(model, verbose) as verbose_model:
        query_column = dataframe.get(query_column_name)
        document_column = dataframe.get(document_column_name)
        if query_column is None or document_column is None:
            openinference_query_column = dataframe.get(OPENINFERENCE_QUERY_COLUMN_NAME)
            openinference_document_column = dataframe.get(OPENINFERENCE_DOCUMENT_COLUMN_NAME)
            if openinference_query_column is None or openinference_document_column is None:
                raise ValueError(
                    f'Dataframe columns must include either "{query_column_name}" and '
                    f'"{document_column_name}", or "{OPENINFERENCE_QUERY_COLUMN_NAME}" and '
                    f'"{OPENINFERENCE_DOCUMENT_COLUMN_NAME}".'
                )
            query_column = openinference_query_column
            document_column = openinference_document_column.map(
                lambda docs: _get_contents_from_openinference_documents(docs)
                if docs is not None
                else None
            )

        queries = cast("pd.Series[str]", query_column).tolist()
        document_lists = cast("pd.Series[str]", document_column).tolist()
        indexes = []
        expanded_queries = []
        expanded_documents = []
        for index, (query, documents) in enumerate(zip(queries, document_lists)):
            if query is None or documents is None:
                continue
            for document in documents:
                indexes.append(index)
                expanded_queries.append(query)
                expanded_documents.append(document)
        predictions = llm_classify(
            dataframe=pd.DataFrame(
                {
                    query_column_name: expanded_queries,
                    document_column_name: expanded_documents,
                }
            ),
            model=verbose_model,
            template=template,
            rails=rails,
            system_instruction=system_instruction,
            verbose=verbose,
        ).iloc[:, 0]
        outputs: List[List[str]] = [[] for _ in range(len(dataframe))]
        for index, prediction in zip(indexes, predictions):
            outputs[index].append(prediction)
        return outputs


def _get_contents_from_openinference_documents(documents: Iterable[Any]) -> List[Optional[str]]:
    """
    Get document contents from an iterable of OpenInference document objects, which are dictionaries
    containing the document text under the "document.content" key.
    """
    return [doc.get(DOCUMENT_CONTENT) if isinstance(doc, dict) else None for doc in documents]


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


def _default_openai_function(
    rails: List[str],
    with_explanation: bool = False,
) -> Dict[str, Any]:
    properties = {
        **(
            {
                _EXPLANATION: {
                    "type": "string",
                    "description": "Explanation of the reasoning for your response.",
                },
            }
            if with_explanation
            else {}
        ),
        _RESPONSE: {"type": "string", "description": "Your response.", "enum": rails},
    }
    required = [*([_EXPLANATION] if with_explanation else []), _RESPONSE]
    return {
        "name": "record_response",
        "description": "A function to record your response.",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required,
        },
    }
