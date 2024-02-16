# Changelog

## [4.0.0](https://github.com/Arize-ai/phoenix/compare/phoenix-v3.2.0...phoenix-v4.0.0) (2024-02-16)


### ⚠ BREAKING CHANGES

* replace Phoenix tracers with OpenInference instrumentors ([#2190](https://github.com/Arize-ai/phoenix/issues/2190))
* Remove model-level tenacity retries ([#2176](https://github.com/Arize-ai/phoenix/issues/2176))
* Update `llm_classify` and `llm_generate` interfaces ([#1974](https://github.com/Arize-ai/phoenix/issues/1974))
* **models:** openAI 1.0 ([#1716](https://github.com/Arize-ai/phoenix/issues/1716))

### Features

* add ability to save and load TraceDatasets ([#2082](https://github.com/Arize-ai/phoenix/issues/2082)) ([60c5e5e](https://github.com/Arize-ai/phoenix/commit/60c5e5e1012680d62b1d439aaa822dd067578474))
* Add async submission to `llm_generate` ([#1965](https://github.com/Arize-ai/phoenix/issues/1965)) ([5999133](https://github.com/Arize-ai/phoenix/commit/59991331c93d4f994f00745124b73602d84cc95d))
* Add dockerfile ([#1761](https://github.com/Arize-ai/phoenix/issues/1761)) ([4fa8929](https://github.com/Arize-ai/phoenix/commit/4fa8929f4103e9961a8df0eb059b8df149ed648f))
* add get_trace_dataset method to session ([#2107](https://github.com/Arize-ai/phoenix/issues/2107)) ([9754b60](https://github.com/Arize-ai/phoenix/commit/9754b604af7ee8914333f6a59cabbeaf79f9eadf))
* add long-context evaluators, including map reduce and refine patterns ([#1710](https://github.com/Arize-ai/phoenix/issues/1710)) ([0c3b105](https://github.com/Arize-ai/phoenix/commit/0c3b1053f95b88e234ed3ccfffa50b27f48dc359))
* Add OpenAI Rate limiting ([#1805](https://github.com/Arize-ai/phoenix/issues/1805)) ([115e044](https://github.com/Arize-ai/phoenix/commit/115e04478f7192bdb4aa7b7a1cd0a5bd950fb03c))
* add persistence for span evaluations ([#2021](https://github.com/Arize-ai/phoenix/issues/2021)) ([589d482](https://github.com/Arize-ai/phoenix/commit/589d482419b1119edfae24f837fd17d57612835f))
* Add retries to Bedrock ([#1927](https://github.com/Arize-ai/phoenix/issues/1927)) ([2728c3e](https://github.com/Arize-ai/phoenix/commit/2728c3e75927ca34e05c83336b3a8e9f5476466e))
* add support for explanations to run_evals ([#1975](https://github.com/Arize-ai/phoenix/issues/1975)) ([5143529](https://github.com/Arize-ai/phoenix/commit/51435297538c83542f7df6ba5860a50ef71307cf))
* Add support for Google's Gemini models via Vertex python sdk ([#2008](https://github.com/Arize-ai/phoenix/issues/2008)) ([caf826c](https://github.com/Arize-ai/phoenix/commit/caf826c8ced9f8840d3150f7d466bdc2295d2054))
* **app:** databricks notebook support ([#2086](https://github.com/Arize-ai/phoenix/issues/2086)) ([b517480](https://github.com/Arize-ai/phoenix/commit/b517480e18d5e5d4c10d237cf13aff7546aa6529))
* **embeddings:** add search by text and ID on selection ([#2219](https://github.com/Arize-ai/phoenix/issues/2219)) ([99c480c](https://github.com/Arize-ai/phoenix/commit/99c480c46b32ec78d28c93fe793b48a94fc3ebfa))
* **embeddings:** audio support ([#1920](https://github.com/Arize-ai/phoenix/issues/1920)) ([61cc550](https://github.com/Arize-ai/phoenix/commit/61cc55074c7381746886131c19e06d92a33f8489))
* Evals with explanations ([#1699](https://github.com/Arize-ai/phoenix/issues/1699)) ([2db8141](https://github.com/Arize-ai/phoenix/commit/2db814102ea27f441e201740cc75ace79c82837c))
* **evals:** add an output_parser to llm_generate ([#1736](https://github.com/Arize-ai/phoenix/issues/1736)) ([6408dda](https://github.com/Arize-ai/phoenix/commit/6408dda7d33bfe84d929ddaacd01cb3269e0f63a))
* **evals:** Gpt 4 turbo context window size ([#2112](https://github.com/Arize-ai/phoenix/issues/2112)) ([389c1a0](https://github.com/Arize-ai/phoenix/commit/389c1a008885f061955ac8b9288d125e881a0d11))
* **evals:** Human vs AI Evals ([#1850](https://github.com/Arize-ai/phoenix/issues/1850)) ([e96bd27](https://github.com/Arize-ai/phoenix/commit/e96bd27ed626a23187a92ddb34720a07ee689ad1))
* **evals:** in `llm_classify`, use function calling to constrain LLM outputs when available; `llm_classify` now returns a dataframe ([#1651](https://github.com/Arize-ai/phoenix/issues/1651)) ([b796cb4](https://github.com/Arize-ai/phoenix/commit/b796cb4057846574d0cd7a3e3c078b7f6ef5ee91))
* **evals:** return partial results when llm function is interrupted ([#1755](https://github.com/Arize-ai/phoenix/issues/1755)) ([1fb0849](https://github.com/Arize-ai/phoenix/commit/1fb0849a4e5f39c6afc90a1417300747a0bf4bf6))
* **evals:** show span evaluations in trace details slideout ([#1810](https://github.com/Arize-ai/phoenix/issues/1810)) ([4f0e4dc](https://github.com/Arize-ai/phoenix/commit/4f0e4dce35b779f2167581f281a0c70d61597f1d))
* evaluation column selectors ([#1932](https://github.com/Arize-ai/phoenix/issues/1932)) ([ed07809](https://github.com/Arize-ai/phoenix/commit/ed07809910e8b97387ef0729d843677e7e8c68a7))
* evaluation ingestion (no user-facing feature is added) ([#1764](https://github.com/Arize-ai/phoenix/issues/1764)) ([7c4039b](https://github.com/Arize-ai/phoenix/commit/7c4039b3d9a04a73b312a09ceeb95a73de9610ef))
* evaluator enhancements ([#2045](https://github.com/Arize-ai/phoenix/issues/2045)) ([1cc9c0a](https://github.com/Arize-ai/phoenix/commit/1cc9c0a7a32c5896ff8a83fe25defaeb01fd9bf2))
* feature flags context ([#1802](https://github.com/Arize-ai/phoenix/issues/1802)) ([a2732cd](https://github.com/Arize-ai/phoenix/commit/a2732cd115dad011c3856819fd2abf2a80ca2154))
* filter spans by metadata values ([#2268](https://github.com/Arize-ai/phoenix/issues/2268)) ([1541b73](https://github.com/Arize-ai/phoenix/commit/1541b73753c2eddb2f28993b16881b793342dea2))
* Implement asynchronous submission for OpenAI evals ([#1754](https://github.com/Arize-ai/phoenix/issues/1754)) ([30c011d](https://github.com/Arize-ai/phoenix/commit/30c011de471b68bc1a912780eff03ae0567d803e))
* instantiate evaluators by criteria ([#1983](https://github.com/Arize-ai/phoenix/issues/1983)) ([9c72616](https://github.com/Arize-ai/phoenix/commit/9c72616aee88116c0194937d136bf3a74817132b))
* Instrument LlamaIndex streaming responses ([#1901](https://github.com/Arize-ai/phoenix/issues/1901)) ([f46396e](https://github.com/Arize-ai/phoenix/commit/f46396e04976475220092249a4e83f252d319630))
* launch phoenix with evaluations ([#2095](https://github.com/Arize-ai/phoenix/issues/2095)) ([9656d0c](https://github.com/Arize-ai/phoenix/commit/9656d0cc41bb995f2dfa35477ccf6569104da0c8))
* LiteLLM model support for evals ([#1675](https://github.com/Arize-ai/phoenix/issues/1675)) ([5f2a999](https://github.com/Arize-ai/phoenix/commit/5f2a9991059e060423853567a20789eba832f65a))
* **models:** openAI 1.0 ([#1716](https://github.com/Arize-ai/phoenix/issues/1716)) ([2564521](https://github.com/Arize-ai/phoenix/commit/2564521e1ce00aaabaf592ce3735a656e1c6f1b8))
* openai async streaming instrumentation ([#1900](https://github.com/Arize-ai/phoenix/issues/1900)) ([06d643b](https://github.com/Arize-ai/phoenix/commit/06d643b7c7255b79c7a7e4ea587b4e445122ac37))
* openai streaming function call message support ([#1914](https://github.com/Arize-ai/phoenix/issues/1914)) ([25279ca](https://github.com/Arize-ai/phoenix/commit/25279ca563a81e438b7bbc3fd897d13ecca67b60))
* openai streaming spans show up in the ui ([#1888](https://github.com/Arize-ai/phoenix/issues/1888)) ([ffa1d41](https://github.com/Arize-ai/phoenix/commit/ffa1d41e633b6fee4978a9b705fa10bf4b5fe137))
* openai streaming tool calls ([#1936](https://github.com/Arize-ai/phoenix/issues/1936)) ([6dd14cf](https://github.com/Arize-ai/phoenix/commit/6dd14cf21acb12b599107619d0b7f4b0cdc55f4c))
* **persistence:** add a PHOENIX_WORKING_DIR env var for setting up a… ([#2121](https://github.com/Arize-ai/phoenix/issues/2121)) ([5fbb2e6](https://github.com/Arize-ai/phoenix/commit/5fbb2e6d39dfe8041e3067531841e720e85829ae))
* phoenix client `get_evaluations()` and `get_trace_dataset()` ([#2154](https://github.com/Arize-ai/phoenix/issues/2154)) ([29800e4](https://github.com/Arize-ai/phoenix/commit/29800e4ed4a901ad19874ba049638e13d8c67b87))
* phoenix client `get_spans_dataframe()` and `query_spans()` ([#2151](https://github.com/Arize-ai/phoenix/issues/2151)) ([e44b948](https://github.com/Arize-ai/phoenix/commit/e44b948301b28b22d5f578de686dc29c1cf84ad0))
* propagate error status codes to parent spans for improved visibility into trace exceptions ([#1824](https://github.com/Arize-ai/phoenix/issues/1824)) ([1a234e9](https://github.com/Arize-ai/phoenix/commit/1a234e902d5882f19ab3c497e788bb2c4e2ff227))
* Protect Langchain callbacks ([#1653](https://github.com/Arize-ai/phoenix/issues/1653)) ([196c22b](https://github.com/Arize-ai/phoenix/commit/196c22ba3a5b049b99312ece7b37c95ac1e4375e))
* px.Client `log_evaluations` ([#2308](https://github.com/Arize-ai/phoenix/issues/2308)) ([69a4b2b](https://github.com/Arize-ai/phoenix/commit/69a4b2b9705d05cb54de3b153fc0450485da4427))
* **rag:** eval relevancy conventions ([#1612](https://github.com/Arize-ai/phoenix/issues/1612)) ([e9f92f7](https://github.com/Arize-ai/phoenix/commit/e9f92f7532ef05a885d66629b2d6e077ad82f39a))
* reference link correctness evaluation prompt template ([#1771](https://github.com/Arize-ai/phoenix/issues/1771)) ([bf731df](https://github.com/Arize-ai/phoenix/commit/bf731df32d0f908b91a9f3ffb5ed6dcf6e00ff13))
* Remove model-level tenacity retries ([#2176](https://github.com/Arize-ai/phoenix/issues/2176)) ([66d452c](https://github.com/Arize-ai/phoenix/commit/66d452c45a676ee5dbac43b25df43df32bdb71bc))
* replace Phoenix tracers with OpenInference instrumentors ([#2190](https://github.com/Arize-ai/phoenix/issues/2190)) ([b983c70](https://github.com/Arize-ai/phoenix/commit/b983c709ddc6f99239a33516e5ac8b59c3f7f833))
* sagemaker nobebook support ([#1772](https://github.com/Arize-ai/phoenix/issues/1772)) ([2c0ffbc](https://github.com/Arize-ai/phoenix/commit/2c0ffbc1479ae0255b72bc2d31d5f3204fd8e32c))
* semantic conventions for `tool_calls` array in OpenAI ChatCompletion messages ([#1837](https://github.com/Arize-ai/phoenix/issues/1837)) ([c079f00](https://github.com/Arize-ai/phoenix/commit/c079f00fd731e281671bace9ef4b68d4cbdcc584))
* support asynchronous chat completions for openai instrumentation ([#1849](https://github.com/Arize-ai/phoenix/issues/1849)) ([f066e10](https://github.com/Arize-ai/phoenix/commit/f066e108c07c95502ba77b11fcb37fe3e5e5ed72))
* support eval exports for session ([#2094](https://github.com/Arize-ai/phoenix/issues/2094)) ([8757fa8](https://github.com/Arize-ai/phoenix/commit/8757fa899428e13991acedb4beb77aadfaf42ea0))
* Support first-party Anthropic python SDK ([#2004](https://github.com/Arize-ai/phoenix/issues/2004)) ([a323283](https://github.com/Arize-ai/phoenix/commit/a323283021372bd3b7c95b435a8bef347e12028f))
* support function calling for run_evals ([#1978](https://github.com/Arize-ai/phoenix/issues/1978)) ([8be325c](https://github.com/Arize-ai/phoenix/commit/8be325cef3d48ce98f8c27c29dc46a42516ab970))
* support instrumentation for openai synchronous streaming ([#1879](https://github.com/Arize-ai/phoenix/issues/1879)) ([b6e8c73](https://github.com/Arize-ai/phoenix/commit/b6e8c732926ea112775e9541173a9bdb29482d8d))
* support running multiple evals at once ([#1742](https://github.com/Arize-ai/phoenix/issues/1742)) ([79d4473](https://github.com/Arize-ai/phoenix/commit/79d44739ba75b980967440a91850c9bed01ceb99))
* **trace:** display metadata in the trace page UI ([#2304](https://github.com/Arize-ai/phoenix/issues/2304)) ([fce2d63](https://github.com/Arize-ai/phoenix/commit/fce2d63983aa31b115080d94bb3f5c7a899ecaf5))
* **traces:** add `v1/traces` HTTP endpoint to handle `ExportTraceServiceRequest` ([3c94dea](https://github.com/Arize-ai/phoenix/commit/3c94dea6f5986c7b1658462d4700d21df56f72f6))
* **traces:** add `v1/traces` HTTP endpoint to handle `ExportTraceServiceRequest` ([#1968](https://github.com/Arize-ai/phoenix/issues/1968)) ([3c94dea](https://github.com/Arize-ai/phoenix/commit/3c94dea6f5986c7b1658462d4700d21df56f72f6))
* **traces:** add retrieval summary to header ([#2006](https://github.com/Arize-ai/phoenix/issues/2006)) ([8af0582](https://github.com/Arize-ai/phoenix/commit/8af0582c8c5cb19fe6bd84408f3d8ef26480c19e))
* **traces:** configurable endpoint for the exporter ([#1795](https://github.com/Arize-ai/phoenix/issues/1795)) ([8515763](https://github.com/Arize-ai/phoenix/commit/851576385f548d8515e745bb39392fcf1b070e93))
* **traces:** display document evaluations alongside the document ([#1823](https://github.com/Arize-ai/phoenix/issues/1823)) ([2ca3613](https://github.com/Arize-ai/phoenix/commit/2ca361348ad112c6320c17b40d36bfadb0c2c66f))
* **traces:** display document retrieval metrics on trace details ([#1902](https://github.com/Arize-ai/phoenix/issues/1902)) ([0c35229](https://github.com/Arize-ai/phoenix/commit/0c352297b3cef838651e69a05ae5357cbdbd61a5))
* **traces:** document retrieval metrics based on document evaluation scores ([#1826](https://github.com/Arize-ai/phoenix/issues/1826)) ([3dfb7bd](https://github.com/Arize-ai/phoenix/commit/3dfb7bdfba3eb61e57dba503efcc761511479a90))
* **traces:** document retrieval metrics on trace / span tables ([#1873](https://github.com/Arize-ai/phoenix/issues/1873)) ([733d233](https://github.com/Arize-ai/phoenix/commit/733d2339ec3ffabc9ac83454fb6540adfefe1526))
* **traces:** evaluation annotations on traces for associating spans with eval metrics ([#1693](https://github.com/Arize-ai/phoenix/issues/1693)) ([a218a65](https://github.com/Arize-ai/phoenix/commit/a218a650cefa8925ed7b6627c121454bfc94ec0d))
* **traces:** evaluation summary on the header ([#2000](https://github.com/Arize-ai/phoenix/issues/2000)) ([965beb0](https://github.com/Arize-ai/phoenix/commit/965beb00c223b405cd8c56c6a58d15beb391af78))
* **traces:** filterable span and document evaluation summaries ([#1880](https://github.com/Arize-ai/phoenix/issues/1880)) ([f90919c](https://github.com/Arize-ai/phoenix/commit/f90919c6162ce6bba3b12c5bba92b31f31128739))
* **traces:** graphql query for document evaluation summary ([#1874](https://github.com/Arize-ai/phoenix/issues/1874)) ([8a6a063](https://github.com/Arize-ai/phoenix/commit/8a6a06326e42f58018e030e0d854847d6fe6f10b))
* **traces:** query spans into dataframes ([#1910](https://github.com/Arize-ai/phoenix/issues/1910)) ([6b51435](https://github.com/Arize-ai/phoenix/commit/6b5143535cf4ad3d0149fb68234043d47debaa15))
* **traces:** server-side sort of spans by evaluation result (score or label) ([#1812](https://github.com/Arize-ai/phoenix/issues/1812)) ([d139693](https://github.com/Arize-ai/phoenix/commit/d1396931ab5b7b59c2777bb607afcf053134f6b7))
* **traces:** server-side span filter by evaluation result values ([#1858](https://github.com/Arize-ai/phoenix/issues/1858)) ([6b05f96](https://github.com/Arize-ai/phoenix/commit/6b05f96fa7fc328414daf3caaed7d807e018763a))
* **traces:** show all evaluations in the table" ([#1819](https://github.com/Arize-ai/phoenix/issues/1819)) ([2b27333](https://github.com/Arize-ai/phoenix/commit/2b273336b3448bc8cab1f433e79fc9fd868ad073))
* **traces:** span evaluation summary (aggregation metrics of scores and labels) ([#1846](https://github.com/Arize-ai/phoenix/issues/1846)) ([5c5c3d6](https://github.com/Arize-ai/phoenix/commit/5c5c3d69021fa21ce73a0d297107d5bf14fe4c98))
* **traces:** span table column visibility controls ([#1687](https://github.com/Arize-ai/phoenix/issues/1687)) ([559852f](https://github.com/Arize-ai/phoenix/commit/559852f12d976df691c24f3e89bf23a7650d148c))
* **traces:** Trace page header with latency, status, and evaluations ([#1831](https://github.com/Arize-ai/phoenix/issues/1831)) ([1d88efd](https://github.com/Arize-ai/phoenix/commit/1d88efdb623f5239106fde098fe51e53358592e2))
* **ui:** add filter condition snippets ([#2049](https://github.com/Arize-ai/phoenix/issues/2049)) ([567fa54](https://github.com/Arize-ai/phoenix/commit/567fa5499a4584e03bf1695caea3179778d27889))
* **ui:** add hour time range ([#2244](https://github.com/Arize-ai/phoenix/issues/2244)) ([2e22518](https://github.com/Arize-ai/phoenix/commit/2e22518c57c4a405b16fb6de00297931925e43c4))
* **ui:** light theme ([#1657](https://github.com/Arize-ai/phoenix/issues/1657)) ([db2aa46](https://github.com/Arize-ai/phoenix/commit/db2aa4607689dab75ef3acf70fb8a24548c1c4a5))
* Update `llm_classify` and `llm_generate` interfaces ([#1974](https://github.com/Arize-ai/phoenix/issues/1974)) ([9fd35a1](https://github.com/Arize-ai/phoenix/commit/9fd35a11399c2d1aba1be40592cac0e31fff2d80))


### Bug Fixes

* `run_evals` correctly falls back to default responses on error ([#2233](https://github.com/Arize-ai/phoenix/issues/2233)) ([4b2bd39](https://github.com/Arize-ai/phoenix/commit/4b2bd3989ab5ed34feb536342fda4ca412c51ade))
* absolute path for eval exporter ([#2202](https://github.com/Arize-ai/phoenix/issues/2202)) ([2ac39e9](https://github.com/Arize-ai/phoenix/commit/2ac39e93de3f437c5cf3f092bd6de437d75337ce))
* absolute path for urljoin in px.Client ([#2199](https://github.com/Arize-ai/phoenix/issues/2199)) ([ba30a30](https://github.com/Arize-ai/phoenix/commit/ba30a30d1312af042b81b631b5d0b6cc0e14d411))
* add bedrock import ([#1695](https://github.com/Arize-ai/phoenix/issues/1695)) ([dc7f3ef](https://github.com/Arize-ai/phoenix/commit/dc7f3ef6fa7c184e46ef92f1c035a29345e0b12e))
* Add lock failsafe ([#1956](https://github.com/Arize-ai/phoenix/issues/1956)) ([9ddbd9c](https://github.com/Arize-ai/phoenix/commit/9ddbd9caa4a66ae47c5447aa4dafa46cc9c5cfa5))
* add name= to Run() for langchain tracer ([#1671](https://github.com/Arize-ai/phoenix/issues/1671)) ([70c3b32](https://github.com/Arize-ai/phoenix/commit/70c3b3241b29df573318bde823a9e37f4779ac10))
* Adjust evaluation templates and rails for Gemini compatibility ([#2075](https://github.com/Arize-ai/phoenix/issues/2075)) ([3a7bfd2](https://github.com/Arize-ai/phoenix/commit/3a7bfd2158b5c0ea995f4d1ec00a6f7b2c4a21e8))
* allow json string for `metadata` span attribute ([#2301](https://github.com/Arize-ai/phoenix/issues/2301)) ([ec7fbe2](https://github.com/Arize-ai/phoenix/commit/ec7fbe2380bd9f1ff837802b58a626eb562731e1))
* allow streaming response to be iterated by user ([#1862](https://github.com/Arize-ai/phoenix/issues/1862)) ([76a2443](https://github.com/Arize-ai/phoenix/commit/76a24436d7f2d1cb56ac77fb8486b4296f65a615))
* broken link and openinference links ([#2144](https://github.com/Arize-ai/phoenix/issues/2144)) ([01fb046](https://github.com/Arize-ai/phoenix/commit/01fb0464d023e1494c22f80b10ed840eef47fce8))
* Clean up vertex clients after event loop closure ([#2102](https://github.com/Arize-ai/phoenix/issues/2102)) ([202c7ea](https://github.com/Arize-ai/phoenix/commit/202c7eadf79acd40505885d891a02eb9331ff1e4))
* databricks check crashes in python console ([#2152](https://github.com/Arize-ai/phoenix/issues/2152)) ([5aeeeff](https://github.com/Arize-ai/phoenix/commit/5aeeeff9fa8c2d697374686552b35127238dce44))
* default collector endpoint breaks on windows ([#2161](https://github.com/Arize-ai/phoenix/issues/2161)) ([f1a2007](https://github.com/Arize-ai/phoenix/commit/f1a200713c44ffcf2506ff54429715ef7171ecd1))
* Determine default async concurrency on a per-model basis ([#2096](https://github.com/Arize-ai/phoenix/issues/2096)) ([b44d8aa](https://github.com/Arize-ai/phoenix/commit/b44d8aa8de6854632f241000be244c43a26ed85e))
* disregard active session if endpoint is provided to px.Client ([#2206](https://github.com/Arize-ai/phoenix/issues/2206)) ([6ec0d23](https://github.com/Arize-ai/phoenix/commit/6ec0d2344ffb7f40534730160f10d99f266788da))
* Do not retry if eval was successful when using SyncExecutor ([#2016](https://github.com/Arize-ai/phoenix/issues/2016)) ([a869190](https://github.com/Arize-ai/phoenix/commit/a8691905e16fe1c8c6483d837399e8c499ce71cf))
* Do not retry when context window has been exceeded ([#2126](https://github.com/Arize-ai/phoenix/issues/2126)) ([ff6df1f](https://github.com/Arize-ai/phoenix/commit/ff6df1fc01f0986357a9e20e0441a3c15697a5fa))
* endpoint for client inside ProcessSession ([#2211](https://github.com/Arize-ai/phoenix/issues/2211)) ([82e279e](https://github.com/Arize-ai/phoenix/commit/82e279ed85b9f963f4d6dd86f3a0d89ed085635d))
* enhance llama-index callback support for exception events ([#1814](https://github.com/Arize-ai/phoenix/issues/1814)) ([8db01df](https://github.com/Arize-ai/phoenix/commit/8db01df096b5955adb12a57101beb76c943d8649))
* ensure float values are properly encoded by otel tracer ([#2024](https://github.com/Arize-ai/phoenix/issues/2024)) ([b12a894](https://github.com/Arize-ai/phoenix/commit/b12a89496468063e2cd6a99e1ea08d49af5c6ba1))
* ensure llamaindex spans are correctly encoded ([#2023](https://github.com/Arize-ai/phoenix/issues/2023)) ([3ca6262](https://github.com/Arize-ai/phoenix/commit/3ca6262ad38c13b63dc2cde84e1a97a76ba1c323))
* **evals:** properly use kw args for models in notebooks ([#2235](https://github.com/Arize-ai/phoenix/issues/2235)) ([7bd59d5](https://github.com/Arize-ai/phoenix/commit/7bd59d5bab1ce992793e73cd2c223f47f88067c5))
* evaluate rag notebook ([#2316](https://github.com/Arize-ai/phoenix/issues/2316)) ([4219bf2](https://github.com/Arize-ai/phoenix/commit/4219bf2b55414dcec1528f1c8ca15f4393f00388))
* Handle missing vertex candidates ([#2055](https://github.com/Arize-ai/phoenix/issues/2055)) ([1d0475a](https://github.com/Arize-ai/phoenix/commit/1d0475afa4974eb9590c70334961996f99e6d856))
* handle ndarray during ingestion ([#2262](https://github.com/Arize-ai/phoenix/issues/2262)) ([80114fb](https://github.com/Arize-ai/phoenix/commit/80114fb2c3c9f71973236b920b0284aeeb9e7129))
* increment version to v0.0.50rc5 ([#1649](https://github.com/Arize-ai/phoenix/issues/1649)) ([664e207](https://github.com/Arize-ai/phoenix/commit/664e207b60bed36b84b91fc7c811e034ce2a17d8))
* llama_index_search_and_retrieval_notebook ([#2315](https://github.com/Arize-ai/phoenix/issues/2315)) ([21e5429](https://github.com/Arize-ai/phoenix/commit/21e5429dc57d5d6cdc9e06276bc5aff1940261c1))
* llama-index extra ([#1958](https://github.com/Arize-ai/phoenix/issues/1958)) ([d9b68eb](https://github.com/Arize-ai/phoenix/commit/d9b68eb2e8f3422a491dc8a0981dd474d84d6260))
* LlamaIndex callback handler drops events if the `start_event` handler is not called ([#1668](https://github.com/Arize-ai/phoenix/issues/1668)) ([428053f](https://github.com/Arize-ai/phoenix/commit/428053fcefdd9b5502b3fc38ac0235a0e938c8a1))
* LlamaIndex compatibility fix ([#1940](https://github.com/Arize-ai/phoenix/issues/1940)) ([052349d](https://github.com/Arize-ai/phoenix/commit/052349d594fa2d25b827f5318e0b438f33bf165c))
* localhost address for px.Client ([#2200](https://github.com/Arize-ai/phoenix/issues/2200)) ([e56b66a](https://github.com/Arize-ai/phoenix/commit/e56b66adea734693a82f49b415e093a07a9f0ff1))
* make alert icon for exceptions visible ([#2001](https://github.com/Arize-ai/phoenix/issues/2001)) ([e7a6567](https://github.com/Arize-ai/phoenix/commit/e7a6567f813149e4e7952f4b80183f39ea7cc15f))
* make dspy notebook work on colab ([#2306](https://github.com/Arize-ai/phoenix/issues/2306)) ([a518701](https://github.com/Arize-ai/phoenix/commit/a5187013bac52e710cf73b716abb70423af59026))
* make the app launchable when nest_asyncio is applied ([#1783](https://github.com/Arize-ai/phoenix/issues/1783)) ([f9d5085](https://github.com/Arize-ai/phoenix/commit/f9d508510c739007243ca200560268d53e6cb543))
* Model stability enhancements ([#1939](https://github.com/Arize-ai/phoenix/issues/1939)) ([dca42e0](https://github.com/Arize-ai/phoenix/commit/dca42e026acc079f0523158d10e2149b01136600))
* OpenAI clients are not cleaned up after calls to `llm_classify` ([#2068](https://github.com/Arize-ai/phoenix/issues/2068)) ([3233d56](https://github.com/Arize-ai/phoenix/commit/3233d561783556ef8799e65fe1335da52d161a12))
* pin llama-index temporarily ([#1806](https://github.com/Arize-ai/phoenix/issues/1806)) ([d6aa76e](https://github.com/Arize-ai/phoenix/commit/d6aa76e2707528c367ea9ec5accc503871f97644))
* pin openai version below 1.0.0 ([#1714](https://github.com/Arize-ai/phoenix/issues/1714)) ([d21e364](https://github.com/Arize-ai/phoenix/commit/d21e36459a42f01d04a373236fef2e603eea159d))
* Rate limiter will sometimes tank request rate with many concurrent requests ([#1855](https://github.com/Arize-ai/phoenix/issues/1855)) ([2530569](https://github.com/Arize-ai/phoenix/commit/25305699c639d4c556c413e27a4c13378a548a77))
* remove hyphens from span_id in legacy evaluation fixtures ([#2153](https://github.com/Arize-ai/phoenix/issues/2153)) ([fae859d](https://github.com/Arize-ai/phoenix/commit/fae859d8831669f92a368e979caa81a778948432))
* Remove LiteLLM model support check ([#2046](https://github.com/Arize-ai/phoenix/issues/2046)) ([45d3fe6](https://github.com/Arize-ai/phoenix/commit/45d3fe6e1a2aaf931eb783aaca68525579215386))
* remove sklearn metrics not available in sagemaker ([#1791](https://github.com/Arize-ai/phoenix/issues/1791)) ([20ab6e5](https://github.com/Arize-ai/phoenix/commit/20ab6e551eb4de16df65d31d10b8efe34814c866))
* Resolves Bedrock model compatibility issues ([#2114](https://github.com/Arize-ai/phoenix/issues/2114)) ([c4a5343](https://github.com/Arize-ai/phoenix/commit/c4a534351eca3eec9b02911ea5558ef2b47ea8a7))
* restore process session ([#1781](https://github.com/Arize-ai/phoenix/issues/1781)) ([34a32c3](https://github.com/Arize-ai/phoenix/commit/34a32c3e8567672bd1ac0979923566c39adecfcf))
* set global session to None if it fails to start ([#2286](https://github.com/Arize-ai/phoenix/issues/2286)) ([6752fd2](https://github.com/Arize-ai/phoenix/commit/6752fd223410c33a2aae707b3b74222d4140de93))
* show localhost when the notebook is running locally ([#2090](https://github.com/Arize-ai/phoenix/issues/2090)) ([095298d](https://github.com/Arize-ai/phoenix/commit/095298d88bc44b28928b44b2b593eca9d54e843b))
* trace dataset to disc ([#1798](https://github.com/Arize-ai/phoenix/issues/1798)) ([278d344](https://github.com/Arize-ai/phoenix/commit/278d344434d43d5d05cc66abfcb9646b0ac2fb6d))
* **trace:** Make dataset IDs unique by instance for TraceDataset ([#2254](https://github.com/Arize-ai/phoenix/issues/2254)) ([1ac170f](https://github.com/Arize-ai/phoenix/commit/1ac170fcf3debe3de2a9647b67112d4004a71e91))
* **trace:** perform library version compatibility on llama_index ([#2272](https://github.com/Arize-ai/phoenix/issues/2272)) ([89bc510](https://github.com/Arize-ai/phoenix/commit/89bc510b66a92a7df85150a6aa3856b4f3818e5e))
* **trace:** return to /tracing url when dismissing trace slide over ([#2222](https://github.com/Arize-ai/phoenix/issues/2222)) ([ee4ced3](https://github.com/Arize-ai/phoenix/commit/ee4ced3a8e4414c79859eec4e638dbac96d015bb))
* **traces:** convert (non-list) iterables to lists during protobuf construction due to potential presence of ndarray when reading from parquet files ([#1801](https://github.com/Arize-ai/phoenix/issues/1801)) ([ca72747](https://github.com/Arize-ai/phoenix/commit/ca72747991bf60881d76f95e88c656b1cecff2df))
* **traces:** handle `AIMessageChunk` in langchain tracer by matching prefix in name ([#1724](https://github.com/Arize-ai/phoenix/issues/1724)) ([8654c0a](https://github.com/Arize-ai/phoenix/commit/8654c0a0c9e088284b4ed0bbbae4f571ae11b1e7))
* **traces:** Keep traces visible behind the details slideover ([#1709](https://github.com/Arize-ai/phoenix/issues/1709)) ([1c8b8f1](https://github.com/Arize-ai/phoenix/commit/1c8b8f175e0cc8506490a8e0e36ad92d7e7ff69a))
* **traces:** make column selector sync'd between tabs ([#1816](https://github.com/Arize-ai/phoenix/issues/1816)) ([125431a](https://github.com/Arize-ai/phoenix/commit/125431a15cb9eaf07db406a936bd38c42f8665d8))
* **traces:** prevent missing key exception when extracting invocation parameters in llama-index ([#2076](https://github.com/Arize-ai/phoenix/issues/2076)) ([5cc9560](https://github.com/Arize-ai/phoenix/commit/5cc956057f01613ebd08b0247d773c74b24a5aa3))
* **traces:** refetch traces and spans even when searching ([#1683](https://github.com/Arize-ai/phoenix/issues/1683)) ([8d95b6d](https://github.com/Arize-ai/phoenix/commit/8d95b6dc1cebdb88bbc657afdd95dbd3385105ae))
* **traces:** remove nan from log_evaluations ([#2056](https://github.com/Arize-ai/phoenix/issues/2056)) ([df9ed5c](https://github.com/Arize-ai/phoenix/commit/df9ed5cfd68da1e42d52b01aa9f85d68698c3b64))
* **traces:** span evaluations missing from the header ([#1908](https://github.com/Arize-ai/phoenix/issues/1908)) ([5ace81e](https://github.com/Arize-ai/phoenix/commit/5ace81e1a99afc72b6baf6464f1c21eea05eecdd))
* **traces:** span summary root span filter ([#1981](https://github.com/Arize-ai/phoenix/issues/1981)) ([d286f07](https://github.com/Arize-ai/phoenix/commit/d286f077e8493c98a795ae83066e8c1c43a5291f))
* **traces:** support token counts for custom models in llama_index ([#1673](https://github.com/Arize-ai/phoenix/issues/1673)) ([1f5aeec](https://github.com/Arize-ai/phoenix/commit/1f5aeecaa784bb3b714087df48707ca1f6db5b94))
* **traces:** warn if collector endpoint is set but launch app is called ([#2209](https://github.com/Arize-ai/phoenix/issues/2209)) ([eb97b8d](https://github.com/Arize-ai/phoenix/commit/eb97b8d04da2f1728906862318caa1ea8df4933b))
* **ui:** add last_hour, fix end of hour rounding ([#2247](https://github.com/Arize-ai/phoenix/issues/2247)) ([aa4efaf](https://github.com/Arize-ai/phoenix/commit/aa4efaff57ae09b87e7d350994c2ead862b5fa7a))
* **UI:** fix icon and label colors for light mode ([#1678](https://github.com/Arize-ai/phoenix/issues/1678)) ([27e9b81](https://github.com/Arize-ai/phoenix/commit/27e9b8178b243ee28d4538df8ad50168d5e26134))
* **ui:** safely parse JSON and fallback to string for span attributes ([#2293](https://github.com/Arize-ai/phoenix/issues/2293)) ([e43cdbb](https://github.com/Arize-ai/phoenix/commit/e43cdbb5b7a2f5c24957acadac5dd0949ea5469c))
* unpin llama-index version in tutorial notebooks ([#1766](https://github.com/Arize-ai/phoenix/issues/1766)) ([5ff74e3](https://github.com/Arize-ai/phoenix/commit/5ff74e3895f1b0c5642bd0897dd65e6f2913a7bd))
* update tracer for llama-index 0.9.0 ([#1750](https://github.com/Arize-ai/phoenix/issues/1750)) ([48d0996](https://github.com/Arize-ai/phoenix/commit/48d09960855d59419edfd10925aaa895fd370a0d))
* Use separate versioning file ([#2020](https://github.com/Arize-ai/phoenix/issues/2020)) ([f38eedf](https://github.com/Arize-ai/phoenix/commit/f38eedfbd57da6e9512f9aa9fcc5c97232b2bb6e))
* working_dir ([#2257](https://github.com/Arize-ai/phoenix/issues/2257)) ([d0f617f](https://github.com/Arize-ai/phoenix/commit/d0f617f3f7e0094667179e77dd5a07c416db9ea7))


### Documentation

* Add a Deployment Section (GITBOOK-455) ([38086e3](https://github.com/Arize-ai/phoenix/commit/38086e3be25b14ba1f10d9bce60f2be344d391d2))
* Add anyscale tutorial ([#1941](https://github.com/Arize-ai/phoenix/issues/1941)) ([e47c8d0](https://github.com/Arize-ai/phoenix/commit/e47c8d0be941f82ac13c5686fe75622cb59974ab))
* Add bedrock instrumentation notebook ([#2285](https://github.com/Arize-ai/phoenix/issues/2285)) ([6294e36](https://github.com/Arize-ai/phoenix/commit/6294e363891f8f629e7448990490f0b6f56c02f2))
* Add demo link, examples getting started (GITBOOK-396) ([e987315](https://github.com/Arize-ai/phoenix/commit/e987315ab35550350921257aa3e38f5cb6796f3f))
* add docker badge ([e584ed8](https://github.com/Arize-ai/phoenix/commit/e584ed87960eba61c0e5165e3c0d08cf0d11e672))
* add download keyword to px.Client page (GITBOOK-491) ([c35e1a6](https://github.com/Arize-ai/phoenix/commit/c35e1a6cebf487138666ed0102f0609828bb5f54))
* Add Evaluating Traces Section (GITBOOK-386) ([7d72029](https://github.com/Arize-ai/phoenix/commit/7d720293cc30e0021596c427081e3b6bef4b7f5b))
* Add evaluations section for results (GITBOOK-387) ([2e74be0](https://github.com/Arize-ai/phoenix/commit/2e74be0a70a63ddfd6e42d84042f51fc9894f1cb))
* Add final thoughts to evaluation (GITBOOK-405) ([20eab16](https://github.com/Arize-ai/phoenix/commit/20eab16c2dc99b3c6defd497120ee2472eb97ff1))
* add import statement (GITBOOK-408) ([23247d7](https://github.com/Arize-ai/phoenix/commit/23247d755bad33b618e683687dd297e95274939c))
* add instructions for docker build ([#1770](https://github.com/Arize-ai/phoenix/issues/1770)) ([45eb5f2](https://github.com/Arize-ai/phoenix/commit/45eb5f244997d0ff0e991879c297b564e46c9a18))
* Add launch guides (GITBOOK-480) ([6f12435](https://github.com/Arize-ai/phoenix/commit/6f124353ffac66bab11d6e0efe776f4db83b5888))
* add link (GITBOOK-403) ([0be280a](https://github.com/Arize-ai/phoenix/commit/0be280a974e7b8e88904c35285b149cde2369804))
* Add LLM Tracing+Evals notebook with keyless example ([#1928](https://github.com/Arize-ai/phoenix/issues/1928)) ([4c4aac6](https://github.com/Arize-ai/phoenix/commit/4c4aac6425af851b68f52d537813a8a1293a2a4b))
* Add reranker to span kinds (GITBOOK-348) ([fee736d](https://github.com/Arize-ai/phoenix/commit/fee736df2c212a4fe94a489b680693525b0446f8))
* Add terminal running steps (GITBOOK-441) ([91c6b24](https://github.com/Arize-ai/phoenix/commit/91c6b24b411bd2d447c7c2c4453bb57320bff325))
* Adding Demo Videos in  (GITBOOK-476) ([7782c50](https://github.com/Arize-ai/phoenix/commit/7782c50be95495a5353a9c458ffd23d0bab74a93))
* autogen link ([#1946](https://github.com/Arize-ai/phoenix/issues/1946)) ([c3fb4ce](https://github.com/Arize-ai/phoenix/commit/c3fb4ce80005c41201824114400abcdf007574c0))
* Claud Hallucination (GITBOOK-354) ([480c907](https://github.com/Arize-ai/phoenix/commit/480c9074fe63d7bbd02226824729fbfb74971842))
* Claude V2 Metrics & Bedrock (GITBOOK-353) ([cd02879](https://github.com/Arize-ai/phoenix/commit/cd02879039355bad6029ed8fe08b79e5ca2d5d56))
* Clear anyscale tutorial outputs ([#1942](https://github.com/Arize-ai/phoenix/issues/1942)) ([63580a6](https://github.com/Arize-ai/phoenix/commit/63580a6bde204247953a920e8ca13209bd1d7f0b))
* custom instrumentation (GITBOOK-495) ([3310ba6](https://github.com/Arize-ai/phoenix/commit/3310ba66e74be2cf9bff5966a6359c9632590d90))
* dspy tutorial notebook ([#2288](https://github.com/Arize-ai/phoenix/issues/2288)) ([f26caaa](https://github.com/Arize-ai/phoenix/commit/f26caaa764e3fefc28116a25bc84014bc1962553))
* Environment documentation (GITBOOK-370) ([dbbb0a7](https://github.com/Arize-ai/phoenix/commit/dbbb0a7cf86200d71327a2d29e889f31c1a0f149))
* eval concepts typo (GITBOOK-394) ([7c80d4b](https://github.com/Arize-ai/phoenix/commit/7c80d4b3a151ee3a9b1937d04b7362ab2dba3697))
* eval concepts typos (GITBOOK-393) ([62bc99f](https://github.com/Arize-ai/phoenix/commit/62bc99f9e4d729e3bd911f346ce58bf44141c30f))
* Eval Diffentiators (GITBOOK-376) ([bcd14a4](https://github.com/Arize-ai/phoenix/commit/bcd14a4b0d0e3db5a716b19352e831ad8bc7da74))
* Eval results update (GITBOOK-363) ([6ec1c0e](https://github.com/Arize-ai/phoenix/commit/6ec1c0e85d823771ae5f515e0fb39947156e8f9d))
* Eval Types (GITBOOK-434) ([7e728ee](https://github.com/Arize-ai/phoenix/commit/7e728eeab2318b1e207f445af460584b3ad56269))
* **evals:** document llm_generate with output parser ([#1741](https://github.com/Arize-ai/phoenix/issues/1741)) ([1e70ec3](https://github.com/Arize-ai/phoenix/commit/1e70ec3ff6158ffada40726419ae436ba6c7948d))
* **evals:** update RAG evaluations notebook ([#2092](https://github.com/Arize-ai/phoenix/issues/2092)) ([9ad797a](https://github.com/Arize-ai/phoenix/commit/9ad797ab8d2b726088c5bdb6e104e7bc1faf8509))
* **evals:** update ragas integration notebook ([#2100](https://github.com/Arize-ai/phoenix/issues/2100)) ([66fb048](https://github.com/Arize-ai/phoenix/commit/66fb0480a886bd92246d2bffedd32c66a33946ce))
* evaluation concepts typo fix (GITBOOK-390) ([2cbc1dc](https://github.com/Arize-ai/phoenix/commit/2cbc1dcce6ac781d71fbf3107e6af74121be018e))
* Explanations (GITBOOK-371) ([5f33da3](https://github.com/Arize-ai/phoenix/commit/5f33da313625e5231619a447a8fbe0d173d638b0))
* Extract Data from Spans (GITBOOK-383) ([440f530](https://github.com/Arize-ai/phoenix/commit/440f530e35c13c7be1f69a05b0819afec094c5ed))
* fix broken section link (GITBOOK-409) ([fee537b](https://github.com/Arize-ai/phoenix/commit/fee537b9ede6a8d7899744b834a46066f7f8837d))
* fix js instrumentation guide (GITBOOK-493) ([06ab22a](https://github.com/Arize-ai/phoenix/commit/06ab22a7ad939142ff6033a9f14ca836905a6850))
* Fix links on Phoenix Inferences (GITBOOK-359) ([0b2b401](https://github.com/Arize-ai/phoenix/commit/0b2b401786ddb4a026f1f88fb13eefc171ac1228))
* Fix notebook output (GITBOOK-380) ([358adf8](https://github.com/Arize-ai/phoenix/commit/358adf8a23e5823ac3230f83f41b3b71fcbecdac))
* fix typo (GITBOOK-489) ([b1af413](https://github.com/Arize-ai/phoenix/commit/b1af413f16b6f93c599badbfec7997e822e0ccda))
* fix typos (GITBOOK-391) ([c8f5a55](https://github.com/Arize-ai/phoenix/commit/c8f5a55d11669b3837c32cdbc10f99388f63276e))
* fix typos (GITBOOK-402) ([3cd973d](https://github.com/Arize-ai/phoenix/commit/3cd973d8b0348bb580455f093cc36f58deecf1b9))
* fix typos (GITBOOK-406) ([eaa9bea](https://github.com/Arize-ai/phoenix/commit/eaa9beac66cd72ad99ab5a8bc2aec95e2a4a0e7f))
* fix typos (GITBOOK-407) ([cad4820](https://github.com/Arize-ai/phoenix/commit/cad4820c085c7799adcf8d72b4209440b37fcbb9))
* fix typos (GITBOOK-490) ([968457a](https://github.com/Arize-ai/phoenix/commit/968457a4303ef74a49fd122a3e9eedef5e59ceaf))
* human vs AI (GITBOOK-375) ([d159b11](https://github.com/Arize-ai/phoenix/commit/d159b11b3c4fddfb32374eb47320506fea42b579))
* Human vs AI edits (GITBOOK-377) ([686df61](https://github.com/Arize-ai/phoenix/commit/686df614d1044b5edbac5cffa1ddf94fc503aea0))
* Improve rag evaluation (GITBOOK-379) ([e145b98](https://github.com/Arize-ai/phoenix/commit/e145b980f08f1462ce45c4ddf8520aded795e124))
* Initial draft of deploying phoenix (GITBOOK-461) ([54fae17](https://github.com/Arize-ai/phoenix/commit/54fae17a38e2431891dbd6c78f6a70b05f9f4db4))
* Initial draft of evaluation core concept (GITBOOK-385) ([67369cf](https://github.com/Arize-ai/phoenix/commit/67369cf34e5eaddf30e0e3093f163483643f14bb))
* Initial draft of instrumentation (GITBOOK-457) ([90a2f3d](https://github.com/Arize-ai/phoenix/commit/90a2f3da0e49c29dd823407371a3c601b6dd1d03))
* llm ops overview notebook ([#1882](https://github.com/Arize-ai/phoenix/issues/1882)) ([5d15c3c](https://github.com/Arize-ai/phoenix/commit/5d15c3c665583848624882e6d67979148673fca6))
* Log Evaluations (GITBOOK-389) ([369d79d](https://github.com/Arize-ai/phoenix/commit/369d79d479b4b094dbeeef8715b6127babb1a48c))
* Map out to repository for instrumentation (GITBOOK-463) ([4ca7751](https://github.com/Arize-ai/phoenix/commit/4ca77515783264952ea5694697e2cdc795d92453))
* Mistake Label of Precision (GITBOOK-364) ([75f8a27](https://github.com/Arize-ai/phoenix/commit/75f8a2781249a395795b4c5497443615017c650b))
* Move autogen to integrations (GITBOOK-382) ([40d9426](https://github.com/Arize-ai/phoenix/commit/40d9426e581ae92f0cac5a8bca443368cbc6ab4c))
* nix openInference content (GITBOOK-446) ([e2a1ff9](https://github.com/Arize-ai/phoenix/commit/e2a1ff9e3bb41a53e1d89b50229e572f185afc56))
* nix run_relevance_eval api docs (GITBOOK-425) ([80ff36a](https://github.com/Arize-ai/phoenix/commit/80ff36a36652502029ea2f51fc947f931424acdb))
* No subject (GITBOOK-347) ([b90efe8](https://github.com/Arize-ai/phoenix/commit/b90efe8d30478dda1741e101336cb24203e1d12d))
* No subject (GITBOOK-350) ([34dec7a](https://github.com/Arize-ai/phoenix/commit/34dec7aba101060e7d8c185c4534051c99e32068))
* No subject (GITBOOK-355) ([4c30859](https://github.com/Arize-ai/phoenix/commit/4c30859df43fe2e51cecf7f63121c10e46f1bf6d))
* No subject (GITBOOK-361) ([440b61a](https://github.com/Arize-ai/phoenix/commit/440b61a340a4ca6f8c0b84f4cf3d72915e786262))
* No subject (GITBOOK-365) ([d6f44da](https://github.com/Arize-ai/phoenix/commit/d6f44daae84c4f98a45b30c97475df5edc2f3f36))
* No subject (GITBOOK-366) ([025d52b](https://github.com/Arize-ai/phoenix/commit/025d52b7d9cf4a8c602ebacbf02a5e9c0cd471b6))
* No subject (GITBOOK-369) ([656b5c0](https://github.com/Arize-ai/phoenix/commit/656b5c0b9164517f78488b15dec14517590b4d5e))
* No subject (GITBOOK-381) ([de90467](https://github.com/Arize-ai/phoenix/commit/de90467a1a709296098832efeb79f610d709d940))
* No subject (GITBOOK-399) ([94df884](https://github.com/Arize-ai/phoenix/commit/94df884aa6f7ee98610026d827d48b57c0ba032b))
* No subject (GITBOOK-422) ([9b2cd5a](https://github.com/Arize-ai/phoenix/commit/9b2cd5a1a03031434db8d2624d054e3aa2b14241))
* No subject (GITBOOK-423) ([5513071](https://github.com/Arize-ai/phoenix/commit/5513071587740f81f7072b463221865a0d32cce0))
* No subject (GITBOOK-424) ([d75992b](https://github.com/Arize-ai/phoenix/commit/d75992b99552355c8a1e8f812e1bd633c3cdc19a))
* No subject (GITBOOK-426) ([def1969](https://github.com/Arize-ai/phoenix/commit/def19698b72bf8fd6c0816f9b1763edd99870fb7))
* No subject (GITBOOK-428) ([35d6d73](https://github.com/Arize-ai/phoenix/commit/35d6d73b6e2837d2bc59af85b1ccc4c97aa997f4))
* No subject (GITBOOK-430) ([1dbdd92](https://github.com/Arize-ai/phoenix/commit/1dbdd92ae0ec1e527b2f86636310a27acebc7652))
* No subject (GITBOOK-431) ([1c1b708](https://github.com/Arize-ai/phoenix/commit/1c1b7084d827094cc386fdb3aaf889acbb3eadae))
* No subject (GITBOOK-432) ([9769d58](https://github.com/Arize-ai/phoenix/commit/9769d5864de9b12fe94a1e22773026d2531a53ff))
* No subject (GITBOOK-433) ([4cf6287](https://github.com/Arize-ai/phoenix/commit/4cf62872bffe4446b53d36bfee9c34b33ffd361e))
* No subject (GITBOOK-435) ([a36779a](https://github.com/Arize-ai/phoenix/commit/a36779af1705ece581ca884d0645c1ee301c7a8e))
* No subject (GITBOOK-436) ([28dbb5a](https://github.com/Arize-ai/phoenix/commit/28dbb5adb4d407e2bceff00d670fd58a51e68b20))
* No subject (GITBOOK-437) ([560bbf9](https://github.com/Arize-ai/phoenix/commit/560bbf92d580d979618016b91f44e96c3b19d3f7))
* No subject (GITBOOK-438) ([05bfbeb](https://github.com/Arize-ai/phoenix/commit/05bfbebae153d3322d39e8322508a54871ad5541))
* No subject (GITBOOK-439) ([05cf715](https://github.com/Arize-ai/phoenix/commit/05cf715bb4602cced82e2c8e331da448fd0ed289))
* No subject (GITBOOK-440) ([b705f5d](https://github.com/Arize-ai/phoenix/commit/b705f5d01d862c74a573f791b00a562163894520))
* No subject (GITBOOK-442) ([5c4eb6c](https://github.com/Arize-ai/phoenix/commit/5c4eb6c93a284e06907582b3b80dc70cbfd3d0e6))
* No subject (GITBOOK-443) ([11f46cb](https://github.com/Arize-ai/phoenix/commit/11f46cbbb442dbbbc7d84779915ecc537461b80c))
* No subject (GITBOOK-444) ([fcf2bc9](https://github.com/Arize-ai/phoenix/commit/fcf2bc927c24cfb7cba3eda8e7589f59af2dfcf1))
* No subject (GITBOOK-447) ([7d16a46](https://github.com/Arize-ai/phoenix/commit/7d16a4660f07d527073f4dc870c2d1596e346e70))
* No subject (GITBOOK-448) ([f6eafee](https://github.com/Arize-ai/phoenix/commit/f6eafeeb04ba94704f2be7857dc6a3118b1b1398))
* No subject (GITBOOK-453) ([325b89c](https://github.com/Arize-ai/phoenix/commit/325b89cefd09415325c1a26fccf47ce36c210d58))
* No subject (GITBOOK-456) ([727df32](https://github.com/Arize-ai/phoenix/commit/727df328525238d145b964d56654d1c8c53b76e5))
* No subject (GITBOOK-458) ([2246857](https://github.com/Arize-ai/phoenix/commit/2246857cc65c769310a2d5e1e6d76257bf91fad6))
* No subject (GITBOOK-459) ([e79330b](https://github.com/Arize-ai/phoenix/commit/e79330b7d454165d6fdbd2f5acd88edf979e906c))
* No subject (GITBOOK-460) ([f2ec417](https://github.com/Arize-ai/phoenix/commit/f2ec417e48c508ff082d27b5a8c02bd48ba1af77))
* No subject (GITBOOK-462) ([0136c81](https://github.com/Arize-ai/phoenix/commit/0136c81c5b10d389e4311ad768776e15dccbd7ec))
* No subject (GITBOOK-465) ([1cf6cec](https://github.com/Arize-ai/phoenix/commit/1cf6cecbee6b2ffbb6dcd3fd1ccf00308e4661d3))
* No subject (GITBOOK-467) ([210996b](https://github.com/Arize-ai/phoenix/commit/210996b3ecf04ad18a504ba5e38b6235cd9bd113))
* No subject (GITBOOK-469) ([1d633c9](https://github.com/Arize-ai/phoenix/commit/1d633c95c23ca7442f1cd08e1fcb625947abf63c))
* No subject (GITBOOK-470) ([eabaa64](https://github.com/Arize-ai/phoenix/commit/eabaa645854fb9d6ea0f3bf5fa78a5db759df9c6))
* No subject (GITBOOK-471) ([03fa955](https://github.com/Arize-ai/phoenix/commit/03fa955c6b5c43a9c26df8f1c70051991d48d6c9))
* No subject (GITBOOK-472) ([83d52a3](https://github.com/Arize-ai/phoenix/commit/83d52a3c556018e2c320925bd366b86571d2991f))
* No subject (GITBOOK-474) ([d73098f](https://github.com/Arize-ai/phoenix/commit/d73098f4b714f3fc0e9819a9a3cd68a6b8f6cdc4))
* No subject (GITBOOK-475) ([4213da9](https://github.com/Arize-ai/phoenix/commit/4213da9ac09f86f86e54e3deed5b7e5deff3faf3))
* No subject (GITBOOK-477) ([a03ce81](https://github.com/Arize-ai/phoenix/commit/a03ce8104b3f4fc2b5b19b009fadb85e1965182c))
* No subject (GITBOOK-478) ([030a09e](https://github.com/Arize-ai/phoenix/commit/030a09e3de8525399870341915ec1e3af2de00ed))
* No subject (GITBOOK-479) ([38a6a5b](https://github.com/Arize-ai/phoenix/commit/38a6a5bd17f6a28ec8a75b307824e6940ddf6926))
* No subject (GITBOOK-481) ([070cbd1](https://github.com/Arize-ai/phoenix/commit/070cbd1d6c7b26b3112712dd63077cc65e74123a))
* No subject (GITBOOK-482) ([a7699a3](https://github.com/Arize-ai/phoenix/commit/a7699a33414b4f314d4aeb05f76acbe74d9ab60b))
* No subject (GITBOOK-483) ([b2e6f42](https://github.com/Arize-ai/phoenix/commit/b2e6f42f3b8ef4389ef83a359ba6a119dc0959d0))
* No subject (GITBOOK-484) ([f8b9938](https://github.com/Arize-ai/phoenix/commit/f8b9938036e4ccc90d8e4a62cc3b80ce57c618bd))
* No subject (GITBOOK-487) ([e5618d6](https://github.com/Arize-ai/phoenix/commit/e5618d6e654b5231d6dcac5d86ca2021f034c2b9))
* No subject (GITBOOK-488) ([5b978ac](https://github.com/Arize-ai/phoenix/commit/5b978ac39ca0cce42c0ecaccd099bcfc6a6edffd))
* No subject (GITBOOK-492) ([db4f912](https://github.com/Arize-ai/phoenix/commit/db4f912b919fda9db590c6e2dadbdda4563f0997))
* Phoenix Client (GITBOOK-485) ([b7a6e52](https://github.com/Arize-ai/phoenix/commit/b7a6e52fcc04b3ae62d6465379470dc3716fac31))
* Phoenix Deployment (GITBOOK-429) ([d9bc966](https://github.com/Arize-ai/phoenix/commit/d9bc966fe448b36e60030b3f0a900788051c9f03))
* pin tutorials to openai&lt;1 ([#1718](https://github.com/Arize-ai/phoenix/issues/1718)) ([831c041](https://github.com/Arize-ai/phoenix/commit/831c041185e5f514fa1a13836758efecbf05e1dd))
* RAG Evaluation (GITBOOK-378) ([429f537](https://github.com/Arize-ai/phoenix/commit/429f537ee034639dc66c4c80b455b22c65a2e7bd))
* RAG evaluation notebook using traces ([#1857](https://github.com/Arize-ai/phoenix/issues/1857)) ([4b67805](https://github.com/Arize-ai/phoenix/commit/4b67805931b059635997326de596d46a0bad1b76))
* Re-arrange nav (GITBOOK-398) ([54a87eb](https://github.com/Arize-ai/phoenix/commit/54a87eb598c1eb01576a4e5baf3ddfa1f67322e8))
* Ref Link Evals (GITBOOK-358) ([8488b4a](https://github.com/Arize-ai/phoenix/commit/8488b4a1c2f66f3b5bd999d8641e6fb6a31a6970))
* Remove the word golden, simplify title (GITBOOK-395) ([a2233b2](https://github.com/Arize-ai/phoenix/commit/a2233b26b648466f60565c09286f8650823cf97f))
* replace p.active_session() with px.Client() (GITBOOK-486) ([34ecc5b](https://github.com/Arize-ai/phoenix/commit/34ecc5bfc334ba3313259aeb0cd935f40b140e49))
* Retrieval Chunks (GITBOOK-372) ([39976d3](https://github.com/Arize-ai/phoenix/commit/39976d3f020bfaaf0929f3bc8cbedb65d5aae010))
* run_evals api reference docs (GITBOOK-427) ([3e5f88c](https://github.com/Arize-ai/phoenix/commit/3e5f88c7cf9caca250397bd578726967c7f9bd14))
* simplify conceps (GITBOOK-384) ([c38f6c2](https://github.com/Arize-ai/phoenix/commit/c38f6c2cc1b47dfadd881e2ad9923f3d559aff27))
* Simplify examples page (GITBOOK-400) ([6144158](https://github.com/Arize-ai/phoenix/commit/614415882527801ea23fb05eec7e01e12a190807))
* sync ([#1947](https://github.com/Arize-ai/phoenix/issues/1947)) ([c72bbac](https://github.com/Arize-ai/phoenix/commit/c72bbacfbe23aba03167e58077e7b51bc2cde2e2))
* sync for 1.3 ([#1833](https://github.com/Arize-ai/phoenix/issues/1833)) ([4d01e83](https://github.com/Arize-ai/phoenix/commit/4d01e83edb7995ef07d02573d59060be9dba0fc1))
* Trace Evaluations Section (GITBOOK-388) ([2ffa800](https://github.com/Arize-ai/phoenix/commit/2ffa8002d3a3a58a6f2b5e387129cd04f127baca))
* **trace:** refactor llama-index tutorials to use 0.10.0 ([#2277](https://github.com/Arize-ai/phoenix/issues/2277)) ([055b8d6](https://github.com/Arize-ai/phoenix/commit/055b8d6d4d49e1d1e434aba8f638e1c40c4af562))
* **traces:** autogen tracing tutorial ([#1945](https://github.com/Arize-ai/phoenix/issues/1945)) ([0fd02ff](https://github.com/Arize-ai/phoenix/commit/0fd02ff4548342123f349f3e0b0957eac73d676c))
* tracing notebook updates ([#2053](https://github.com/Arize-ai/phoenix/issues/2053)) ([a1e5323](https://github.com/Arize-ai/phoenix/commit/a1e53238e03e8ade931084633f29e55dc1f8dd08))
* update badge ([ddcecea](https://github.com/Arize-ai/phoenix/commit/ddcecea23bc9998f361f3cb41427688f84314295))
* update default value of variable in run_relevance_eval (GITBOOK-368) ([d5bcaf8](https://github.com/Arize-ai/phoenix/commit/d5bcaf8147475f329cb55223cb981eb38611423c))
* update docs for `phoenix.experimental.evals.llm_classify` (GITBOOK-356) ([5c4eb17](https://github.com/Arize-ai/phoenix/commit/5c4eb17562d2101e673c05acf592dd8078c5bfed))
* Update environments illustration (GITBOOK-464) ([e72e290](https://github.com/Arize-ai/phoenix/commit/e72e290603d918dd4a7c7e890cc98a6b442e294a))
* Update image for span kinds (GITBOOK-349) ([891ca67](https://github.com/Arize-ai/phoenix/commit/891ca67d7633c79fa4c547591ccdfcb082ed8cf4))
* update notebooks for px.Client().log_evaluations() ([#2311](https://github.com/Arize-ai/phoenix/issues/2311)) ([a3ca311](https://github.com/Arize-ai/phoenix/commit/a3ca31186a177d4572693a1f5066c5e91aa078de))
* Update Phoenix Inferences Quickstart (GITBOOK-357) ([5aefb0d](https://github.com/Arize-ai/phoenix/commit/5aefb0d5407ad57e44a2a54b8a9b4b97666792b8))
* update prompt to reflect rails (GITBOOK-445) ([dea6dd6](https://github.com/Arize-ai/phoenix/commit/dea6dd6ce2f179cf200eaef5f77ba958140355a2))
* update px.Client (GITBOOK-494) ([61b427c](https://github.com/Arize-ai/phoenix/commit/61b427c157066b1c18f262b268a711a7cba91414))
* update rag eval notebook ([#1950](https://github.com/Arize-ai/phoenix/issues/1950)) ([d06b8b7](https://github.com/Arize-ai/phoenix/commit/d06b8b7cc68b9e0bcb9728cafd68e10b36b4d83e))
* update rag evals docs ([#1954](https://github.com/Arize-ai/phoenix/issues/1954)) ([aa6f36a](https://github.com/Arize-ai/phoenix/commit/aa6f36a3a5329b64fcb8f94d146ec33f5255a6eb))
* update rag_evaluation ([f112150](https://github.com/Arize-ai/phoenix/commit/f11215013c70217739001e10e6d58bf0311f8a9c))
* update readme with a deployment guide ([#2194](https://github.com/Arize-ai/phoenix/issues/2194)) ([bf67775](https://github.com/Arize-ai/phoenix/commit/bf6777569c764392d72d4ccf3c71738079957901))
* Update SECURITY.md ([#2029](https://github.com/Arize-ai/phoenix/issues/2029)) ([363e891](https://github.com/Arize-ai/phoenix/commit/363e8913a3a0f7dafca5dc6bba6bf0e9776c1158))
* Using phoenix with HuggingFace LLMs- getting started ([#1916](https://github.com/Arize-ai/phoenix/issues/1916)) ([b446972](https://github.com/Arize-ai/phoenix/commit/b44697268a1e9599a4a155b9f0e283bb1a9ad349))

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
