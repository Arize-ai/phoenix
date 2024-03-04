from phoenix.evals import BedrockModel


def test_bedrock_model_can_be_instantiated():
    model = BedrockModel()
    assert model
