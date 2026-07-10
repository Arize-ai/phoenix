In dataset `qa-bot-golden`, find the example whose metadata `example_key` is "ex-014".
Locate the `candidate-v2` experiment run for that example, find that run's trace, and
identify the span in that trace that errored.

Answer schema:
{"span_name": "<name of the errored span>",
 "exception_message": "<the exception message recorded on that span>"}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
