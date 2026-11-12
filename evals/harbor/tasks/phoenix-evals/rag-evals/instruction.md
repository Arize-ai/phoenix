Customers keep complaining about wrong answers from our policy assistant. Its traces are in Phoenix under the `policy-rag` project, and the app code is in `/app`.

Can you set up evals that tell us whether the retriever pulled the right policy and whether the answer stuck to what was retrieved? Log a `relevant` annotation on each retrieved document and a `grounded` annotation on each answer, labeled `pass` or `fail`, so we can filter for them in Phoenix. Put the eval code in `/app/evals/` so our nightly job can run `python evals/rag_evals.py` to score new traffic. Any LLM-based eval has to use `gpt-5.4-nano`; it's the only model the nightly job's API key can call.

Then tell me whether retrieval or generation is the bigger problem right now.
