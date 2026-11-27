Our reviewers have been checking support-bot replies by hand and recording their verdicts as `review` annotations on the `support-bot-reviews` project in Phoenix.

Can you turn them into a dataset called `grounding-golden` that we can use to test our grounding judge? Each trace you keep becomes one example, with the customer's question and the bot's reply as input, the verdict (`supported` or `unsupported`) as the expected output, and a link back to its source span. Go by our reviewers' latest verdict on each trace, and leave out any trace they haven't settled.

Tell me how many examples you included and what you left out.
