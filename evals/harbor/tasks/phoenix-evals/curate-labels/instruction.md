Our reviewers have been checking support-bot replies in Phoenix, and their verdicts are the `review` annotations on the `support-bot-reviews` project.

Can you turn them into a dataset called `grounding-golden` that we can use to test our grounding judge? Each trace you keep becomes one example, with the customer's question and the bot's reply as input, the verdict (`supported` or `unsupported`) as the expected output, and a link back to its source span. Go by each trace's most recent human review, and skip traces where that review is still `needs_review` and traces that only have the auto-labeler's pre-label.

Tell me how many examples you included and what you left out.
