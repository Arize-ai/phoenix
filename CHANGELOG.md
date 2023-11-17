# Changelog

## [1.2.0](https://github.com/Arize-ai/phoenix/compare/v1.1.1...v1.2.0) (2023-11-17)


### Features

* Add dockerfile ([#1761](https://github.com/Arize-ai/phoenix/issues/1761)) ([4fa8929](https://github.com/Arize-ai/phoenix/commit/4fa8929f4103e9961a8df0eb059b8df149ed648f))
* **evals:** return partial results when llm function is interrupted ([#1755](https://github.com/Arize-ai/phoenix/issues/1755)) ([1fb0849](https://github.com/Arize-ai/phoenix/commit/1fb0849a4e5f39c6afc90a1417300747a0bf4bf6))
* LiteLLM model support for evals ([#1675](https://github.com/Arize-ai/phoenix/issues/1675)) ([5f2a999](https://github.com/Arize-ai/phoenix/commit/5f2a9991059e060423853567a20789eba832f65a))
* sagemaker nobebook support ([#1772](https://github.com/Arize-ai/phoenix/issues/1772)) ([2c0ffbc](https://github.com/Arize-ai/phoenix/commit/2c0ffbc1479ae0255b72bc2d31d5f3204fd8e32c))


### Bug Fixes

* unpin llama-index version in tutorial notebooks ([#1766](https://github.com/Arize-ai/phoenix/issues/1766)) ([5ff74e3](https://github.com/Arize-ai/phoenix/commit/5ff74e3895f1b0c5642bd0897dd65e6f2913a7bd))


### Documentation

* add instructions for docker build ([#1770](https://github.com/Arize-ai/phoenix/issues/1770)) ([45eb5f2](https://github.com/Arize-ai/phoenix/commit/45eb5f244997d0ff0e991879c297b564e46c9a18))

## [1.1.1](https://github.com/Arize-ai/phoenix/compare/v1.1.0...v1.1.1) (2023-11-16)


### Bug Fixes

* update tracer for llama-index 0.9.0 ([#1750](https://github.com/Arize-ai/phoenix/issues/1750)) ([48d0996](https://github.com/Arize-ai/phoenix/commit/48d09960855d59419edfd10925aaa895fd370a0d))

## [1.1.0](https://github.com/Arize-ai/phoenix/compare/v1.0.0...v1.1.0) (2023-11-14)


### Features

* Evals with explanations ([#1699](https://github.com/Arize-ai/phoenix/issues/1699)) ([2db8141](https://github.com/Arize-ai/phoenix/commit/2db814102ea27f441e201740cc75ace79c82837c))
* **evals:** add an output_parser to llm_generate ([#1736](https://github.com/Arize-ai/phoenix/issues/1736)) ([6408dda](https://github.com/Arize-ai/phoenix/commit/6408dda7d33bfe84d929ddaacd01cb3269e0f63a))


### Documentation

* **evals:** document llm_generate with output parser ([#1741](https://github.com/Arize-ai/phoenix/issues/1741)) ([1e70ec3](https://github.com/Arize-ai/phoenix/commit/1e70ec3ff6158ffada40726419ae436ba6c7948d))

## [1.0.0](https://github.com/Arize-ai/phoenix/compare/v0.1.1...v1.0.0) (2023-11-10)


### ⚠ BREAKING CHANGES

* **models:** openAI 1.0 ([#1716](https://github.com/Arize-ai/phoenix/issues/1716))

### Features

* **models:** openAI 1.0 ([#1716](https://github.com/Arize-ai/phoenix/issues/1716)) ([2564521](https://github.com/Arize-ai/phoenix/commit/2564521e1ce00aaabaf592ce3735a656e1c6f1b8))

## [0.1.1](https://github.com/Arize-ai/phoenix/compare/v0.1.0...v0.1.1) (2023-11-09)


### Bug Fixes

* **traces:** handle `AIMessageChunk` in langchain tracer by matching prefix in name ([#1724](https://github.com/Arize-ai/phoenix/issues/1724)) ([8654c0a](https://github.com/Arize-ai/phoenix/commit/8654c0a0c9e088284b4ed0bbbae4f571ae11b1e7))

## [0.1.0](https://github.com/Arize-ai/phoenix/compare/v0.0.51...v0.1.0) (2023-11-08)


### Features

* add long-context evaluators, including map reduce and refine patterns ([#1710](https://github.com/Arize-ai/phoenix/issues/1710)) ([0c3b105](https://github.com/Arize-ai/phoenix/commit/0c3b1053f95b88e234ed3ccfffa50b27f48dc359))
* **traces:** span table column visibility controls ([#1687](https://github.com/Arize-ai/phoenix/issues/1687)) ([559852f](https://github.com/Arize-ai/phoenix/commit/559852f12d976df691c24f3e89bf23a7650d148c))


### Bug Fixes

* add bedrock import ([#1695](https://github.com/Arize-ai/phoenix/issues/1695)) ([dc7f3ef](https://github.com/Arize-ai/phoenix/commit/dc7f3ef6fa7c184e46ef92f1c035a29345e0b12e))
* pin openai version below 1.0.0 ([#1714](https://github.com/Arize-ai/phoenix/issues/1714)) ([d21e364](https://github.com/Arize-ai/phoenix/commit/d21e36459a42f01d04a373236fef2e603eea159d))
* **traces:** Keep traces visible behind the details slideover ([#1709](https://github.com/Arize-ai/phoenix/issues/1709)) ([1c8b8f1](https://github.com/Arize-ai/phoenix/commit/1c8b8f175e0cc8506490a8e0e36ad92d7e7ff69a))


### Documentation

* pin tutorials to openai&lt;1 ([#1718](https://github.com/Arize-ai/phoenix/issues/1718)) ([831c041](https://github.com/Arize-ai/phoenix/commit/831c041185e5f514fa1a13836758efecbf05e1dd))
