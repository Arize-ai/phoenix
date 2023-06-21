evaluation_prompt_template = """You will be given a query and a reference text. You must determine whether the reference text contains an answer to the input query. Your response must be binary (0 or 1) and should not contain any text or characters aside from 0 or 1. 0 means that the reference text does not contain an answer to the query. 1 means the reference text contains an answer to the query.

# Query: {query}

# Reference: {reference}

# Binary: """


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def complete_batch_of_prompts(prompts: List[str], model_name: str) -> List[str]:
    """
    Completes a list of prompts using the OpenAI completion API and the
    specified model. As of June 2023, OpenAI supports a maximum of 20 prompts
    per completion request. This function is wrapped in a retry decorator in
    order to avoid rate-limiting. Retry settings were copied from
    https://github.com/openai/openai-cookbook/blob/main/examples/How_to_handle_rate_limits.ipynb.
    """
    response = openai.Completion.create(
        model=model_name,
        prompt=prompts,
    )
    return [choice["text"] for choice in response["choices"]]


def complete_prompts(
    prompts: List[str],
    model_name: str,
    batch_size: int = 20,  # the max number of prompts per completion request as of June 2023
) -> List[str]:
    """
    Completes a list of prompts using the OpenAI completion API. The list may be
    of arbitrary length and will be batched using the batch_size parameter.
    """
    completions = []
    progress_bar = tqdm(total=len(prompts))
    for batch_of_prompts in (
        prompts[index : index + batch_size] for index in range(0, len(prompts), batch_size)
    ):
        completions.extend(complete_batch_of_prompts(batch_of_prompts, model_name))
        num_prompts_in_batch = len(batch_of_prompts)
        progress_bar.update(num_prompts_in_batch)
    return completions


def process_completions(
    raw_completions: List[str], binary_to_string_map: Dict[int, str]
) -> List[str]:
    """
    Parses the raw completions returned by the OpenAI completion API and
    converts them to the desired format. The binary_to_string_map parameter
    should be a dictionary mapping binary values (0 or 1) to the desired
    string values (e.g. "irrelevant" or "relevant").
    """
    processed_completions = []
    for raw_completion in raw_completions:
        try:
            binary_value = int(raw_completion.strip())
            processed_completion = binary_to_string_map[binary_value]
        except (ValueError, KeyError):
            processed_completion = None
        processed_completions.append(processed_completion)
    return processed_completions
