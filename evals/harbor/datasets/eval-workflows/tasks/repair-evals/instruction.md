Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.

Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations on those traces are right? Keep the judge on `gpt-5-nano`, and keep it runnable as `python evals/nightly_grounding.py` from `/app`, since that's how our nightly job runs it.

Then tell me what was wrong and what the real grounded rate is.
