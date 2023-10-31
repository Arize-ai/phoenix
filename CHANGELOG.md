# Changelog

## [0.1.0](https://github.com/Arize-ai/phoenix/compare/v0.0.50...v0.1.0) (2023-10-31)


### Features

* **evals:** in `llm_classify`, use function calling to constrain LLM outputs when available; `llm_classify` now returns a dataframe ([#1651](https://github.com/Arize-ai/phoenix/issues/1651)) ([b796cb4](https://github.com/Arize-ai/phoenix/commit/b796cb4057846574d0cd7a3e3c078b7f6ef5ee91))


### Bug Fixes

* LlamaIndex callback handler drops events if the `start_event` handler is not called ([#1668](https://github.com/Arize-ai/phoenix/issues/1668)) ([428053f](https://github.com/Arize-ai/phoenix/commit/428053fcefdd9b5502b3fc38ac0235a0e938c8a1))
* **traces:** refetch traces and spans even when searching ([#1683](https://github.com/Arize-ai/phoenix/issues/1683)) ([8d95b6d](https://github.com/Arize-ai/phoenix/commit/8d95b6dc1cebdb88bbc657afdd95dbd3385105ae))
