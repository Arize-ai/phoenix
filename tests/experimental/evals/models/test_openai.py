from phoenix.experimental.evals.models.openai import OpenAIModel


def test_openai_model():
    """
    Sanity check of the initialization of OpenAI wrapper
    """
    model = OpenAIModel("gpt-4-")
    assert model.model_name == "gpt2"
    assert model.model_type == "openai"
    assert model.model is not None
    assert model.tokenizer is not None
    assert model.device == "cpu"
    assert model.max_length == 20
    assert model.min_length == 1
    assert model.do_sample == True
    assert model.top_k == 50
    assert model.top_p == 0.95
    assert model.temperature == 1.0
    assert model.repetition_penalty == 1.0
    assert model.length_penalty == 1.0
    assert model.num_beams == 1
    assert model.num_return_sequences == 1
    assert model.early_stopping == True
    assert model.no_repeat_ngram_size == 0
    assert model.num_beam_groups == 1
    assert model.diversity_penalty == 0.0
    assert model.prefix_allowed_tokens_fn == None
    assert model.output_scores == False
    assert model.output_attentions == False
    assert model.output_hidden_states == False
    assert model.output_past == True
    assert model.use_cache == True
    assert model.return_dict_in_generate == False
    assert model.return_dict == True
    assert model.return_dict_in_generate == False
    assert model.return_dict_in_generate == False
    assert model.return_dict_in_generate == False
