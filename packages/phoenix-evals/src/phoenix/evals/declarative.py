import time
from phoenix.client.utils.template_formatters import MustacheBaseTemplateFormatter
from phoenix.evals.models import BaseModel

import inspect
import logging
import warnings
from collections import defaultdict
from enum import Enum
from functools import wraps
from itertools import product
from typing import (
    Any,
    Callable,
    DefaultDict,
    Dict,
    Iterable,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Tuple,
    TypeVar,
    Union,
)
import json
import pandas as pd
from pandas import DataFrame
from typing_extensions import TypeAlias

from phoenix.evals.evaluators import LLMEvaluator
from phoenix.evals.exceptions import PhoenixTemplateMappingError
from phoenix.evals.executors import ExecutionStatus, get_executor_on_sync_context
from phoenix.evals.models import OpenAIModel, set_verbosity
from phoenix.evals.templates import (
    ClassificationTemplate,
    MultimodalPrompt,
    PromptOptions,
    PromptPartTemplate,
    PromptPartContentType,
    PromptTemplate,
    normalize_classification_template,
)
from phoenix.evals.utils import (
    NOT_PARSABLE,
    get_tqdm_progress_bar_formatter,
    openai_function_call_kwargs,
    parse_openai_function_call,
    printif,
    snap_to_rail,
)
from pydantic import BaseModel, Field, create_model
from typing import Union, List, Any, Optional, Callable
import pandas as pd
from openai import OpenAI, AsyncOpenAI
from tqdm import tqdm
import asyncio
import aiohttp

async def declarative_eval(
    data: Union[pd.DataFrame, List[Any]],
    model: Union[OpenAI, AsyncOpenAI],
    schema: BaseModel,  # Pydantic model class
    field_mappings: Dict[str, str], # key is the openinference target field value, value is the path to the field in the schema
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    include_prompt: bool = False,
    include_response: bool = False,
    include_exceptions: bool = False,
    provide_explanation: bool = False,
    max_retries: int = 10,
    exit_on_error: bool = True,
    run_sync: bool = False,
    concurrency: Optional[int] = None,
    progress_bar_format: Optional[str] = get_tqdm_progress_bar_formatter("declarative_eval"),
) -> pd.DataFrame:
    """
    Evaluates data using an LLM with a Pydantic schema to structure the output.
    """

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
        """
    )

    labels: Iterable[Optional[str]] = [None] * len(data)
    explanations: Iterable[Optional[str]] = [None] * len(data)
    scores: Iterable[Optional[float]] = [None] * len(data)

    default_system_instruction = "You will be provided the input passed to the llm and the generated output data to evaluate according to the specified schema."

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
        new_field_mappings = {}
        for key, value in field_mappings.items():
            new_field_mappings[key] = f"schema.{value}"
        # Override the explanation field mapping
        new_field_mappings["explanation"] = "explanation"
        # Update the field mappings
        field_mappings = new_field_mappings

    print("field_mappings", field_mappings)

        
    def _map_template(data: pd.Series) -> str:
        output_str = formatter.format(template.template, variables={
                "input": json.dumps(data["attributes.llm.input_messages"]).replace("\\", "\\\\"),
                "output": json.dumps(data["attributes.llm.output_messages"]).replace("\\", "\\\\")
            }
        )
        return output_str

    async def _run_llm_eval_async() -> List[Tuple[pd.Series, Dict[str, Any], Optional[str]]]:
        if type(model) is OpenAI:
            raise ValueError("OpenAI is not supported for async operations")
        # Handle async request        
        async def _make_request(idx: int, row: pd.Series) -> Tuple[int, pd.Series, BaseModel, Optional[str], float]:
            try:
                start_time = time.time()
                response = await model.beta.chat.completions.parse(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {"role": "system", "content": system_instruction or default_system_instruction},
                        {"role": "user", "content": _map_template(row)}
                    ],
                    response_format=schema,
                )
                parsed_response = response.choices[0].message.parsed
                end_time = time.time()
                execution_seconds = end_time - start_time
                return idx, row, parsed_response, None, execution_seconds
            except Exception as e:
                return idx, row, None, str(e), 0
        
        # create tasks
        tasks = []
        for idx, (_, row) in enumerate(dataframe.iterrows()):
            tasks.append(_make_request(idx, row))

        results = [None] * len(tasks)
        with tqdm(total=len(tasks), desc="Running Declarative Evaluations") as pbar:
            for coro in asyncio.as_completed(tasks):
                idx, row, parsed_response, error, execution_seconds = await coro
                results[idx] = (row, parsed_response, error, execution_seconds)
                pbar.update(1)
        
        return results
    

    def _run_llm_eval_sync() -> List[Tuple[pd.Series, Dict[str, Any]]]:
        if type(model) is AsyncOpenAI:
            raise ValueError("AsyncOpenAI is not supported for sync operations")
        def _make_request(idx: int, row: pd.Series) -> Tuple[int, pd.Series, BaseModel, Optional[str], float]:
            try:
                start_time = time.time()
                response = model.beta.chat.completions.parse(
                    model="gpt-4o-2024-08-06",
                    messages=[
                        {"role": "system", "content": system_instruction or default_system_instruction},
                        {"role": "user", "content": _map_template(row)}
                    ],
                    response_format=schema,
                )
                parsed_response = response.choices[0].message.parsed
                end_time = time.time()
                execution_seconds = end_time - start_time
                return idx, row, parsed_response, None, execution_seconds
            except Exception as e:
                return idx, row, None, str(e), 0
        results = [None] * len(dataframe)
        for idx, (_, row) in enumerate(dataframe.iterrows()):
            idx, row, parsed_response, error, execution_seconds = _make_request(idx, row)
            results[idx] = (row, parsed_response, error, execution_seconds)
        return results
    
    def _get_nested_value(obj: Dict[str, Any], path: str) -> Any:
        parts = path.split('.')
        current = obj
        for part in parts:
            if part in current:
                current = current[part]
            else:
                return None
        return current
    
    def _extract_data_using_field_mappings(result: Tuple[pd.Series, BaseModel, Optional[str], float]) -> Dict[str, Any]:
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
    
    def _parse_results(results: List[Tuple[pd.Series, BaseModel, Optional[str], float]]) -> List[Tuple[pd.Series, Dict[str, Any]]]:
        results_data = []
        for result in results:
            results_data.append((result[0], _extract_data_using_field_mappings(result)))
        return results_data
    
    
    
    results = await _run_llm_eval_async()
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
