Our refund bot has been live for a week. Its traces are in Phoenix under the `refund-bot` project, and the app code and our reply spec (`SPEC.md`) are in `/app`.

Can you set up evals for each requirement in the spec and run them over all the production traces? Log one annotation per requirement on each trace, named with the requirement's ID from the spec and labeled `pass` or `fail`, so we can filter for failures in Phoenix. Put the eval code under `/app/evals/` with an entry point our nightly job can run to score new traces: `python evals/refund_evals.py`. Any LLM-based eval has to use `gpt-5.4-nano`; it's the only model the nightly job's API key can call.

Then tell me which requirements fail most often.
