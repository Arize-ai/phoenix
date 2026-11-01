---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill, Read]
runs: 3
tags: [phoenix-evals]
---
I'm building a web API with the Phoenix framework in Elixir. I want to write ExUnit tests that evaluate my controller's responses — checking the status code and the JSON body for a few endpoints. How should I structure these tests?
