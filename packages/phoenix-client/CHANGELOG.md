# Changelog

## [1.13.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.13.1...arize-phoenix-client-v1.13.2) (2025-07-18)


### Bug Fixes

* Allow executors to run in background threads ([#8628](https://github.com/Arize-ai/phoenix/issues/8628)) ([6fb4f42](https://github.com/Arize-ai/phoenix/commit/6fb4f4265e71671c661dcf3e67a5085598d9a252))

## [1.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.13.0...arize-phoenix-client-v1.13.1) (2025-07-16)


### Bug Fixes

* Do not access API for experiment evaluations in dry_run mode ([#8606](https://github.com/Arize-ai/phoenix/issues/8606)) ([b8c77fb](https://github.com/Arize-ai/phoenix/commit/b8c77fb2d2d397e13f55aec86b978be2bd9dbfa6))

## [1.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.12.0...arize-phoenix-client-v1.13.0) (2025-07-16)


### Features

* Add experiments module to phoenix-client ([#8375](https://github.com/Arize-ai/phoenix/issues/8375)) ([3df0326](https://github.com/Arize-ai/phoenix/commit/3df032627e8ce52a96e8d6dcd626f7641d0cb011))
* Add serialization/deserialization methods to client Datasets ([#8453](https://github.com/Arize-ai/phoenix/issues/8453)) ([1dcb304](https://github.com/Arize-ai/phoenix/commit/1dcb304f1415edfa12a07ff152a1ebe82a3de8c0))
* Experiment enhancements ([#8591](https://github.com/Arize-ai/phoenix/issues/8591)) ([2ba7953](https://github.com/Arize-ai/phoenix/commit/2ba79535c07069939ac33d660172c50a434bda54))

## [1.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.11.0...arize-phoenix-client-v1.12.0) (2025-07-03)


### Features

* bedrock playground client ([#7918](https://github.com/Arize-ai/phoenix/issues/7918)) ([15d7e7a](https://github.com/Arize-ai/phoenix/commit/15d7e7aaa36913e3bb76777653fb29c8f6297340))

## [1.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.10.0...arize-phoenix-client-v1.11.0) (2025-06-19)


### Features

* Add `log_spans` to client and REST API ([#8005](https://github.com/Arize-ai/phoenix/issues/8005)) ([5a838ab](https://github.com/Arize-ai/phoenix/commit/5a838abf587db2ae707e39b1eca9d93c0c83323d))
* Add dataset methods to phoenix client ([#7931](https://github.com/Arize-ai/phoenix/issues/7931)) ([4a5aa39](https://github.com/Arize-ai/phoenix/commit/4a5aa39b90adfb9896f336db7998bcde7c481bf8))
* **auth:** logout ([#7985](https://github.com/Arize-ai/phoenix/issues/7985)) ([63128c5](https://github.com/Arize-ai/phoenix/commit/63128c5328222147fe5c5103d8dd3576d5534bc2))
* read OTEL_EXPORTER_OTLP_ENDPOINT when PHOENIX_COLLECTOR_ENDPOINT is missing ([#8095](https://github.com/Arize-ai/phoenix/issues/8095)) ([4cb7e4c](https://github.com/Arize-ai/phoenix/commit/4cb7e4c2cd3b43ee3334c717dc4499634ca12135))
* separate docs phoenix client evals ([#7948](https://github.com/Arize-ai/phoenix/issues/7948)) ([e569b68](https://github.com/Arize-ai/phoenix/commit/e569b6802ab9e31cb230a30dbc08f60d7e28e993))


### Documentation

* Readthedocs improvements on naming and structure ([#8009](https://github.com/Arize-ai/phoenix/issues/8009)) ([76a4b92](https://github.com/Arize-ai/phoenix/commit/76a4b9282ff8476757ee1c0b3c85a7767208795b))

## [1.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.9.0...arize-phoenix-client-v1.10.0) (2025-06-04)


### Features

* Add `get_spans` to phoenix client ([#7688](https://github.com/Arize-ai/phoenix/issues/7688)) ([8b48176](https://github.com/Arize-ai/phoenix/commit/8b481762c188e3191a8e0bb2ffd295a7ee3fdfb8))
* ollama ([#7846](https://github.com/Arize-ai/phoenix/issues/7846)) ([4c52db4](https://github.com/Arize-ai/phoenix/commit/4c52db40da6b7772487cc6d288cf69d5944812a1))


### Bug Fixes

* Do not return notes from GET /span_annotations ([#7830](https://github.com/Arize-ai/phoenix/issues/7830)) ([52c2c06](https://github.com/Arize-ai/phoenix/commit/52c2c06028815d0982172925e2d31705f49e0fe3))

## [1.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.8.0...arize-phoenix-client-v1.9.0) (2025-05-31)


### Features

* **admin:** users REST api ([#7314](https://github.com/Arize-ai/phoenix/issues/7314)) ([c7bcc36](https://github.com/Arize-ai/phoenix/commit/c7bcc36b8469e76db3038f53859e24c7bb5da000))
* xai to playground ([#7808](https://github.com/Arize-ai/phoenix/issues/7808)) ([5dd53be](https://github.com/Arize-ai/phoenix/commit/5dd53be2ee697dd1b2c482df58d718d00ae892eb))

## [1.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.7.0...arize-phoenix-client-v1.8.0) (2025-05-29)


### Features

* Playground add deepseek ([#7675](https://github.com/Arize-ai/phoenix/issues/7675)) ([b162720](https://github.com/Arize-ai/phoenix/commit/b162720325c7fe7c20cda75feb161b4646127cf8))

## [1.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.6.0...arize-phoenix-client-v1.7.0) (2025-05-21)


### Features

* graphql query for hourly span count timeseries ([#6997](https://github.com/Arize-ai/phoenix/issues/6997)) ([fe6a80a](https://github.com/Arize-ai/phoenix/commit/fe6a80aaa939ebe445af04c17e46b2c29080bc60))

## [1.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.5.0...arize-phoenix-client-v1.6.0) (2025-05-14)


### Features

* **api:** expose experiment routes ([#7543](https://github.com/Arize-ai/phoenix/issues/7543)) ([7882615](https://github.com/Arize-ai/phoenix/commit/7882615fb22c487833b76c784edda668921e21db))


### Bug Fixes

* allow context.span_id as column name ([#7368](https://github.com/Arize-ai/phoenix/issues/7368)) ([ba1b9eb](https://github.com/Arize-ai/phoenix/commit/ba1b9eba9ce55b6644d46cd3f6436d29ccf2f304))

## [1.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.4.0...arize-phoenix-client-v1.5.0) (2025-05-09)


### Features

* add `get_span_annotations_dataframe` to client ([#7366](https://github.com/Arize-ai/phoenix/issues/7366)) ([94c0c02](https://github.com/Arize-ai/phoenix/commit/94c0c029dee31e017da112cf1f5db36127cedf1b))
* span annotation POST methods for client ([#7359](https://github.com/Arize-ai/phoenix/issues/7359)) ([218cc63](https://github.com/Arize-ai/phoenix/commit/218cc63cac84d48477d5359cc31aaf6ccca7f8bf))


### Bug Fixes

* **annotations:** ensure response types for annotation configs are nested under a data key ([#7443](https://github.com/Arize-ai/phoenix/issues/7443)) ([145dba3](https://github.com/Arize-ai/phoenix/commit/145dba3978a2ae542a5b5d0e56098e3b0f019a6c))
* formatting issues incase of escaped characters ([#7407](https://github.com/Arize-ai/phoenix/issues/7407)) ([3c0ab8b](https://github.com/Arize-ai/phoenix/commit/3c0ab8b33fdb3d97639fb5863643c3c32fe2d3af))
* Improve client semantics 2 ([#7484](https://github.com/Arize-ai/phoenix/issues/7484)) ([11656a1](https://github.com/Arize-ai/phoenix/commit/11656a1aad9b31434ee7f97715fc3d8a9ebe6228))

## [1.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.3.0...arize-phoenix-client-v1.4.0) (2025-05-02)


### Features

* Add `SpanQuery` DSL to phoenix client and include `get_spans_dataframe` to client ([#7071](https://github.com/Arize-ai/phoenix/issues/7071)) ([ee56e9a](https://github.com/Arize-ai/phoenix/commit/ee56e9a9bf9e13c8793bd4a3b915ef083f679f2a))


### Documentation

* **client:** add general rules for the client ([#7290](https://github.com/Arize-ai/phoenix/issues/7290)) ([ba79347](https://github.com/Arize-ai/phoenix/commit/ba793476c46a6e9a3a203448ef06a3b46f9f8486))

## [1.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.2.1...arize-phoenix-client-v1.3.0) (2025-04-09)


### Features

* allow project name as identifier in REST path for projects endpoints ([#7064](https://github.com/Arize-ai/phoenix/issues/7064)) ([8ccf2d7](https://github.com/Arize-ai/phoenix/commit/8ccf2d761100cefb2afc5a2d70690f9a5d15483e))
* REST API for CRUD operations on projects ([#7006](https://github.com/Arize-ai/phoenix/issues/7006)) ([b30c7ff](https://github.com/Arize-ai/phoenix/commit/b30c7ff65ee418c225d54a6fd00d4f7f29ad84e8))

## [1.2.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.2.0...arize-phoenix-client-v1.2.1) (2025-04-05)


### Documentation

* add nice headers ([#7044](https://github.com/Arize-ai/phoenix/issues/7044)) ([9151104](https://github.com/Arize-ai/phoenix/commit/9151104bd4aa69380849a441e3556a3adfa604ca))

## [1.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.1.0...arize-phoenix-client-v1.2.0) (2025-04-03)


### Features

* add REST endpoints to list or create prompt version tags ([#6984](https://github.com/Arize-ai/phoenix/issues/6984)) ([959622d](https://github.com/Arize-ai/phoenix/commit/959622d335274a0cb59dbf6b78e94fe6f3613bd3))


### Documentation

* No subject (GITBOOK-1087) ([6fa5fd7](https://github.com/Arize-ai/phoenix/commit/6fa5fd71cdf57a9a5a7efc3e2822ad57497f3b5a))
* No subject (GITBOOK-1090) ([024c49f](https://github.com/Arize-ai/phoenix/commit/024c49fe57487ee816317f798ec648331a866ae4))
* No subject (GITBOOK-1099) ([b4357e3](https://github.com/Arize-ai/phoenix/commit/b4357e324a9444704fbf85370c193ef2ee59495f))

## [1.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.0.3...arize-phoenix-client-v1.1.0) (2025-03-07)


### Features

* add anthropic thinking config param for python client ([#6659](https://github.com/Arize-ai/phoenix/issues/6659)) ([d03d57e](https://github.com/Arize-ai/phoenix/commit/d03d57e0efaedcba4731caa18b74db35f9b104f1))

## [1.0.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.0.2...arize-phoenix-client-v1.0.3) (2025-02-27)


### Bug Fixes

* add README for phoenix client ([#6604](https://github.com/Arize-ai/phoenix/issues/6604)) ([5ad7b0e](https://github.com/Arize-ai/phoenix/commit/5ad7b0eb5e87d0da3566b6f4a8f048aa9fabb1d1))

## [1.0.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.0.1...arize-phoenix-client-v1.0.2) (2025-02-24)


### Bug Fixes

* Add max_completion_tokens to openai param validation ([#6550](https://github.com/Arize-ai/phoenix/issues/6550)) ([c99ee6f](https://github.com/Arize-ai/phoenix/commit/c99ee6fe69bc0ebde8d0fe018044f796142fcdc9))
* **client:** update python client sdk helper for anthropic 0.47 ([#6551](https://github.com/Arize-ai/phoenix/issues/6551)) ([4abbd0d](https://github.com/Arize-ai/phoenix/commit/4abbd0dbe941009245d06a95329426e34df90ed9))

## [1.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.0.0...arize-phoenix-client-v1.0.1) (2025-02-19)


### Bug Fixes

* phoenix client version ([#6465](https://github.com/Arize-ai/phoenix/issues/6465)) ([3fede08](https://github.com/Arize-ai/phoenix/commit/3fede08024ff5e7e013717d07a1d94f2cb965a60))

## [0.2.0-alpha.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v0.1.0-alpha.1...arize-phoenix-client-v0.2.0-alpha.1) (2025-02-19)


### Features

* client get latest prompt version ([#6167](https://github.com/Arize-ai/phoenix/issues/6167)) ([e5226ff](https://github.com/Arize-ai/phoenix/commit/e5226ff5993d271359807b5544fea6cfaef83b6d))
* **prompts:** add client helpers for openai and anthropic prompts ([#6109](https://github.com/Arize-ai/phoenix/issues/6109)) ([4083257](https://github.com/Arize-ai/phoenix/commit/4083257aabcc371b465752bb6153ec1f4fbcba79))
* **prompts:** add tool choice in openapi schema for python client sdk helpers ([#6291](https://github.com/Arize-ai/phoenix/issues/6291)) ([20c8bef](https://github.com/Arize-ai/phoenix/commit/20c8bef27adb7b0d6efafcf22c3189d3c29af973))
* **prompts:** POST method for prompts endpoint ([#6347](https://github.com/Arize-ai/phoenix/issues/6347)) ([77eab0c](https://github.com/Arize-ai/phoenix/commit/77eab0cc3251a0f50c077149d985a87cadb2d0f8))
* update client with response format for openai sdk ([#6282](https://github.com/Arize-ai/phoenix/issues/6282)) ([a9d9a49](https://github.com/Arize-ai/phoenix/commit/a9d9a49f9f91e0c99a08ae92e716cbc0887346cb))


### Bug Fixes

* **client:** exclude empty list of tools in sdk helper functions ([#6203](https://github.com/Arize-ai/phoenix/issues/6203)) ([e3e5ea3](https://github.com/Arize-ai/phoenix/commit/e3e5ea324fcdcb5d12279f5d29e837d895898f5f))
* **client:** handle azure openai invocation parameters ([#6450](https://github.com/Arize-ai/phoenix/issues/6450)) ([b11a604](https://github.com/Arize-ai/phoenix/commit/b11a60432c084314d65549bbdea56c2e3441d4e0))
* **prompts:** normalized tools ([#6220](https://github.com/Arize-ai/phoenix/issues/6220)) ([42a31ad](https://github.com/Arize-ai/phoenix/commit/42a31adca6c25068e94decb437ff79b187f85903))
* **prompts:** prompt invocation parameters ([#6309](https://github.com/Arize-ai/phoenix/issues/6309)) ([c0e2998](https://github.com/Arize-ai/phoenix/commit/c0e2998e8b56ffb5276d671d8d9654c2494eaaf7))
* **prompts:** rename google provider ([#6452](https://github.com/Arize-ai/phoenix/issues/6452)) ([2ecac95](https://github.com/Arize-ai/phoenix/commit/2ecac9527ec3d718bdb75d21596ef1ee3b0b9d6b))
* **prompts:** sqlalchemy types ([#6177](https://github.com/Arize-ai/phoenix/issues/6177)) ([d6614b6](https://github.com/Arize-ai/phoenix/commit/d6614b6494f4e7a29212559bb8275edef2b80601))

## [0.1.0-alpha.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v0.1.0-alpha.0...arize-phoenix-client-v0.1.0-alpha.1) (2025-01-07)


### Features

* initial Python package skeleton for `arize-phoenix-client` ([#5934](https://github.com/Arize-ai/phoenix/issues/5934)) ([00fd25d](https://github.com/Arize-ai/phoenix/commit/00fd25d98e949a428b0f702882866beaaba43e45))
