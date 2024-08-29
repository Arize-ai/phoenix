import asyncio

import boto3
import pytest

from phoenix.evals import BedrockModel


def test_bedrock_model_can_be_instantiated():
    session = boto3.Session(region_name="us-west-2")
    model = BedrockModel(session=session)
    assert model


def test_bedrock_async_propagates_errors():
    with pytest.raises(AttributeError, match="'NoneType' object has no attribute 'invoke_model'"):
        session = boto3.Session(region_name="us-west-2")
        client = session.client("bedrock-runtime")
        model = BedrockModel(session=session, client=client)
        model.client = None
        asyncio.run(model._async_generate("prompt"))
