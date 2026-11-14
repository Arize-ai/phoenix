Our nightly grounding eval (`/app/evals/nightly_grounding.py`) says about 95% of our support bot's replies are grounded, but our reviewers keep finding replies that make things up. The bot's traces are in Phoenix under the `support-bot` project.

Can you figure out why the eval's numbers are misleading, fix it, and rerun it so the `grounded` annotations (`pass` or `fail`) on the `support-bot` traces are right? Keep the script path and the annotation name; our nightly job runs `python evals/nightly_grounding.py` from `/app`.

Then tell me what was wrong and what the real grounded rate is.
