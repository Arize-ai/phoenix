# Changelog

## [0.17.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.1...arize-phoenix-evals-v0.17.2) (2024-10-18)


### Bug Fixes

* allow progress bar to be disabled ([#5064](https://github.com/Arize-ai/phoenix/issues/5064)) ([07d9856](https://github.com/Arize-ai/phoenix/commit/07d985672de77ed5f90a8195cbac24554c951ac4))

## [0.17.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.0...arize-phoenix-evals-v0.17.1) (2024-10-17)


### Bug Fixes

* increase python upper bound to include python 3.13 for `arize-phoenix-evals` and `arize-phoenix-otel` ([#5077](https://github.com/Arize-ai/phoenix/issues/5077)) ([ef5c893](https://github.com/Arize-ai/phoenix/commit/ef5c893ef7bc81690662a7687ed190f5b6dca701))

## [0.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.16.1...arize-phoenix-evals-v0.17.0) (2024-10-09)


### Features

* Always prompt as system for OpenAI Models ([#4937](https://github.com/Arize-ai/phoenix/issues/4937)) ([5f28ef2](https://github.com/Arize-ai/phoenix/commit/5f28ef244db2c4dd59fad6c6d6f1b63ff235817b))

## [0.16.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.16.0...arize-phoenix-evals-v0.16.1) (2024-09-27)


### Bug Fixes

* Use python string formatting for standard template delimiters ([#4781](https://github.com/Arize-ai/phoenix/issues/4781)) ([26b422f](https://github.com/Arize-ai/phoenix/commit/26b422f70dd5e7b295f79a30a82dab1cc1ed9173))

## [0.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.15.1...arize-phoenix-evals-v0.16.0) (2024-09-17)


### Features

* OpenAI support for o1 preview ([#4633](https://github.com/Arize-ai/phoenix/issues/4633)) ([1ad7b79](https://github.com/Arize-ai/phoenix/commit/1ad7b79d95bd362ca15f34f2cebe7e1332a19846))


### Bug Fixes

* Ensure correct dataloader results ordering ([#4524](https://github.com/Arize-ai/phoenix/issues/4524)) ([f9239d6](https://github.com/Arize-ai/phoenix/commit/f9239d63af9d06c04430f9dca808caf08d152d3d))

## [0.15.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.15.0...arize-phoenix-evals-v0.15.1) (2024-08-27)


### Bug Fixes

* support pydantic in the range 2.4.1&lt;=pydantic<=2.7.1 ([#4323](https://github.com/Arize-ai/phoenix/issues/4323)) ([fa5eeff](https://github.com/Arize-ai/phoenix/commit/fa5eeff45b0752508d4bc51334607ef4acc19474))

## [0.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.14.1...arize-phoenix-evals-v0.15.0) (2024-08-15)


### Features

* Expose configuration for initial rate limit ([#4087](https://github.com/Arize-ai/phoenix/issues/4087)) ([194a66d](https://github.com/Arize-ai/phoenix/commit/194a66d6315ffd93275e1a8e19560a435701ddc8))


### Bug Fixes

* use dataloader for span annotations ([#4139](https://github.com/Arize-ai/phoenix/issues/4139)) ([2456ad4](https://github.com/Arize-ai/phoenix/commit/2456ad47c6cb73901152bec5b4bfed8c77c96933))


### Documentation

* api ref updates and docstring fixes ([e089f99](https://github.com/Arize-ai/phoenix/commit/e089f99fa2e63cdf9cb342bc3810361947c28e61))
* Fix docstring ([#3969](https://github.com/Arize-ai/phoenix/issues/3969)) ([f6a5b62](https://github.com/Arize-ai/phoenix/commit/f6a5b62a1f53ba34d22c678e7bbb314693641993))
* Update LiteLLM and OpenAI docstrings ([#3910](https://github.com/Arize-ai/phoenix/issues/3910)) ([be57127](https://github.com/Arize-ai/phoenix/commit/be5712761a1eb59c73ca38bc207f9e6078bf60f6))

## [0.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.14.0...arize-phoenix-evals-v0.14.1) (2024-07-16)


### Bug Fixes

* Run Bedrock calls in executor for async ([#3884](https://github.com/Arize-ai/phoenix/issues/3884)) ([46e3b1c](https://github.com/Arize-ai/phoenix/commit/46e3b1c7c705e6fd6df7cdcc10f1ec0f14efb03c))

## [0.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.2...arize-phoenix-evals-v0.14.0) (2024-07-12)

### Features

* Add function call evaluator template to span_templates.py & tutorial notebook

### Bug Fixes

* ensure experiment errors messages work on python 3.8 and 3.9 ([#3840](https://github.com/Arize-ai/phoenix/issues/3840)) ([25a7fb9](https://github.com/Arize-ai/phoenix/commit/25a7fb93fe7512a0ac2da9a59915c9e145c58ae2))


### Documentation

* Update model wrapper docstrings ([#3834](https://github.com/Arize-ai/phoenix/issues/3834)) ([531360b](https://github.com/Arize-ai/phoenix/commit/531360b4f1a7180c892504ffbc567d78503283f2))

## [0.13.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.1...arize-phoenix-evals-v0.13.2) (2024-07-03)


### Bug Fixes

* allow invocations of OpenAIModel without api key ([#3820](https://github.com/Arize-ai/phoenix/issues/3820)) ([4dd8c0e](https://github.com/Arize-ai/phoenix/commit/4dd8c0e15308971fe42c5fd11f04f80b18c55746))

## [0.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.0...arize-phoenix-evals-v0.13.1) (2024-06-30)


### Bug Fixes

* llm_classify from warning message ([#3752](https://github.com/Arize-ai/phoenix/issues/3752)) ([717a0c7](https://github.com/Arize-ai/phoenix/commit/717a0c786b1aa78000d6bc3e47f369bbba7662a3))

## [0.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.12.0...arize-phoenix-evals-v0.13.0) (2024-06-26)


### Features

* added SQLEvaluator ([#3577](https://github.com/Arize-ai/phoenix/issues/3577)) ([0a79535](https://github.com/Arize-ai/phoenix/commit/0a79535f20426072c8ffa60960b605a8dbb95a18))


### Bug Fixes

* add support for querying datetimes ([#3439](https://github.com/Arize-ai/phoenix/issues/3439)) ([90fd619](https://github.com/Arize-ai/phoenix/commit/90fd61927d11a0eaf151ca41b81f149b9fc8214f))
* resolves the authentication issue for GeminiModel in evals model ([#3662](https://github.com/Arize-ai/phoenix/issues/3662)) ([b79d946](https://github.com/Arize-ai/phoenix/commit/b79d946cebd7447bcda7edbdf23603a2ceef5f03))

## [0.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.11.0...arize-phoenix-evals-v0.12.0) (2024-06-06)


### Features

* add span-level templates for evaluation hallucinations and qa correctness ([#3380](https://github.com/Arize-ai/phoenix/issues/3380)) ([1689b49](https://github.com/Arize-ai/phoenix/commit/1689b49cfa3ea99d39bd98873580e5253101a0c7))
* Adds timing info to llm_classify ([#3377](https://github.com/Arize-ai/phoenix/issues/3377)) ([3e2785f](https://github.com/Arize-ai/phoenix/commit/3e2785f7d53dd628e7027fe988ae066fa1be0da1))

## [0.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.10.0...arize-phoenix-evals-v0.11.0) (2024-05-31)


### Features

* Allow skipping on template mapping errors, returning debug info ([#3350](https://github.com/Arize-ai/phoenix/issues/3350)) ([dc18123](https://github.com/Arize-ai/phoenix/commit/dc1812379c33fbb89537c6aed6361f808f29ec73))
* Serializable execution details ([#3358](https://github.com/Arize-ai/phoenix/issues/3358)) ([fc74513](https://github.com/Arize-ai/phoenix/commit/fc7451372c9b938a27c7b36f7e32704f7b3a8e87))

## [0.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.2...arize-phoenix-evals-v0.10.0) (2024-05-29)


### Features

* docker image runs as root by default with tags for nonroot and debug images ([#3280](https://github.com/Arize-ai/phoenix/issues/3280)) ([41a4826](https://github.com/Arize-ai/phoenix/commit/41a4826733e104a3ec533a73049df5b778391e7f))
* Support mistral ([#3270](https://github.com/Arize-ai/phoenix/issues/3270)) ([4e38531](https://github.com/Arize-ai/phoenix/commit/4e3853159881fa936d04beff5feb971df72ad038))

## [0.9.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.1...arize-phoenix-evals-v0.9.2) (2024-05-21)


### Bug Fixes

* Bypass signal handler if running in a thread ([#3251](https://github.com/Arize-ai/phoenix/issues/3251)) ([8c82306](https://github.com/Arize-ai/phoenix/commit/8c8230606d173a55a2f84b2fbdbb48e920cbdb70))

## [0.9.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.0...arize-phoenix-evals-v0.9.1) (2024-05-21)


### Bug Fixes

* clarify error message for missing azure api-key ([#3256](https://github.com/Arize-ai/phoenix/issues/3256)) ([58a1398](https://github.com/Arize-ai/phoenix/commit/58a1398b4f1fcc64af7fdb06463f9a0fc0f53b76))

## [0.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.2...arize-phoenix-evals-v0.9.0) (2024-05-17)


### Features

* Added support for default_headers for azure_openai. ([#3211](https://github.com/Arize-ai/phoenix/issues/3211)) ([2d48192](https://github.com/Arize-ai/phoenix/commit/2d48192d57a1b97e4b08efc30f5c689423667c93))

## [0.8.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.1...arize-phoenix-evals-v0.8.2) (2024-05-14)


### Bug Fixes

* evaluators no longer have incorrect type hints ([#3195](https://github.com/Arize-ai/phoenix/issues/3195)) ([7d57e2e](https://github.com/Arize-ai/phoenix/commit/7d57e2e760a98095c57b45b3e39e2d009972faaf))

## [0.8.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.0...arize-phoenix-evals-v0.8.1) (2024-05-03)


### Bug Fixes

* **evals:** incorrect wording in hallucinations ([#3085](https://github.com/Arize-ai/phoenix/issues/3085)) ([7aa0292](https://github.com/Arize-ai/phoenix/commit/7aa029239c2c36b677070e270f7127f6bf6cff5e))

## [0.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.7.0...arize-phoenix-evals-v0.8.0) (2024-04-22)


### Features

* Add user frustration eval ([#2928](https://github.com/Arize-ai/phoenix/issues/2928)) ([406938b](https://github.com/Arize-ai/phoenix/commit/406938b1f19ee6efb7cec630772d9d8940c0953f))

## [0.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.6.1...arize-phoenix-evals-v0.7.0) (2024-04-12)


### Features

* Add SQL and Code Functionality Eval Templates ([#2861](https://github.com/Arize-ai/phoenix/issues/2861)) ([c7d776a](https://github.com/Arize-ai/phoenix/commit/c7d776a23e1843cc1bb5c74059496615700a3396))

## [0.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.6.0...arize-phoenix-evals-v0.6.1) (2024-04-04)


### Bug Fixes

* switch license format  in toml ([5c6f345](https://github.com/Arize-ai/phoenix/commit/5c6f345691dcab3d460823329ce31b9060bab02c))

## [0.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.5.0...arize-phoenix-evals-v0.6.0) (2024-03-29)


### Features

* update bedrock.py to use messages API for claude ([#2636](https://github.com/Arize-ai/phoenix/issues/2636)) ([3d7d91a](https://github.com/Arize-ai/phoenix/commit/3d7d91ac6f399ceb40771461cd1fc7bfe60ff04f))

## [0.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.4.0...arize-phoenix-evals-v0.5.0) (2024-03-20)


### Features

* Add `response_format` argument to `MistralAIModel` ([#2660](https://github.com/Arize-ai/phoenix/issues/2660)) ([7da51af](https://github.com/Arize-ai/phoenix/commit/7da51afc77984925cd59d7d909142141530684cc))

## [0.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.3.1...arize-phoenix-evals-v0.4.0) (2024-03-20)


### Features

* **evals:** Add Mistral as an eval model ([#2640](https://github.com/Arize-ai/phoenix/issues/2640)) ([c13ab6b](https://github.com/Arize-ai/phoenix/commit/c13ab6bf644ec285c37e92cc6a7b114a309cec52))

## [0.3.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.3.0...arize-phoenix-evals-v0.3.1) (2024-03-15)


### Bug Fixes

* pass verbose to evaluators ([#2597](https://github.com/Arize-ai/phoenix/issues/2597)) ([9467e1d](https://github.com/Arize-ai/phoenix/commit/9467e1deabe58c0079ad8bdb9dfc972ee2ae5c0b))

## [0.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.2.0...arize-phoenix-evals-v0.3.0) (2024-03-13)


### Features

* add phoenix-evals support for python 3.12 ([#2554](https://github.com/Arize-ai/phoenix/issues/2554)) ([efb6a76](https://github.com/Arize-ai/phoenix/commit/efb6a764a2aaecfff271b2cd7b7569771989a6a1))

## [0.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.1.0...arize-phoenix-evals-v0.2.0) (2024-03-07)


### Features

* Update `AnthropicModel` to use `messages` API ([#2489](https://github.com/Arize-ai/phoenix/issues/2489)) ([5aa3842](https://github.com/Arize-ai/phoenix/commit/5aa3842d3e3d8a1fe21fb62c594032474899fb81))


### Bug Fixes

* `llm_generate` now preserves input index when constructing the output ([#2441](https://github.com/Arize-ai/phoenix/issues/2441)) ([ee36987](https://github.com/Arize-ai/phoenix/commit/ee369874649ac36fadcce3322cf87cf22d04aed4))

## [0.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.5...arize-phoenix-evals-v0.1.0) (2024-03-05)


### Features

* Removes token processing module from `phoenix.evals` ([#2421](https://github.com/Arize-ai/phoenix/issues/2421)) ([fbd4961](https://github.com/Arize-ai/phoenix/commit/fbd496163d6cf46b3299da4ac7962b19da054bd8))


### Bug Fixes

* Properly define `BedrockModel` ([#2425](https://github.com/Arize-ai/phoenix/issues/2425)) ([81a720c](https://github.com/Arize-ai/phoenix/commit/81a720c8264f80fc37fcfe76c1c982014e9f12b3))
* source distribution build ([#2407](https://github.com/Arize-ai/phoenix/issues/2407)) ([1e67d7e](https://github.com/Arize-ai/phoenix/commit/1e67d7e4eb037f85b1e33e59b42014fe3daa876d))

## [0.0.5](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.4...arize-phoenix-evals-v0.0.5) (2024-02-24)


### Bug Fixes

* **evals:** reference link template export ([#2393](https://github.com/Arize-ai/phoenix/issues/2393)) ([d9e21b7](https://github.com/Arize-ai/phoenix/commit/d9e21b7cb6f4c9cc9c863623696f3987f96dd174))

## [0.0.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.3...arize-phoenix-evals-v0.0.4) (2024-02-24)


### Bug Fixes

* export reference link templates ([#2390](https://github.com/Arize-ai/phoenix/issues/2390)) ([d5e4121](https://github.com/Arize-ai/phoenix/commit/d5e41213e897bfb64e121a72b85c614b29e1358c))

## [0.0.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.2...arize-phoenix-evals-v0.0.3) (2024-02-23)


### Bug Fixes

* remove run_relevance_evals and fix import issues ([#2375](https://github.com/Arize-ai/phoenix/issues/2375)) ([9a97e62](https://github.com/Arize-ai/phoenix/commit/9a97e6251cddf4ca7aa03ba71d4831cb0de4a165))


### Documentation

* **evals:** add README ([#2363](https://github.com/Arize-ai/phoenix/issues/2363)) ([47842da](https://github.com/Arize-ai/phoenix/commit/47842da560f004944852ea1071edf30eb3993ac8))

## [0.0.2](https://github.com/Arize-ai/phoenix/compare/phoenix-evals-v0.0.1...phoenix-evals-v0.0.2) (2024-02-22)

### Features
* extract `phoenix.experimental.evals` to separate `phoenix.evals` package ([#2142](https://github.com/Arize-ai/phoenix/issues/2142)) ([7b63431](https://github.com/Arize-ai/phoenix/commit/7b63431ee329a3916a9898e1437efef0added22f))


### Bug Fixes

* use static version in pyproject.toml for packages ([#2346](https://github.com/Arize-ai/phoenix/issues/2346)) ([ef2148c](https://github.com/Arize-ai/phoenix/commit/ef2148c18bbbece08755fdee58f66c50ab6a7de8))
