"""
Test Declarative Eval
"""

from typing import Dict, Literal
from unittest.mock import AsyncMock, MagicMock

import pandas as pd
import pytest
from pydantic import BaseModel, Field

from phoenix.evals import declarative_eval, transform_field_mappings_for_explanation


class Conciseness(BaseModel):
    is_concise: bool = Field(..., description="Whether the output is concise")


class Formatting(BaseModel):
    language: Literal["High", "Average", "Low"] = Field(
        ..., description="The complexity of the formatting used in the output"
    )


class Schema(BaseModel):
    conciseness: Conciseness = Field(..., description="A custom evaluation of the output")
    formatting: Formatting = Field(..., description="A custom evaluation of the output")


class SchemaWithExplanation(BaseModel):
    schema: Schema = Field(..., description="The schema to evaluate")
    explanation: str = Field(..., description="An explanation of the evaluation")


@pytest.fixture
def sample_dataframe() -> pd.DataFrame:
    """Sample dataframe to simulate ArizeExportClient(...).export_model_to_df(...)"""
    return pd.DataFrame(
        {
            "attributes.llm.input_messages": [
                [{"role": "user", "content": "What is 2+2?"}],
                [{"role": "user", "content": "Who was the first president?"}],
            ],
            "attributes.llm.output_messages": [
                [{"role": "assistant", "content": "4"}],
                [{"role": "assistant", "content": "George Washington"}],
            ],
        }
    )


@pytest.fixture
def correct_field_mappings() -> Dict[str, str]:
    """Accurate field mappings for the Schema"""
    return {
        "conciseness.label": "conciseness.is_concise",
        "formatting.label": "formatting.language",
    }


@pytest.fixture
def incorrect_field_mappings() -> Dict[str, str]:
    """Incorrect field mappings for the Schema"""
    return {
        "conciseness.label": "not_conciseness.is_concise",
        "formatting.label": "formatting.not_language",
    }


@pytest.fixture
def mock_parse_responses():
    """Mock responses for two consecutive OpenAI parse API calls."""
    responses = []
    for _ in range(2):
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message = MagicMock()
        mock_resp.choices[0].message.parsed = Schema(
            conciseness=Conciseness(is_concise=True), formatting=Formatting(language="High")
        )
        responses.append(mock_resp)
    return responses


@pytest.fixture
def mock_client(mock_parse_responses):
    """Mock OpenAI client with predefined responses."""
    mock_client = MagicMock()
    mock_client.beta = MagicMock()
    mock_client.beta.chat = MagicMock()
    mock_client.beta.chat.completions = MagicMock()

    # Set up the async mock to return different responses for each call
    mock_parse = AsyncMock()
    # Use side_effect to return a different response for each call
    mock_parse.side_effect = mock_parse_responses
    mock_client.beta.chat.completions.parse = mock_parse

    return mock_client


@pytest.fixture
def mock_parse_responses_with_explanation():
    """Mock responses for two consecutive OpenAI parse API calls."""
    responses = []
    for _ in range(2):
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message = MagicMock()
        mock_resp.choices[0].message.parsed = SchemaWithExplanation(
            schema=Schema(
                conciseness=Conciseness(is_concise=True), formatting=Formatting(language="High")
            ),
            explanation="Explanation",
        )
        responses.append(mock_resp)
    return responses


@pytest.fixture
def mock_client_with_explanation(mock_parse_responses_with_explanation):
    """Mock OpenAI client with predefined responses."""
    mock_client = MagicMock()
    mock_client.beta = MagicMock()
    mock_client.beta.chat = MagicMock()
    mock_client.beta.chat.completions = MagicMock()

    # Set up the async mock to return different responses for each call
    mock_parse = AsyncMock()
    # Use side_effect to return a different response for each call
    mock_parse.side_effect = mock_parse_responses_with_explanation
    mock_client.beta.chat.completions.parse = mock_parse

    return mock_client


@pytest.mark.asyncio
async def test_declarative_eval_correct_field_mappings(
    sample_dataframe, correct_field_mappings, mock_client
):
    """Test declarative_eval with correct field mappings."""
    result = await declarative_eval(
        data=sample_dataframe,
        model=mock_client,
        schema=Schema,
        field_mappings=correct_field_mappings,
    )
    fm_keys = set(correct_field_mappings.keys())
    assert isinstance(result, pd.DataFrame)
    assert result.shape[0] == 2
    assert fm_keys.issubset(set(result.columns.tolist()))
    assert result["conciseness.label"].tolist() == [True, True]
    assert result["formatting.label"].tolist() == ["High", "High"]


@pytest.mark.asyncio
async def test_declarative_eval_incorrect_field_mappings(
    sample_dataframe, incorrect_field_mappings, mock_client
):
    """Test declarative_eval with correct field mappings."""
    result = await declarative_eval(
        data=sample_dataframe,
        model=mock_client,
        schema=Schema,
        field_mappings=incorrect_field_mappings,
    )
    fm_keys = set(incorrect_field_mappings.keys())
    assert isinstance(result, pd.DataFrame)
    assert result.shape[0] == 2
    assert fm_keys.issubset(set(result.columns.tolist()))
    for fm_key in fm_keys:
        assert result[fm_key].tolist() == [None, None]


@pytest.mark.asyncio
async def test_declarative_eval_with_explanation(
    sample_dataframe, correct_field_mappings, mock_client_with_explanation
):
    """Test declarative_eval with explanations."""
    result = await declarative_eval(
        data=sample_dataframe,
        model=mock_client_with_explanation,
        schema=SchemaWithExplanation,
        field_mappings=correct_field_mappings,
        provide_explanation=True,
    )

    pre_transform_fm = correct_field_mappings
    pre_transform_fm_values = set(pre_transform_fm.values())

    print(f"pre_transform_fm: {pre_transform_fm}")
    correct_field_mappings = transform_field_mappings_for_explanation(correct_field_mappings)
    print(f"correct_field_mappings: {correct_field_mappings}")
    fm_keys = set(correct_field_mappings.keys())
    fm_values = set(correct_field_mappings.values())

    assert isinstance(result, pd.DataFrame)
    assert result.shape[0] == 2
    assert fm_keys.issubset(set(result.columns.tolist()))
    assert pre_transform_fm_values.isdisjoint(fm_values)
    assert result["conciseness.label"].tolist() == [True, True]
    assert result["formatting.label"].tolist() == ["High", "High"]
    assert result["explanation"].tolist() == ["Explanation", "Explanation"]
