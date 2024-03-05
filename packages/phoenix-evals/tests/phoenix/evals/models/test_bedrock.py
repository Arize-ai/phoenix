import boto3
from phoenix.evals import BedrockModel


def test_bedrock_model_can_be_instantiated():
    session = boto3.Session(region_name="us-west-2")
    model = BedrockModel(session=session)
    assert model
