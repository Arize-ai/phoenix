The support bot in `/app` has no tracing. Instrument it so that running
`python support_bot.py` sends traces to Phoenix at http://127.0.0.1:6006, in a project
named `support-bot-dev`. Each answer should be one trace that shows its model calls and
tool calls, and the traces from one conversation should share a session.

Don't change what the bot answers. `README.md` explains how to run the bot locally.
