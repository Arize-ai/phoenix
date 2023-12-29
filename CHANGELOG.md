# Changelog

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
