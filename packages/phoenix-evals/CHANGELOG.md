# Changelog

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
