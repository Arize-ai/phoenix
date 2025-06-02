# How do I resolve Phoenix Evals showing NOT\_PARSABLE?

`NOT_PARSABLE` errors often occur when LLM responses exceed the `max_tokens` limit or produce incomplete JSON. Here's how to fix it:

1.  Increase `max_tokens`: Update the model configuration as follows:

    ```python
    pythonCopy codellm_judge_model = OpenAIModel(
        api_key=getpass("Enter your OpenAI API key..."),
        model="gpt-4o-2024-08-06",
        temperature=0.2,
        max_tokens=1000,  # Increase token limit
    )
    ```
2. Update Phoenix: Use version ≥0.17.4, which removes token limits for OpenAI and increases defaults for other APIs.
3. Check Logs: Look for `finish_reason="length"` to confirm token limits caused the issue.
4. If the above doesn't work, it's possible the llm-as-a-judge output might not fit into the defined rails for that particular custom Phoenix eval. Double check the prompt output matches the rail expectations.
