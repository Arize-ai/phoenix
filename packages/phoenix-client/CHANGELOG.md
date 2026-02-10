# Changelog

## [1.28.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.28.0...arize-phoenix-client-v1.28.1) (2026-02-09)


### Bug Fixes

* add timezone validation to log_spans_dataframe ([#11283](https://github.com/Arize-ai/phoenix/issues/11283)) ([45a07bb](https://github.com/Arize-ai/phoenix/commit/45a07bb37c81dfd993d36172adc20ecbf01f9937))

## [1.28.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.27.2...arize-phoenix-client-v1.28.0) (2026-01-21)


### Features

* add FaithfulnessEvaluator and deprecate HallucinationEvaluator ([#10962](https://github.com/Arize-ai/phoenix/issues/10962)) ([fc8b1b5](https://github.com/Arize-ai/phoenix/commit/fc8b1b5eaeadbd4e23ed684f0f2286f5a55d00a2))
* add span_id_key to link dataset examples to traces ([#10942](https://github.com/Arize-ai/phoenix/issues/10942)) ([01eb1fb](https://github.com/Arize-ai/phoenix/commit/01eb1fbaa7ac029f044842d683f35c3fb21da627))

## [1.27.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.27.1...arize-phoenix-client-v1.27.2) (2026-01-08)


### Bug Fixes

* use context.span_id column when DataFrame has integer index ([#10861](https://github.com/Arize-ai/phoenix/issues/10861)) ([607558d](https://github.com/Arize-ai/phoenix/commit/607558dff70500eee53d00f369936d4f5dce2db7))

## [1.27.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.27.0...arize-phoenix-client-v1.27.1) (2025-12-16)


### Bug Fixes

* update `reasoning_effort` options for openai ([#10620](https://github.com/Arize-ai/phoenix/issues/10620)) ([5132ce4](https://github.com/Arize-ai/phoenix/commit/5132ce4743d2e9aa0dd509b1c277f1eb800345aa))

## [1.27.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.26.0...arize-phoenix-client-v1.27.0) (2025-12-11)


### Features

* Add span note function to python client ([#10521](https://github.com/Arize-ai/phoenix/issues/10521)) ([ddeff2b](https://github.com/Arize-ai/phoenix/commit/ddeff2b08cdedd18a6b1fccc090ab495849be598))
* Add span notes endpoint ([#10508](https://github.com/Arize-ai/phoenix/issues/10508)) ([727cb23](https://github.com/Arize-ai/phoenix/commit/727cb234f822b992c2fa2a44f0f85d35a7de13a2))
* Lightweight Directory Access Protocol (LDAP) ([#10420](https://github.com/Arize-ai/phoenix/issues/10420)) ([f6aff97](https://github.com/Arize-ai/phoenix/commit/f6aff97b9a563f3f3f87a9b5b8d969152bb4ba47))

## [1.26.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.25.0...arize-phoenix-client-v1.26.0) (2025-11-25)


### Features

* **splits:** Allow split assignment from dataset upload ([#10353](https://github.com/Arize-ai/phoenix/issues/10353)) ([cb45336](https://github.com/Arize-ai/phoenix/commit/cb45336da7ed2016760de11772afd12e9d46f262))

## [1.25.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.24.0...arize-phoenix-client-v1.25.0) (2025-11-24)


### Features

* add evaluation helpers to easily pull rag spans  ([#10341](https://github.com/Arize-ai/phoenix/issues/10341)) ([0c409ad](https://github.com/Arize-ai/phoenix/commit/0c409adf9eb5a61772ca2b9a7038ee31567f6964))

## [1.24.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.23.0...arize-phoenix-client-v1.24.0) (2025-11-19)


### Features

* switch client to be Apache 2.0 ([#10332](https://github.com/Arize-ai/phoenix/issues/10332)) ([ee6f6ee](https://github.com/Arize-ai/phoenix/commit/ee6f6ee15deca45430aff2732fb5ac7253d82522))

## [1.23.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.22.0...arize-phoenix-client-v1.23.0) (2025-11-12)


### Features

* Experiment retries ([#10179](https://github.com/Arize-ai/phoenix/issues/10179)) ([e05fbe9](https://github.com/Arize-ai/phoenix/commit/e05fbe9f3279a5b872cb7cc905a58e6e6aa397a3))

## [1.22.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.21.0...arize-phoenix-client-v1.22.0) (2025-11-05)


### Features

* Bind example to evaluators ([#9036](https://github.com/Arize-ai/phoenix/issues/9036)) ([04d2708](https://github.com/Arize-ai/phoenix/commit/04d270843a0e1c35aa8c55e78ee5d3adb6baabc8))
* metadata for prompts ([#10097](https://github.com/Arize-ai/phoenix/issues/10097)) ([0c92232](https://github.com/Arize-ai/phoenix/commit/0c92232a91679d1b8146167a26aecd20326fce9c))
* query examples by splits ([#9762](https://github.com/Arize-ai/phoenix/issues/9762)) ([e698c9f](https://github.com/Arize-ai/phoenix/commit/e698c9f573e8022eff28c4cc4591c65ab5b39109))
* resume experiment and evaluation ([#9994](https://github.com/Arize-ai/phoenix/issues/9994)) ([557865c](https://github.com/Arize-ai/phoenix/commit/557865c60b08dee5b09912bd09dfd2593231f713))


### Bug Fixes

* Clear error message for non-existent prompts instead of HTTP 404 ([#9931](https://github.com/Arize-ai/phoenix/issues/9931)) ([b31be10](https://github.com/Arize-ai/phoenix/commit/b31be10220d02dc63dfd0027efdd627f30178812))
* **client:** soften input type to create_dataset method ([#9995](https://github.com/Arize-ai/phoenix/issues/9995)) ([02dc536](https://github.com/Arize-ai/phoenix/commit/02dc53652eb7463be47728fb983e4aee8c5215c1))


### Documentation

* **client:** fix docstring for get_dataset ([#9728](https://github.com/Arize-ai/phoenix/issues/9728)) ([2d330f1](https://github.com/Arize-ai/phoenix/commit/2d330f1ff8ca45f0c462c9050723bbae6e792fd7))
* migrate to client.spans.log_ ([#9757](https://github.com/Arize-ai/phoenix/issues/9757)) ([aecb5fb](https://github.com/Arize-ai/phoenix/commit/aecb5fbbfb1ae6938b8d91ac0a1ff6f3a51113a9))
* sync main to docs ([65a68f4](https://github.com/Arize-ai/phoenix/commit/65a68f4c05635e76068b2c85b2929b4d13ca2668))

## [1.21.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.20.0...arize-phoenix-client-v1.21.0) (2025-09-29)


### Features

* client methods for adding trace and session annotations ([#9369](https://github.com/Arize-ai/phoenix/issues/9369)) ([e9b29ef](https://github.com/Arize-ai/phoenix/commit/e9b29ef0b50eb30c64d7e3c557d6264d5652d3fc))


### Documentation

* add session api docs ([#9697](https://github.com/Arize-ai/phoenix/issues/9697)) ([d72e867](https://github.com/Arize-ai/phoenix/commit/d72e867a0971e608816c774816c845908f3b69bd))

## [1.20.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.19.1...arize-phoenix-client-v1.20.0) (2025-09-26)


### Features

* support repetitions ([#9657](https://github.com/Arize-ai/phoenix/issues/9657)) ([0365f7f](https://github.com/Arize-ai/phoenix/commit/0365f7f3c72fc53b39d275f24d48426b7c547933))


### Bug Fixes

* Experiment tracing should respect OITracer configs ([#9640](https://github.com/Arize-ai/phoenix/issues/9640)) ([f08b212](https://github.com/Arize-ai/phoenix/commit/f08b212f6d9857d25c19daeaec833227ef2061f1))

## [1.19.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.19.0...arize-phoenix-client-v1.19.1) (2025-09-19)


### Bug Fixes

* **client:** make sure printed url work for proxied urls ([#9552](https://github.com/Arize-ai/phoenix/issues/9552)) ([9135531](https://github.com/Arize-ai/phoenix/commit/9135531c75c6f7199145a1794648088b1c7b0d75))

## [1.19.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.18.2...arize-phoenix-client-v1.19.0) (2025-09-17)


### Features

* Experiments&lt;-&gt;Evals 2.0 compatibility ([#9442](https://github.com/Arize-ai/phoenix/issues/9442)) ([90e4dbc](https://github.com/Arize-ai/phoenix/commit/90e4dbc08e63ee707f3ab7e42dc5146ad6054e82))

## [1.18.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.18.1...arize-phoenix-client-v1.18.2) (2025-09-11)


### Bug Fixes

* **experiments:** make sure repetitions is a positive integer ([#9479](https://github.com/Arize-ai/phoenix/issues/9479)) ([1b71c66](https://github.com/Arize-ai/phoenix/commit/1b71c666e88853de8bf40eec39ab634a8658f439))

## [1.18.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.18.0...arize-phoenix-client-v1.18.1) (2025-09-10)


### Bug Fixes

* **client:** handle multi-index for document annotations dataframe ([#9464](https://github.com/Arize-ai/phoenix/issues/9464)) ([042ff39](https://github.com/Arize-ai/phoenix/commit/042ff39dc21682454520bdd3b8575ad429add3e5))
* missing version in deprecation docstring ([#9453](https://github.com/Arize-ai/phoenix/issues/9453)) ([bb5ff83](https://github.com/Arize-ai/phoenix/commit/bb5ff83f847631b4ad071836e8dd7bddaafef3ab))

## [1.18.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.17.1...arize-phoenix-client-v1.18.0) (2025-09-04)


### Features

* paginate get experiment runs inside run_experiment ([#9370](https://github.com/Arize-ai/phoenix/issues/9370)) ([8882afc](https://github.com/Arize-ai/phoenix/commit/8882afc2eb1901ffaad0bc9057eb65e1ec3bc337))

## [1.17.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.17.0...arize-phoenix-client-v1.17.1) (2025-09-04)


### Bug Fixes

* experiment task function backward compatibility for the example argument ([#9374](https://github.com/Arize-ai/phoenix/issues/9374)) ([9dd3b8c](https://github.com/Arize-ai/phoenix/commit/9dd3b8cf09198fc611fb4ce1c6781afdfd07a0dc))

## [1.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.16.0...arize-phoenix-client-v1.17.0) (2025-09-03)


### Features

* add methods to log document annotations ([#9352](https://github.com/Arize-ai/phoenix/issues/9352)) ([26808b7](https://github.com/Arize-ai/phoenix/commit/26808b795a1333c40e79a62742a9ff0b631cd064))


### Documentation

* fix doctring on document annotations ([#9367](https://github.com/Arize-ai/phoenix/issues/9367)) ([5a149f2](https://github.com/Arize-ai/phoenix/commit/5a149f23983725579939ee36ce358f659b0ef5bd))
* fix doctring trailing comma ([#9339](https://github.com/Arize-ai/phoenix/issues/9339)) ([292cace](https://github.com/Arize-ai/phoenix/commit/292cace00b1fcb399bff2f6936a7715fa012ebe9))
* fix doctrings for annotatiosn ([#9337](https://github.com/Arize-ai/phoenix/issues/9337)) ([e1c713a](https://github.com/Arize-ai/phoenix/commit/e1c713a11e614b225f222493d8286b63e7a23452))

## [1.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.15.3...arize-phoenix-client-v1.16.0) (2025-08-30)


### Features

* `get_spans_dataframe` sorts by newst/oldest spans ([#9173](https://github.com/Arize-ai/phoenix/issues/9173)) ([2bf5819](https://github.com/Arize-ai/phoenix/commit/2bf58194ae6be3e63d08c64ccf71a96b1e20dfdf))
* **client:** re-export types for dx ([#9330](https://github.com/Arize-ai/phoenix/issues/9330)) ([3713355](https://github.com/Arize-ai/phoenix/commit/37133552a24cab98c7c9d8eb680f80be3c3df2bf))
* Handle new OpenAI tool types ([#9175](https://github.com/Arize-ai/phoenix/issues/9175)) ([d6c2559](https://github.com/Arize-ai/phoenix/commit/d6c25590d11668cb2529a2173d8e3ea1df67a14e))


### Documentation

* add docs links to all readmes ([#9322](https://github.com/Arize-ai/phoenix/issues/9322)) ([b0b671b](https://github.com/Arize-ai/phoenix/commit/b0b671bbabf05279ea7254e2b92972725a7a86b6))
* Add explicit documentation for missing phoenix.Client methods in API reference ([#8976](https://github.com/Arize-ai/phoenix/issues/8976)) ([6cd0b1f](https://github.com/Arize-ai/phoenix/commit/6cd0b1f84f8aacd1fa2a88c31c61638c0b391818))
* **client:** fix python client docs ([#9317](https://github.com/Arize-ai/phoenix/issues/9317)) ([d94835a](https://github.com/Arize-ai/phoenix/commit/d94835aad129216fdb7d480a70aa2a501e615a8e))
* consistent docstrings ([#9324](https://github.com/Arize-ai/phoenix/issues/9324)) ([00dcea9](https://github.com/Arize-ai/phoenix/commit/00dcea97aac7a8165395bfaefe52f771feadca2d))
* fix client python docs ([#9160](https://github.com/Arize-ai/phoenix/issues/9160)) ([bbe1300](https://github.com/Arize-ai/phoenix/commit/bbe130056dd531128a04db53a2e635df41284d7a))

## [1.15.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.15.2...arize-phoenix-client-v1.15.3) (2025-08-15)


### Bug Fixes

* **experiments:** dataset version id should not be optional ([#9074](https://github.com/Arize-ai/phoenix/issues/9074)) ([ec83174](https://github.com/Arize-ai/phoenix/commit/ec831742aa2cc22453922a7acf61775e4bbe5b29))
* **experiments:** result should be nullable when there's error in experiment run evaluation ([#9065](https://github.com/Arize-ai/phoenix/issues/9065)) ([fc5c303](https://github.com/Arize-ai/phoenix/commit/fc5c30310b804157f5472a2e2599ca34e0a03a46))

## [1.15.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.15.1...arize-phoenix-client-v1.15.2) (2025-08-14)


### Bug Fixes

* **experiments:** ran experiment should contain project name ([#9076](https://github.com/Arize-ai/phoenix/issues/9076)) ([03dd8de](https://github.com/Arize-ai/phoenix/commit/03dd8deeee5fc26991df5b39f6f0adf29676557e))
* **experiments:** span name should be short for experiment tasks ([#9079](https://github.com/Arize-ai/phoenix/issues/9079)) ([589e96d](https://github.com/Arize-ai/phoenix/commit/589e96d040d571c28b03cf393ed20d405dd895bb))

## [1.15.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.15.0...arize-phoenix-client-v1.15.1) (2025-08-13)


### Bug Fixes

* **experiments:** record end time after span ends ([#9070](https://github.com/Arize-ai/phoenix/issues/9070)) ([7961d43](https://github.com/Arize-ai/phoenix/commit/7961d43d9b3002d769be11f06605790d01ca5820))


### Documentation

* client config for run_experiment docstring ([#9032](https://github.com/Arize-ai/phoenix/issues/9032)) ([41384be](https://github.com/Arize-ai/phoenix/commit/41384be0e7e65d55285899b54033b269c4c3cc22))

## [1.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.14.2...arize-phoenix-client-v1.15.0) (2025-08-07)


### Features

* **playground:** support gpt-5 ([#8985](https://github.com/Arize-ai/phoenix/issues/8985)) ([8711bde](https://github.com/Arize-ai/phoenix/commit/8711bdecfeee479c480a1acebf32ebc1b11461cb))
* python phoenix-client delete span method ([#8944](https://github.com/Arize-ai/phoenix/issues/8944)) ([c7a0a1a](https://github.com/Arize-ai/phoenix/commit/c7a0a1a9fa63a659f86c5675ef913168df8962bf))
* Reexport experiment utilities in top-level client module ([#8953](https://github.com/Arize-ai/phoenix/issues/8953)) ([1f9a9cb](https://github.com/Arize-ai/phoenix/commit/1f9a9cb8d9ac3bf63db05a8541e5826e099a153b))


### Bug Fixes

* Update notebooks to use new client ([#8891](https://github.com/Arize-ai/phoenix/issues/8891)) ([6ebbfb4](https://github.com/Arize-ai/phoenix/commit/6ebbfb4d6a9bfb40cf7a7d6a8db1464b4d931bd0))

## [1.14.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.14.1...arize-phoenix-client-v1.14.2) (2025-08-05)


### Bug Fixes

* Remove reference to experiment evaluators in client docstrings ([#8933](https://github.com/Arize-ai/phoenix/issues/8933)) ([3a45871](https://github.com/Arize-ai/phoenix/commit/3a45871775494496b1993d816a3a9fd26630e51e))

## [1.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.14.0...arize-phoenix-client-v1.14.1) (2025-07-30)


### Bug Fixes

* reconcile schema `str` type with runtime `datetime` type ([#8862](https://github.com/Arize-ai/phoenix/issues/8862)) ([f7a2403](https://github.com/Arize-ai/phoenix/commit/f7a24031e147f86d07e8f4832e72fb33839a03fc))

## [1.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-client-v1.13.2...arize-phoenix-client-v1.14.0) (2025-07-29)


### Features

* update python client with list method for datasets ([#8815](https://github.com/Arize-ai/phoenix/issues/8815)) ([559863c](https://github.com/Arize-ai/phoenix/commit/559863cfb2d3c5d1e496e39f4c9619bac27f0891))

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
