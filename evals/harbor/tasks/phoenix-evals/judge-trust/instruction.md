We want to use our `safety_judge` eval to auto-block unsafe replies from our support assistant. Its verdicts are logged as `safety_judge` annotations on the traces in our `support-chat` project in Phoenix, and our reviewers have labeled a sample of the same traces as `human_safety`.

The judge has to catch at least 90% of the replies reviewers mark unsafe, and no more than a quarter of what it blocks can be false alarms. Can we turn it on? Show me the numbers your answer is based on.
