One of the regressed examples you just identified has metadata `example_key` "ex-014".
Locate the lower-scoring candidate experiment's run for that example, find that run's
trace, and identify the span in that trace that errored.

Answer schema:
{"span_name": "<name of the errored span>",
 "exception_message": "<the exception message recorded on that span>"}

End your reply with exactly one fenced ```json code block matching the schema above.
Do not include any other fenced json blocks in your reply.
