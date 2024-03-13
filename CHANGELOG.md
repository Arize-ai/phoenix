# Changelog

## [3.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.12.0...arize-phoenix-v3.13.0) (2024-03-13)


### Features

* add arize-phoenix support for python 3.12 ([#2555](https://github.com/Arize-ai/phoenix/issues/2555)) ([aac0cd5](https://github.com/Arize-ai/phoenix/commit/aac0cd5b3e7367fb1e791bad3bf80345520b75ea))

## [3.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.11.1...arize-phoenix-v3.12.0) (2024-03-13)


### Features

* Enable dynamic project switching ([#2537](https://github.com/Arize-ai/phoenix/issues/2537)) ([0ef3224](https://github.com/Arize-ai/phoenix/commit/0ef3224169b95210c0b2c85333309b1a3539b4d4))


### Bug Fixes

* prevent browser caching of static assets ([#2549](https://github.com/Arize-ai/phoenix/issues/2549)) ([038e56e](https://github.com/Arize-ai/phoenix/commit/038e56e242032f27ebbb46b044a8549918ca1e8a))

## [3.11.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.11.0...arize-phoenix-v3.11.1) (2024-03-12)


### Bug Fixes

* display newlines in explanations ([#2531](https://github.com/Arize-ai/phoenix/issues/2531)) ([12e8a97](https://github.com/Arize-ai/phoenix/commit/12e8a97404ac30b7348d55f46d34e952c79af93d))

## [3.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.10.0...arize-phoenix-v3.11.0) (2024-03-11)


### Features

* **graphql:** embed project inside graphql span as private attribute ([#2522](https://github.com/Arize-ai/phoenix/issues/2522)) ([9be1afa](https://github.com/Arize-ai/phoenix/commit/9be1afa7ca9cb29698061a7fa334d2939b776456))
* **trace:** context manager to pause tracing ([#2520](https://github.com/Arize-ai/phoenix/issues/2520)) ([6bf7232](https://github.com/Arize-ai/phoenix/commit/6bf7232116ba406085957be60028c994547205d6))


### Bug Fixes

* parse files to detect sagemaker ([#2527](https://github.com/Arize-ai/phoenix/issues/2527)) ([0761513](https://github.com/Arize-ai/phoenix/commit/0761513c61e76418854881f918a04b25ef958466))


### Documentation

* Update pyproject.toml with proper biline ([4fdf710](https://github.com/Arize-ai/phoenix/commit/4fdf710057a6fd19c75df133ed28206c35597eee))

## [3.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.9.0...arize-phoenix-v3.10.0) (2024-03-09)


### Features

* **projects:** add support for the PHOENIX_PROJECT_NAME param ([#2515](https://github.com/Arize-ai/phoenix/issues/2515)) ([6f24786](https://github.com/Arize-ai/phoenix/commit/6f2478660aa6348153c11dba5dd43231a8a44df8))
* show first non-empty project ([#2508](https://github.com/Arize-ai/phoenix/issues/2508)) ([54a2834](https://github.com/Arize-ai/phoenix/commit/54a28349ee81ef83caab3e1823b43a913cf218bf))


### Bug Fixes

* support minimal llama-index installations ([#2516](https://github.com/Arize-ai/phoenix/issues/2516)) ([2469677](https://github.com/Arize-ai/phoenix/commit/246967731bb211c5a891e0720a503aa8973803df))


### Documentation

* sync Feb 21, 2024 ([#2343](https://github.com/Arize-ai/phoenix/issues/2343)) ([4e151f3](https://github.com/Arize-ai/phoenix/commit/4e151f37f0afcd5de80eae52e7650677bf3bb9e2))

## [3.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.8.0...arize-phoenix-v3.9.0) (2024-03-08)


### Features

* **ui:** copy to clipboard for prompt template etc. ([#2496](https://github.com/Arize-ai/phoenix/issues/2496)) ([9b853d0](https://github.com/Arize-ai/phoenix/commit/9b853d0a3fc62519b01d8cce1394fe61f671f9fd))

## [3.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.7.0...arize-phoenix-v3.8.0) (2024-03-07)


The Phoenix `evals` module is graduating out of `experimental`! You can now install Phoenix evals as a standalone package with `pip install arize-phoenix-evals` or you can include the new version of `phoenix.evals` along with the Phoenix install with `pip install -U arize-phoenix[evals]`. Swapping to the new `evals` module includes a few small breaking changes which might require some migration work. Details can be found in [`MIGRATION.md`](https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md).

`phoenix.experimental.evals` is being deprecated and will remain in Phoenix for about a month before being removed.

### Features

* **gql:** add trace count to gql project ([#2484](https://github.com/Arize-ai/phoenix/issues/2484)) ([91b4ae1](https://github.com/Arize-ai/phoenix/commit/91b4ae16a4dc6146e1f5d9a13ae7273b5b404618))
* Integrate `phoenix.evals` into `phoenix` ([#2420](https://github.com/Arize-ai/phoenix/issues/2420)) ([dd3e7b4](https://github.com/Arize-ai/phoenix/commit/dd3e7b4b31875572ce5e181cf3e80afecb78695c))


### Documentation

* Add SQL retriever tracing tutorial ([#2468](https://github.com/Arize-ai/phoenix/issues/2468)) ([c92b118](https://github.com/Arize-ai/phoenix/commit/c92b11875fb77391fd26d7595f33d164b55a8de6))

## [3.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.6.0...arize-phoenix-v3.7.0) (2024-03-07)


### Features

* **projects:** project listing ([#2459](https://github.com/Arize-ai/phoenix/issues/2459)) ([2a19814](https://github.com/Arize-ai/phoenix/commit/2a19814dd09ea2c540e0b56baf99ae20551fa982))
* **projects:** project node interace ([#2466](https://github.com/Arize-ai/phoenix/issues/2466)) ([9d8ade0](https://github.com/Arize-ai/phoenix/commit/9d8ade0aaec53c494e5cd120910c16fd400ac526))

## [3.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.5.0...arize-phoenix-v3.6.0) (2024-03-06)


### Features

* **traces:** store and query spans by project name ([#2433](https://github.com/Arize-ai/phoenix/issues/2433)) ([b8ef923](https://github.com/Arize-ai/phoenix/commit/b8ef923815255c58eda90744910e362fc407cf5e))
* **ui:** auto-expand side nav on hover ([#2458](https://github.com/Arize-ai/phoenix/issues/2458)) ([da83f69](https://github.com/Arize-ai/phoenix/commit/da83f699120db904e2d311b17bf81585d192940d))


### Bug Fixes

* link to span ([#2460](https://github.com/Arize-ai/phoenix/issues/2460)) ([cbef052](https://github.com/Arize-ai/phoenix/commit/cbef05233a22314d886d120f4df1c1065fe1fb72))

## [3.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.4.1...arize-phoenix-v3.5.0) (2024-03-05)


### Features

* add metadata to spans and traces table ([#2339](https://github.com/Arize-ai/phoenix/issues/2339)) ([e9725a2](https://github.com/Arize-ai/phoenix/commit/e9725a29c7b70fa6470eb542c57b99f20af74704))
* Removes token processing module from `phoenix.evals` ([#2421](https://github.com/Arize-ai/phoenix/issues/2421)) ([fbd4961](https://github.com/Arize-ai/phoenix/commit/fbd496163d6cf46b3299da4ac7962b19da054bd8))
* **ui:** new side nav with projects ([#2359](https://github.com/Arize-ai/phoenix/issues/2359)) ([d8c423e](https://github.com/Arize-ai/phoenix/commit/d8c423e840c5b1f856e3788781179406c97fc845))


### Bug Fixes

* Properly define `BedrockModel` ([#2425](https://github.com/Arize-ai/phoenix/issues/2425)) ([81a720c](https://github.com/Arize-ai/phoenix/commit/81a720c8264f80fc37fcfe76c1c982014e9f12b3))
* remove __computed__ atributes from exported dataframe ([#2366](https://github.com/Arize-ai/phoenix/issues/2366)) ([1de1415](https://github.com/Arize-ai/phoenix/commit/1de1415de8938d4d583620e86394dcab607becf4))
* turn span_kind enums into string because it's not serializable by pyarrow ([#2438](https://github.com/Arize-ai/phoenix/issues/2438)) ([50c7eb0](https://github.com/Arize-ai/phoenix/commit/50c7eb04e70c6404992d3d829221151b860d5c9d))
* update rag and llm ops notebooks ([#2442](https://github.com/Arize-ai/phoenix/issues/2442)) ([adf1b2b](https://github.com/Arize-ai/phoenix/commit/adf1b2ba7f62647d20f72bb7e88fb6ff7bfba6b1))


### Documentation

* **evals:** update tracing tutorials with arize-phoenix-evals ([#2386](https://github.com/Arize-ai/phoenix/issues/2386)) ([1af8187](https://github.com/Arize-ai/phoenix/commit/1af81871b105135584959afbd7c906f9b2607db4))
* log information about the server at startup ([#2445](https://github.com/Arize-ai/phoenix/issues/2445)) ([6d410c1](https://github.com/Arize-ai/phoenix/commit/6d410c1509e0380cd5f19cee185a1401c6d33ad2))
* update readme for phoenix.evals, fix llama-index example ([#2435](https://github.com/Arize-ai/phoenix/issues/2435)) ([dfffaad](https://github.com/Arize-ai/phoenix/commit/dfffaadd8bba60750680caabcfd38913c0d79a94))

## [3.4.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.4.0...arize-phoenix-v3.4.1) (2024-02-29)


### Bug Fixes

* remove symbolic links for docker build ([#2408](https://github.com/Arize-ai/phoenix/issues/2408)) ([b57abe9](https://github.com/Arize-ai/phoenix/commit/b57abe9d6bf0352c3fc41c60727350185544ff9b))
* source distribution build ([#2407](https://github.com/Arize-ai/phoenix/issues/2407)) ([1e67d7e](https://github.com/Arize-ai/phoenix/commit/1e67d7e4eb037f85b1e33e59b42014fe3daa876d))

## [3.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.3.0...arize-phoenix-v3.4.0) (2024-02-28)


### Features

* Add `phoenix.evals` bridge to `phoenix` and add `evals` extra install ([#2389](https://github.com/Arize-ai/phoenix/issues/2389)) ([d8b9054](https://github.com/Arize-ai/phoenix/commit/d8b905457c38edce247b2fb2368d90db242f3abc))


### Bug Fixes

* remove run_relevance_evals and fix import issues ([#2375](https://github.com/Arize-ai/phoenix/issues/2375)) ([9a97e62](https://github.com/Arize-ai/phoenix/commit/9a97e6251cddf4ca7aa03ba71d4831cb0de4a165))
* **traces:** add y scroll on trace tree ([#2399](https://github.com/Arize-ai/phoenix/issues/2399)) ([9c4f6b9](https://github.com/Arize-ai/phoenix/commit/9c4f6b9cec80709eb9f673934282ad3a7cbddc92))


### Documentation

* **evals:** add README ([#2363](https://github.com/Arize-ai/phoenix/issues/2363)) ([47842da](https://github.com/Arize-ai/phoenix/commit/47842da560f004944852ea1071edf30eb3993ac8))
* **evals:** migrate evaluation notebooks ([#2388](https://github.com/Arize-ai/phoenix/issues/2388)) ([3dedc6e](https://github.com/Arize-ai/phoenix/commit/3dedc6ef6d21ab55f303401a5a0c25cf1b74d1d0))
* update ragas integration ([#2400](https://github.com/Arize-ai/phoenix/issues/2400)) ([7bebe98](https://github.com/Arize-ai/phoenix/commit/7bebe98beeeb2a7ffe1eaf56edaf8f9d6b062226))

## [3.3.0](https://github.com/Arize-ai/phoenix/compare/phoenix-v3.2.1...phoenix-v3.3.0) (2024-02-23)


### Features

* display status description under trace info ([#2334](https://github.com/Arize-ai/phoenix/issues/2334)) ([aed925f](https://github.com/Arize-ai/phoenix/commit/aed925f3a677fd2045bfabc0a3c5102e7264aaf3))
* show span as soon as they arrive ([#2353](https://github.com/Arize-ai/phoenix/issues/2353)) ([88397a5](https://github.com/Arize-ai/phoenix/commit/88397a58ea29ae88987ed8ca12b494a05970bb87))


### Bug Fixes

* use static version in pyproject.toml for packages ([#2346](https://github.com/Arize-ai/phoenix/issues/2346)) ([ef2148c](https://github.com/Arize-ai/phoenix/commit/ef2148c18bbbece08755fdee58f66c50ab6a7de8))


### Documentation

* update cspell ([#2329](https://github.com/Arize-ai/phoenix/issues/2329)) ([055506f](https://github.com/Arize-ai/phoenix/commit/055506fc622862ec26d72df86c09746d666c220a))

## [3.2.1](https://github.com/Arize-ai/phoenix/compare/v3.2.0...v3.2.1) (2024-02-16)


### Bug Fixes

* evaluate rag notebook ([#2316](https://github.com/Arize-ai/phoenix/issues/2316)) ([4219bf2](https://github.com/Arize-ai/phoenix/commit/4219bf2b55414dcec1528f1c8ca15f4393f00388))
* llama_index_search_and_retrieval_notebook ([#2315](https://github.com/Arize-ai/phoenix/issues/2315)) ([21e5429](https://github.com/Arize-ai/phoenix/commit/21e5429dc57d5d6cdc9e06276bc5aff1940261c1))


### Documentation

* update notebooks for px.Client().log_evaluations() ([#2311](https://github.com/Arize-ai/phoenix/issues/2311)) ([a3ca311](https://github.com/Arize-ai/phoenix/commit/a3ca31186a177d4572693a1f5066c5e91aa078de))


### Miscellaneous Chores

* release 3.2.1 ([#2326](https://github.com/Arize-ai/phoenix/issues/2326)) ([dc2f561](https://github.com/Arize-ai/phoenix/commit/dc2f56184311c98241b439609488a86b5ccd9fe3))

## [3.2.0](https://github.com/Arize-ai/phoenix/compare/v3.1.2...v3.2.0) (2024-02-16)


### Features

* px.Client `log_evaluations` ([#2308](https://github.com/Arize-ai/phoenix/issues/2308)) ([69a4b2b](https://github.com/Arize-ai/phoenix/commit/69a4b2b9705d05cb54de3b153fc0450485da4427))
* **trace:** display metadata in the trace page UI ([#2304](https://github.com/Arize-ai/phoenix/issues/2304)) ([fce2d63](https://github.com/Arize-ai/phoenix/commit/fce2d63983aa31b115080d94bb3f5c7a899ecaf5))


### Bug Fixes

* make dspy notebook work on colab ([#2306](https://github.com/Arize-ai/phoenix/issues/2306)) ([a518701](https://github.com/Arize-ai/phoenix/commit/a5187013bac52e710cf73b716abb70423af59026))

## [3.1.2](https://github.com/Arize-ai/phoenix/compare/v3.1.1...v3.1.2) (2024-02-15)


### Bug Fixes

* allow json string for `metadata` span attribute ([#2301](https://github.com/Arize-ai/phoenix/issues/2301)) ([ec7fbe2](https://github.com/Arize-ai/phoenix/commit/ec7fbe2380bd9f1ff837802b58a626eb562731e1))
* **ui:** safely parse JSON and fallback to string for span attributes ([#2293](https://github.com/Arize-ai/phoenix/issues/2293)) ([e43cdbb](https://github.com/Arize-ai/phoenix/commit/e43cdbb5b7a2f5c24957acadac5dd0949ea5469c))


### Documentation

* dspy tutorial notebook ([#2288](https://github.com/Arize-ai/phoenix/issues/2288)) ([f26caaa](https://github.com/Arize-ai/phoenix/commit/f26caaa764e3fefc28116a25bc84014bc1962553))

## [3.1.1](https://github.com/Arize-ai/phoenix/compare/v3.1.0...v3.1.1) (2024-02-15)


### Bug Fixes

* fix: cast message to string in vertexai model ([86947a2](https://github.com/Arize-ai/phoenix/commit/86947a2e1a761e3419f721be4d25f11658faa735))


### Documentation

* Add bedrock instrumentation notebook ([#2285](https://github.com/Arize-ai/phoenix/issues/2285)) ([6294e36](https://github.com/Arize-ai/phoenix/commit/6294e363891f8f629e7448990490f0b6f56c02f2))

## [3.1.0](https://github.com/Arize-ai/phoenix/compare/v3.0.3...v3.1.0) (2024-02-15)


### Features

* filter spans by metadata values ([#2268](https://github.com/Arize-ai/phoenix/issues/2268)) ([1541b73](https://github.com/Arize-ai/phoenix/commit/1541b73753c2eddb2f28993b16881b793342dea2))


### Bug Fixes

* set global session to None if it fails to start ([#2286](https://github.com/Arize-ai/phoenix/issues/2286)) ([6752fd2](https://github.com/Arize-ai/phoenix/commit/6752fd223410c33a2aae707b3b74222d4140de93))
* **trace:** Make dataset IDs unique by instance for TraceDataset ([#2254](https://github.com/Arize-ai/phoenix/issues/2254)) ([1ac170f](https://github.com/Arize-ai/phoenix/commit/1ac170fcf3debe3de2a9647b67112d4004a71e91))


### Documentation

* **trace:** refactor llama-index tutorials to use 0.10.0 ([#2277](https://github.com/Arize-ai/phoenix/issues/2277)) ([055b8d6](https://github.com/Arize-ai/phoenix/commit/055b8d6d4d49e1d1e434aba8f638e1c40c4af562))

## [3.0.3](https://github.com/Arize-ai/phoenix/compare/v3.0.2...v3.0.3) (2024-02-13)


### Bug Fixes

* **trace:** perform library version compatibility on llama_index ([#2272](https://github.com/Arize-ai/phoenix/issues/2272)) ([89bc510](https://github.com/Arize-ai/phoenix/commit/89bc510b66a92a7df85150a6aa3856b4f3818e5e))

## [3.0.2](https://github.com/Arize-ai/phoenix/compare/v3.0.1...v3.0.2) (2024-02-13)


### Bug Fixes

* `run_evals` correctly falls back to default responses on error ([#2233](https://github.com/Arize-ai/phoenix/issues/2233)) ([4b2bd39](https://github.com/Arize-ai/phoenix/commit/4b2bd3989ab5ed34feb536342fda4ca412c51ade))

## [3.0.1](https://github.com/Arize-ai/phoenix/compare/v3.0.0...v3.0.1) (2024-02-09)


### Bug Fixes

* handle ndarray during ingestion ([#2262](https://github.com/Arize-ai/phoenix/issues/2262)) ([80114fb](https://github.com/Arize-ai/phoenix/commit/80114fb2c3c9f71973236b920b0284aeeb9e7129))
* working_dir ([#2257](https://github.com/Arize-ai/phoenix/issues/2257)) ([d0f617f](https://github.com/Arize-ai/phoenix/commit/d0f617f3f7e0094667179e77dd5a07c416db9ea7))

## [3.0.0](https://github.com/Arize-ai/phoenix/compare/v2.11.1...v3.0.0) (2024-02-09)


### ⚠ BREAKING CHANGES

* replace Phoenix tracers with OpenInference instrumentors ([#2190](https://github.com/Arize-ai/phoenix/issues/2190))

### Features

* replace Phoenix tracers with OpenInference instrumentors ([#2190](https://github.com/Arize-ai/phoenix/issues/2190)) ([b983c70](https://github.com/Arize-ai/phoenix/commit/b983c709ddc6f99239a33516e5ac8b59c3f7f833))

## [2.11.1](https://github.com/Arize-ai/phoenix/compare/v2.11.0...v2.11.1) (2024-02-09)


### Bug Fixes

* **ui:** add last_hour, fix end of hour rounding ([#2247](https://github.com/Arize-ai/phoenix/issues/2247)) ([aa4efaf](https://github.com/Arize-ai/phoenix/commit/aa4efaff57ae09b87e7d350994c2ead862b5fa7a))

## [2.11.0](https://github.com/Arize-ai/phoenix/compare/v2.10.0...v2.11.0) (2024-02-08)


### Features

* **ui:** add hour time range ([#2244](https://github.com/Arize-ai/phoenix/issues/2244)) ([2e22518](https://github.com/Arize-ai/phoenix/commit/2e22518c57c4a405b16fb6de00297931925e43c4))


### Bug Fixes

* **evals:** properly use kw args for models in notebooks ([#2235](https://github.com/Arize-ai/phoenix/issues/2235)) ([7bd59d5](https://github.com/Arize-ai/phoenix/commit/7bd59d5bab1ce992793e73cd2c223f47f88067c5))

## [2.10.0](https://github.com/Arize-ai/phoenix/compare/v2.9.4...v2.10.0) (2024-02-07)


### Features

* **embeddings:** add search by text and ID on selection ([#2219](https://github.com/Arize-ai/phoenix/issues/2219)) ([99c480c](https://github.com/Arize-ai/phoenix/commit/99c480c46b32ec78d28c93fe793b48a94fc3ebfa))


### Bug Fixes

* endpoint for client inside ProcessSession ([#2211](https://github.com/Arize-ai/phoenix/issues/2211)) ([82e279e](https://github.com/Arize-ai/phoenix/commit/82e279ed85b9f963f4d6dd86f3a0d89ed085635d))
* **trace:** return to /tracing url when dismissing trace slide over ([#2222](https://github.com/Arize-ai/phoenix/issues/2222)) ([ee4ced3](https://github.com/Arize-ai/phoenix/commit/ee4ced3a8e4414c79859eec4e638dbac96d015bb))
* **traces:** warn if collector endpoint is set but launch app is called ([#2209](https://github.com/Arize-ai/phoenix/issues/2209)) ([eb97b8d](https://github.com/Arize-ai/phoenix/commit/eb97b8d04da2f1728906862318caa1ea8df4933b))


### Documentation

* custom instrumentation (GITBOOK-495) ([3310ba6](https://github.com/Arize-ai/phoenix/commit/3310ba66e74be2cf9bff5966a6359c9632590d90))
* update px.Client (GITBOOK-494) ([61b427c](https://github.com/Arize-ai/phoenix/commit/61b427c157066b1c18f262b268a711a7cba91414))

## [2.9.4](https://github.com/Arize-ai/phoenix/compare/v2.9.3...v2.9.4) (2024-02-06)


### Bug Fixes

* disregard active session if endpoint is provided to px.Client ([#2206](https://github.com/Arize-ai/phoenix/issues/2206)) ([6ec0d23](https://github.com/Arize-ai/phoenix/commit/6ec0d2344ffb7f40534730160f10d99f266788da))

## [2.9.3](https://github.com/Arize-ai/phoenix/compare/v2.9.2...v2.9.3) (2024-02-05)


### Bug Fixes

* absolute path for eval exporter ([#2202](https://github.com/Arize-ai/phoenix/issues/2202)) ([2ac39e9](https://github.com/Arize-ai/phoenix/commit/2ac39e93de3f437c5cf3f092bd6de437d75337ce))

## [2.9.2](https://github.com/Arize-ai/phoenix/compare/v2.9.1...v2.9.2) (2024-02-05)


### Bug Fixes

* localhost address for px.Client ([#2200](https://github.com/Arize-ai/phoenix/issues/2200)) ([e56b66a](https://github.com/Arize-ai/phoenix/commit/e56b66adea734693a82f49b415e093a07a9f0ff1))

## [2.9.1](https://github.com/Arize-ai/phoenix/compare/v2.9.0...v2.9.1) (2024-02-05)


### Bug Fixes

* absolute path for urljoin in px.Client ([#2199](https://github.com/Arize-ai/phoenix/issues/2199)) ([ba30a30](https://github.com/Arize-ai/phoenix/commit/ba30a30d1312af042b81b631b5d0b6cc0e14d411))


### Documentation

* update readme with a deployment guide ([#2194](https://github.com/Arize-ai/phoenix/issues/2194)) ([bf67775](https://github.com/Arize-ai/phoenix/commit/bf6777569c764392d72d4ccf3c71738079957901))

## [2.9.0](https://github.com/Arize-ai/phoenix/compare/v2.8.0...v2.9.0) (2024-02-05)


### Features

* phoenix client `get_evaluations()` and `get_trace_dataset()` ([#2154](https://github.com/Arize-ai/phoenix/issues/2154)) ([29800e4](https://github.com/Arize-ai/phoenix/commit/29800e4ed4a901ad19874ba049638e13d8c67b87))
* phoenix client `get_spans_dataframe()` and `query_spans()` ([#2151](https://github.com/Arize-ai/phoenix/issues/2151)) ([e44b948](https://github.com/Arize-ai/phoenix/commit/e44b948301b28b22d5f578de686dc29c1cf84ad0))

## [2.8.0](https://github.com/Arize-ai/phoenix/compare/v2.7.0...v2.8.0) (2024-02-02)


### Features

* Remove model-level tenacity retries ([#2176](https://github.com/Arize-ai/phoenix/issues/2176)) ([66d452c](https://github.com/Arize-ai/phoenix/commit/66d452c45a676ee5dbac43b25df43df32bdb71bc))


### Bug Fixes

* broken link and openinference links ([#2144](https://github.com/Arize-ai/phoenix/issues/2144)) ([01fb046](https://github.com/Arize-ai/phoenix/commit/01fb0464d023e1494c22f80b10ed840eef47fce8))
* databricks check crashes in python console ([#2152](https://github.com/Arize-ai/phoenix/issues/2152)) ([5aeeeff](https://github.com/Arize-ai/phoenix/commit/5aeeeff9fa8c2d697374686552b35127238dce44))
* default collector endpoint breaks on windows ([#2161](https://github.com/Arize-ai/phoenix/issues/2161)) ([f1a2007](https://github.com/Arize-ai/phoenix/commit/f1a200713c44ffcf2506ff54429715ef7171ecd1))
* Do not retry when context window has been exceeded ([#2126](https://github.com/Arize-ai/phoenix/issues/2126)) ([ff6df1f](https://github.com/Arize-ai/phoenix/commit/ff6df1fc01f0986357a9e20e0441a3c15697a5fa))
* remove hyphens from span_id in legacy evaluation fixtures ([#2153](https://github.com/Arize-ai/phoenix/issues/2153)) ([fae859d](https://github.com/Arize-ai/phoenix/commit/fae859d8831669f92a368e979caa81a778948432))


### Documentation

* add docker badge ([e584ed8](https://github.com/Arize-ai/phoenix/commit/e584ed87960eba61c0e5165e3c0d08cf0d11e672))
* Add terminal running steps (GITBOOK-441) ([91c6b24](https://github.com/Arize-ai/phoenix/commit/91c6b24b411bd2d447c7c2c4453bb57320bff325))
* No subject (GITBOOK-442) ([5c4eb6c](https://github.com/Arize-ai/phoenix/commit/5c4eb6c93a284e06907582b3b80dc70cbfd3d0e6))
* No subject (GITBOOK-443) ([11f46cb](https://github.com/Arize-ai/phoenix/commit/11f46cbbb442dbbbc7d84779915ecc537461b80c))
* No subject (GITBOOK-444) ([fcf2bc9](https://github.com/Arize-ai/phoenix/commit/fcf2bc927c24cfb7cba3eda8e7589f59af2dfcf1))
* update badge ([ddcecea](https://github.com/Arize-ai/phoenix/commit/ddcecea23bc9998f361f3cb41427688f84314295))
* update prompt to reflect rails (GITBOOK-445) ([dea6dd6](https://github.com/Arize-ai/phoenix/commit/dea6dd6ce2f179cf200eaef5f77ba958140355a2))


### Miscellaneous Chores

* change release to 2.8.0 ([#2181](https://github.com/Arize-ai/phoenix/issues/2181)) ([0b7b524](https://github.com/Arize-ai/phoenix/commit/0b7b524d8cbd05bf1f8652a648145ed94d72af90))

## [2.7.0](https://github.com/Arize-ai/phoenix/compare/v2.6.0...v2.7.0) (2024-01-24)


### Features

* **persistence:** add a PHOENIX_WORKING_DIR env var for setting up a… ([#2121](https://github.com/Arize-ai/phoenix/issues/2121)) ([5fbb2e6](https://github.com/Arize-ai/phoenix/commit/5fbb2e6d39dfe8041e3067531841e720e85829ae))

## [2.6.0](https://github.com/Arize-ai/phoenix/compare/v2.5.0...v2.6.0) (2024-01-23)


### Features

* add ability to save and load TraceDatasets ([#2082](https://github.com/Arize-ai/phoenix/issues/2082)) ([60c5e5e](https://github.com/Arize-ai/phoenix/commit/60c5e5e1012680d62b1d439aaa822dd067578474))
* add get_trace_dataset method to session ([#2107](https://github.com/Arize-ai/phoenix/issues/2107)) ([9754b60](https://github.com/Arize-ai/phoenix/commit/9754b604af7ee8914333f6a59cabbeaf79f9eadf))
* **evals:** Gpt 4 turbo context window size ([#2112](https://github.com/Arize-ai/phoenix/issues/2112)) ([389c1a0](https://github.com/Arize-ai/phoenix/commit/389c1a008885f061955ac8b9288d125e881a0d11))
* launch phoenix with evaluations ([#2095](https://github.com/Arize-ai/phoenix/issues/2095)) ([9656d0c](https://github.com/Arize-ai/phoenix/commit/9656d0cc41bb995f2dfa35477ccf6569104da0c8))
* support eval exports for session ([#2094](https://github.com/Arize-ai/phoenix/issues/2094)) ([8757fa8](https://github.com/Arize-ai/phoenix/commit/8757fa899428e13991acedb4beb77aadfaf42ea0))


### Bug Fixes

* Clean up vertex clients after event loop closure ([#2102](https://github.com/Arize-ai/phoenix/issues/2102)) ([202c7ea](https://github.com/Arize-ai/phoenix/commit/202c7eadf79acd40505885d891a02eb9331ff1e4))
* Determine default async concurrency on a per-model basis ([#2096](https://github.com/Arize-ai/phoenix/issues/2096)) ([b44d8aa](https://github.com/Arize-ai/phoenix/commit/b44d8aa8de6854632f241000be244c43a26ed85e))
* Resolves Bedrock model compatibility issues ([#2114](https://github.com/Arize-ai/phoenix/issues/2114)) ([c4a5343](https://github.com/Arize-ai/phoenix/commit/c4a534351eca3eec9b02911ea5558ef2b47ea8a7))
* show localhost when the notebook is running locally ([#2090](https://github.com/Arize-ai/phoenix/issues/2090)) ([095298d](https://github.com/Arize-ai/phoenix/commit/095298d88bc44b28928b44b2b593eca9d54e843b))


### Documentation

* **evals:** update RAG evaluations notebook ([#2092](https://github.com/Arize-ai/phoenix/issues/2092)) ([9ad797a](https://github.com/Arize-ai/phoenix/commit/9ad797ab8d2b726088c5bdb6e104e7bc1faf8509))
* **evals:** update ragas integration notebook ([#2100](https://github.com/Arize-ai/phoenix/issues/2100)) ([66fb048](https://github.com/Arize-ai/phoenix/commit/66fb0480a886bd92246d2bffedd32c66a33946ce))

## [2.5.0](https://github.com/Arize-ai/phoenix/compare/v2.4.1...v2.5.0) (2024-01-16)


### Features

* **app:** databricks notebook support ([#2086](https://github.com/Arize-ai/phoenix/issues/2086)) ([b517480](https://github.com/Arize-ai/phoenix/commit/b517480e18d5e5d4c10d237cf13aff7546aa6529))


### Bug Fixes

* Adjust evaluation templates and rails for Gemini compatibility ([#2075](https://github.com/Arize-ai/phoenix/issues/2075)) ([3a7bfd2](https://github.com/Arize-ai/phoenix/commit/3a7bfd2158b5c0ea995f4d1ec00a6f7b2c4a21e8))

## [2.4.1](https://github.com/Arize-ai/phoenix/compare/v2.4.0...v2.4.1) (2024-01-11)


### Bug Fixes

* **traces:** prevent missing key exception when extracting invocation parameters in llama-index ([#2076](https://github.com/Arize-ai/phoenix/issues/2076)) ([5cc9560](https://github.com/Arize-ai/phoenix/commit/5cc956057f01613ebd08b0247d773c74b24a5aa3))

## [2.4.0](https://github.com/Arize-ai/phoenix/compare/v2.3.0...v2.4.0) (2024-01-10)


### Features

* add persistence for span evaluations ([#2021](https://github.com/Arize-ai/phoenix/issues/2021)) ([589d482](https://github.com/Arize-ai/phoenix/commit/589d482419b1119edfae24f837fd17d57612835f))
* **ui:** add filter condition snippets ([#2049](https://github.com/Arize-ai/phoenix/issues/2049)) ([567fa54](https://github.com/Arize-ai/phoenix/commit/567fa5499a4584e03bf1695caea3179778d27889))


### Bug Fixes

* Handle missing vertex candidates ([#2055](https://github.com/Arize-ai/phoenix/issues/2055)) ([1d0475a](https://github.com/Arize-ai/phoenix/commit/1d0475afa4974eb9590c70334961996f99e6d856))
* OpenAI clients are not cleaned up after calls to `llm_classify` ([#2068](https://github.com/Arize-ai/phoenix/issues/2068)) ([3233d56](https://github.com/Arize-ai/phoenix/commit/3233d561783556ef8799e65fe1335da52d161a12))
* **traces:** remove nan from log_evaluations ([#2056](https://github.com/Arize-ai/phoenix/issues/2056)) ([df9ed5c](https://github.com/Arize-ai/phoenix/commit/df9ed5cfd68da1e42d52b01aa9f85d68698c3b64))


### Documentation

* tracing notebook updates ([#2053](https://github.com/Arize-ai/phoenix/issues/2053)) ([a1e5323](https://github.com/Arize-ai/phoenix/commit/a1e53238e03e8ade931084633f29e55dc1f8dd08))

## [2.3.0](https://github.com/Arize-ai/phoenix/compare/v2.2.1...v2.3.0) (2024-01-08)


### Features

* evaluator enhancements ([#2045](https://github.com/Arize-ai/phoenix/issues/2045)) ([1cc9c0a](https://github.com/Arize-ai/phoenix/commit/1cc9c0a7a32c5896ff8a83fe25defaeb01fd9bf2))


### Bug Fixes

* Remove LiteLLM model support check ([#2046](https://github.com/Arize-ai/phoenix/issues/2046)) ([45d3fe6](https://github.com/Arize-ai/phoenix/commit/45d3fe6e1a2aaf931eb783aaca68525579215386))


### Documentation

* Add demo link, examples getting started (GITBOOK-396) ([e987315](https://github.com/Arize-ai/phoenix/commit/e987315ab35550350921257aa3e38f5cb6796f3f))
* Add Evaluating Traces Section (GITBOOK-386) ([7d72029](https://github.com/Arize-ai/phoenix/commit/7d720293cc30e0021596c427081e3b6bef4b7f5b))
* Add evaluations section for results (GITBOOK-387) ([2e74be0](https://github.com/Arize-ai/phoenix/commit/2e74be0a70a63ddfd6e42d84042f51fc9894f1cb))
* Add final thoughts to evaluation (GITBOOK-405) ([20eab16](https://github.com/Arize-ai/phoenix/commit/20eab16c2dc99b3c6defd497120ee2472eb97ff1))
* add import statement (GITBOOK-408) ([23247d7](https://github.com/Arize-ai/phoenix/commit/23247d755bad33b618e683687dd297e95274939c))
* add link (GITBOOK-403) ([0be280a](https://github.com/Arize-ai/phoenix/commit/0be280a974e7b8e88904c35285b149cde2369804))
* eval concepts typo (GITBOOK-394) ([7c80d4b](https://github.com/Arize-ai/phoenix/commit/7c80d4b3a151ee3a9b1937d04b7362ab2dba3697))
* eval concepts typos (GITBOOK-393) ([62bc99f](https://github.com/Arize-ai/phoenix/commit/62bc99f9e4d729e3bd911f346ce58bf44141c30f))
* evaluation concepts typo fix (GITBOOK-390) ([2cbc1dc](https://github.com/Arize-ai/phoenix/commit/2cbc1dcce6ac781d71fbf3107e6af74121be018e))
* Extract Data from Spans (GITBOOK-383) ([440f530](https://github.com/Arize-ai/phoenix/commit/440f530e35c13c7be1f69a05b0819afec094c5ed))
* fix broken section link (GITBOOK-409) ([fee537b](https://github.com/Arize-ai/phoenix/commit/fee537b9ede6a8d7899744b834a46066f7f8837d))
* fix typos (GITBOOK-391) ([c8f5a55](https://github.com/Arize-ai/phoenix/commit/c8f5a55d11669b3837c32cdbc10f99388f63276e))
* fix typos (GITBOOK-402) ([3cd973d](https://github.com/Arize-ai/phoenix/commit/3cd973d8b0348bb580455f093cc36f58deecf1b9))
* fix typos (GITBOOK-406) ([eaa9bea](https://github.com/Arize-ai/phoenix/commit/eaa9beac66cd72ad99ab5a8bc2aec95e2a4a0e7f))
* fix typos (GITBOOK-407) ([cad4820](https://github.com/Arize-ai/phoenix/commit/cad4820c085c7799adcf8d72b4209440b37fcbb9))
* Initial draft of evaluation core concept (GITBOOK-385) ([67369cf](https://github.com/Arize-ai/phoenix/commit/67369cf34e5eaddf30e0e3093f163483643f14bb))
* Log Evaluations (GITBOOK-389) ([369d79d](https://github.com/Arize-ai/phoenix/commit/369d79d479b4b094dbeeef8715b6127babb1a48c))
* No subject (GITBOOK-399) ([94df884](https://github.com/Arize-ai/phoenix/commit/94df884aa6f7ee98610026d827d48b57c0ba032b))
* Re-arrange nav (GITBOOK-398) ([54a87eb](https://github.com/Arize-ai/phoenix/commit/54a87eb598c1eb01576a4e5baf3ddfa1f67322e8))
* Remove the word golden, simplify title (GITBOOK-395) ([a2233b2](https://github.com/Arize-ai/phoenix/commit/a2233b26b648466f60565c09286f8650823cf97f))
* simplify conceps (GITBOOK-384) ([c38f6c2](https://github.com/Arize-ai/phoenix/commit/c38f6c2cc1b47dfadd881e2ad9923f3d559aff27))
* Simplify examples page (GITBOOK-400) ([6144158](https://github.com/Arize-ai/phoenix/commit/614415882527801ea23fb05eec7e01e12a190807))
* Trace Evaluations Section (GITBOOK-388) ([2ffa800](https://github.com/Arize-ai/phoenix/commit/2ffa8002d3a3a58a6f2b5e387129cd04f127baca))
* Update SECURITY.md ([#2029](https://github.com/Arize-ai/phoenix/issues/2029)) ([363e891](https://github.com/Arize-ai/phoenix/commit/363e8913a3a0f7dafca5dc6bba6bf0e9776c1158))

## [2.2.1](https://github.com/Arize-ai/phoenix/compare/v2.2.0...v2.2.1) (2023-12-28)


### Bug Fixes

* Do not retry if eval was successful when using SyncExecutor ([#2016](https://github.com/Arize-ai/phoenix/issues/2016)) ([a869190](https://github.com/Arize-ai/phoenix/commit/a8691905e16fe1c8c6483d837399e8c499ce71cf))
* ensure float values are properly encoded by otel tracer ([#2024](https://github.com/Arize-ai/phoenix/issues/2024)) ([b12a894](https://github.com/Arize-ai/phoenix/commit/b12a89496468063e2cd6a99e1ea08d49af5c6ba1))
* ensure llamaindex spans are correctly encoded ([#2023](https://github.com/Arize-ai/phoenix/issues/2023)) ([3ca6262](https://github.com/Arize-ai/phoenix/commit/3ca6262ad38c13b63dc2cde84e1a97a76ba1c323))
* Use separate versioning file ([#2020](https://github.com/Arize-ai/phoenix/issues/2020)) ([f38eedf](https://github.com/Arize-ai/phoenix/commit/f38eedfbd57da6e9512f9aa9fcc5c97232b2bb6e))

## [2.2.0](https://github.com/Arize-ai/phoenix/compare/v2.1.0...v2.2.0) (2023-12-22)


### Features

* Add support for Google's Gemini models via Vertex python sdk ([#2008](https://github.com/Arize-ai/phoenix/issues/2008)) ([caf826c](https://github.com/Arize-ai/phoenix/commit/caf826c8ced9f8840d3150f7d466bdc2295d2054))
* Support first-party Anthropic python SDK ([#2004](https://github.com/Arize-ai/phoenix/issues/2004)) ([a323283](https://github.com/Arize-ai/phoenix/commit/a323283021372bd3b7c95b435a8bef347e12028f))

## [2.1.0](https://github.com/Arize-ai/phoenix/compare/v2.0.0...v2.1.0) (2023-12-21)


### Features

* instantiate evaluators by criteria ([#1983](https://github.com/Arize-ai/phoenix/issues/1983)) ([9c72616](https://github.com/Arize-ai/phoenix/commit/9c72616aee88116c0194937d136bf3a74817132b))
* support function calling for run_evals ([#1978](https://github.com/Arize-ai/phoenix/issues/1978)) ([8be325c](https://github.com/Arize-ai/phoenix/commit/8be325cef3d48ce98f8c27c29dc46a42516ab970))
* **traces:** add `v1/traces` HTTP endpoint to handle `ExportTraceServiceRequest` ([3c94dea](https://github.com/Arize-ai/phoenix/commit/3c94dea6f5986c7b1658462d4700d21df56f72f6))
* **traces:** add `v1/traces` HTTP endpoint to handle `ExportTraceServiceRequest` ([#1968](https://github.com/Arize-ai/phoenix/issues/1968)) ([3c94dea](https://github.com/Arize-ai/phoenix/commit/3c94dea6f5986c7b1658462d4700d21df56f72f6))
* **traces:** add retrieval summary to header ([#2006](https://github.com/Arize-ai/phoenix/issues/2006)) ([8af0582](https://github.com/Arize-ai/phoenix/commit/8af0582c8c5cb19fe6bd84408f3d8ef26480c19e))
* **traces:** evaluation summary on the header ([#2000](https://github.com/Arize-ai/phoenix/issues/2000)) ([965beb0](https://github.com/Arize-ai/phoenix/commit/965beb00c223b405cd8c56c6a58d15beb391af78))


### Bug Fixes

* make alert icon for exceptions visible ([#2001](https://github.com/Arize-ai/phoenix/issues/2001)) ([e7a6567](https://github.com/Arize-ai/phoenix/commit/e7a6567f813149e4e7952f4b80183f39ea7cc15f))

## [2.0.0](https://github.com/Arize-ai/phoenix/compare/v1.9.0...v2.0.0) (2023-12-20)


### ⚠ BREAKING CHANGES

* Update `llm_classify` and `llm_generate` interfaces ([#1974](https://github.com/Arize-ai/phoenix/issues/1974))

### Features

* Add async submission to `llm_generate` ([#1965](https://github.com/Arize-ai/phoenix/issues/1965)) ([5999133](https://github.com/Arize-ai/phoenix/commit/59991331c93d4f994f00745124b73602d84cc95d))
* add support for explanations to run_evals ([#1975](https://github.com/Arize-ai/phoenix/issues/1975)) ([5143529](https://github.com/Arize-ai/phoenix/commit/51435297538c83542f7df6ba5860a50ef71307cf))
* evaluation column selectors ([#1932](https://github.com/Arize-ai/phoenix/issues/1932)) ([ed07809](https://github.com/Arize-ai/phoenix/commit/ed07809910e8b97387ef0729d843677e7e8c68a7))
* openai streaming tool calls ([#1936](https://github.com/Arize-ai/phoenix/issues/1936)) ([6dd14cf](https://github.com/Arize-ai/phoenix/commit/6dd14cf21acb12b599107619d0b7f4b0cdc55f4c))
* support running multiple evals at once ([#1742](https://github.com/Arize-ai/phoenix/issues/1742)) ([79d4473](https://github.com/Arize-ai/phoenix/commit/79d44739ba75b980967440a91850c9bed01ceb99))
* Update `llm_classify` and `llm_generate` interfaces ([#1974](https://github.com/Arize-ai/phoenix/issues/1974)) ([9fd35a1](https://github.com/Arize-ai/phoenix/commit/9fd35a11399c2d1aba1be40592cac0e31fff2d80))


### Bug Fixes

* Add lock failsafe ([#1956](https://github.com/Arize-ai/phoenix/issues/1956)) ([9ddbd9c](https://github.com/Arize-ai/phoenix/commit/9ddbd9caa4a66ae47c5447aa4dafa46cc9c5cfa5))
* llama-index extra ([#1958](https://github.com/Arize-ai/phoenix/issues/1958)) ([d9b68eb](https://github.com/Arize-ai/phoenix/commit/d9b68eb2e8f3422a491dc8a0981dd474d84d6260))
* LlamaIndex compatibility fix ([#1940](https://github.com/Arize-ai/phoenix/issues/1940)) ([052349d](https://github.com/Arize-ai/phoenix/commit/052349d594fa2d25b827f5318e0b438f33bf165c))
* Model stability enhancements ([#1939](https://github.com/Arize-ai/phoenix/issues/1939)) ([dca42e0](https://github.com/Arize-ai/phoenix/commit/dca42e026acc079f0523158d10e2149b01136600))
* **traces:** span summary root span filter ([#1981](https://github.com/Arize-ai/phoenix/issues/1981)) ([d286f07](https://github.com/Arize-ai/phoenix/commit/d286f077e8493c98a795ae83066e8c1c43a5291f))


### Documentation

* Add anyscale tutorial ([#1941](https://github.com/Arize-ai/phoenix/issues/1941)) ([e47c8d0](https://github.com/Arize-ai/phoenix/commit/e47c8d0be941f82ac13c5686fe75622cb59974ab))
* autogen link ([#1946](https://github.com/Arize-ai/phoenix/issues/1946)) ([c3fb4ce](https://github.com/Arize-ai/phoenix/commit/c3fb4ce80005c41201824114400abcdf007574c0))
* Clear anyscale tutorial outputs ([#1942](https://github.com/Arize-ai/phoenix/issues/1942)) ([63580a6](https://github.com/Arize-ai/phoenix/commit/63580a6bde204247953a920e8ca13209bd1d7f0b))
* RAG Evaluation (GITBOOK-378) ([429f537](https://github.com/Arize-ai/phoenix/commit/429f537ee034639dc66c4c80b455b22c65a2e7bd))
* sync ([#1947](https://github.com/Arize-ai/phoenix/issues/1947)) ([c72bbac](https://github.com/Arize-ai/phoenix/commit/c72bbacfbe23aba03167e58077e7b51bc2cde2e2))
* **traces:** autogen tracing tutorial ([#1945](https://github.com/Arize-ai/phoenix/issues/1945)) ([0fd02ff](https://github.com/Arize-ai/phoenix/commit/0fd02ff4548342123f349f3e0b0957eac73d676c))
* update rag eval notebook ([#1950](https://github.com/Arize-ai/phoenix/issues/1950)) ([d06b8b7](https://github.com/Arize-ai/phoenix/commit/d06b8b7cc68b9e0bcb9728cafd68e10b36b4d83e))
* update rag evals docs ([#1954](https://github.com/Arize-ai/phoenix/issues/1954)) ([aa6f36a](https://github.com/Arize-ai/phoenix/commit/aa6f36a3a5329b64fcb8f94d146ec33f5255a6eb))
* Using phoenix with HuggingFace LLMs- getting started ([#1916](https://github.com/Arize-ai/phoenix/issues/1916)) ([b446972](https://github.com/Arize-ai/phoenix/commit/b44697268a1e9599a4a155b9f0e283bb1a9ad349))

## [1.9.0](https://github.com/Arize-ai/phoenix/compare/v1.8.0...v1.9.0) (2023-12-11)


### Features

* Add retries to Bedrock ([#1927](https://github.com/Arize-ai/phoenix/issues/1927)) ([2728c3e](https://github.com/Arize-ai/phoenix/commit/2728c3e75927ca34e05c83336b3a8e9f5476466e))


### Documentation

* Add LLM Tracing+Evals notebook with keyless example ([#1928](https://github.com/Arize-ai/phoenix/issues/1928)) ([4c4aac6](https://github.com/Arize-ai/phoenix/commit/4c4aac6425af851b68f52d537813a8a1293a2a4b))

## [1.8.0](https://github.com/Arize-ai/phoenix/compare/v1.7.0...v1.8.0) (2023-12-10)


### Features

* **embeddings:** audio support ([#1920](https://github.com/Arize-ai/phoenix/issues/1920)) ([61cc550](https://github.com/Arize-ai/phoenix/commit/61cc55074c7381746886131c19e06d92a33f8489))
* openai streaming function call message support ([#1914](https://github.com/Arize-ai/phoenix/issues/1914)) ([25279ca](https://github.com/Arize-ai/phoenix/commit/25279ca563a81e438b7bbc3fd897d13ecca67b60))

## [1.7.0](https://github.com/Arize-ai/phoenix/compare/v1.6.0...v1.7.0) (2023-12-09)


### Features

* Instrument LlamaIndex streaming responses ([#1901](https://github.com/Arize-ai/phoenix/issues/1901)) ([f46396e](https://github.com/Arize-ai/phoenix/commit/f46396e04976475220092249a4e83f252d319630))
* openai async streaming instrumentation ([#1900](https://github.com/Arize-ai/phoenix/issues/1900)) ([06d643b](https://github.com/Arize-ai/phoenix/commit/06d643b7c7255b79c7a7e4ea587b4e445122ac37))
* **traces:** query spans into dataframes ([#1910](https://github.com/Arize-ai/phoenix/issues/1910)) ([6b51435](https://github.com/Arize-ai/phoenix/commit/6b5143535cf4ad3d0149fb68234043d47debaa15))


### Bug Fixes

* **traces:** span evaluations missing from the header ([#1908](https://github.com/Arize-ai/phoenix/issues/1908)) ([5ace81e](https://github.com/Arize-ai/phoenix/commit/5ace81e1a99afc72b6baf6464f1c21eea05eecdd))

## [1.6.0](https://github.com/Arize-ai/phoenix/compare/v1.5.1...v1.6.0) (2023-12-08)


### Features

* openai streaming spans show up in the ui ([#1888](https://github.com/Arize-ai/phoenix/issues/1888)) ([ffa1d41](https://github.com/Arize-ai/phoenix/commit/ffa1d41e633b6fee4978a9b705fa10bf4b5fe137))
* support instrumentation for openai synchronous streaming ([#1879](https://github.com/Arize-ai/phoenix/issues/1879)) ([b6e8c73](https://github.com/Arize-ai/phoenix/commit/b6e8c732926ea112775e9541173a9bdb29482d8d))
* **traces:** display document retrieval metrics on trace details ([#1902](https://github.com/Arize-ai/phoenix/issues/1902)) ([0c35229](https://github.com/Arize-ai/phoenix/commit/0c352297b3cef838651e69a05ae5357cbdbd61a5))
* **traces:** filterable span and document evaluation summaries ([#1880](https://github.com/Arize-ai/phoenix/issues/1880)) ([f90919c](https://github.com/Arize-ai/phoenix/commit/f90919c6162ce6bba3b12c5bba92b31f31128739))
* **traces:** graphql query for document evaluation summary ([#1874](https://github.com/Arize-ai/phoenix/issues/1874)) ([8a6a063](https://github.com/Arize-ai/phoenix/commit/8a6a06326e42f58018e030e0d854847d6fe6f10b))


### Documentation

* llm ops overview notebook ([#1882](https://github.com/Arize-ai/phoenix/issues/1882)) ([5d15c3c](https://github.com/Arize-ai/phoenix/commit/5d15c3c665583848624882e6d67979148673fca6))

## [1.5.1](https://github.com/Arize-ai/phoenix/compare/v1.5.0...v1.5.1) (2023-12-06)


### Bug Fixes

* Improve rate limiter behavior ([#1855](https://github.com/Arize-ai/phoenix/issues/1855)) ([2530569](https://github.com/Arize-ai/phoenix/commit/25305699c639d4c556c413e27a4c13378a548a77))

## [1.5.0](https://github.com/Arize-ai/phoenix/compare/v1.4.0...v1.5.0) (2023-12-06)


### Features

* **evals:** Human vs AI Evals ([#1850](https://github.com/Arize-ai/phoenix/issues/1850)) ([e96bd27](https://github.com/Arize-ai/phoenix/commit/e96bd27ed626a23187a92ddb34720a07ee689ad1))
* semantic conventions for `tool_calls` array in OpenAI ChatCompletion messages ([#1837](https://github.com/Arize-ai/phoenix/issues/1837)) ([c079f00](https://github.com/Arize-ai/phoenix/commit/c079f00fd731e281671bace9ef4b68d4cbdcc584))
* support asynchronous chat completions for openai instrumentation ([#1849](https://github.com/Arize-ai/phoenix/issues/1849)) ([f066e10](https://github.com/Arize-ai/phoenix/commit/f066e108c07c95502ba77b11fcb37fe3e5e5ed72))
* **traces:** document retrieval metrics based on document evaluation scores ([#1826](https://github.com/Arize-ai/phoenix/issues/1826)) ([3dfb7bd](https://github.com/Arize-ai/phoenix/commit/3dfb7bdfba3eb61e57dba503efcc761511479a90))
* **traces:** document retrieval metrics on trace / span tables ([#1873](https://github.com/Arize-ai/phoenix/issues/1873)) ([733d233](https://github.com/Arize-ai/phoenix/commit/733d2339ec3ffabc9ac83454fb6540adfefe1526))
* **traces:** evaluation annotations on traces for associating spans with eval metrics ([#1693](https://github.com/Arize-ai/phoenix/issues/1693)) ([a218a65](https://github.com/Arize-ai/phoenix/commit/a218a650cefa8925ed7b6627c121454bfc94ec0d))
* **traces:** server-side span filter by evaluation result values ([#1858](https://github.com/Arize-ai/phoenix/issues/1858)) ([6b05f96](https://github.com/Arize-ai/phoenix/commit/6b05f96fa7fc328414daf3caaed7d807e018763a))
* **traces:** span evaluation summary (aggregation metrics of scores and labels) ([#1846](https://github.com/Arize-ai/phoenix/issues/1846)) ([5c5c3d6](https://github.com/Arize-ai/phoenix/commit/5c5c3d69021fa21ce73a0d297107d5bf14fe4c98))


### Bug Fixes

* allow streaming response to be iterated by user ([#1862](https://github.com/Arize-ai/phoenix/issues/1862)) ([76a2443](https://github.com/Arize-ai/phoenix/commit/76a24436d7f2d1cb56ac77fb8486b4296f65a615))
* trace dataset to disc ([#1798](https://github.com/Arize-ai/phoenix/issues/1798)) ([278d344](https://github.com/Arize-ai/phoenix/commit/278d344434d43d5d05cc66abfcb9646b0ac2fb6d))


### Documentation

* RAG evaluation notebook using traces ([#1857](https://github.com/Arize-ai/phoenix/issues/1857)) ([4b67805](https://github.com/Arize-ai/phoenix/commit/4b67805931b059635997326de596d46a0bad1b76))
* Retrieval Chunks (GITBOOK-372) ([39976d3](https://github.com/Arize-ai/phoenix/commit/39976d3f020bfaaf0929f3bc8cbedb65d5aae010))

## [1.4.0](https://github.com/Arize-ai/phoenix/compare/v1.3.0...v1.4.0) (2023-11-30)


### Features

* propagate error status codes to parent spans for improved visibility into trace exceptions ([#1824](https://github.com/Arize-ai/phoenix/issues/1824)) ([1a234e9](https://github.com/Arize-ai/phoenix/commit/1a234e902d5882f19ab3c497e788bb2c4e2ff227))

## [1.3.0](https://github.com/Arize-ai/phoenix/compare/v1.2.1...v1.3.0) (2023-11-30)


### Features

* Add OpenAI Rate limiting ([#1805](https://github.com/Arize-ai/phoenix/issues/1805)) ([115e044](https://github.com/Arize-ai/phoenix/commit/115e04478f7192bdb4aa7b7a1cd0a5bd950fb03c))
* **evals:** show span evaluations in trace details slideout ([#1810](https://github.com/Arize-ai/phoenix/issues/1810)) ([4f0e4dc](https://github.com/Arize-ai/phoenix/commit/4f0e4dce35b779f2167581f281a0c70d61597f1d))
* evaluation ingestion (no user-facing feature is added) ([#1764](https://github.com/Arize-ai/phoenix/issues/1764)) ([7c4039b](https://github.com/Arize-ai/phoenix/commit/7c4039b3d9a04a73b312a09ceeb95a73de9610ef))
* feature flags context ([#1802](https://github.com/Arize-ai/phoenix/issues/1802)) ([a2732cd](https://github.com/Arize-ai/phoenix/commit/a2732cd115dad011c3856819fd2abf2a80ca2154))
* Implement asynchronous submission for OpenAI evals ([#1754](https://github.com/Arize-ai/phoenix/issues/1754)) ([30c011d](https://github.com/Arize-ai/phoenix/commit/30c011de471b68bc1a912780eff03ae0567d803e))
* reference link correctness evaluation prompt template ([#1771](https://github.com/Arize-ai/phoenix/issues/1771)) ([bf731df](https://github.com/Arize-ai/phoenix/commit/bf731df32d0f908b91a9f3ffb5ed6dcf6e00ff13))
* **traces:** configurable endpoint for the exporter ([#1795](https://github.com/Arize-ai/phoenix/issues/1795)) ([8515763](https://github.com/Arize-ai/phoenix/commit/851576385f548d8515e745bb39392fcf1b070e93))
* **traces:** display document evaluations alongside the document ([#1823](https://github.com/Arize-ai/phoenix/issues/1823)) ([2ca3613](https://github.com/Arize-ai/phoenix/commit/2ca361348ad112c6320c17b40d36bfadb0c2c66f))
* **traces:** server-side sort of spans by evaluation result (score or label) ([#1812](https://github.com/Arize-ai/phoenix/issues/1812)) ([d139693](https://github.com/Arize-ai/phoenix/commit/d1396931ab5b7b59c2777bb607afcf053134f6b7))
* **traces:** show all evaluations in the table" ([#1819](https://github.com/Arize-ai/phoenix/issues/1819)) ([2b27333](https://github.com/Arize-ai/phoenix/commit/2b273336b3448bc8cab1f433e79fc9fd868ad073))
* **traces:** Trace page header with latency, status, and evaluations ([#1831](https://github.com/Arize-ai/phoenix/issues/1831)) ([1d88efd](https://github.com/Arize-ai/phoenix/commit/1d88efdb623f5239106fde098fe51e53358592e2))


### Bug Fixes

* enhance llama-index callback support for exception events ([#1814](https://github.com/Arize-ai/phoenix/issues/1814)) ([8db01df](https://github.com/Arize-ai/phoenix/commit/8db01df096b5955adb12a57101beb76c943d8649))
* pin llama-index temporarily ([#1806](https://github.com/Arize-ai/phoenix/issues/1806)) ([d6aa76e](https://github.com/Arize-ai/phoenix/commit/d6aa76e2707528c367ea9ec5accc503871f97644))
* remove sklearn metrics not available in sagemaker ([#1791](https://github.com/Arize-ai/phoenix/issues/1791)) ([20ab6e5](https://github.com/Arize-ai/phoenix/commit/20ab6e551eb4de16df65d31d10b8efe34814c866))
* **traces:** convert (non-list) iterables to lists during protobuf construction due to potential presence of ndarray when reading from parquet files ([#1801](https://github.com/Arize-ai/phoenix/issues/1801)) ([ca72747](https://github.com/Arize-ai/phoenix/commit/ca72747991bf60881d76f95e88c656b1cecff2df))
* **traces:** make column selector sync'd between tabs ([#1816](https://github.com/Arize-ai/phoenix/issues/1816)) ([125431a](https://github.com/Arize-ai/phoenix/commit/125431a15cb9eaf07db406a936bd38c42f8665d8))


### Documentation

* Environment documentation (GITBOOK-370) ([dbbb0a7](https://github.com/Arize-ai/phoenix/commit/dbbb0a7cf86200d71327a2d29e889f31c1a0f149))
* Explanations (GITBOOK-371) ([5f33da3](https://github.com/Arize-ai/phoenix/commit/5f33da313625e5231619a447a8fbe0d173d638b0))
* No subject (GITBOOK-369) ([656b5c0](https://github.com/Arize-ai/phoenix/commit/656b5c0b9164517f78488b15dec14517590b4d5e))
* sync for 1.3 ([#1833](https://github.com/Arize-ai/phoenix/issues/1833)) ([4d01e83](https://github.com/Arize-ai/phoenix/commit/4d01e83edb7995ef07d02573d59060be9dba0fc1))
* update default value of variable in run_relevance_eval (GITBOOK-368) ([d5bcaf8](https://github.com/Arize-ai/phoenix/commit/d5bcaf8147475f329cb55223cb981eb38611423c))

## [1.2.1](https://github.com/Arize-ai/phoenix/compare/v1.2.0...v1.2.1) (2023-11-18)


### Bug Fixes

* make the app launchable when nest_asyncio is applied ([#1783](https://github.com/Arize-ai/phoenix/issues/1783)) ([f9d5085](https://github.com/Arize-ai/phoenix/commit/f9d508510c739007243ca200560268d53e6cb543))
* restore process session ([#1781](https://github.com/Arize-ai/phoenix/issues/1781)) ([34a32c3](https://github.com/Arize-ai/phoenix/commit/34a32c3e8567672bd1ac0979923566c39adecfcf))

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
