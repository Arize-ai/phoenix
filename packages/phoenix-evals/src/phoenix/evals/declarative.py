import asyncio
import json
import time
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Tuple,
    Union,
)

import pandas as pd
from openai import AsyncOpenAI, OpenAI
from pydantic import BaseModel, Field, create_model
from tqdm import tqdm

from phoenix.client.utils.template_formatters import MustacheBaseTemplateFormatter
from phoenix.evals.templates import (
    PromptPartContentType,
    PromptPartTemplate,
)
from phoenix.evals.utils import (
    get_tqdm_progress_bar_formatter,
    printif,
)


def transform_field_mappings_for_explanation(field_mappings: Dict[str, str]) -> Dict[str, str]:
    """
    Transforms field mappings to work with a schema that includes an explanation field.

    This function takes field mappings that point to fields within a schema and transforms them
    to work with a schema that wraps the original schema and adds an explanation field.

    Args:
        field_mappings (Dict[str, str]): A dictionary mapping target field names to paths
            within the original schema. For example, {"conciseness.label": "conciseness.is_concise"}.

    Returns:
        Dict[str, str]: A new dictionary with transformed field mappings where each value is
            prefixed with "schema." and an additional "explanation" mapping is added.

    Example:
        >>> field_mappings = {"conciseness.label": "conciseness.is_concise"}
        >>> transform_field_mappings_for_explanation(field_mappings)
        {"conciseness.label": "schema.conciseness.is_concise", "explanation": "explanation"}
    """  # noqa: E501
    new_field_mappings = {}
    for key, value in field_mappings.items():
        new_field_mappings[key] = f"schema.{value}"
    # Override the explanation field mapping
    new_field_mappings["explanation"] = "explanation"
    return new_field_mappings


async def declarative_eval(
    data: Union[pd.DataFrame, List[Any]],
    model: Union[OpenAI, AsyncOpenAI],
    schema: BaseModel,  # Pydantic model class
    field_mappings: Dict[
        str, str
    ],  # key is the openinference target field value, value is the path to the field in the schema
    system_instruction: str = "You will be provided the input passed to the llm and the generated output data to evaluate according to the specified schema.",  # noqa: E501
    verbose: bool = False,
    include_prompt: bool = False,
    include_response: bool = False,
    include_exceptions: bool = False,
    provide_explanation: bool = False,
    max_retries: int = 10,
    exit_on_error: bool = True,
    run_sync: bool = False,
    concurrency: Optional[int] = None,
    progress_bar_format: Optional[str] = get_tqdm_progress_bar_formatter("llm_classify"),
) -> pd.DataFrame:
    """
    Evaluates data using a declarative schema with an LLM.

    This function evaluates each row of the input data using a declarative schema with an LLM.
    It returns a pandas DataFrame with the evaluation results mapped according to the provided field mappings.

    Args:
        data (Union[pd.DataFrame, List[Any]]): A collection of data to evaluate with columns
            that match the template variables "attributes.llm.input_messages" and
            "attributes.llm.output_messages".

        model (Union[OpenAI, AsyncOpenAI]): An OpenAI client instance to use for evaluation.

        schema (BaseModel): A Pydantic model class defining the evaluation schema.

        field_mappings (Dict[str, str]): A dictionary mapping target field names to paths
            within the schema. For example, {"conciseness.label": "conciseness.is_concise"}.

        system_instruction (str): A system message to guide the evaluation, defaults to
            "You will be provided the input passed to the llm and the generated output data to evaluate according to the specified schema.".

        verbose (bool): If True, prints detailed information during evaluation. Default is False.

        include_prompt (bool): Not currently used.

        include_response (bool): Not currently used.

        include_exceptions (bool): Not currently used.

        provide_explanation (bool): If True, adds an explanation field to the schema and output. Default is False.

        max_retries (int): Not currently used.

        exit_on_error (bool): Not currently used.

        run_sync (bool): Not currently used.

        concurrency (Optional[int]): Not currently used.

        progress_bar_format (Optional[str]): Format for the progress bar. If None, progress bar is disabled.

    Returns:
        pd.DataFrame: A DataFrame containing the evaluation results with columns mapped according
            to the field_mappings parameter along with the execution time and any exceptions.
            The DataFrame has the same length and index as the input data.

    Raises:
        ValueError: If the input data doesn't contain required columns or if field mappings are invalid.

    Example:
        ```python
        # Define a schema with nested models
        class Conciseness(BaseModel):
            is_concise: bool = Field(..., description="Whether the output is concise")

        class Formatting(BaseModel):
            language: Literal["High", "Average", "Low"] = Field(
                ..., description="The complexity of the formatting used in the output"
            )

        class Schema(BaseModel):
            conciseness: Conciseness = Field(..., description="A custom evaluation of the output")
            formatting: Formatting = Field(..., description="A custom evaluation of the output")

        # Prepare sample data
        data = pd.DataFrame({
            "attributes.llm.input_messages": [
                [{"role": "user", "content": "What is 2+2?"}],
                [{"role": "user", "content": "Who was the first president?"}],
            ],
            "attributes.llm.output_messages": [
                [{"role": "assistant", "content": "Whenever you add those two numbers, you get 4"}],
                [{"role": "assistant", "content": "George Washington"}],
            ],
        })

        # Define field mappings
        field_mappings = {
            "conciseness.label": "conciseness.is_concise",
            "formatting.label": "formatting.language",
        }

        # Run the evaluation
        result = await declarative_eval(
            data=data,
            model=openai_client,
            schema=Schema,
            field_mappings=field_mappings,
        )

        # Result will be a DataFrame with columns:
        # - conciseness.label (containing boolean values)
        # - formatting.label (containing "High", "Average", or "Low")
        # - execution_seconds (execution time)
        # - exceptions (any errors encountered)
        ```
    """  # noqa: E501

    formatter = MustacheBaseTemplateFormatter()
    template = PromptPartTemplate(
        content_type=PromptPartContentType.TEXT,
        template="""an input and output pair passed to an LLM
        INPUT MESSAGES:
        ```
        {{input}}
        ```
        OUTPUT MESSAGE:
        ```
        {{output}}
        ```
        """,
    )

    # Convert data to consistent format
    if isinstance(data, pd.DataFrame):
        dataframe = data
        dataframe_index = data.index
    else:
        dataframe = pd.DataFrame(data)
        dataframe_index = dataframe.index

    if provide_explanation:
        # Update the schema
        ExplainedSchema = create_model(
            "ExplainedSchema",
            schema=(schema, Field(..., description="The schema to evaluate")),
            explanation=(str, Field(..., description="An explanation of the evaluation")),
        )
        schema = ExplainedSchema

        # Update the field mappings
        field_mappings = transform_field_mappings_for_explanation(field_mappings)

    def _map_template(data: pd.Series) -> str:
        output_str = formatter.format(
            template.template,
            variables={
                "input": json.dumps(data["attributes.llm.input_messages"]).replace("\\", "\\\\"),
                "output": json.dumps(data["attributes.llm.output_messages"]).replace("\\", "\\\\"),
            },
        )
        return output_str

    async def _run_llm_eval_async(
        row_data: Tuple[int, pd.Series],
    ) -> Tuple[pd.Series, Dict[str, Any], Optional[str], float]:
        # Guard clause
        if type(model) is OpenAI:
            raise ValueError("OpenAI is not supported for async operations")
        idx, row = row_data

        # Handle async request
        async def _make_request(
            idx: int, row: pd.Series
        ) -> Tuple[int, pd.Series, BaseModel, Optional[str], float]:
            try:
                start_time = time.time()
                response = await model.beta.chat.completions.parse(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {
                            "role": "system",
                            "content": system_instruction,
                        },
                        {"role": "user", "content": _map_template(row)},
                    ],
                    response_format=schema,
                )
                parsed_response = response.choices[0].message.parsed
                end_time = time.time()
                execution_seconds = end_time - start_time
                printif(
                    verbose,
                    f"""\n\nIndex: {idx}
                    Execution time: {execution_seconds} s
                    Structured output: {parsed_response.model_dump_json(indent=2)}
                    \n\n""",
                )
                return idx, row, parsed_response, None, execution_seconds
            except Exception as e:
                return idx, row, None, str(e), 0

        result = await _make_request(idx, row)

        # # create tasks
        # tasks = []
        # for idx, (_, row) in enumerate(dataframe.iterrows()):
        #     tasks.append(_make_request(idx, row))

        # results = [None] * len(tasks)
        # with tqdm(total=len(tasks), desc="Running Declarative Evaluations") as pbar:
        #     for coro in asyncio.as_completed(tasks):
        #         idx, row, parsed_response, error, execution_seconds = await coro
        #         results[idx] = (row, parsed_response, error, execution_seconds)
        #         pbar.update(1)

        return result

    def _run_llm_eval_sync(row_data: Tuple[int, pd.Series]) -> Tuple[pd.Series, Dict[str, Any]]:
        if type(model) is AsyncOpenAI:
            raise ValueError("AsyncOpenAI is not supported for sync operations")

        idx, row = row_data

        def _make_request(
            idx: int, row: pd.Series
        ) -> Tuple[int, pd.Series, BaseModel, Optional[str], float]:
            try:
                start_time = time.time()
                response = model.beta.chat.completions.parse(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {
                            "role": "system",
                            "content": system_instruction,
                        },
                        {"role": "user", "content": _map_template(row)},
                    ],
                    response_format=schema,
                )
                parsed_response = response.choices[0].message.parsed
                end_time = time.time()
                execution_seconds = end_time - start_time
                return idx, row, parsed_response, None, execution_seconds
            except Exception as e:
                return idx, row, None, str(e), 0

        result = _make_request(idx, row)
        # results = [None] * len(dataframe)
        # for idx, (_, row) in enumerate(dataframe.iterrows()):
        #     idx, row, parsed_response, error, execution_seconds = _make_request(idx, row)
        #     results[idx] = (row, parsed_response, error, execution_seconds)
        return result

    def _get_nested_value(obj: Dict[str, Any], path: str) -> Any:
        parts = path.split(".")
        current = obj
        for part in parts:
            if part in current:
                current = current[part]
            else:
                return None
        return current

    def _extract_data_using_field_mappings(
        result: Tuple[pd.Series, BaseModel, Optional[str], float],
    ) -> Dict[str, Any]:
        row, parsed_response, error, execution_seconds = result
        results_data = {}
        results_data["execution_seconds"] = execution_seconds
        results_data["exceptions"] = []
        if error:
            results_data["exceptions"].append(error)
            for schema_field, _ in field_mappings.items():
                results_data[schema_field] = None
        else:
            for schema_field, object_path in field_mappings.items():
                json_schema_object = parsed_response.model_dump()
                results_data[schema_field] = _get_nested_value(json_schema_object, object_path)

        return results_data

    def _parse_results(
        results: List[Tuple[pd.Series, BaseModel, Optional[str], float]],
    ) -> List[Tuple[pd.Series, Dict[str, Any]]]:
        results_data = []
        for result in results:
            _idx, row, model_response, error, execution_seconds = result
            results_data.append(
                (
                    result[0],
                    _extract_data_using_field_mappings(
                        (row, model_response, error, execution_seconds)
                    ),
                )
            )
        return results_data

    # # USING EXECUTOR (cannot be used without acceptable model)
    # fallback_return_value = (pd.Series(), {}, None, 0)
    # executor = get_executor_on_sync_context(
    #     _run_llm_eval_sync,
    #     _run_llm_eval_async,
    #     run_sync=run_sync,
    #     concurrency=concurrency,
    #     tqdm_bar_format=progress_bar_format,
    #     max_retries=max_retries,
    #     exit_on_error=exit_on_error,
    #     fallback_return_value=fallback_return_value,
    # )

    # inputs = [
    #     row for _, row in dataframe.iterrows()
    # ]
    # print("inputs", inputs)
    # import pdb; pdb.set_trace()
    # results, execution_details = executor.run(inputs)
    # print("results", results)
    # print("execution_details", execution_details)

    inputs = [(idx, row) for idx, row in dataframe.iterrows()]
    results = []
    with tqdm(total=len(inputs), desc="Running Declarative Evaluations") as pbar:
        tasks = []
        for input in inputs:
            task = _run_llm_eval_async(input)
            tasks.append(task)

        for task in asyncio.as_completed(tasks):
            result = await task
            results.append(result)
            pbar.update(1)
    # results = _run_llm_eval_sync()
    results_data = _parse_results(results)

    rows = []
    outcome_results = []
    for result in results_data:
        rows.append(result[0])
        outcome_results.append(result[1])

    # transform results from item centric to field centric
    key_centric_results = {}
    for field_name, _ in outcome_results[0].items():
        field_values = [result.get(field_name) for result in outcome_results]
        if field_values:
            key_centric_results[field_name] = field_values
    return pd.DataFrame(
        data=key_centric_results,
        index=dataframe_index,
    )

    return results_data
