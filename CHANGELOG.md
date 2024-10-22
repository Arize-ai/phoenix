# Changelog

## [5.5.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.5.1...arize-phoenix-v5.5.2) (2024-10-21)


### Bug Fixes

* **playground:** do nothing on credential form submit ([#5128](https://github.com/Arize-ai/phoenix/issues/5128)) ([a2de578](https://github.com/Arize-ai/phoenix/commit/a2de578ce8cf735e81fbb50e2ba8c7616b34c065))
* update llama-index versions in extra ([#5141](https://github.com/Arize-ai/phoenix/issues/5141)) ([df2d2a7](https://github.com/Arize-ai/phoenix/commit/df2d2a7a10dc7d839cfbc1c8a2a5bc5b64fa01d8))

## [5.5.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.5.0...arize-phoenix-v5.5.1) (2024-10-19)


### Bug Fixes

* **UI:** bad looking button styles ([#5119](https://github.com/Arize-ai/phoenix/issues/5119)) ([e0e8cc7](https://github.com/Arize-ai/phoenix/commit/e0e8cc780f1b35b61fc4f7a643b40cd3f692d72e))


### Documentation

* add more links and integrations to the readme ([#5121](https://github.com/Arize-ai/phoenix/issues/5121)) ([dc90a6d](https://github.com/Arize-ai/phoenix/commit/dc90a6db43e1a0a9b42bf2f90b39abfc9a9e78e7))
* Update README.md ([e9c081c](https://github.com/Arize-ai/phoenix/commit/e9c081ce2a7488d499d785e79563d74e8add3a57))
* Update README.md wit hmore links ([52af0af](https://github.com/Arize-ai/phoenix/commit/52af0af52a5e5f9c58682f3f2da97044342833fe))

## [5.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.4.0...arize-phoenix-v5.5.0) (2024-10-19)


### Features

* Refactor subscription streaming and plumb through anthropic support ([#5105](https://github.com/Arize-ai/phoenix/issues/5105)) ([d405f61](https://github.com/Arize-ai/phoenix/commit/d405f6178ad00e85cf852ae4a772363ab71d1a25))

## [5.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.3.1...arize-phoenix-v5.4.0) (2024-10-18)


### Features

* add support for secure wss connection ([#5110](https://github.com/Arize-ai/phoenix/issues/5110)) ([9bf0740](https://github.com/Arize-ai/phoenix/commit/9bf0740bf891544bf68c5ce6d8514ccc70e56acc))
* **playground:** return finalized span at end of subscription ([#5089](https://github.com/Arize-ai/phoenix/issues/5089)) ([6ca4288](https://github.com/Arize-ai/phoenix/commit/6ca428886ee14f6866aeee2b64bfa243a7bbf93f))
* **playground:** show span details when playground run ends ([#5108](https://github.com/Arize-ai/phoenix/issues/5108)) ([acce9d9](https://github.com/Arize-ai/phoenix/commit/acce9d94cff415e3fe8b5b85fa1e40d7492130d3))


### Bug Fixes

* Derive playground values instead of storing them in state ([#5067](https://github.com/Arize-ai/phoenix/issues/5067)) ([d935d4b](https://github.com/Arize-ai/phoenix/commit/d935d4bf7063eb9a8ee614431538fbcd753540ba))
* **playground:** optional type in playground tool calls ([#5080](https://github.com/Arize-ai/phoenix/issues/5080)) ([925b496](https://github.com/Arize-ai/phoenix/commit/925b496349ca2167c7a37c980c8981712c3c608a))


### Documentation

* anthropic tools tracing tutorial and fixture ([#5094](https://github.com/Arize-ai/phoenix/issues/5094)) ([51b0201](https://github.com/Arize-ai/phoenix/commit/51b02010fafc51fb5c6aaa2a87abd9b767140303))

## [5.3.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.3.0...arize-phoenix-v5.3.1) (2024-10-17)


### Bug Fixes

* **playground:** add openai as a container dependency ([#5074](https://github.com/Arize-ai/phoenix/issues/5074)) ([6bc625c](https://github.com/Arize-ai/phoenix/commit/6bc625cb6a32514b730ddd35f873c279be78775d))
* Re-enable run button on subscription error ([#5081](https://github.com/Arize-ai/phoenix/issues/5081)) ([1418472](https://github.com/Arize-ai/phoenix/commit/14184723a582ad411d939c2f584c7a378bbe9bdc))

## [5.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.2.2...arize-phoenix-v5.3.0) (2024-10-17)


### Features

* add litellm integrations UI ([#5028](https://github.com/Arize-ai/phoenix/issues/5028)) ([5e895cb](https://github.com/Arize-ai/phoenix/commit/5e895cb3d51e8a47b6845a7595e165363da6703e))
* Add model listing ([#4948](https://github.com/Arize-ai/phoenix/issues/4948)) ([94d92fb](https://github.com/Arize-ai/phoenix/commit/94d92fbb3529c894e81e241831d7424b61c80006))
* **js:** Scaffold ts phoenix client ([#4847](https://github.com/Arize-ai/phoenix/issues/4847)) ([24f447e](https://github.com/Arize-ai/phoenix/commit/24f447ef80ff5d8cb6db7146ed00468f2c1ac8b9))
* make model listing more generic ([#5022](https://github.com/Arize-ai/phoenix/issues/5022)) ([fd0c6ce](https://github.com/Arize-ai/phoenix/commit/fd0c6ce67354bb6cd1bce9b371436b79d60759b9))
* Playground UI prototype ([#4778](https://github.com/Arize-ai/phoenix/issues/4778)) ([a0a83a2](https://github.com/Arize-ai/phoenix/commit/a0a83a29ce93b68c6272efca9195b00ce6397702))
* **playground:** accumulate errors while parsing span attributes ([#4941](https://github.com/Arize-ai/phoenix/issues/4941)) ([c27dfb1](https://github.com/Arize-ai/phoenix/commit/c27dfb1e47bf55b0c7b9a64190bd0e87ab885ec5))
* **playground:** add / delete messages ([#4947](https://github.com/Arize-ai/phoenix/issues/4947)) ([5d45e48](https://github.com/Arize-ai/phoenix/commit/5d45e481f1c131a8b9763b51f7ae2fe7c8bb11e7))
* **playground:** add credential storage ([#4970](https://github.com/Arize-ai/phoenix/issues/4970)) ([b15f2a4](https://github.com/Arize-ai/phoenix/commit/b15f2a45772470d7769729ff7d40a06058778796))
* **playground:** add tools ui ([#5002](https://github.com/Arize-ai/phoenix/issues/5002)) ([767bd37](https://github.com/Arize-ai/phoenix/commit/767bd37c0b6e9e63d24825fe9dbe7e4092d5a880))
* **playground:** allow up to 4 instances, distinguish alphabetically ([#4951](https://github.com/Arize-ai/phoenix/issues/4951)) ([240bfe8](https://github.com/Arize-ai/phoenix/commit/240bfe8277f94b812ceb4a4ede46b88a85aa273b))
* **playground:** copy messages to clipboard ([#5000](https://github.com/Arize-ai/phoenix/issues/5000)) ([23e9d82](https://github.com/Arize-ai/phoenix/commit/23e9d82046ed82ada238a0d8e7f8ece651d1d246))
* **playground:** create llm span for playground runs ([#4982](https://github.com/Arize-ai/phoenix/issues/4982)) ([39c9940](https://github.com/Arize-ai/phoenix/commit/39c9940a4e6ea4f64d3a00872f836195b99e71d5))
* **playground:** Extract and display variables from all message templates as "inputs" ([#4994](https://github.com/Arize-ai/phoenix/issues/4994)) ([b8cd777](https://github.com/Arize-ai/phoenix/commit/b8cd7772e59455b8b3c691609f4baee7a6157a24))
* **playground:** Implement codemirror based template string editor ([#4943](https://github.com/Arize-ai/phoenix/issues/4943)) ([e20716f](https://github.com/Arize-ai/phoenix/commit/e20716f348279cb87b743d416c2b304d6f29cd82))
* **playground:** Implement editable input variable textareas ([#4987](https://github.com/Arize-ai/phoenix/issues/4987)) ([#5006](https://github.com/Arize-ai/phoenix/issues/5006)) ([ab09109](https://github.com/Arize-ai/phoenix/commit/ab091093b7e0ba6308700fdcf6e07b7e931e349a))
* **playground:** Implement message role picker callback ([#4909](https://github.com/Arize-ai/phoenix/issues/4909)) ([b2a8bd0](https://github.com/Arize-ai/phoenix/commit/b2a8bd0245bea2cc39e335dabaa70a856cacd423))
* **playground:** make chat messages match style in traces ([#4931](https://github.com/Arize-ai/phoenix/issues/4931)) ([ed6e05e](https://github.com/Arize-ai/phoenix/commit/ed6e05eb318f6d204a21b2848312784a60f10708))
* **playground:** model selector ([#4971](https://github.com/Arize-ai/phoenix/issues/4971)) ([025c33e](https://github.com/Arize-ai/phoenix/commit/025c33e8a15bf20de49280e2b19d19e3656b58e0))
* **playground:** parse model name and infer provider form span ([#5021](https://github.com/Arize-ai/phoenix/issues/5021)) ([45973b7](https://github.com/Arize-ai/phoenix/commit/45973b7c0b9798d114c3e629861933ee0b287c07))
* **playground:** parse span attribute `llm.input_messages` for playground span replay ([#4906](https://github.com/Arize-ai/phoenix/issues/4906)) ([f4b1d92](https://github.com/Arize-ai/phoenix/commit/f4b1d92512f21fa52e6a541f52021aa0cc6e17ca))
* **playground:** playground layout ([#4978](https://github.com/Arize-ai/phoenix/issues/4978)) ([2c50441](https://github.com/Arize-ai/phoenix/commit/2c50441433b83cf7793d84adf16e3593d62b0bd7))
* **playground:** plumb through and apply template variables ([#5052](https://github.com/Arize-ai/phoenix/issues/5052)) ([d0b1641](https://github.com/Arize-ai/phoenix/commit/d0b1641259d52321e3957765f04aed210a6c3077))
* **playground:** provide a back to trace button from the span playgr… ([#4954](https://github.com/Arize-ai/phoenix/issues/4954)) ([01227e2](https://github.com/Arize-ai/phoenix/commit/01227e2c98d426efaff9d42bab3a73073d85eda7))
* **playground:** re-ordering of messages using dnd ([#4936](https://github.com/Arize-ai/phoenix/issues/4936)) ([ad27394](https://github.com/Arize-ai/phoenix/commit/ad27394dcea64784b4cb9c4346fd254c128a821d))
* **playground:** rudimentary graphql support for messages input ([#4907](https://github.com/Arize-ai/phoenix/issues/4907)) ([ee1f85b](https://github.com/Arize-ai/phoenix/commit/ee1f85b0e528fd32a83af47719dd53dd110fcc8e))
* **playground:** streaming chat completions ([#4785](https://github.com/Arize-ai/phoenix/issues/4785)) ([5948ea3](https://github.com/Arize-ai/phoenix/commit/5948ea382f8f9069b32ba226d271c20abca7fd19))
* **playground:** support azure openai ([#5065](https://github.com/Arize-ai/phoenix/issues/5065)) ([4df3f8a](https://github.com/Arize-ai/phoenix/commit/4df3f8a812c7720423021d431c61760e57a6290f))
* **playground:** toggle for the template language ([#5004](https://github.com/Arize-ai/phoenix/issues/5004)) ([45755bb](https://github.com/Arize-ai/phoenix/commit/45755bbd2d52527bdbdfa58e4c7bd3e3577b1f79))
* **playground:** tool call backend ([#5027](https://github.com/Arize-ai/phoenix/issues/5027)) ([5485c03](https://github.com/Arize-ai/phoenix/commit/5485c03abf4ffe87fe8501cba491613f3636e1c2))
* **playground:** wire up tool calling ui ([#5029](https://github.com/Arize-ai/phoenix/issues/5029)) ([75b7000](https://github.com/Arize-ai/phoenix/commit/75b7000b1b3f5329841d6293ffdcc1bf1e993be9))


### Bug Fixes

* **playground:** authenticate websockets ([#4924](https://github.com/Arize-ai/phoenix/issues/4924)) ([4a53e8e](https://github.com/Arize-ai/phoenix/commit/4a53e8eaa185a52baee6cee4441723493723a00d))
* **playground:** ignore keyboard events in template messages for drag and drop ([#4945](https://github.com/Arize-ai/phoenix/issues/4945)) ([2b6529f](https://github.com/Arize-ai/phoenix/commit/2b6529f997156cb033fb36ea63a8617024ad25d2))
* **playground:** invalidate cache for playground span project to ensure new span is refetched ([#4991](https://github.com/Arize-ai/phoenix/issues/4991)) ([985042c](https://github.com/Arize-ai/phoenix/commit/985042cbb6a3f9804205e2458e2df35ea06f594d))
* **playground:** make messages collapsible so they can be dragged ([#5062](https://github.com/Arize-ai/phoenix/issues/5062)) ([30d95b4](https://github.com/Arize-ai/phoenix/commit/30d95b48fdc829ab23b12bd72fcd5a10da9889ff))
* **playground:** plumb through and record invocation parameters ([#5005](https://github.com/Arize-ai/phoenix/issues/5005)) ([9d375e5](https://github.com/Arize-ai/phoenix/commit/9d375e507d2eebaad910f94fcfad93b98d97f18b))
* **playground:** plumb through credentials ([#5003](https://github.com/Arize-ai/phoenix/issues/5003)) ([0fa0c87](https://github.com/Arize-ai/phoenix/commit/0fa0c870ab6522e9931345fdd4110db35f2f116d))
* **playground:** plumb through model name and providers ([#4999](https://github.com/Arize-ai/phoenix/issues/4999)) ([23958bd](https://github.com/Arize-ai/phoenix/commit/23958bd82922e4c09c662714c9f1b2db8b6f5dc9))
* **playground:** remove toolChoice if no tools provided ([#5079](https://github.com/Arize-ai/phoenix/issues/5079)) ([c883b06](https://github.com/Arize-ai/phoenix/commit/c883b060bf9edb7cf198f10c85474752bd872351))
* **playground:** Remove unused statements in language grammars ([#4992](https://github.com/Arize-ai/phoenix/issues/4992)) ([bbbfd22](https://github.com/Arize-ai/phoenix/commit/bbbfd220f7fdbe1bdf011a4328399cc0bc39331f))


### Documentation

* add environment variable PHOENIX_CSRF_TRUSTED_ORIGINS (GITBOOK-885) ([38fc7ba](https://github.com/Arize-ai/phoenix/commit/38fc7ba4a1e2988fd43ce38f561873359688cb8e))
* Add Evaluating Phoenix Traces nbconverted page (GITBOOK-889) ([38912b4](https://github.com/Arize-ai/phoenix/commit/38912b4a045f0165e92eec07707b98b3c0816680))
* Adding Auth Video (GITBOOK-896) ([11e5a07](https://github.com/Arize-ai/phoenix/commit/11e5a071e876e12d086283fab443e652fe25efe2))
* auth-related environment variables (GITBOOK-887) ([8a8ec8d](https://github.com/Arize-ai/phoenix/commit/8a8ec8d36fe7c3934ab49af244c18d30a0c1f600))
* DSPy doc updates (GITBOOK-886) ([b00def9](https://github.com/Arize-ai/phoenix/commit/b00def9b853ea0175c27fb0d12497a40afca26a7))
* Fixing Quickstart: Tracing (GITBOOK-888) ([e0f9fba](https://github.com/Arize-ai/phoenix/commit/e0f9fbab69bb9888c3ff4ebf53a87ebefac0bde9))
* how to add evaluations to experiments after the fact (GITBOOK-895) ([7b584ee](https://github.com/Arize-ai/phoenix/commit/7b584eeb2b863d6db4dfd28e92c84ad3a0e87556))
* initial playground PRD ([#4777](https://github.com/Arize-ai/phoenix/issues/4777)) ([2a0ddd9](https://github.com/Arize-ai/phoenix/commit/2a0ddd9d9183f761f7db9f47c9219ad615976cbe))
* Mistral 1.0 Changes (GITBOOK-883) ([4e11e86](https://github.com/Arize-ai/phoenix/commit/4e11e86f532a85371a14c91c7962cd6dacc807b8))
* Navbar changes (GITBOOK-884) ([62798ad](https://github.com/Arize-ai/phoenix/commit/62798ad899051574c0f3941fbd8445accd14fc90))
* No subject (GITBOOK-890) ([54556a1](https://github.com/Arize-ai/phoenix/commit/54556a1316095c7aadccb7c298c1fcfaf948a7a4))
* No subject (GITBOOK-891) ([4e5392f](https://github.com/Arize-ai/phoenix/commit/4e5392fa9e0c6bc27715d7ead4dee8ef71ede32b))
* No subject (GITBOOK-892) ([70b386d](https://github.com/Arize-ai/phoenix/commit/70b386dd782ab60ba3dd76a98f7afee6f9a7d33d))
* No subject (GITBOOK-894) ([5625288](https://github.com/Arize-ai/phoenix/commit/56252884ddbf0920e727b97246a2c31dba60c513))
* No subject (GITBOOK-897) ([1d4c250](https://github.com/Arize-ai/phoenix/commit/1d4c250c2b63913c4242bc43fa86a6a5fbc8a561))
* No subject (GITBOOK-898) ([3b56ecd](https://github.com/Arize-ai/phoenix/commit/3b56ecdd47177d60ed5acee035b21d7e4d3d48b5))
* No subject (GITBOOK-899) ([842846a](https://github.com/Arize-ai/phoenix/commit/842846a37f9210edea9bdc8dc9792720959a283b))
* No subject (GITBOOK-900) ([29495bc](https://github.com/Arize-ai/phoenix/commit/29495bcd4e3037cd14153ce6654db74dad22b763))
* No subject (GITBOOK-901) ([8ec974e](https://github.com/Arize-ai/phoenix/commit/8ec974e71f21f3c7ef9e922aec1895e0ecfc7a74))
* No subject (GITBOOK-902) ([290afb4](https://github.com/Arize-ai/phoenix/commit/290afb43af6c3ed0b4a56aa9c8af848be4eb9c7f))
* No subject (GITBOOK-903) ([0d1f3e6](https://github.com/Arize-ai/phoenix/commit/0d1f3e626d41207fedfe4d34c996b5e5b309139c))
* update crewai tutorial for 0.63.0+ ([#5026](https://github.com/Arize-ai/phoenix/issues/5026)) ([c89ba9e](https://github.com/Arize-ai/phoenix/commit/c89ba9e1a8c0918d27859309cead97f5415726c3))
* update dspy notebook to reflect new instrumentation for v2.5 and above ([#4946](https://github.com/Arize-ai/phoenix/issues/4946)) ([61d8a1c](https://github.com/Arize-ai/phoenix/commit/61d8a1c18f76955e3b6b70388096979be2622435))

## [5.2.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.2.1...arize-phoenix-v5.2.2) (2024-10-09)


### Bug Fixes

* add Starlette middleware for checking Cross-Site Request Forgery (CSRF) when trusted origins are specified via environment variable ([#4916](https://github.com/Arize-ai/phoenix/issues/4916)) ([26f8e4b](https://github.com/Arize-ai/phoenix/commit/26f8e4b02ff21029582732fcae71a960c39a074d))
* playwright ([#4935](https://github.com/Arize-ai/phoenix/issues/4935)) ([199d0eb](https://github.com/Arize-ai/phoenix/commit/199d0ebbecaf8bf4159d0e8bb9f4653a93276d4f))


### Reverts

* "chore: use git town for making stacked changes ([#4878](https://github.com/Arize-ai/phoenix/issues/4878))" ([#4933](https://github.com/Arize-ai/phoenix/issues/4933)) ([506f412](https://github.com/Arize-ai/phoenix/commit/506f4129df68514fb1477c116fd876fd21c67d60))

## [5.2.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.2.0...arize-phoenix-v5.2.1) (2024-10-08)


### Bug Fixes

* handle badly ingested llm spans gracefully ([#4915](https://github.com/Arize-ai/phoenix/issues/4915)) ([b008d11](https://github.com/Arize-ai/phoenix/commit/b008d11ddf5b6f72da6b80ed2822a4b153304607))


### Documentation

* **js:** add langchain deno notebook ([#4848](https://github.com/Arize-ai/phoenix/issues/4848)) ([9bb57b7](https://github.com/Arize-ai/phoenix/commit/9bb57b72ffc7bfc15f0f6c1fae570739be066afb))

## [5.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.6...arize-phoenix-v5.2.0) (2024-10-05)


### Features

* phoenix cli ([#4870](https://github.com/Arize-ai/phoenix/issues/4870)) ([a8a8e3b](https://github.com/Arize-ai/phoenix/commit/a8a8e3b1aff2bfa6cb24f821d9b484ab024528a9))


### Bug Fixes

* create optional dependency group for umap-learn and fast-hdbscan ([#4868](https://github.com/Arize-ai/phoenix/issues/4868)) ([32c2bd8](https://github.com/Arize-ai/phoenix/commit/32c2bd8799e2eb0472b158f0007e7faf2aaa7278))

## [5.1.6](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.5...arize-phoenix-v5.1.6) (2024-10-04)


### Bug Fixes

* replace hdbscan with fast-hdbscan ([#4866](https://github.com/Arize-ai/phoenix/issues/4866)) ([c871107](https://github.com/Arize-ai/phoenix/commit/c871107b7881e6e1db6227c2fe06d2420143280b))


### Documentation

* testing philosophy, coverage, types ([#4820](https://github.com/Arize-ai/phoenix/issues/4820)) ([40fd695](https://github.com/Arize-ai/phoenix/commit/40fd695546bcb34197df9cd6d7738540ffa8e9ef))

## [5.1.5](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.4...arize-phoenix-v5.1.5) (2024-10-03)


### Bug Fixes

* bump strawberry-graphql version to 0.243.1 ([#4851](https://github.com/Arize-ai/phoenix/issues/4851)) ([6cd6d9a](https://github.com/Arize-ai/phoenix/commit/6cd6d9a2e3c175676e3dc9b806a45af33034fa3f))
* pin postgres version to 16 in `docker-compose.yml` ([#4855](https://github.com/Arize-ai/phoenix/issues/4855)) ([5b588bf](https://github.com/Arize-ai/phoenix/commit/5b588bf4288043dac03764e46159d090d954ba9f))
* remove incorrect URL in python guide ([#4845](https://github.com/Arize-ai/phoenix/issues/4845)) ([2d263cb](https://github.com/Arize-ai/phoenix/commit/2d263cb45c70f040b63747413af14c14da7b9417))


### Documentation

* add deno notebook examples and scaffold the js monorepo ([#4826](https://github.com/Arize-ai/phoenix/issues/4826)) ([9352c0e](https://github.com/Arize-ai/phoenix/commit/9352c0e8750f691adfbc0cab524e1ffcc53b7dc6))

## [5.1.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.3...arize-phoenix-v5.1.4) (2024-10-02)


### Bug Fixes

* handle `ndarray` for `json.dumps` in `encode_span_to_otlp` ([#4838](https://github.com/Arize-ai/phoenix/issues/4838)) ([ae864d9](https://github.com/Arize-ai/phoenix/commit/ae864d9855a55a1a830ead2c5326e118f661ebd4))

## [5.1.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.2...arize-phoenix-v5.1.3) (2024-10-01)


### Bug Fixes

* Add padding to empty dataset list ([#4812](https://github.com/Arize-ai/phoenix/issues/4812)) ([#4822](https://github.com/Arize-ai/phoenix/issues/4822)) ([41e9a2c](https://github.com/Arize-ai/phoenix/commit/41e9a2c84314b3537053a4038a7eb1d6f08e611d))
* Implement simple email sender to simplify dependencies ([#4815](https://github.com/Arize-ai/phoenix/issues/4815)) ([f56cdb8](https://github.com/Arize-ai/phoenix/commit/f56cdb86136f9cb0af05edfeddd35ba2a0c524c4))

## [5.1.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.1...arize-phoenix-v5.1.2) (2024-09-30)


### Bug Fixes

* update LangGraph agent fixtures path ([#4808](https://github.com/Arize-ai/phoenix/issues/4808)) ([8188dfd](https://github.com/Arize-ai/phoenix/commit/8188dfdfb819a36998e14bf89ea3ac9a231e2075))

## [5.1.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.1.0...arize-phoenix-v5.1.1) (2024-09-30)


### Bug Fixes

* support numpy 2 ([#4798](https://github.com/Arize-ai/phoenix/issues/4798)) ([c4baea4](https://github.com/Arize-ai/phoenix/commit/c4baea40af5058b5aefcef3f283aba53b8770199))

## [5.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.0.0...arize-phoenix-v5.1.0) (2024-09-27)


### Features

* update fixtures.py to include new demos ([#4772](https://github.com/Arize-ai/phoenix/issues/4772)) ([e616fcc](https://github.com/Arize-ai/phoenix/commit/e616fcc12c5855c364d10832d97cd4503c58ddf3))


### Bug Fixes

* fixes to the langgraph example agent ([#4771](https://github.com/Arize-ai/phoenix/issues/4771)) ([d457f70](https://github.com/Arize-ai/phoenix/commit/d457f708fb9c1edc177727aed52e82fc52badedd))

## [5.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.36.0...arize-phoenix-v5.0.0) (2024-09-26)


### ⚠ BREAKING CHANGES

* deprecate python 3.8 ([#4766](https://github.com/Arize-ai/phoenix/issues/4766))
* Remove legacy instrumentation modules ([#4604](https://github.com/Arize-ai/phoenix/issues/4604))

### Features

* Add CreateUserApiKey mutation ([#4476](https://github.com/Arize-ai/phoenix/issues/4476)) ([ecd7a39](https://github.com/Arize-ai/phoenix/commit/ecd7a39d8e863f4d1098fdd8430127a2a6fb4fb3))
* api keys on viewer node ([#4486](https://github.com/Arize-ai/phoenix/issues/4486)) ([366a1ec](https://github.com/Arize-ai/phoenix/commit/366a1ec84d809131f04ee4cfdb6ac471aea42b6c))
* api-key for client headers ([#4460](https://github.com/Arize-ai/phoenix/issues/4460)) ([7fcacff](https://github.com/Arize-ai/phoenix/commit/7fcacffffa0f7fd510e4cffbf132d7dcb8a1a739))
* auth for swagger UI ([#4459](https://github.com/Arize-ai/phoenix/issues/4459)) ([b54d6f7](https://github.com/Arize-ai/phoenix/commit/b54d6f7c7cb76800de68b3bf259b44d7abc0d2e5))
* Auth prometheus metrics ([#4725](https://github.com/Arize-ai/phoenix/issues/4725)) ([c4da0c7](https://github.com/Arize-ai/phoenix/commit/c4da0c700bf1865c853edc9a66df33fc4d327c42))
* **auth:** add admin user management ui ([#4631](https://github.com/Arize-ai/phoenix/issues/4631)) ([b4423ca](https://github.com/Arize-ai/phoenix/commit/b4423ca586e01005bf8f69d67381657f59488050))
* **auth:** Add API key guidance ([#4566](https://github.com/Arize-ai/phoenix/issues/4566)) ([31ac385](https://github.com/Arize-ai/phoenix/commit/31ac3850a2a01d79680d8dfc8d4dff155ad352e5))
* **auth:** add cancel for reset password page ([#4735](https://github.com/Arize-ai/phoenix/issues/4735)) ([fe5e043](https://github.com/Arize-ai/phoenix/commit/fe5e043a9a3faa36321effffd1ddc9dc15227833))
* **auth:** add delete user api keys mutation ([#4489](https://github.com/Arize-ai/phoenix/issues/4489)) ([1a4332b](https://github.com/Arize-ai/phoenix/commit/1a4332b3fd1f6a67ebdb5d260c389ffc94bcd955))
* **auth:** add delete user api keys to ui ([#4503](https://github.com/Arize-ai/phoenix/issues/4503)) ([397ec51](https://github.com/Arize-ai/phoenix/commit/397ec51cfc810ae49eb27555620cdaebe92267ae))
* **auth:** add delete user ui ([#4609](https://github.com/Arize-ai/phoenix/issues/4609)) ([1536275](https://github.com/Arize-ai/phoenix/commit/1536275b37d5b8f78d7a55078821c07f2b33bb84))
* **auth:** add deleteUsers mutation ([#4537](https://github.com/Arize-ai/phoenix/issues/4537)) ([745cba7](https://github.com/Arize-ai/phoenix/commit/745cba7530336192cc8ef010682ed1f25d7f0589))
* **auth:** add environment variables for token expiries ([#4585](https://github.com/Arize-ai/phoenix/issues/4585)) ([2c67d63](https://github.com/Arize-ai/phoenix/commit/2c67d638a96cf9eec8c0e06548f4be8e5d889b1d))
* **auth:** add returnUrl for users that try to access a page while logged out ([#4610](https://github.com/Arize-ai/phoenix/issues/4610)) ([a3552ba](https://github.com/Arize-ai/phoenix/commit/a3552ba6510633f9b1236f3c667aad6f6436a19f))
* **auth:** add support for oauth2 with openid connect discovery ([#4618](https://github.com/Arize-ai/phoenix/issues/4618)) ([8d96e77](https://github.com/Arize-ai/phoenix/commit/8d96e770667285544c1a960a521f8e133934de0c))
* **auth:** add user api keys to profile page ([#4534](https://github.com/Arize-ai/phoenix/issues/4534)) ([26a3d73](https://github.com/Arize-ai/phoenix/commit/26a3d736f3921d19fb3f57d16503e7a3f78db386))
* **auth:** add user friendly messages to the login page ([#4705](https://github.com/Arize-ai/phoenix/issues/4705)) ([332c509](https://github.com/Arize-ai/phoenix/commit/332c5090f48979687ed909630d6a583b0df16699))
* **auth:** auth rbac components ([#4482](https://github.com/Arize-ai/phoenix/issues/4482)) ([1193427](https://github.com/Arize-ai/phoenix/commit/1193427c0d082685a44edaa4057d880e3728a972))
* **auth:** auth refresh tokens ([#4499](https://github.com/Arize-ai/phoenix/issues/4499)) ([d330930](https://github.com/Arize-ai/phoenix/commit/d330930215b7fc69aff76075ea7bb94052c3bbed))
* **auth:** cleaned up reset password UI ([#4671](https://github.com/Arize-ai/phoenix/issues/4671)) ([8b6898e](https://github.com/Arize-ai/phoenix/commit/8b6898e6913cb50811e9b7f4f6d877db12c3064f))
* **auth:** edit profile UI ([#4559](https://github.com/Arize-ai/phoenix/issues/4559)) ([61c5f54](https://github.com/Arize-ai/phoenix/commit/61c5f54cbb776a6320b0f98836777f63d5f02837))
* **auth:** force password repeat on new user adition ([#4591](https://github.com/Arize-ai/phoenix/issues/4591)) ([5f65763](https://github.com/Arize-ai/phoenix/commit/5f65763753a21178027e4045ebf33600a30c8730))
* **auth:** playwright tests ([#4570](https://github.com/Arize-ai/phoenix/issues/4570)) ([bedb66c](https://github.com/Arize-ai/phoenix/commit/bedb66cde8245f0747bbe4e60d5bc900bc53c66c))
* **auth:** profile picture ([#4724](https://github.com/Arize-ai/phoenix/issues/4724)) ([a26a9e9](https://github.com/Arize-ai/phoenix/commit/a26a9e9764b6e34a78ba21ed07d04a9409b7e6b0))
* **auth:** refresh route and auth router refactor ([#4458](https://github.com/Arize-ai/phoenix/issues/4458)) ([a7c53fe](https://github.com/Arize-ai/phoenix/commit/a7c53fe573ebdf35e66fd48714adcaa328b894f0))
* **auth:** Reset password ([#4545](https://github.com/Arize-ai/phoenix/issues/4545)) ([befca2f](https://github.com/Arize-ai/phoenix/commit/befca2f77f8388db3d691e79b6d9703f9d4a847b))
* **auth:** secure `/exports` when auth is enabled ([#4589](https://github.com/Arize-ai/phoenix/issues/4589)) ([b7af851](https://github.com/Arize-ai/phoenix/commit/b7af851f42d04417d2851f62c7a3ee6ad99b7634))
* **auth:** secure graphql api when auth is enabled ([#4508](https://github.com/Arize-ai/phoenix/issues/4508)) ([39b1e07](https://github.com/Arize-ai/phoenix/commit/39b1e07d1212a7afa557e6a7378701725c3329d1))
* **auth:** UI guidance on how to set api keys for tracing and experi… ([#4578](https://github.com/Arize-ai/phoenix/issues/4578)) ([6b14b11](https://github.com/Arize-ai/phoenix/commit/6b14b1126714ce447704886362865d7783234034))
* **auth:** user of a given key ([#4442](https://github.com/Arize-ai/phoenix/issues/4442)) ([f8bbf25](https://github.com/Arize-ai/phoenix/commit/f8bbf25171a82167480cfbc186805e6981e6dc46))
* **auth:** User profile and viewer context ([#4480](https://github.com/Arize-ai/phoenix/issues/4480)) ([8012d6a](https://github.com/Arize-ai/phoenix/commit/8012d6a168ad97f602d8c49e0aa02fcfd2145620))
* environment variable for `Secure` attribute on cookies ([#4520](https://github.com/Arize-ai/phoenix/issues/4520)) ([655a459](https://github.com/Arize-ai/phoenix/commit/655a45985320f39a4d4c76a242883c70e205135a))
* fetch db on token cache miss ([#4723](https://github.com/Arize-ai/phoenix/issues/4723)) ([7a41f5a](https://github.com/Arize-ai/phoenix/commit/7a41f5afbb89b9f65616b49d9fbc369eb6ccc0ec))
* **gql:** indicate whether user password needs reset ([#4514](https://github.com/Arize-ai/phoenix/issues/4514)) ([a76638b](https://github.com/Arize-ai/phoenix/commit/a76638bf15d416d901eccc71a7c56d44049d2814))
* graphql resolvers to patch users ([#4504](https://github.com/Arize-ai/phoenix/issues/4504)) ([13f6b16](https://github.com/Arize-ai/phoenix/commit/13f6b165465016a506369a850d4312c572662faa))
* Implement serverside rate limiter ([#4431](https://github.com/Arize-ai/phoenix/issues/4431)) ([18b587f](https://github.com/Arize-ai/phoenix/commit/18b587fa814b3c320231568437ab2c31515e97bb))
* per-user password salt ([#4449](https://github.com/Arize-ai/phoenix/issues/4449)) ([7f739db](https://github.com/Arize-ai/phoenix/commit/7f739dbe1bf9c8dafc4c419ad3ce3f5eddedc426))
* **playground:** add skeleton playground page ([#4648](https://github.com/Arize-ai/phoenix/issues/4648)) ([d23a7c3](https://github.com/Arize-ai/phoenix/commit/d23a7c3064f2ab2bd0b13cfb8e2ac530d4fd3a74))
* Remove legacy instrumentation modules ([#4604](https://github.com/Arize-ai/phoenix/issues/4604)) ([e27df56](https://github.com/Arize-ai/phoenix/commit/e27df56c5d3bc909d7aa1aeb3e05df6c4b78c0dc))
* role based access control for gql queries ([#4554](https://github.com/Arize-ai/phoenix/issues/4554)) ([f25e751](https://github.com/Arize-ai/phoenix/commit/f25e7517b8322bdf447480a6a235cd56ff39739e))
* smtp for password reset ([#4630](https://github.com/Arize-ai/phoenix/issues/4630)) ([44dac66](https://github.com/Arize-ai/phoenix/commit/44dac6665120cb3edf86b61b2975dc8c6507d295))
* token-based authentication ([#4370](https://github.com/Arize-ai/phoenix/issues/4370)) ([41a8654](https://github.com/Arize-ai/phoenix/commit/41a86541ee37036d599be2b02fb84296ad4d35c0))
* Wire up API keys via env var for Phoenix clients and experiments ([#4617](https://github.com/Arize-ai/phoenix/issues/4617)) ([246770d](https://github.com/Arize-ai/phoenix/commit/246770dc0b7cd73ca9e0b9c9b722594b73c3e55f))


### Bug Fixes

* allow logging out with only the refresh token ([#4706](https://github.com/Arize-ai/phoenix/issues/4706)) ([b31d9f9](https://github.com/Arize-ai/phoenix/commit/b31d9f959c7db60fab85e14179f6a42732e42750))
* allow secret when auth is disabled ([#4466](https://github.com/Arize-ai/phoenix/issues/4466)) ([ad1763d](https://github.com/Arize-ai/phoenix/commit/ad1763d2cdaab702032935fe3f04556a7425319c))
* **auth:** add back user api keys table ([#4494](https://github.com/Arize-ai/phoenix/issues/4494)) ([162ada8](https://github.com/Arize-ai/phoenix/commit/162ada848de75c18036a796b4928b0e93b0eff07))
* **auth:** don't show error on successful logout ([#4535](https://github.com/Arize-ai/phoenix/issues/4535)) ([3dab931](https://github.com/Arize-ai/phoenix/commit/3dab931a536a5e58c28eab168e41d17863c5046c))
* **auth:** fix graphiql_ide param type ([#4496](https://github.com/Arize-ai/phoenix/issues/4496)) ([8462567](https://github.com/Arize-ai/phoenix/commit/846256758caa9e6a3864b21cf624fda3c846799f))
* **auth:** handle forgot password form submission ([#4755](https://github.com/Arize-ai/phoenix/issues/4755)) ([3ab5959](https://github.com/Arize-ai/phoenix/commit/3ab5959969868685ec06fbadb398d9a49049c97b))
* **auth:** infer origin url ([#4737](https://github.com/Arize-ai/phoenix/issues/4737)) ([bb2df0f](https://github.com/Arize-ai/phoenix/commit/bb2df0fbe52a1a73a04086bd89f69b742d5ed50b))
* **auth:** make username a required field ([#4734](https://github.com/Arize-ai/phoenix/issues/4734)) ([77cc1fe](https://github.com/Arize-ai/phoenix/commit/77cc1fe0a6a93aa195b628be09abc61891d98767))
* **auth:** prevent first admin password salt from being reset on every start ([#4477](https://github.com/Arize-ai/phoenix/issues/4477)) ([bccdbf1](https://github.com/Arize-ai/phoenix/commit/bccdbf14bcd0302d6904055b83c070790f8b1c4e))
* **auth:** set oauth2 state and nonce cookies with lax samesite policy ([#4693](https://github.com/Arize-ai/phoenix/issues/4693)) ([795e769](https://github.com/Arize-ai/phoenix/commit/795e7698b5b93ee5f87e5cc8ed8d54826772c604))
* **auth:** soft-delete users ([#4562](https://github.com/Arize-ai/phoenix/issues/4562)) ([f8f40b6](https://github.com/Arize-ai/phoenix/commit/f8f40b6a6e31dd6d0576b0a09279a20b6d992ce1))
* **auth:** strengthen auth method constraint ([#4744](https://github.com/Arize-ai/phoenix/issues/4744)) ([d399cb4](https://github.com/Arize-ai/phoenix/commit/d399cb4890276f82fef8cf62f84a6bd289f4b887))
* Catch decode error ([#4752](https://github.com/Arize-ai/phoenix/issues/4752)) ([b9d0caf](https://github.com/Arize-ai/phoenix/commit/b9d0caf50b7dd06a23f493968ec6fc50f6be7b05))
* clean up after token auth ([#4447](https://github.com/Arize-ai/phoenix/issues/4447)) ([bcf273d](https://github.com/Arize-ai/phoenix/commit/bcf273dfc09e6838b98c812d781a9cc25058a9e3))
* Correct auth login rate limit routes ([#4698](https://github.com/Arize-ai/phoenix/issues/4698)) ([e79a54c](https://github.com/Arize-ai/phoenix/commit/e79a54cc1cb72b7ac44fde66a33df8a5f6765390))
* db lookup on token cache miss ([#4726](https://github.com/Arize-ai/phoenix/issues/4726)) ([3e0cbc6](https://github.com/Arize-ai/phoenix/commit/3e0cbc61f69f1e5035656be17ba1c896109373c1))
* deprecate python 3.8 ([#4766](https://github.com/Arize-ai/phoenix/issues/4766)) ([2213a79](https://github.com/Arize-ai/phoenix/commit/2213a790269cd0a6017a6f6191b8d2194542e879))
* don't redirect if there is no viewer in case auth is disabled ([#4547](https://github.com/Arize-ai/phoenix/issues/4547)) ([b80f532](https://github.com/Arize-ai/phoenix/commit/b80f532485b41a3688436d498b494aeff4953081))
* Fix DB unittest reliability ([#4548](https://github.com/Arize-ai/phoenix/issues/4548)) ([29460c5](https://github.com/Arize-ai/phoenix/commit/29460c5d5b458f4309e91777f8653644b28a0517))
* forbid role change on default admin ([#4647](https://github.com/Arize-ai/phoenix/issues/4647)) ([775b4f8](https://github.com/Arize-ai/phoenix/commit/775b4f81abac4ce39ba88cc1675b830190be4722))
* improve error message for phoenix secret ([#4461](https://github.com/Arize-ai/phoenix/issues/4461)) ([f7e9731](https://github.com/Arize-ai/phoenix/commit/f7e97315e9c517d00ccad1e459b7aba43b19e580))
* inadvertent cookie deletion when changing user password via PatchUser ([#4637](https://github.com/Arize-ai/phoenix/issues/4637)) ([7077cc2](https://github.com/Arize-ai/phoenix/commit/7077cc249a96e0d0e8fad85538225ff88d7dcec0))
* only redirect if auth is enabled ([#4768](https://github.com/Arize-ai/phoenix/issues/4768)) ([ff14180](https://github.com/Arize-ai/phoenix/commit/ff141803f79c7815ee0092f6459118974e19292e))
* overflow of UI issues ([#4759](https://github.com/Arize-ai/phoenix/issues/4759)) ([4e68274](https://github.com/Arize-ai/phoenix/commit/4e68274d6f080b5a3fca017bf2a0e430542de00a))
* padding on users table ([#4753](https://github.com/Arize-ai/phoenix/issues/4753)) ([c2361a3](https://github.com/Arize-ai/phoenix/commit/c2361a39b31cb7739a196ea71bb3ff7cbe092864))
* playwright scaffolding and user action menu rendering ([#4697](https://github.com/Arize-ai/phoenix/issues/4697)) ([8892180](https://github.com/Arize-ai/phoenix/commit/88921802f9cbb580617d5ff80b5b0c6ab6acb0be))
* **playwright:** make rate-limiting test run last ([#4738](https://github.com/Arize-ai/phoenix/issues/4738)) ([eabf268](https://github.com/Arize-ai/phoenix/commit/eabf2689516cc557d4b836c4284588fe66ed8061))
* **playwright:** revert back to localhost for playwright ([#4758](https://github.com/Arize-ai/phoenix/issues/4758)) ([7c2a864](https://github.com/Arize-ai/phoenix/commit/7c2a864f48fce20c8e69c4f1b985dbd4c40279b8))
* remove `exp` from `jwt` ([#4729](https://github.com/Arize-ai/phoenix/issues/4729)) ([0e6e1e8](https://github.com/Arize-ai/phoenix/commit/0e6e1e81113bec065bbe7323558b950a44269b4d))
* remove python 3.8 version dep ([#4751](https://github.com/Arize-ai/phoenix/issues/4751)) ([4f5120b](https://github.com/Arize-ai/phoenix/commit/4f5120bbd966b4dc4f377a40bba4741882073992))
* sqlite should explicitly autoincrement integer primary keys ([#4468](https://github.com/Arize-ai/phoenix/issues/4468)) ([e7e86f0](https://github.com/Arize-ai/phoenix/commit/e7e86f023d5cbbba7299d25f74fd3dcd66ad278c))
* use referer from headers for base url in password reset url ([#4746](https://github.com/Arize-ai/phoenix/issues/4746)) ([77675c9](https://github.com/Arize-ai/phoenix/commit/77675c9a80533bc7d995b4facdba56986c6e363a))
* user deletion should delete all tokens ([#4655](https://github.com/Arize-ai/phoenix/issues/4655)) ([cf3c6be](https://github.com/Arize-ai/phoenix/commit/cf3c6bee6655573fd77ffc3bced3bac12bdc6cf6))
* user should be able to initiate password reset again before existing token is used or expires ([#4674](https://github.com/Arize-ai/phoenix/issues/4674)) ([3f33d1a](https://github.com/Arize-ai/phoenix/commit/3f33d1ab0d4170d2986e7df23e536582ac4addd7))
* username should be optional for user creation ([#4595](https://github.com/Arize-ai/phoenix/issues/4595)) ([eae81e8](https://github.com/Arize-ai/phoenix/commit/eae81e89d56d39325a185d8aeaf64216ed747d8e))
* users should not be asked to reset password again right after they reset their password ([#4672](https://github.com/Arize-ai/phoenix/issues/4672)) ([f63b4f6](https://github.com/Arize-ai/phoenix/commit/f63b4f661711067d85d5506c9027e4129955a1d4))


### Documentation

* add agent framework example ([#4703](https://github.com/Arize-ai/phoenix/issues/4703)) ([b870a59](https://github.com/Arize-ai/phoenix/commit/b870a5988d198ab9f8aaeb3922f3ceea31792070))
* **auth:** instrumentation migration ([#4732](https://github.com/Arize-ai/phoenix/issues/4732)) ([62dd2e7](https://github.com/Arize-ai/phoenix/commit/62dd2e793959d70a44dff48599e2cd60be185389))
* **auth:** migration guide for auth ([#4721](https://github.com/Arize-ai/phoenix/issues/4721)) ([ba2ab86](https://github.com/Arize-ai/phoenix/commit/ba2ab8669cfc59cf374bb8bb046e3c35f2b0401c))
* deprecate phoenix.trace.openai ([#4757](https://github.com/Arize-ai/phoenix/issues/4757)) ([3bd8d37](https://github.com/Arize-ai/phoenix/commit/3bd8d377c988868467d962de4de3fd4d6964d44c))
* Playwright in READE ([#4719](https://github.com/Arize-ai/phoenix/issues/4719)) ([adb3019](https://github.com/Arize-ai/phoenix/commit/adb301994b3c0a71b10f46a66d4d58ef68ef2e66))

## [4.36.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.35.2...arize-phoenix-v4.36.0) (2024-09-20)


### Features

* Add environment variable setting for structured logging ([#4635](https://github.com/Arize-ai/phoenix/issues/4635)) ([a50ca10](https://github.com/Arize-ai/phoenix/commit/a50ca1018014567d44835680a4daaaa07551d27c))


### Bug Fixes

* close db connection after migration ([#4702](https://github.com/Arize-ai/phoenix/issues/4702)) ([b8b724a](https://github.com/Arize-ai/phoenix/commit/b8b724af725830e30094fd521c897599abd864c8))

## [4.35.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.35.1...arize-phoenix-v4.35.2) (2024-09-20)


### Bug Fixes

* `TraceDataset.to_span()` should unflatten dot separators at all levels ([#4694](https://github.com/Arize-ai/phoenix/issues/4694)) ([c4a6831](https://github.com/Arize-ai/phoenix/commit/c4a68315faf0d0220c5f48c586478d812f413e93))


### Documentation

* add evaluating traces notebook ([#4521](https://github.com/Arize-ai/phoenix/issues/4521)) ([f04fd61](https://github.com/Arize-ai/phoenix/commit/f04fd61ba10d42e2abf6b0b2490a274b00dbb1c6))

## [4.35.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.35.0...arize-phoenix-v4.35.1) (2024-09-17)


### Bug Fixes

* submodule packaging for bazel ([#4643](https://github.com/Arize-ai/phoenix/issues/4643)) ([f780d34](https://github.com/Arize-ai/phoenix/commit/f780d3475e50c523f45ab4df5ca32321c748740c))

## [4.35.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.34.0...arize-phoenix-v4.35.0) (2024-09-17)


### Features

* adds o1 testing demo project ([#4636](https://github.com/Arize-ai/phoenix/issues/4636)) ([8140eaf](https://github.com/Arize-ai/phoenix/commit/8140eafba457b443aa4684bd2ecf978ed0dc85df))

## [4.34.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.33.2...arize-phoenix-v4.34.0) (2024-09-17)


### Features

* finer grain last N time range ([#4632](https://github.com/Arize-ai/phoenix/issues/4632)) ([021f4e8](https://github.com/Arize-ai/phoenix/commit/021f4e84442b0b4b298906a0d441472cba98f55e))


### Documentation

* create groq_tracing_tutorial.ipynb ([#4615](https://github.com/Arize-ai/phoenix/issues/4615)) ([5883c5a](https://github.com/Arize-ai/phoenix/commit/5883c5af296bc77f5249ec955b397ef041041507))
* **quickstart:** convert Phoenix inferences instructions to notebook ([#4593](https://github.com/Arize-ai/phoenix/issues/4593)) ([1e9541a](https://github.com/Arize-ai/phoenix/commit/1e9541a142bd040be726f78d530ceef796c2593c))

## [4.33.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.33.1...arize-phoenix-v4.33.2) (2024-09-12)


### Bug Fixes

* `get_retrieved_documents` should handle missing values ([#4599](https://github.com/Arize-ai/phoenix/issues/4599)) ([4f604b1](https://github.com/Arize-ai/phoenix/commit/4f604b1fd8d76560535ca020990eaea689a0f25b))


### Documentation

* add docs link to readme ([#4572](https://github.com/Arize-ai/phoenix/issues/4572)) ([558c5d3](https://github.com/Arize-ai/phoenix/commit/558c5d38f1d7835fc8e4b0f7ece5198537d6a82a))

## [4.33.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.33.0...arize-phoenix-v4.33.1) (2024-09-05)


### Bug Fixes

* Fix typo and update ensure dataloader results ordering ([#4527](https://github.com/Arize-ai/phoenix/issues/4527)) ([21d71d1](https://github.com/Arize-ai/phoenix/commit/21d71d166d80a85f7c307d98462f5fcc05c61332))

## [4.33.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.32.0...arize-phoenix-v4.33.0) (2024-09-04)


### Features

* **auth:** add user api keys table ([#4473](https://github.com/Arize-ai/phoenix/issues/4473)) ([7c1334d](https://github.com/Arize-ai/phoenix/commit/7c1334dcd9e2e862c9aab8e2b6d66b59d5e72bb4))
* incorporate schema for postgresql and add integration test ([#4474](https://github.com/Arize-ai/phoenix/issues/4474)) ([cd64a99](https://github.com/Arize-ai/phoenix/commit/cd64a9975d673f872d00c26478c1ad832bd00303))
* **onboarding:** add bedrock ([#4465](https://github.com/Arize-ai/phoenix/issues/4465)) ([b03901b](https://github.com/Arize-ai/phoenix/commit/b03901b95a8d14b1cd4ad74d92ee2c100f47c281))
* render db schema in welcome message when applicable ([#4479](https://github.com/Arize-ai/phoenix/issues/4479)) ([ecdf039](https://github.com/Arize-ai/phoenix/commit/ecdf03958d9f30f7a0a485517bc64fab4c2eb0e7))
* Return Query from DeleteSystemApiKey mutation ([#4432](https://github.com/Arize-ai/phoenix/issues/4432)) ([b0639e0](https://github.com/Arize-ai/phoenix/commit/b0639e0f18f658129da967d62b560e8d76a1c181))


### Bug Fixes

* small typo in app ([#4457](https://github.com/Arize-ai/phoenix/issues/4457)) ([55d7b87](https://github.com/Arize-ai/phoenix/commit/55d7b87dd94d8ae0231788de45f3a0abe343fdd2))


### Documentation

* create nbconvert makefile ([#4456](https://github.com/Arize-ai/phoenix/issues/4456)) ([f32f842](https://github.com/Arize-ai/phoenix/commit/f32f842a5b853d3b851c9f7d9fa49f1db9691ed0))
* fix spacing ([f959dc6](https://github.com/Arize-ai/phoenix/commit/f959dc6aa9673ea377a675eafa5997fcd1428a6b))
* improve migration guide ([#4425](https://github.com/Arize-ai/phoenix/issues/4425)) ([aed6c83](https://github.com/Arize-ai/phoenix/commit/aed6c838eb9ca395df340fcec1d129e80f071e4e))
* Update hosted Phoenix tutorials to use register and add quickstarts ([#4371](https://github.com/Arize-ai/phoenix/issues/4371)) ([14b898b](https://github.com/Arize-ai/phoenix/commit/14b898bc741d3e9c6c770915bf93a95d3533c102))
* update readme with a gif ([15a8d0a](https://github.com/Arize-ai/phoenix/commit/15a8d0ac9d3953a99e62106a06b0c8434e6e14a4))
* vision tracing tutorial ([#4441](https://github.com/Arize-ai/phoenix/issues/4441)) ([669c1b7](https://github.com/Arize-ai/phoenix/commit/669c1b7496088ceabb3f1a745138e258e100f51b))

## [4.32.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.31.0...arize-phoenix-v4.32.0) (2024-08-29)


### Features

* **auth:** delete system keys ([#4426](https://github.com/Arize-ai/phoenix/issues/4426)) ([a6fa21e](https://github.com/Arize-ai/phoenix/commit/a6fa21e86d735bf7e82deacd4a8dadefbfa712e9))
* **auth:** wire up login/logout ([#4419](https://github.com/Arize-ai/phoenix/issues/4419)) ([5f60258](https://github.com/Arize-ai/phoenix/commit/5f6025889036be03ded6d35fa9e1cee207c7dd55))
* **tools:** Display tool schema definitions  in the UI ([#4428](https://github.com/Arize-ai/phoenix/issues/4428)) ([6aa787e](https://github.com/Arize-ai/phoenix/commit/6aa787e13b9635696c32c90b04e68726e0f1381b))
* **ui:** add the ability to turn off auto-refresh of projects ([#4414](https://github.com/Arize-ai/phoenix/issues/4414)) ([4a792d2](https://github.com/Arize-ai/phoenix/commit/4a792d27005ccdcc73713000de70fa28778c5e66))


### Bug Fixes

* error message for PHOENIX_PORT env vars auto-generated by kubernetes ([#4422](https://github.com/Arize-ai/phoenix/issues/4422)) ([63d0adb](https://github.com/Arize-ai/phoenix/commit/63d0adbe5a78693f0060bd0015a82532c268d76e))
* scaffolder should incorporate port from cammand line ([#4415](https://github.com/Arize-ai/phoenix/issues/4415)) ([0678c86](https://github.com/Arize-ai/phoenix/commit/0678c86d310c54c54a2307559efae344eb949931))


### Documentation

* simplify readme ([76db494](https://github.com/Arize-ai/phoenix/commit/76db4941d6ce1d5422d44ad68761e6318a6a40f0))

## [4.31.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.30.1...arize-phoenix-v4.31.0) (2024-08-28)


### Features

* **ui:** add the ability to turn off auto-refresh of projects ([#4414](https://github.com/Arize-ai/phoenix/issues/4414)) ([4a792d2](https://github.com/Arize-ai/phoenix/commit/4a792d27005ccdcc73713000de70fa28778c5e66))
* **vision:** show images in a gallery, expandable images ([#4407](https://github.com/Arize-ai/phoenix/issues/4407)) ([9e2d67f](https://github.com/Arize-ai/phoenix/commit/9e2d67f72c208437a70ca3e71fb1e6f33903e5c4))


### Bug Fixes

* annotation events should refresh trace project ([#4412](https://github.com/Arize-ai/phoenix/issues/4412)) ([3a18c13](https://github.com/Arize-ai/phoenix/commit/3a18c13eda514984badb07fb33ff235a77a0a2aa))
* **experiments:** ensure compare experiments page does not break for experiments that contain a large number of examples ([#4402](https://github.com/Arize-ai/phoenix/issues/4402)) ([71484e0](https://github.com/Arize-ai/phoenix/commit/71484e09407e4d73f7641820b7f642bec3a388c0))
* use dataloader for experiment run annotations ([#4397](https://github.com/Arize-ai/phoenix/issues/4397)) ([5582ce6](https://github.com/Arize-ai/phoenix/commit/5582ce66115b9badf4b3147ce0c9a70ac39191f2))


### Documentation

* demo dataset ingestion ([#4393](https://github.com/Arize-ai/phoenix/issues/4393)) ([c00862a](https://github.com/Arize-ai/phoenix/commit/c00862aec125aab33a1d4c5fb182a192df999f10))

## [4.31.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.30.2...arize-phoenix-v4.31.0) (2024-08-27)


### Features

* **vision:** show images in a gallery, expandable images ([#4407](https://github.com/Arize-ai/phoenix/issues/4407)) ([9e2d67f](https://github.com/Arize-ai/phoenix/commit/9e2d67f72c208437a70ca3e71fb1e6f33903e5c4))


### Bug Fixes

* annotation events should refresh trace project ([#4412](https://github.com/Arize-ai/phoenix/issues/4412)) ([3a18c13](https://github.com/Arize-ai/phoenix/commit/3a18c13eda514984badb07fb33ff235a77a0a2aa))


### Documentation

* demo dataset ingestion ([#4393](https://github.com/Arize-ai/phoenix/issues/4393)) ([c00862a](https://github.com/Arize-ai/phoenix/commit/c00862aec125aab33a1d4c5fb182a192df999f10))

## [4.30.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.30.1...arize-phoenix-v4.30.2) (2024-08-27)


### Bug Fixes

* **experiments:** ensure compare experiments page does not break for experiments that contain a large number of examples ([#4402](https://github.com/Arize-ai/phoenix/issues/4402)) ([71484e0](https://github.com/Arize-ai/phoenix/commit/71484e09407e4d73f7641820b7f642bec3a388c0))
* use dataloader for experiment run annotations ([#4397](https://github.com/Arize-ai/phoenix/issues/4397)) ([5582ce6](https://github.com/Arize-ai/phoenix/commit/5582ce66115b9badf4b3147ce0c9a70ac39191f2))

## [4.30.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.30.0...arize-phoenix-v4.30.1) (2024-08-26)


### Bug Fixes

* improve timeout error message for query_spans method ([#4391](https://github.com/Arize-ai/phoenix/issues/4391)) ([81811f1](https://github.com/Arize-ai/phoenix/commit/81811f1c18d98f89f5d3e941694d3965e957d7a7))

## [4.30.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.29.0...arize-phoenix-v4.30.0) (2024-08-26)


### Features

* **onboarding:** New project onboarding ([#4372](https://github.com/Arize-ai/phoenix/issues/4372)) ([16ac5ed](https://github.com/Arize-ai/phoenix/commit/16ac5edcfbe44b0e8fef018f2fdc1c083aaa2765))

## [4.29.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.28.1...arize-phoenix-v4.29.0) (2024-08-26)


### Features

* Add Experiments API to OpenAPI Schema ([#4356](https://github.com/Arize-ai/phoenix/issues/4356)) ([ca4fb5d](https://github.com/Arize-ai/phoenix/commit/ca4fb5db7e02f80777dc3e5ce22614aa91977109))
* Delete system API key mutation ([#4337](https://github.com/Arize-ai/phoenix/issues/4337)) ([b6bb6bc](https://github.com/Arize-ai/phoenix/commit/b6bb6bc71266ef3178c31c358a5c63cf188dd868))


### Bug Fixes

* **docker:** support arm64 architecture in docker images ([#4386](https://github.com/Arize-ai/phoenix/issues/4386)) ([1b6eec8](https://github.com/Arize-ai/phoenix/commit/1b6eec898ab5f8bc355245f1ed14f54ad8a3173c))


### Documentation

* **examples:** add crew ai example ([#4373](https://github.com/Arize-ai/phoenix/issues/4373)) ([93ffb67](https://github.com/Arize-ai/phoenix/commit/93ffb67d94b7d8db1d917897ba613dfe47fef5f4))

## [4.28.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.28.0...arize-phoenix-v4.28.1) (2024-08-23)


### Bug Fixes

* format code ([#4343](https://github.com/Arize-ai/phoenix/issues/4343)) ([32e131a](https://github.com/Arize-ai/phoenix/commit/32e131a17525b6fbe65178a03d7fa338490fdf0b))

## [4.28.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.27.0...arize-phoenix-v4.28.0) (2024-08-23)


### Features

* **auth:** add create user modal to ui ([#4319](https://github.com/Arize-ai/phoenix/issues/4319)) ([e77a390](https://github.com/Arize-ai/phoenix/commit/e77a390d6dbc3ae8e226c0397aca3c556b5b722e))
* **auth:** prettier login screen ([#4332](https://github.com/Arize-ai/phoenix/issues/4332)) ([18f8240](https://github.com/Arize-ai/phoenix/commit/18f82403bff53bc7ec4966dc44d70b1f403a972d))


### Documentation

* update api reference ([#4316](https://github.com/Arize-ai/phoenix/issues/4316)) ([387346d](https://github.com/Arize-ai/phoenix/commit/387346defa90d5f14c6b102b55640ce943d0621a))

## [4.27.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.26.0...arize-phoenix-v4.27.0) (2024-08-22)


### Features

* Add `list_experiments` client method ([#4271](https://github.com/Arize-ai/phoenix/issues/4271)) ([a063d83](https://github.com/Arize-ai/phoenix/commit/a063d839007e117152605ffd85a63b9c99ac82f6))
* Add fixtures only for new DBs, add flag to force fixture ingestion ([#4315](https://github.com/Arize-ai/phoenix/issues/4315)) ([ef4adcd](https://github.com/Arize-ai/phoenix/commit/ef4adcd0df4615af0f7aef986c2d7d158cf7d650))
* **auth:** minimal login page ([#4320](https://github.com/Arize-ai/phoenix/issues/4320)) ([764f359](https://github.com/Arize-ai/phoenix/commit/764f3594cf44ba23395b5e6cc4d021bb33d8b365))
* **experiments:** add the ability to copy experiment IDs to the clipboard ([#4317](https://github.com/Arize-ai/phoenix/issues/4317)) ([589ac03](https://github.com/Arize-ai/phoenix/commit/589ac03677108be9c11c2acd66a94d79ee32e6fa))
* onboarding demo projects ([#4262](https://github.com/Arize-ai/phoenix/issues/4262)) ([74dd3c7](https://github.com/Arize-ai/phoenix/commit/74dd3c7b678e4577d811ca020d0119dc36f4ce8e))


### Bug Fixes

* handle `None` values in the `reference` column in the `get_qa_with_reference` helper ([#4309](https://github.com/Arize-ai/phoenix/issues/4309)) ([58685b7](https://github.com/Arize-ai/phoenix/commit/58685b73d2675cb03b6658de362c37fbd9dc3cff))

## [4.26.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.25.0...arize-phoenix-v4.26.0) (2024-08-21)


### Features

* **auth:** add login/ logout routes and createUser mutation ([#4293](https://github.com/Arize-ai/phoenix/issues/4293)) ([a3ff0f6](https://github.com/Arize-ai/phoenix/commit/a3ff0f6b1c90f126db1249e877d2369ab9bffe02))


### Bug Fixes

* postgresql driver name for db migrations ([#4304](https://github.com/Arize-ai/phoenix/issues/4304)) ([9e683f2](https://github.com/Arize-ai/phoenix/commit/9e683f2ef3c99a7c24233ea45ac1d666399107e4))

## [4.25.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.24.0...arize-phoenix-v4.25.0) (2024-08-21)


### Features

* **auth:** add expiry support for system keys ([#4296](https://github.com/Arize-ai/phoenix/issues/4296)) ([8d436a5](https://github.com/Arize-ai/phoenix/commit/8d436a5d6e8b6d79a169c0ce186f1e5e07da62cd))
* **auth:** create system key ([#4235](https://github.com/Arize-ai/phoenix/issues/4235)) ([bae5fbe](https://github.com/Arize-ai/phoenix/commit/bae5fbee5b7b51146de61ee8b5e37463a550ad63))
* **auth:** system api keys ui ([#4270](https://github.com/Arize-ai/phoenix/issues/4270)) ([695fdea](https://github.com/Arize-ai/phoenix/commit/695fdea226a936a3b238d8bcbfe6e4ec49e31fe4))
* Clarify `register` API documentation ([#4280](https://github.com/Arize-ai/phoenix/issues/4280)) ([819236c](https://github.com/Arize-ai/phoenix/commit/819236c1e654f168abd725ca2c4e3d7cf187b384))
* Create `phoenix.otel` package ([#4230](https://github.com/Arize-ai/phoenix/issues/4230)) ([4e2ad61](https://github.com/Arize-ai/phoenix/commit/4e2ad615a6685bb60df987e1f23f3162eb5d3ca5))


### Bug Fixes

* conditionally display re-ranker queries in span details ([#4263](https://github.com/Arize-ai/phoenix/issues/4263)) ([248d61b](https://github.com/Arize-ai/phoenix/commit/248d61bace47c98cf18580e9f202a89e31cd635f))
* **python:** application launch on Windows ([#4276](https://github.com/Arize-ai/phoenix/issues/4276)) ([9ede0a3](https://github.com/Arize-ai/phoenix/commit/9ede0a3e7068f5f5c76bebcdc070d73fbcabd17d))


### Documentation

* add haystack to README ([a244cdd](https://github.com/Arize-ai/phoenix/commit/a244cdd69b8c9b5e3412e6af1d56cef856c6f535))
* Add human feedback notebook tutorial ([#4257](https://github.com/Arize-ai/phoenix/issues/4257)) ([d4c200f](https://github.com/Arize-ai/phoenix/commit/d4c200f3343ea4eb821b5faca1c2fb45e86788b9))
* add LLM fixtures for demo dataset (fine-tuning dataset), fix demo notebook ([#4286](https://github.com/Arize-ai/phoenix/issues/4286)) ([9f54510](https://github.com/Arize-ai/phoenix/commit/9f545107f111d6083df69ae601c4f96ca7cce03a))
* Add Phoenix Llamaindex RAG Demo notebook + chunks + questions ([#4202](https://github.com/Arize-ai/phoenix/issues/4202)) ([7f1b817](https://github.com/Arize-ai/phoenix/commit/7f1b81719e4bcb2ea7a71406183a4b071400e40f))
* fix variable name typo in run experiments doc ([#4249](https://github.com/Arize-ai/phoenix/issues/4249)) ([9745754](https://github.com/Arize-ai/phoenix/commit/9745754cd5168962bb780400f65c55f58a20b1f2))

## [4.24.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.23.0...arize-phoenix-v4.24.0) (2024-08-15)


### Features

* **auth:** add user role, exclude system in user lists ([#4229](https://github.com/Arize-ai/phoenix/issues/4229)) ([fb18ab6](https://github.com/Arize-ai/phoenix/commit/fb18ab65a05265b08b2a2b228773fd2498efa861))
* **auth:** user / system api key resolvers ([#4232](https://github.com/Arize-ai/phoenix/issues/4232)) ([c7b939e](https://github.com/Arize-ai/phoenix/commit/c7b939e9ebd60cd0aff5441760f330e2c621d987))
* **experiments:** ability to specify concurrency in run_experiment and evaluate_experiment ([#4189](https://github.com/Arize-ai/phoenix/issues/4189)) ([8239d3a](https://github.com/Arize-ai/phoenix/commit/8239d3a495dcee365263751f587ebc5f5c0c598c))


### Documentation

* Add multimodal image reasoning tutorial with llama index ([#4210](https://github.com/Arize-ai/phoenix/issues/4210)) ([d24712e](https://github.com/Arize-ai/phoenix/commit/d24712e54181c4def6e719acbb8748a7882986e3))

## [4.23.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.22.1...arize-phoenix-v4.23.0) (2024-08-13)


### Features

* **auth:** plumb auth_enabled flag, add a settings page ([#4213](https://github.com/Arize-ai/phoenix/issues/4213)) ([7f66f0b](https://github.com/Arize-ai/phoenix/commit/7f66f0b5d7478e26fe5149ff8579a9c4a3ddf7e6))
* **auth:** user gql query ([#4219](https://github.com/Arize-ai/phoenix/issues/4219)) ([46543be](https://github.com/Arize-ai/phoenix/commit/46543bee779393b7c541f09cd8472d630f3a480e))
* **auth:** users table in settings ([#4221](https://github.com/Arize-ai/phoenix/issues/4221)) ([803399f](https://github.com/Arize-ai/phoenix/commit/803399f88968e2101a53d0c9cbe3fceb8a8005a1))


### Bug Fixes

* Propagate span annotation metadata to examples on all mutations ([#4195](https://github.com/Arize-ai/phoenix/issues/4195)) ([181e021](https://github.com/Arize-ai/phoenix/commit/181e0210a11eadd788e8da5e3a684a09ac5ad019))
* **UI:** show IO if embedding span is missing embeddings ([#4218](https://github.com/Arize-ai/phoenix/issues/4218)) ([5bc97ff](https://github.com/Arize-ai/phoenix/commit/5bc97fff952252d2a160111503a37d5f95ec182f))

## [4.22.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.22.0...arize-phoenix-v4.22.1) (2024-08-12)


### Bug Fixes

* **experiments:** `evaluate_experiment` on existing experiment runs ([#4204](https://github.com/Arize-ai/phoenix/issues/4204)) ([515e195](https://github.com/Arize-ai/phoenix/commit/515e1952b06b61d94ab1a6e084812064783e319d))
* remove skep_deps_check param on phoenix.instrumentors ([#4205](https://github.com/Arize-ai/phoenix/issues/4205)) ([7a9ad5e](https://github.com/Arize-ai/phoenix/commit/7a9ad5e7abd1a49514f73d8c12d1e628a6c8ad25))

## [4.22.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.21.0...arize-phoenix-v4.22.0) (2024-08-09)


### Features

* **UI:** annotation filter actions on span/trace tables ([#4194](https://github.com/Arize-ai/phoenix/issues/4194)) ([0301696](https://github.com/Arize-ai/phoenix/commit/03016963cc5e45ce817ae69f0eeb3f6a48d8306c))

## [4.21.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.20.2...arize-phoenix-v4.21.0) (2024-08-08)


### Features

* **annotations:** add cta for span annotations ([#4160](https://github.com/Arize-ai/phoenix/issues/4160)) ([ce22de5](https://github.com/Arize-ai/phoenix/commit/ce22de517f2938e524748be818e9a5349ab1426f))

## [4.20.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.20.1...arize-phoenix-v4.20.2) (2024-08-07)


### Bug Fixes

* add token count columns to spans table to improve projects page query performance ([#4135](https://github.com/Arize-ai/phoenix/issues/4135)) ([8c713e3](https://github.com/Arize-ai/phoenix/commit/8c713e3115ca654998be64802bab87c15b9c35d3))


### Documentation

* **examples:** add feedback to manually-instrumented-chatbot example ([#4020](https://github.com/Arize-ai/phoenix/issues/4020)) ([86b299f](https://github.com/Arize-ai/phoenix/commit/86b299ff6977a3c57172772fed5d9ad52daa4f83))

## [4.20.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.20.0...arize-phoenix-v4.20.1) (2024-08-06)


### Bug Fixes

* cache invalidation ([#4138](https://github.com/Arize-ai/phoenix/issues/4138)) ([d75dc8a](https://github.com/Arize-ai/phoenix/commit/d75dc8ab933e6daf2db7301b86069f85fb473647))
* ensure span annotations appear in sorted order by name ([#4144](https://github.com/Arize-ai/phoenix/issues/4144)) ([ff2e4b9](https://github.com/Arize-ai/phoenix/commit/ff2e4b93c86bd0224ded9000292148349953dbf1))

## [4.20.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.19.0...arize-phoenix-v4.20.0) (2024-08-06)


### Features

* Add span annotations to dataset example metadata ([#4123](https://github.com/Arize-ai/phoenix/issues/4123)) ([a16dd57](https://github.com/Arize-ai/phoenix/commit/a16dd57fd3dabd2cb61566377ba33723df72d482))


### Bug Fixes

* use dataloader for span annotations ([[#4006](https://github.com/Arize-ai/phoenix/issues/4006)]) ([ab53325](https://github.com/Arize-ai/phoenix/commit/ab53325622ae9e72942350f8a21d842513635cda))
* ensure rest api urls include custom root path ([#4137](https://github.com/Arize-ai/phoenix/issues/4137)) ([9550a7e](https://github.com/Arize-ai/phoenix/commit/9550a7eafd1aa6ed5e003dd4fa84c85e45bee4da))


### Documentation

* add more videos to docs (GITBOOK-787) ([cb9ee71](https://github.com/Arize-ai/phoenix/commit/cb9ee7175b2407bcf9ad46a9d8ad89fb19138866))
* Added Prompt flow documentation with example (GITBOOK-781) ([2772397](https://github.com/Arize-ai/phoenix/commit/277239718d95d850d0eb01e7cf3d1d68db66fcc9))
* minor fixes to the quickstart (GITBOOK-786) ([04a8ea0](https://github.com/Arize-ai/phoenix/commit/04a8ea01e3a397a2d28a21f958d5d9569d30f255))
* Update Tracing Integrations to match standard format (GITBOOK-784) ([dedf969](https://github.com/Arize-ai/phoenix/commit/dedf969346f172cf0fa4fe3128b3149e5479df9a))

## [4.19.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.18.0...arize-phoenix-v4.19.0) (2024-08-02)


### Features

* **annotations:** show all annotations in annotation summary in project page header ([#4119](https://github.com/Arize-ai/phoenix/issues/4119)) ([5b7264e](https://github.com/Arize-ai/phoenix/commit/5b7264e57a8488457f7bfce5fbac87c6f290693f))

## [4.18.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.17.0...arize-phoenix-v4.18.0) (2024-08-02)


### Features

* Add annotation summaries to projects ([#4108](https://github.com/Arize-ai/phoenix/issues/4108)) ([5aa79c4](https://github.com/Arize-ai/phoenix/commit/5aa79c4458289f5ce3090c26fd0fc48b67bb0745))
* **annotations:** add ability to edit human span annotations ([#4111](https://github.com/Arize-ai/phoenix/issues/4111)) ([67cb9a2](https://github.com/Arize-ai/phoenix/commit/67cb9a238bd4bdaf5954462f1d4fbab7e97d9bfb))
* **session:** support a slug to the seesion.view ([#4114](https://github.com/Arize-ai/phoenix/issues/4114)) ([9305f8a](https://github.com/Arize-ai/phoenix/commit/9305f8a85feb47e58aacbdee737b18211165a7de))


### Bug Fixes

* set higher lower-bound for OpenInference packages ([#4117](https://github.com/Arize-ai/phoenix/issues/4117)) ([cfcbf58](https://github.com/Arize-ai/phoenix/commit/cfcbf5837853da505653f2f1ea6e9bf95772554b))


### Documentation

* **annotations:** add a feedback tooltip ([#4116](https://github.com/Arize-ai/phoenix/issues/4116)) ([490ed44](https://github.com/Arize-ai/phoenix/commit/490ed44cc9d8c592a52a0afa834f4141587702d8))

## [4.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.16.1...arize-phoenix-v4.17.0) (2024-08-02)


### Features

* **annotations:** add feedback column to spans / traces tables with all annotations ([#4100](https://github.com/Arize-ai/phoenix/issues/4100)) ([193b309](https://github.com/Arize-ai/phoenix/commit/193b30913db6b9a331623c24c6788a725422762c))
* **annotations:** update RetrievalEvaluationLabel styles to match AnnotationLabel ([#4101](https://github.com/Arize-ai/phoenix/issues/4101)) ([eef32df](https://github.com/Arize-ai/phoenix/commit/eef32dfe119adcf3218ad72c31d1463d562a7efe))
* **ui:** condensed trace tree ([#4099](https://github.com/Arize-ai/phoenix/issues/4099)) ([548f685](https://github.com/Arize-ai/phoenix/commit/548f685c50f36b8caef7df8b17fefb61f6bbce48))


### Bug Fixes

* color for span aside ([#4093](https://github.com/Arize-ai/phoenix/issues/4093)) ([83c9840](https://github.com/Arize-ai/phoenix/commit/83c984099f81dccb1ab82afc98c2211ca6d8931f))

## [4.16.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.16.0...arize-phoenix-v4.16.1) (2024-07-31)


### Bug Fixes

* process annotation insertions after spans ([#4084](https://github.com/Arize-ai/phoenix/issues/4084)) ([5b1a709](https://github.com/Arize-ai/phoenix/commit/5b1a7092491bf96119677afe5b4a472515136138))

## [4.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.15.0...arize-phoenix-v4.16.0) (2024-07-30)


### Features

* Add sort order argument to Span- and Trace- Annotation fields ([#4079](https://github.com/Arize-ai/phoenix/issues/4079)) ([cf3b37c](https://github.com/Arize-ai/phoenix/commit/cf3b37cf8063cad756d55b17dc2fb8c66f71cee4))
* add trace stream toggle into preferences context ([#4035](https://github.com/Arize-ai/phoenix/issues/4035)) ([bc3be3e](https://github.com/Arize-ai/phoenix/commit/bc3be3e7dc7f4c7d1fb4962e6522eac14ac56c41))
* allow retries for annotation insertions when the corresponding span/trace does not exist ([#4026](https://github.com/Arize-ai/phoenix/issues/4026)) ([13af3b5](https://github.com/Arize-ai/phoenix/commit/13af3b5d2e26a485fe123b2214e41b8fcfed0523))
* **annotations:** add feedback tab to span details ([#4069](https://github.com/Arize-ai/phoenix/issues/4069)) ([8dc9672](https://github.com/Arize-ai/phoenix/commit/8dc9672de2694ae4b7faf2cf466f9cc2972b2636))
* **annotations:** default collapse annotation explanations ([#4081](https://github.com/Arize-ai/phoenix/issues/4081)) ([dbf3ee4](https://github.com/Arize-ai/phoenix/commit/dbf3ee48993c949c7b6d4a0a872a4eec0c57711f))
* **annotations:** make color for evaluation summaries consistent with table ([#4082](https://github.com/Arize-ai/phoenix/issues/4082)) ([70a8b5a](https://github.com/Arize-ai/phoenix/commit/70a8b5a7fbc5c81ff20d4ec8379d024e0d0756e2))
* **annotations:** migrate span eval labels to us AnnotationLabel ([#4068](https://github.com/Arize-ai/phoenix/issues/4068)) ([6219e91](https://github.com/Arize-ai/phoenix/commit/6219e91c24daed559a2d1a650f3547de4b1fb3c3))
* **trace:** add a span aside with timing info and feedback ([#4071](https://github.com/Arize-ai/phoenix/issues/4071)) ([275ad73](https://github.com/Arize-ai/phoenix/commit/275ad73bd35a6edadee9e733bd4ba8920bd79ecf))
* **ui:** tracing getting started button ([#4067](https://github.com/Arize-ai/phoenix/issues/4067)) ([9eba5eb](https://github.com/Arize-ai/phoenix/commit/9eba5eb394deff221bd23a3b489249b56cff6a7e))


### Bug Fixes

* add `raise` to exceptions ([#4080](https://github.com/Arize-ai/phoenix/issues/4080)) ([4331fdd](https://github.com/Arize-ai/phoenix/commit/4331fdd8305fb90e8d32acfe7571f954314b199a))
* use outerjoin for evals filter ([#4066](https://github.com/Arize-ai/phoenix/issues/4066)) ([334a9a9](https://github.com/Arize-ai/phoenix/commit/334a9a94bad2e1384c443f5996516a443edcd5b1))

## [4.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.14.1...arize-phoenix-v4.15.0) (2024-07-26)


### Features

* Add containedInDataset boolean field to gql Spans ([#4015](https://github.com/Arize-ai/phoenix/issues/4015)) ([3c096ca](https://github.com/Arize-ai/phoenix/commit/3c096ca192c0676c43043197062603c0ef211f96))
* **annotations:** add annot ation macro and filter condition snippet to project page ([#4024](https://github.com/Arize-ai/phoenix/issues/4024)) ([acc2ff1](https://github.com/Arize-ai/phoenix/commit/acc2ff13b8760566c30eb4044a3a2c86bd1910eb))
* **annotations:** refetch annootations on annotation changes ([#3980](https://github.com/Arize-ai/phoenix/issues/3980)) ([9ba7cb9](https://github.com/Arize-ai/phoenix/commit/9ba7cb9294e7b15ebdc5fbd55d8df5d98c7b0f01))
* **datasets:** add dataset edit UI and dataset metadata on create ([#4005](https://github.com/Arize-ai/phoenix/issues/4005)) ([d80c438](https://github.com/Arize-ai/phoenix/commit/d80c438cc51f40200716e73a7f00edcc16e9572c))
* **trace:** UI lazy loading of spans ([#4014](https://github.com/Arize-ai/phoenix/issues/4014)) ([ab4fafa](https://github.com/Arize-ai/phoenix/commit/ab4fafaf18a22084d16e6e648676cbc8e1ed390a))
* Version mismatch checks ([#3989](https://github.com/Arize-ai/phoenix/issues/3989)) ([8454183](https://github.com/Arize-ai/phoenix/commit/845418390aa53863dc87943f7c95e8cf0f52aaa5))


### Bug Fixes

* add mutex for sqlite ([#3981](https://github.com/Arize-ai/phoenix/issues/3981)) ([91f96ef](https://github.com/Arize-ai/phoenix/commit/91f96eff869baf9f88eeb0cca6457e3ba3181f88))
* Changes dataset name query from is to equal ([#3983](https://github.com/Arize-ai/phoenix/issues/3983)) ([3f77759](https://github.com/Arize-ai/phoenix/commit/3f77759c4c56609d7dce48de7b136386e6c0b005))
* move all fixtures from jsonl to parquet ([#3943](https://github.com/Arize-ai/phoenix/issues/3943)) ([0587462](https://github.com/Arize-ai/phoenix/commit/058746207250c94d9387600f773b03f4d7a23587))
* remove invalid command from dev:ui script ([#3982](https://github.com/Arize-ai/phoenix/issues/3982)) ([02f264c](https://github.com/Arize-ai/phoenix/commit/02f264c263382d4b561ecf4ad95624645e390204))


### Documentation

* add reverse proxy example ([#3977](https://github.com/Arize-ai/phoenix/issues/3977)) ([6b201e0](https://github.com/Arize-ai/phoenix/commit/6b201e074e4a54df21441b8159bf77ad8b63bffd))

## [4.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.14.0...arize-phoenix-v4.14.1) (2024-07-23)


### Bug Fixes

* remove clean step from release pipeline and remove rimraf dev dep ([#3975](https://github.com/Arize-ai/phoenix/issues/3975)) ([5e91f8f](https://github.com/Arize-ai/phoenix/commit/5e91f8f3003962a98a66407604c5ca4aa35f5c66))

## [4.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.13.1...arize-phoenix-v4.14.0) (2024-07-23)


### Features

* **annotations:** annotations UI ([#3914](https://github.com/Arize-ai/phoenix/issues/3914)) ([cd1a48f](https://github.com/Arize-ai/phoenix/commit/cd1a48f60f1f901dd14b8fc04653d6595fbd980f))
* Extend evals DSL to accept 'annotations' symbol ([#3939](https://github.com/Arize-ai/phoenix/issues/3939)) ([659b674](https://github.com/Arize-ai/phoenix/commit/659b674ed727650d5b43e437be807ced54f7d422))


### Bug Fixes

* get_dataset_versions client method does not break on mixed timestamp formats ([#3973](https://github.com/Arize-ai/phoenix/issues/3973)) ([40c448b](https://github.com/Arize-ai/phoenix/commit/40c448bdacd1cfb69eaa6f9d1750fc3b3bc8a63f))


### Documentation

* Fix error in LlamaIndex Quickstart (GITBOOK-750) ([40c5b28](https://github.com/Arize-ai/phoenix/commit/40c5b28df792bbca3906361b9d06d13a9f7e85a7))
* Fix images in Custom Task Evaluation (GITBOOK-749) ([ee7365e](https://github.com/Arize-ai/phoenix/commit/ee7365ec023ee89b08d4688c2a7df16689d3b7e9))

## [4.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.13.0...arize-phoenix-v4.13.1) (2024-07-22)


### Bug Fixes

* renable server side caching ([#3947](https://github.com/Arize-ai/phoenix/issues/3947)) ([00220d0](https://github.com/Arize-ai/phoenix/commit/00220d09bef499b61ed302655f8d62be81cbc026))

## [4.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.12.0...arize-phoenix-v4.13.0) (2024-07-22)


### Features

* **annotations:** graphql resolver for all annotation names on a project ([#3931](https://github.com/Arize-ai/phoenix/issues/3931)) ([e7b87b2](https://github.com/Arize-ai/phoenix/commit/e7b87b2bc535d974f839ce45256ad85e1511dda9))


### Bug Fixes

* **experiments:** ensure experiments table appears even when an experiment has no runs ([#3942](https://github.com/Arize-ai/phoenix/issues/3942)) ([175c268](https://github.com/Arize-ai/phoenix/commit/175c268b619e507e1d6c2e4e3ec57baf2e51fc18))


### Documentation

* Add API docstrings for experiment evaluators module ([#3944](https://github.com/Arize-ai/phoenix/issues/3944)) ([53079ce](https://github.com/Arize-ai/phoenix/commit/53079cefce7a6cf572aa14c0e0d7ce3d5815e5aa))
* api ref sidebar overhaul ([0614255](https://github.com/Arize-ai/phoenix/commit/0614255044b22a66e253388d1d27d25aa657fc4d))
* api ref updates and docstring fixes ([e089f99](https://github.com/Arize-ai/phoenix/commit/e089f99fa2e63cdf9cb342bc3810361947c28e61))
* small fixes for datasets and experiments quickstart notebook ([#3934](https://github.com/Arize-ai/phoenix/issues/3934)) ([e24d721](https://github.com/Arize-ai/phoenix/commit/e24d7212ace403f0e396de027a7cfb9bd4a14657))
* Update README.md ([7836779](https://github.com/Arize-ai/phoenix/commit/7836779d9a65ea98fd403ebc23f3a275db4df7e1))

## [4.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.11.0...arize-phoenix-v4.12.0) (2024-07-18)


### Features

* add timeout arguments to client methods ([#3929](https://github.com/Arize-ai/phoenix/issues/3929)) ([d45fda9](https://github.com/Arize-ai/phoenix/commit/d45fda95a5dcfe1896952ae1da1e43f45fb5bfeb))

## [4.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.10.1...arize-phoenix-v4.11.0) (2024-07-18)


### Features

* Add Guardrail span kind type ([#3919](https://github.com/Arize-ai/phoenix/issues/3919)) ([c0180ef](https://github.com/Arize-ai/phoenix/commit/c0180ef95a093395a6277a4051b4bf4a56f3c4f2))
* **annotations:** gql resolver for annotations on a span ([#3915](https://github.com/Arize-ai/phoenix/issues/3915)) ([c058bbf](https://github.com/Arize-ai/phoenix/commit/c058bbf1f40882b4aa4ccabadf9a6754848e499c))


### Bug Fixes

* flatten sequence attribute when value is `ndarray` (which is not `Sequence`) ([#3926](https://github.com/Arize-ai/phoenix/issues/3926)) ([a361f87](https://github.com/Arize-ai/phoenix/commit/a361f870c4a38fb297a93969b2d66a3f9016826b))
* initialize tracer provider for internal server instrumentation ([#3921](https://github.com/Arize-ai/phoenix/issues/3921)) ([c59af75](https://github.com/Arize-ai/phoenix/commit/c59af7592f8faa7d3ff1b855bc0e3f0c78d546c4))
* security fix for braces ([#3924](https://github.com/Arize-ai/phoenix/issues/3924)) ([c2595c6](https://github.com/Arize-ai/phoenix/commit/c2595c603fdf1c796728aab468a771b428ac47b0))

## [4.10.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.10.0...arize-phoenix-v4.10.1) (2024-07-16)


### Bug Fixes

* debug flag should be store_true ([#3909](https://github.com/Arize-ai/phoenix/issues/3909)) ([bc25ba8](https://github.com/Arize-ai/phoenix/commit/bc25ba89387a3448b5e785ff8b5af47f658eaddf))

## [4.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.9.0...arize-phoenix-v4.10.0) (2024-07-16)


### Features

* Add GQL mutations for Span + Trace Annotations ([#3891](https://github.com/Arize-ai/phoenix/issues/3891)) ([78e7e3b](https://github.com/Arize-ai/phoenix/commit/78e7e3b18aa9a73bf76749d610194f780a1b8e00))
* Add REST routes for span and trace annotations ([#3869](https://github.com/Arize-ai/phoenix/issues/3869)) ([43eede1](https://github.com/Arize-ai/phoenix/commit/43eede1b3366d87826fe2c1f5ffeb29aa3a47788))
* **annotations:** ability to copy span and trace IDs ([49085c4](https://github.com/Arize-ai/phoenix/commit/49085c4c12a17568a1ee48c5993f7d424e62e839))

## [4.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.8.1...arize-phoenix-v4.9.0) (2024-07-10)


### Features

* retry eval insertions ([#3870](https://github.com/Arize-ai/phoenix/issues/3870)) ([7714bce](https://github.com/Arize-ai/phoenix/commit/7714bce47a28efa490f6f4e2d7cf37fea701b158))


### Bug Fixes

* **graphql:** clear project when end_time is UNSET ([#3879](https://github.com/Arize-ai/phoenix/issues/3879)) ([7c77a73](https://github.com/Arize-ai/phoenix/commit/7c77a73f35b8f119a63d5e7db7ba734b8dfb2919))
* remove phoenix.daasets imports ([12adc6a](https://github.com/Arize-ai/phoenix/commit/12adc6a1f7e6c7f44927f6e76adbe81324a5987c))


### Reverts

* "feat: retry eval insertions ([#3870](https://github.com/Arize-ai/phoenix/issues/3870))" ([#3877](https://github.com/Arize-ai/phoenix/issues/3877)) ([859f710](https://github.com/Arize-ai/phoenix/commit/859f710a7f7cd246f16a53768e1dda184c800cc3))


### Documentation

* api reference overhaul modules ([e3b9c7f](https://github.com/Arize-ai/phoenix/commit/e3b9c7f5fcabdfb9462b8cbefa8a3d889c745c30))

## [4.8.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.8.0...arize-phoenix-v4.8.1) (2024-07-09)


### Bug Fixes

* span json decoder for event lists ([#3867](https://github.com/Arize-ai/phoenix/issues/3867)) ([066895b](https://github.com/Arize-ai/phoenix/commit/066895bce615ee14e81cfa7dd541416bf1f2b7d1))


### Documentation

* api ref clean up ([a5d87cc](https://github.com/Arize-ai/phoenix/commit/a5d87cc7b88647baa728125c58b7e9cbb8157ad7))
* updated index for api reference ([9646ee3](https://github.com/Arize-ai/phoenix/commit/9646ee37f46d20310c597e4af07544f9c879c34f))

## [4.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.7.2...arize-phoenix-v4.8.0) (2024-07-08)


### Features

* **experiments:** REST endpoint to delete dataset ([#3853](https://github.com/Arize-ai/phoenix/issues/3853)) ([3c7ede2](https://github.com/Arize-ai/phoenix/commit/3c7ede2de998d1f6a707cea8955620f6c5ae73ad))

## [4.7.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.7.1...arize-phoenix-v4.7.2) (2024-07-08)


### Bug Fixes

* **experiments:** do client.post in thread ([#3846](https://github.com/Arize-ai/phoenix/issues/3846)) ([8db5bdc](https://github.com/Arize-ai/phoenix/commit/8db5bdc9d3feb6919767a67374d4d8b6fcbf35bf))
* make projects page scrollable ([#3756](https://github.com/Arize-ai/phoenix/issues/3756)) ([56f1374](https://github.com/Arize-ai/phoenix/commit/56f13742a7c579ded451fd00db01ac9b9deefc68))

## [4.7.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.7.0...arize-phoenix-v4.7.1) (2024-07-04)


### Bug Fixes

* ensure experiment errors messages work on python 3.8 and 3.9 ([#3841](https://github.com/Arize-ai/phoenix/issues/3841)) ([2595cfb](https://github.com/Arize-ai/phoenix/commit/2595cfb4fda91887c3e18fb6d680efdf852362e0))

## [4.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.6.3...arize-phoenix-v4.7.0) (2024-07-03)


### Features

* **image:** add image rendering on messages ([#3832](https://github.com/Arize-ai/phoenix/issues/3832)) ([f219523](https://github.com/Arize-ai/phoenix/commit/f219523d79cd2aa112dcfa39935f98293ce889a1))


### Bug Fixes

* allow invocations of OpenAIModel without api key ([#3820](https://github.com/Arize-ai/phoenix/issues/3820)) ([4dd8c0e](https://github.com/Arize-ai/phoenix/commit/4dd8c0e15308971fe42c5fd11f04f80b18c55746))

## [4.6.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.6.2...arize-phoenix-v4.6.3) (2024-07-03)


### Bug Fixes

* **UI:** explanation overflow ([#3818](https://github.com/Arize-ai/phoenix/issues/3818)) ([7356c8a](https://github.com/Arize-ai/phoenix/commit/7356c8a6c9eab5eab15c893f672f7d213dbe84a3))

## [4.6.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.6.1...arize-phoenix-v4.6.2) (2024-07-02)


### Bug Fixes

* **experiments:** order annotations by name to make output deterministic ([#3806](https://github.com/Arize-ai/phoenix/issues/3806)) ([256035f](https://github.com/Arize-ai/phoenix/commit/256035f9c403e21d9c3551c7eaa5ae801941b629))

## [4.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.6.0...arize-phoenix-v4.6.1) (2024-07-02)


### Documentation

* txt2sql ([4322b7d](https://github.com/Arize-ai/phoenix/commit/4322b7db04b951a70f1aa31f2ac97089394d4a4b))

## [4.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.5.0...arize-phoenix-v4.6.0) (2024-07-02)


### Features

* `create_evaluator` decorators ([#3642](https://github.com/Arize-ai/phoenix/issues/3642)) ([56acddd](https://github.com/Arize-ai/phoenix/commit/56acddd54ab06ee80c5fa98aac80e9a5144c6787))
* ability to clear data older than X date, fix DB constraint errors for span.id from datasets to projects ([#3670](https://github.com/Arize-ai/phoenix/issues/3670)) ([993ad5d](https://github.com/Arize-ai/phoenix/commit/993ad5dfac5a8c0057476b8352dd02bc6ed90407))
* add annotations resolver on DatasetRun type ([#3473](https://github.com/Arize-ai/phoenix/issues/3473)) ([c677091](https://github.com/Arize-ai/phoenix/commit/c677091bbb1ff1a077e7f36a5f3276b99885d6fb))
* Add basic evaluators for string experiment outputs ([#3534](https://github.com/Arize-ai/phoenix/issues/3534)) ([85bec41](https://github.com/Arize-ai/phoenix/commit/85bec41cd86aae072efe2b9e14de26fe4250992d))
* add dataset-related tables ([#3169](https://github.com/Arize-ai/phoenix/issues/3169)) ([b164dfe](https://github.com/Arize-ai/phoenix/commit/b164dfe0c99020d8668d7613761467fa908095da))
* add experiment-related tables and migrations ([#3381](https://github.com/Arize-ai/phoenix/issues/3381)) ([b08e8d4](https://github.com/Arize-ai/phoenix/commit/b08e8d4a79c47bfd90a46a90a99a7eae26424bdd))
* add experiments resolver to DatasetExample gql type ([#3446](https://github.com/Arize-ai/phoenix/issues/3446)) ([f526025](https://github.com/Arize-ai/phoenix/commit/f526025a1164557923dac4fb7e51a98e41943bc1))
* add graphql resolver for adding spans to datasets ([#3205](https://github.com/Arize-ai/phoenix/issues/3205)) ([b80979e](https://github.com/Arize-ai/phoenix/commit/b80979e1d4462dd9172e23897a14db1c89ac8b85))
* Add LLM evaluators ([#3571](https://github.com/Arize-ai/phoenix/issues/3571)) ([032672b](https://github.com/Arize-ai/phoenix/commit/032672bd4903fb2f3832219af64afafe5af615cb))
* add patchDatasetExamples mutation ([#3343](https://github.com/Arize-ai/phoenix/issues/3343)) ([9ffe198](https://github.com/Arize-ai/phoenix/commit/9ffe1982ac34a09481d2ffe8c50a919903dda0c7))
* add project resolver on span ([#3406](https://github.com/Arize-ai/phoenix/issues/3406)) ([b64d78b](https://github.com/Arize-ai/phoenix/commit/b64d78b63f08eb8003a1998d17d2a54b60c11363))
* Add relevance evaluator ([#3604](https://github.com/Arize-ai/phoenix/issues/3604)) ([da4a6b3](https://github.com/Arize-ai/phoenix/commit/da4a6b3fdc4b149699b0cfe37fb315b33db16c87))
* add runs resolver on Experiment type ([#3465](https://github.com/Arize-ai/phoenix/issues/3465)) ([8140957](https://github.com/Arize-ai/phoenix/commit/81409576499cc457f33e58f914dfddb23aee0779))
* add span resolver on DatasetExample gql type ([#3394](https://github.com/Arize-ai/phoenix/issues/3394)) ([6c46d50](https://github.com/Arize-ai/phoenix/commit/6c46d50cfe74bfbf1a959d3056a0174a3dd2f194))
* **auth:** ability to set headers via environment variables ([ff5b64d](https://github.com/Arize-ai/phoenix/commit/ff5b64d8de9d6461489215341bb6dc8f27052e48))
* compareExperiments resolver ([#3481](https://github.com/Arize-ai/phoenix/issues/3481)) ([2becd18](https://github.com/Arize-ai/phoenix/commit/2becd186fa428821f38f1296c26a1e395ba391e1))
* dataset example slideover ([#3325](https://github.com/Arize-ai/phoenix/issues/3325)) ([c64f99b](https://github.com/Arize-ai/phoenix/commit/c64f99b97f4af898a12c24295166bbbcd7532aec))
* **dataset:** gql dataset versions connection ([#3222](https://github.com/Arize-ai/phoenix/issues/3222)) ([de28b12](https://github.com/Arize-ai/phoenix/commit/de28b1252e7079c1957f1a67dce1a56f390a1523))
* **datasets:** add `reference` as alias of `expected` for evaluator argument bindings ([#3790](https://github.com/Arize-ai/phoenix/issues/3790)) ([fdd070a](https://github.com/Arize-ai/phoenix/commit/fdd070a2e467835db482fe9bde50c5264aa8d55a))
* **datasets:** add client method for appending to datasets ([#3659](https://github.com/Arize-ai/phoenix/issues/3659)) ([9c444a8](https://github.com/Arize-ai/phoenix/commit/9c444a851f18d8ac5b76ccd81dee4aa6ffdd585b))
* **datasets:** add dataframe transformation to dataset ([#3736](https://github.com/Arize-ai/phoenix/issues/3736)) ([fb5730a](https://github.com/Arize-ai/phoenix/commit/fb5730a067d4a321d34c091920becb2dc239fac6))
* **datasets:** add example modal ([#3424](https://github.com/Arize-ai/phoenix/issues/3424)) ([e52867c](https://github.com/Arize-ai/phoenix/commit/e52867cd27486c2967d6a93f66a8659c58367705))
* **datasets:** add graphql field from trace to project ([#3606](https://github.com/Arize-ai/phoenix/issues/3606)) ([7a54241](https://github.com/Arize-ai/phoenix/commit/7a54241aedd706c8db19583f76a372803710c434))
* **datasets:** add jsonl to download menu ([#3495](https://github.com/Arize-ai/phoenix/issues/3495)) ([fcd6c27](https://github.com/Arize-ai/phoenix/commit/fcd6c27976fff7d323808fd93536abc13478ff63))
* **datasets:** add pagination to dataset examples table ([#3299](https://github.com/Arize-ai/phoenix/issues/3299)) ([33d7a74](https://github.com/Arize-ai/phoenix/commit/33d7a7488e9668a8359da92ea728ed539f0ec545))
* **datasets:** add sequence number for experiments of the same dataset ([#3486](https://github.com/Arize-ai/phoenix/issues/3486)) ([1a692cf](https://github.com/Arize-ai/phoenix/commit/1a692cfc1b73e41ec396647314522a712758403c))
* **datasets:** add span to dataset from the trace page ([#3230](https://github.com/Arize-ai/phoenix/issues/3230)) ([945af8c](https://github.com/Arize-ai/phoenix/commit/945af8ca37b9eea29cc886d21b8cb1fae8f73d3f))
* **datasets:** add the ability to create a dataset dynamically ([#3712](https://github.com/Arize-ai/phoenix/issues/3712)) ([81c0cae](https://github.com/Arize-ai/phoenix/commit/81c0cae92d4a52c2ddc6bbc3d217e55653da40aa))
* **datasets:** allow unrecognized parameters in the evaluator function with default values ([#3674](https://github.com/Arize-ai/phoenix/issues/3674)) ([8b97a5e](https://github.com/Arize-ai/phoenix/commit/8b97a5e03494ede75ac975ab087bb92e10831fa7))
* **datasets:** capture traces from experiments and their evaluations ([#3579](https://github.com/Arize-ai/phoenix/issues/3579)) ([1917cd7](https://github.com/Arize-ai/phoenix/commit/1917cd7a7f384794ff2338aeaa82aecad6b39894))
* **datasets:** create dataset UI ([#3217](https://github.com/Arize-ai/phoenix/issues/3217)) ([5183620](https://github.com/Arize-ai/phoenix/commit/5183620ede96956b118ac88e1cb3cc5a011c2909))
* **datasets:** dataset upload endpoint (plus fixtures) ([#3183](https://github.com/Arize-ai/phoenix/issues/3183)) ([626f18d](https://github.com/Arize-ai/phoenix/commit/626f18dea82b766d8bbe68e95684a62d3277744b))
* **datasets:** datasets graphql ([#3192](https://github.com/Arize-ai/phoenix/issues/3192)) ([1697d96](https://github.com/Arize-ai/phoenix/commit/1697d9610dd6dfd3f47cb280f8d742bf48e7ce18))
* **datasets:** datasets page ([#3172](https://github.com/Arize-ai/phoenix/issues/3172)) ([89305fe](https://github.com/Arize-ai/phoenix/commit/89305fed6b0aa07511efdc8267b635e4555e299f))
* **datasets:** Delete dataset mutation ([#3321](https://github.com/Arize-ai/phoenix/issues/3321)) ([053fa31](https://github.com/Arize-ai/phoenix/commit/053fa311440937aa342d51253ca2802ea35e352e))
* **datasets:** Delete dataset UI ([#3336](https://github.com/Arize-ai/phoenix/issues/3336)) ([202e9f8](https://github.com/Arize-ai/phoenix/commit/202e9f8c9b96d6d0fb6db062c5ba9859d5fd5e2a))
* **datasets:** Delete examples ([#3352](https://github.com/Arize-ai/phoenix/issues/3352)) ([42ab894](https://github.com/Arize-ai/phoenix/commit/42ab894d3e7e7c8ed1b4295dc9b96f57f2436ad5))
* **datasets:** delete examples mutation ([#3324](https://github.com/Arize-ai/phoenix/issues/3324)) ([febea33](https://github.com/Arize-ai/phoenix/commit/febea3311ec4e963ea44846df0ae432fec33af7a))
* **datasets:** deny v1 routes and gql mutations if readonly ([#3501](https://github.com/Arize-ai/phoenix/issues/3501)) ([de376cf](https://github.com/Arize-ai/phoenix/commit/de376cfaf350939a24936ad3759a2ff1151c8cb6))
* **datasets:** Display latest version ([#3373](https://github.com/Arize-ai/phoenix/issues/3373)) ([66cd6a8](https://github.com/Arize-ai/phoenix/commit/66cd6a870c09c9591c0b0e02520a0db859f4afc1))
* **datasets:** download csv button ([#3312](https://github.com/Arize-ai/phoenix/issues/3312)) ([e5b83a2](https://github.com/Arize-ai/phoenix/commit/e5b83a279b9977864df396d6c1120b26e9615fd9))
* **datasets:** download dataset as CSV text file ([#3250](https://github.com/Arize-ai/phoenix/issues/3250)) ([9629d39](https://github.com/Arize-ai/phoenix/commit/9629d391a130f031708559253c78d7bc8cff092b))
* **datasets:** download jsonl for openai ([#3493](https://github.com/Arize-ai/phoenix/issues/3493)) ([e4412ef](https://github.com/Arize-ai/phoenix/commit/e4412efc5606b83a36a8487bf1886492c0f13c1b))
* **datasets:** example and experiment count on datasets table ([#3447](https://github.com/Arize-ai/phoenix/issues/3447)) ([2e3413a](https://github.com/Arize-ai/phoenix/commit/2e3413a5292e049fd5908ad907cd21a16534af05))
* **datasets:** example experiment runs ([#3476](https://github.com/Arize-ai/phoenix/issues/3476)) ([db592a8](https://github.com/Arize-ai/phoenix/commit/db592a80ee492ab7f9f68badec6bb62fc184609e))
* **datasets:** expose the API playgrounds ([#3204](https://github.com/Arize-ai/phoenix/issues/3204)) ([da1416b](https://github.com/Arize-ai/phoenix/commit/da1416ba1c96855b43693122eaaffaf8447a15f9))
* **datasets:** get_dataset_by_name ([726d97d](https://github.com/Arize-ai/phoenix/commit/726d97d0b5807c98605b2e9669b11f95b46a2cdb))
* **datasets:** gql dataset create ([#3203](https://github.com/Arize-ai/phoenix/issues/3203)) ([679a868](https://github.com/Arize-ai/phoenix/commit/679a868ca66b9cc4f0574ca373e72d726e0d6f20))
* **datasets:** gql for adding examples ([#3266](https://github.com/Arize-ai/phoenix/issues/3266)) ([4049228](https://github.com/Arize-ai/phoenix/commit/4049228f2bc1d523733da806e3bdf7f95cde218d))
* **datasets:** gql resolver for dataset example count ([#3437](https://github.com/Arize-ai/phoenix/issues/3437)) ([862bb1f](https://github.com/Arize-ai/phoenix/commit/862bb1f842ad1e6c1551e19c60f718f805090570))
* **datasets:** gql resolver for experiment count ([#3443](https://github.com/Arize-ai/phoenix/issues/3443)) ([5b6bc5c](https://github.com/Arize-ai/phoenix/commit/5b6bc5cbe5a63e09e0bb450117186ff929fab563))
* **datasets:** gql resolver returns examples in descending order ([#3448](https://github.com/Arize-ai/phoenix/issues/3448)) ([624ba10](https://github.com/Arize-ai/phoenix/commit/624ba105db007a143fc5304a389fd3b8ef83bfaf))
* **datasets:** JSON endpoint to get dataset versions ([#3323](https://github.com/Arize-ai/phoenix/issues/3323)) ([fec38ff](https://github.com/Arize-ai/phoenix/commit/fec38ff3e129295647e892cde96f975782bcd6f9))
* **datasets:** link to view source span ([#3413](https://github.com/Arize-ai/phoenix/issues/3413)) ([faa925e](https://github.com/Arize-ai/phoenix/commit/faa925e2cebbfffbcbc5c6695897af35785b6277))
* **datasets:** multi-select on span / traces tables ([#3236](https://github.com/Arize-ai/phoenix/issues/3236)) ([160c4e6](https://github.com/Arize-ai/phoenix/commit/160c4e6da6bd2edb20e4917f8f349f7c6ce43cc6))
* **datasets:** navigate to examples if no experiments exist ([cbbed30](https://github.com/Arize-ai/phoenix/commit/cbbed30ee5b836b71b8d8cf689603485d39b602b))
* **datasets:** post the result of each experiment/evaluation run immediately when it finishes ([#3666](https://github.com/Arize-ai/phoenix/issues/3666)) ([4e21d2c](https://github.com/Arize-ai/phoenix/commit/4e21d2c1d18c6ff25a3fc1746ecd8aed8bf5c700))
* **datasets:** print experiment summaries ([#3709](https://github.com/Arize-ai/phoenix/issues/3709)) ([7c70afa](https://github.com/Arize-ai/phoenix/commit/7c70afa436b66c319dad89796fd5466b05cefcbc))
* **datasets:** print the URL to the dataset when uploaded ([#3647](https://github.com/Arize-ai/phoenix/issues/3647)) ([76439cf](https://github.com/Arize-ai/phoenix/commit/76439cf50949b2ba2b5f778ec034696a72fd149a))
* **datasets:** python instructions ([#3569](https://github.com/Arize-ai/phoenix/issues/3569)) ([ee0788a](https://github.com/Arize-ai/phoenix/commit/ee0788a71ed717310c52feb261dc182aca747d19))
* **datasets:** routing for examples and experiment pages ([#3470](https://github.com/Arize-ai/phoenix/issues/3470)) ([141b90c](https://github.com/Arize-ai/phoenix/commit/141b90c52442f1b65a9ec2ff05489e220b39492a))
* **datasets:** show example details in a slide-over ([b1a1317](https://github.com/Arize-ai/phoenix/commit/b1a1317d40cfd764f3a1fa44ed450f8143df7ca9))
* **datasets:** sort by name and createdAt ([79f8c88](https://github.com/Arize-ai/phoenix/commit/79f8c888b5a27a15f35e2061d65688187fe21389))
* **datasets:** sort on version ([#3370](https://github.com/Arize-ai/phoenix/issues/3370)) ([41348cf](https://github.com/Arize-ai/phoenix/commit/41348cfdb0e55a6be73aa3dc6d357f2585044c47))
* **datasets:** spans as examples ([#3279](https://github.com/Arize-ai/phoenix/issues/3279)) ([1d46c42](https://github.com/Arize-ai/phoenix/commit/1d46c421fe42a51b44aecda33cf369d417a63039))
* **datasets:** synchronously upload dataset examples returning `dataset_id` in JSON ([#3347](https://github.com/Arize-ai/phoenix/issues/3347)) ([c32ac4d](https://github.com/Arize-ai/phoenix/commit/c32ac4d4b95d203cd0fbf57a44948c3b567f089a))
* **datasets:** UI to edit a dataset example ([#3376](https://github.com/Arize-ai/phoenix/issues/3376)) ([3950256](https://github.com/Arize-ai/phoenix/commit/39502563ced16292d5c06680c00513579e5345ef))
* **datasets:** upload JSON for dataset examples ([#3658](https://github.com/Arize-ai/phoenix/issues/3658)) ([47ef311](https://github.com/Arize-ai/phoenix/commit/47ef31170a35282b1a29b018d9284618ee66c0a6))
* **datasets:** usability enhancements ([#3773](https://github.com/Arize-ai/phoenix/issues/3773)) ([912dc9b](https://github.com/Arize-ai/phoenix/commit/912dc9b81bf03249ecad753bbbf530ed9069b2e7))
* **datasets:** version history modal ([#3444](https://github.com/Arize-ai/phoenix/issues/3444)) ([86755a4](https://github.com/Arize-ai/phoenix/commit/86755a4e084bed5864ba083385678adc24be3f8c))
* display average run latency in the experiments table ([#3743](https://github.com/Arize-ai/phoenix/issues/3743)) ([cfaafd5](https://github.com/Arize-ai/phoenix/commit/cfaafd52d65c7b291278c936c3ea55b056858aaa))
* error rate resolver on Experiment type ([#3588](https://github.com/Arize-ai/phoenix/issues/3588)) ([ceaea16](https://github.com/Arize-ai/phoenix/commit/ceaea1643f30014006379808d1adaf3abf4fa4b7))
* Experiments improvements ([#3638](https://github.com/Arize-ai/phoenix/issues/3638)) ([bd85bea](https://github.com/Arize-ai/phoenix/commit/bd85bea74d9fbb743756a8dcd775a3caccf0b856))
* **experiments:** add experiment name  ([#3512](https://github.com/Arize-ai/phoenix/issues/3512)) ([801ac29](https://github.com/Arize-ai/phoenix/commit/801ac2936ee407a218da39f541162d8f00b83b16))
* **experiments:** add the ability to view an experiment's traces ([#3603](https://github.com/Arize-ai/phoenix/issues/3603)) ([084a0c6](https://github.com/Arize-ai/phoenix/commit/084a0c6c3270cf671af752794bb345120bc12e3a))
* **experiments:** comparison details slideover ([74d1bd0](https://github.com/Arize-ai/phoenix/commit/74d1bd00ca6947d7fa5897e3539d6d05cd06c76d))
* **experiments:** delete experiments ui ([623805c](https://github.com/Arize-ai/phoenix/commit/623805cdb702ee517bb65e07f9d12ec36e5249c6))
* **experiments:** delete experiments ui ([b942b59](https://github.com/Arize-ai/phoenix/commit/b942b597dbb78b053712683b3baa9ed2591ccf17))
* **experiments:** detail view for comparison ([ebc4aa1](https://github.com/Arize-ai/phoenix/commit/ebc4aa1d8ece22a253a7096c3e52d08635769b00))
* **experiments:** evaluator icon and ingestion ([#3639](https://github.com/Arize-ai/phoenix/issues/3639)) ([70ba085](https://github.com/Arize-ai/phoenix/commit/70ba085da3ce4bf59c2f2880775acc010322491c))
* **experiments:** evaluator trace slide-over ([#3680](https://github.com/Arize-ai/phoenix/issues/3680)) ([2df5b9d](https://github.com/Arize-ai/phoenix/commit/2df5b9d7e8a3f635c5920d83015ccc6b9c4db781))
* **experiments:** experiment error rate column ([#3657](https://github.com/Arize-ai/phoenix/issues/3657)) ([41d354f](https://github.com/Arize-ai/phoenix/commit/41d354ff894e973ef06a1c2761fe7fc4ae33f97f))
* **experiments:** experiment evaluation summaries in the table ([#3575](https://github.com/Arize-ai/phoenix/issues/3575)) ([85c457a](https://github.com/Arize-ai/phoenix/commit/85c457ae5e6712214dcaa1a322f961e209504c5d))
* **experiments:** experiments compare table ([47af587](https://github.com/Arize-ai/phoenix/commit/47af5873e1b8517e242f66f5e74767232847e0f4))
* **experiments:** experiments table ([#3454](https://github.com/Arize-ai/phoenix/issues/3454)) ([a9981da](https://github.com/Arize-ai/phoenix/commit/a9981daf14544e1b0c1594ac26ec5169c2cff657))
* **experiments:** full-text toggle for experiments table ([537ed97](https://github.com/Arize-ai/phoenix/commit/537ed97daeb1d747a6e176797e3fa0e9c892e9cb))
* **experiments:** gql resolver for experiments ([#3404](https://github.com/Arize-ai/phoenix/issues/3404)) ([6d70786](https://github.com/Arize-ai/phoenix/commit/6d70786a223dd1a4206f7ca15cf237b68058eb7e))
* **experiments:** Implement `run_experiment` ([#3471](https://github.com/Arize-ai/phoenix/issues/3471)) ([87a0501](https://github.com/Arize-ai/phoenix/commit/87a05015a53541c06e51f52d4cd0d1ab65d9e2ba))
* **experiments:** navigation to experiments view ([#3509](https://github.com/Arize-ai/phoenix/issues/3509)) ([a293f7e](https://github.com/Arize-ai/phoenix/commit/a293f7ebe93f7f4f8f0d79037de7e63a3bc41dac))
* **experiments:** run count resolver on experiments ([#3679](https://github.com/Arize-ai/phoenix/issues/3679)) ([2444f42](https://github.com/Arize-ai/phoenix/commit/2444f428a47726dbd00175055023411b62bc5545))
* **experiments:** show run count ([#3690](https://github.com/Arize-ai/phoenix/issues/3690)) ([2c79a78](https://github.com/Arize-ai/phoenix/commit/2c79a78d65b2e990c54f73fd6333336fca64e7d3))
* **experiments:** show trace slide-over on experiment page ([#3640](https://github.com/Arize-ai/phoenix/issues/3640)) ([8457cb5](https://github.com/Arize-ai/phoenix/commit/8457cb537b7b0e0c75a0864c07e04c0e8279edd4))
* **experments:** ability to view evaluator traces ([811290e](https://github.com/Arize-ai/phoenix/commit/811290ec41aaa1a6042d24ee03ad3ec9c3f4ebcd))
* **experments:** add the ability to view experiment metadata in full ([#3686](https://github.com/Arize-ai/phoenix/issues/3686)) ([3560e1d](https://github.com/Arize-ai/phoenix/commit/3560e1d478bed2c5183b822cd1217e5a83267d62))
* **experments:** minimum viable dialog showing how to run an experiment ([#3704](https://github.com/Arize-ai/phoenix/issues/3704)) ([4fb13b8](https://github.com/Arize-ai/phoenix/commit/4fb13b8deeb499f2bbe3760409a62422e011d902))
* **experments:** Switch UI to use experiment name ([#3523](https://github.com/Arize-ai/phoenix/issues/3523)) ([a953231](https://github.com/Arize-ai/phoenix/commit/a953231a07b7e8298d5f85ead51e3c4e8605e63d))
* gql resolver for dataset examples ([#3238](https://github.com/Arize-ai/phoenix/issues/3238)) ([fa0b4d2](https://github.com/Arize-ai/phoenix/commit/fa0b4d2319a8bc8dcd1db28d0ff369d594da1ed7))
* Implement `GET /datasets/id` and `GET /datasets` ([#3197](https://github.com/Arize-ai/phoenix/issues/3197)) ([36abede](https://github.com/Arize-ai/phoenix/commit/36abedeaa8631e6c4c1b152b17617d6552eedf07))
* Implement experiments REST API ([#3411](https://github.com/Arize-ai/phoenix/issues/3411)) ([d369fb3](https://github.com/Arize-ai/phoenix/commit/d369fb39f2da38de5146806baf3f0c20de5c54e7))
* implement get_dataset method on phoenix.Client ([#3490](https://github.com/Arize-ai/phoenix/issues/3490)) ([09fb3f0](https://github.com/Arize-ai/phoenix/commit/09fb3f06be9b8ea5eef88207a1d13e62d9d70732))
* implement initial experiment evals ([#3526](https://github.com/Arize-ai/phoenix/issues/3526)) ([b6fabdf](https://github.com/Arize-ai/phoenix/commit/b6fabdf11c5dff6241c54203ce58838be62fe7f4))
* implement patchDataset mutation ([#3457](https://github.com/Arize-ai/phoenix/issues/3457)) ([a0240b3](https://github.com/Arize-ai/phoenix/commit/a0240b3a933c4c395d5530fcfc4dd8806eb60c9e))
* Improve task argument binding and document `run_experiment` ([#3789](https://github.com/Arize-ai/phoenix/issues/3789)) ([0b64cbe](https://github.com/Arize-ai/phoenix/commit/0b64cbebe9a1711f4accc79dccfa9d5fa25574b9))
* List Dataset Examples ([#3271](https://github.com/Arize-ai/phoenix/issues/3271)) ([d5f4391](https://github.com/Arize-ai/phoenix/commit/d5f4391191d92b6b880060c00b781f5c880f8ee3))
* resolvers for experiment annotation aggregations ([#3549](https://github.com/Arize-ai/phoenix/issues/3549)) ([227e6e0](https://github.com/Arize-ai/phoenix/commit/227e6e079b879cf3fdd7a70e3611546da496999e))
* Support repetitions for experiment runs ([#3532](https://github.com/Arize-ai/phoenix/issues/3532)) ([7942694](https://github.com/Arize-ai/phoenix/commit/7942694d956afd62280a16992c8b51e4fc383321))
* **ui:** display examples in dataset page ([#3277](https://github.com/Arize-ai/phoenix/issues/3277)) ([829746a](https://github.com/Arize-ai/phoenix/commit/829746a1d3f51a70f9b81ac5c76894428fd0875e))
* Unify `run_experiment` and `evaluate_experiment` ([#3585](https://github.com/Arize-ai/phoenix/issues/3585)) ([7e1ffb6](https://github.com/Arize-ai/phoenix/commit/7e1ffb6d166be9889a3acbebb6ba44125d8f4b65))


### Bug Fixes

* add tiebreak to versions resolver ([#3488](https://github.com/Arize-ai/phoenix/issues/3488)) ([ac23ec7](https://github.com/Arize-ai/phoenix/commit/ac23ec7366b074f1687797c035cdb11c55cee2bb))
* Address relevance eval feedback ([#3609](https://github.com/Arize-ai/phoenix/issues/3609)) ([b231169](https://github.com/Arize-ai/phoenix/commit/b231169788776a74104ce000963321486f76028c))
* **datasets:** allow duplicate keys for csv upload ([#3464](https://github.com/Arize-ai/phoenix/issues/3464)) ([a0a5b25](https://github.com/Arize-ai/phoenix/commit/a0a5b2590a4bfce99c551b05d34d1b9c01dfee5e))
* **datasets:** api spec for upload endpoint ([#3213](https://github.com/Arize-ai/phoenix/issues/3213)) ([b719267](https://github.com/Arize-ai/phoenix/commit/b719267c54a339d4ddb3365e81956d6ed6e3eafa))
* **datasets:** bug with json upload ([#3663](https://github.com/Arize-ai/phoenix/issues/3663)) ([d667b8f](https://github.com/Arize-ai/phoenix/commit/d667b8f72a9930ca8d1eb4817391a4bd6bed08c0))
* **datasets:** colab usage of dataset.examples should no longer be list ([#3781](https://github.com/Arize-ai/phoenix/issues/3781)) ([4f148ae](https://github.com/Arize-ai/phoenix/commit/4f148ae647d6f7bb4368f43eb8677616611c00d9))
* **datasets:** filter examples by dataset in gql ([#3330](https://github.com/Arize-ai/phoenix/issues/3330)) ([e5606e7](https://github.com/Arize-ai/phoenix/commit/e5606e7c8ff81be00ae77d797f138e66287aefcf))
* **datasets:** free up the `output` keyword as attribute of experiment run objects ([#3793](https://github.com/Arize-ai/phoenix/issues/3793)) ([6b4db71](https://github.com/Arize-ai/phoenix/commit/6b4db71f7a1c1d72f0b5d1d276000d9a945571d9))
* **datasets:** get metadata as `{}` when its value is `None` in JSON ([#3555](https://github.com/Arize-ai/phoenix/issues/3555)) ([6249ebe](https://github.com/Arize-ai/phoenix/commit/6249ebea62a7f5ddff744c717a92e6c05bffcd0b))
* **datasets:** json return payload for upload csv endpoint ([#3364](https://github.com/Arize-ai/phoenix/issues/3364)) ([4a1d063](https://github.com/Arize-ai/phoenix/commit/4a1d06365e028e0345bb49f37166c8cd69ad6396))
* **datasets:** make tests pass with new client ([5cfdc5b](https://github.com/Arize-ai/phoenix/commit/5cfdc5b7448a042edefb211e8fd43586ca726e66))
* **datasets:** missing annotation trace id ([#3664](https://github.com/Arize-ai/phoenix/issues/3664)) ([d800e36](https://github.com/Arize-ai/phoenix/commit/d800e3690ec910a6fee5e019f622984fc30aa7df))
* **datasets:** reconcile Dataset methods ([#3508](https://github.com/Arize-ai/phoenix/issues/3508)) ([43db5bc](https://github.com/Arize-ai/phoenix/commit/43db5bc32bb969cc3dae175de4e2f984e5e55d1b))
* **datasets:** select nested rows on traces ([#3489](https://github.com/Arize-ai/phoenix/issues/3489)) ([0bdb860](https://github.com/Arize-ai/phoenix/commit/0bdb860bbcb8c2248f21145b978fefc791f7b043))
* **datasets:** show full bar on evals of all 1s ([#3733](https://github.com/Arize-ai/phoenix/issues/3733)) ([3faa051](https://github.com/Arize-ai/phoenix/commit/3faa051e0c8abfe40f16106da0c4085489131aef))
* **datasets:** squash experiment run output by "result" key for graphql query ([#3672](https://github.com/Arize-ai/phoenix/issues/3672)) ([20dba43](https://github.com/Arize-ai/phoenix/commit/20dba438d2c0d9ac125e112e75044ac10a22e866))
* **datasets:** typo on dict type for typed dict ([#3684](https://github.com/Arize-ai/phoenix/issues/3684)) ([5e8e9a3](https://github.com/Arize-ai/phoenix/commit/5e8e9a30dfa4b8b1b251210347c21a22a18e81e3))
* **datasets:** update span kind for evaluator with semantic conventions v0.1.9 ([#3667](https://github.com/Arize-ai/phoenix/issues/3667)) ([ff2de45](https://github.com/Arize-ai/phoenix/commit/ff2de454ce292bfb011d3675b551137aca3ea5f3))
* ensure patches are sorted in numeric patch order ([#3379](https://github.com/Arize-ai/phoenix/issues/3379)) ([70facf1](https://github.com/Arize-ai/phoenix/commit/70facf1ac4f3d25b14c809bab63d762422a6ad7e))
* **experiments:** Improve the performance of the table ([#3732](https://github.com/Arize-ai/phoenix/issues/3732)) ([8e33b77](https://github.com/Arize-ai/phoenix/commit/8e33b77f0850ecb408cc20c4d2722c102c6bae33))
* **experments:** fix colab links ([#3637](https://github.com/Arize-ai/phoenix/issues/3637)) ([841ac0d](https://github.com/Arize-ai/phoenix/commit/841ac0dbd05de6a70a44f87bb7d0ad4542c44883))
* fix annotation trace ts errors ([8314aa5](https://github.com/Arize-ai/phoenix/commit/8314aa5393df6866a8303e24aad008f4533fd245))
* json cell for experiment metadata ([#3556](https://github.com/Arize-ai/phoenix/issues/3556)) ([f9e2b6d](https://github.com/Arize-ai/phoenix/commit/f9e2b6d34cb7d29e01f2f96507f149cfa421b953))
* openapi import error ([#3619](https://github.com/Arize-ai/phoenix/issues/3619)) ([1f81c05](https://github.com/Arize-ai/phoenix/commit/1f81c05b01bcbeb9ac4e86add9ad358a1b176571))
* openapi yaml parsing for containers ([#3788](https://github.com/Arize-ai/phoenix/issues/3788)) ([959abf7](https://github.com/Arize-ai/phoenix/commit/959abf7f46d1b20b959ad9a915b98a07c3254613))
* order runs in descending order in runs resolver on Experiment type ([#3480](https://github.com/Arize-ai/phoenix/issues/3480)) ([e1818b7](https://github.com/Arize-ai/phoenix/commit/e1818b7c2878d1532f3f94b7c1706c9d4f99d4e5))
* resolve sqlachemy warning regarding remote ([#3522](https://github.com/Arize-ai/phoenix/issues/3522)) ([cd15d9b](https://github.com/Arize-ai/phoenix/commit/cd15d9b24f21f9703616a04f398d88fa3acd54be))
* style and type errors ([#3540](https://github.com/Arize-ai/phoenix/issues/3540)) ([2cba662](https://github.com/Arize-ai/phoenix/commit/2cba662b4f69c06e69094791dc84304c11dbe01b))
* switch to upload_dataset for examples ([#3783](https://github.com/Arize-ai/phoenix/issues/3783)) ([bea7c2f](https://github.com/Arize-ai/phoenix/commit/bea7c2fc77d405a4eb93649debaf4eec6a819865))
* **ui:** right align numeric columns ([#3587](https://github.com/Arize-ai/phoenix/issues/3587)) ([781ae7a](https://github.com/Arize-ai/phoenix/commit/781ae7a3e09686534df6d2481cb703603cc955e5))


### Documentation

* Added more detail prepping and exporting eval data to the Bring Your Own Evaluator section (GITBOOK-704) ([96a312b](https://github.com/Arize-ai/phoenix/commit/96a312bab1a1a96ff28af4a37fecfc50c8725361))
* **api-ref:** fix readthedocs build issues ([#3706](https://github.com/Arize-ai/phoenix/issues/3706)) ([0827726](https://github.com/Arize-ai/phoenix/commit/0827726787ac3c08f4189d0e93cad9c95d8c5718))
* Cleanup datasets section (GITBOOK-694) ([18a4d5b](https://github.com/Arize-ai/phoenix/commit/18a4d5ba4c80dfec24e2a3646ec3dc19cd2f2842))
* Datasets documentaiton (GITBOOK-697) ([8148f67](https://github.com/Arize-ai/phoenix/commit/8148f67d1092693c9c3a8cf133693c70393c1e45))
* Datasets review - fixing typos, syntax, labels, links (GITBOOK-702) ([fcb56ee](https://github.com/Arize-ai/phoenix/commit/fcb56ee7a39c527e93efaf7fddde97b79dd1aeda))
* datasets tutorials and quickstart ([#3734](https://github.com/Arize-ai/phoenix/issues/3734)) ([cfa641c](https://github.com/Arize-ai/phoenix/commit/cfa641ce7855b75f4fcaf6b7abe9b3d4abd4dcec))
* **datasets:** print useful URLs, disable repetitions ([#3583](https://github.com/Arize-ai/phoenix/issues/3583)) ([14c7d9f](https://github.com/Arize-ai/phoenix/commit/14c7d9f8e5693e2fe328d2de9f4afc0ae2efb905))
* **experiments:** prompt template iteration for summarization task ([#3669](https://github.com/Arize-ai/phoenix/issues/3669)) ([0842df4](https://github.com/Arize-ai/phoenix/commit/0842df4dff7a04ca066dae716657eb29bf7472b0))
* **experiments:** txt2sql ([#3626](https://github.com/Arize-ai/phoenix/issues/3626)) ([33cd194](https://github.com/Arize-ai/phoenix/commit/33cd1942326889b241eddd3502f8b0a5a5646609))
* **experiments:** txt2sql ([#3714](https://github.com/Arize-ai/phoenix/issues/3714)) ([b083159](https://github.com/Arize-ai/phoenix/commit/b08315952edf0552e6e09d625deae4ff38dda16c))
* fix creating datasets (GITBOOK-701) ([9b83b1d](https://github.com/Arize-ai/phoenix/commit/9b83b1dd9e80893786713b8f905fddc2794e47a7))
* fix typos (GITBOOK-698) ([d413e54](https://github.com/Arize-ai/phoenix/commit/d413e541c6169468a61a1f5c3b59732b1e5e3128))
* GPT-4o first set (GITBOOK-695) ([8dff0bf](https://github.com/Arize-ai/phoenix/commit/8dff0bfe992c4275b8f4b3fb690e1961bf7851fb))
* No subject (GITBOOK-696) ([88859e1](https://github.com/Arize-ai/phoenix/commit/88859e1da1a17e86490b998a6149d2a60a9cbbc1))
* No subject (GITBOOK-699) ([9beed78](https://github.com/Arize-ai/phoenix/commit/9beed78412c4fa547bb4e78f5fd230a09c6ddad7))
* No subject (GITBOOK-700) ([5ac466c](https://github.com/Arize-ai/phoenix/commit/5ac466cd6e42c809e41a85300ffc458ab118338a))
* No subject (GITBOOK-703) ([f04e9c5](https://github.com/Arize-ai/phoenix/commit/f04e9c50832d8a5ea953accf22288587c4755f79))
* No subject (GITBOOK-707) ([2237a88](https://github.com/Arize-ai/phoenix/commit/2237a8837aa68c7ab2e451b737b67e301196154c))
* **notebook:** datasets and experiments quickstart ([#3703](https://github.com/Arize-ai/phoenix/issues/3703)) ([991df49](https://github.com/Arize-ai/phoenix/commit/991df49178a4c90665e91e3b002f71b80c52643d))
* placeholders for experiments (GITBOOK-705) ([1f7d183](https://github.com/Arize-ai/phoenix/commit/1f7d183774125c7ed927059b53e5d956a5a27718))
* readthedocs ([71fceab](https://github.com/Arize-ai/phoenix/commit/71fceab0f062961def474adafa51aeb0e5f6ba5d))
* rest api guidance ([#3314](https://github.com/Arize-ai/phoenix/issues/3314)) ([0309017](https://github.com/Arize-ai/phoenix/commit/0309017fec2403584c37a0827a36e9d209ae7c17))
* small fixes (GITBOOK-706) ([297458e](https://github.com/Arize-ai/phoenix/commit/297458ea3818fdb319282acc313babe1d8a91edc))
* small fixes (GITBOOK-708) ([4990aa5](https://github.com/Arize-ai/phoenix/commit/4990aa58533293c638b6cc55824ecd5a1bcd8911))
* sphinx api-ref for readthedocs ([0bcccbd](https://github.com/Arize-ai/phoenix/commit/0bcccbd933958a2c2f6e44f78c57b885a5d2cb4d))
* update dataset creation (GITBOOK-711) ([51c5ea1](https://github.com/Arize-ai/phoenix/commit/51c5ea1b073c08e9f18a4bcde6ae763056f54c72))
* use kwargs with datasets ([#3748](https://github.com/Arize-ai/phoenix/issues/3748)) ([530b2c6](https://github.com/Arize-ai/phoenix/commit/530b2c6fdf6922703b4ddc6e8338fa69c67f07aa))
* use kwargs with datasets ([#3748](https://github.com/Arize-ai/phoenix/issues/3748)) ([#3749](https://github.com/Arize-ai/phoenix/issues/3749)) ([599e340](https://github.com/Arize-ai/phoenix/commit/599e34034eb1b2c887548d611f8a30ca6e90108f))

## [4.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.4.3...arize-phoenix-v4.5.0) (2024-06-21)


### Features

* added SQLEvaluator ([#3577](https://github.com/Arize-ai/phoenix/issues/3577)) ([0a79535](https://github.com/Arize-ai/phoenix/commit/0a79535f20426072c8ffa60960b605a8dbb95a18))

## [4.4.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.4.2...arize-phoenix-v4.4.3) (2024-06-17)


### Bug Fixes

* hdbscan incompatibility with numpy 2.0 ([#3533](https://github.com/Arize-ai/phoenix/issues/3533)) ([52dc11d](https://github.com/Arize-ai/phoenix/commit/52dc11d0b30e0a3588467de46ccfa02bd21e767b))

## [4.4.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.4.1...arize-phoenix-v4.4.2) (2024-06-13)


### Bug Fixes

* ui light mode fix for llm messages ([#3510](https://github.com/Arize-ai/phoenix/issues/3510)) ([9aa2eba](https://github.com/Arize-ai/phoenix/commit/9aa2ebab31a8fd729c870e89fbc6b855e1eb6fda))

## [4.4.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.4.0...arize-phoenix-v4.4.1) (2024-06-11)


### Bug Fixes

* ensure welcome message urls are valid ([#3458](https://github.com/Arize-ai/phoenix/issues/3458)) ([3218e33](https://github.com/Arize-ai/phoenix/commit/3218e33d7d87ae6e06bd7573b3e2c5312531f256))

## [4.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.3.1...arize-phoenix-v4.4.0) (2024-06-10)


### Features

* **ui:** add filter snippets for metadata and substring search ([#3451](https://github.com/Arize-ai/phoenix/issues/3451)) ([2c37be4](https://github.com/Arize-ai/phoenix/commit/2c37be41c4cc20fdf6d3d2c3e66e64d146307cc9))

## [4.3.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.3.0...arize-phoenix-v4.3.1) (2024-06-10)


### Bug Fixes

* add support for querying datetimes ([#3441](https://github.com/Arize-ai/phoenix/issues/3441)) ([2f329a1](https://github.com/Arize-ai/phoenix/commit/2f329a1415009301aa9ea10de947acd435756646))

## [4.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.2.4...arize-phoenix-v4.3.0) (2024-06-07)


### Features

* Adds timing info to llm_classify ([#3377](https://github.com/Arize-ai/phoenix/issues/3377)) ([3e2785f](https://github.com/Arize-ai/phoenix/commit/3e2785f7d53dd628e7027fe988ae066fa1be0da1))
* Serializable execution details ([#3358](https://github.com/Arize-ai/phoenix/issues/3358)) ([fc74513](https://github.com/Arize-ai/phoenix/commit/fc7451372c9b938a27c7b36f7e32704f7b3a8e87))
* **ui:** display input and output for tool spans (if available) ([#3396](https://github.com/Arize-ai/phoenix/issues/3396)) ([73312dc](https://github.com/Arize-ai/phoenix/commit/73312dc9f85aefba7f9d0c5105f0efd75327f0c1))


### Bug Fixes

* add separate package installations to notebooks ([#3393](https://github.com/Arize-ai/phoenix/issues/3393)) ([914e3fe](https://github.com/Arize-ai/phoenix/commit/914e3feceaf08d3f208669dfb5697feb4f51ac3a))
* filter out undefined ([#3383](https://github.com/Arize-ai/phoenix/issues/3383)) ([e3a2d31](https://github.com/Arize-ai/phoenix/commit/e3a2d316956df40a6b7634427175dc20284e20ef))
* percentage sign for alembic configparser ([#3403](https://github.com/Arize-ai/phoenix/issues/3403)) ([87bcd59](https://github.com/Arize-ai/phoenix/commit/87bcd5951f1a9ed98c415c40f4f83560610f56f2))


### Documentation

* minimum working example with a local llm ([#3348](https://github.com/Arize-ai/phoenix/issues/3348)) ([e4c657c](https://github.com/Arize-ai/phoenix/commit/e4c657cce7e5492e314dfdd7cc6cca54da68b7f6))

## [4.2.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.2.3...arize-phoenix-v4.2.4) (2024-05-28)


### Bug Fixes

* update link to openinference spec ([#3322](https://github.com/Arize-ai/phoenix/issues/3322)) ([61dedf8](https://github.com/Arize-ai/phoenix/commit/61dedf8828f7a9aea1ee3b31790bb03e13207285))


### Documentation

* Update langchain dependencies in tutorials ([#3316](https://github.com/Arize-ai/phoenix/issues/3316)) ([e403652](https://github.com/Arize-ai/phoenix/commit/e4036528248369fe822c8cee836b68b1bc252d3d))

## [4.2.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.2.2...arize-phoenix-v4.2.3) (2024-05-23)


### Bug Fixes

* adjust docker tags ([#3297](https://github.com/Arize-ai/phoenix/issues/3297)) ([f097acc](https://github.com/Arize-ai/phoenix/commit/f097accc603fd78478f68cb2c9a4a0830da3cce0))

## [4.2.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.2.1...arize-phoenix-v4.2.2) (2024-05-23)


### Bug Fixes

* Tweak release flow ([#3295](https://github.com/Arize-ai/phoenix/issues/3295)) ([8ff19d3](https://github.com/Arize-ai/phoenix/commit/8ff19d347f3bc17628836ffd16ff7e33d734f024))

## [4.2.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.2.0...arize-phoenix-v4.2.1) (2024-05-23)


### Bug Fixes

* **gql:** don't clear data if `read_only` ([#3291](https://github.com/Arize-ai/phoenix/issues/3291)) ([dbc3203](https://github.com/Arize-ai/phoenix/commit/dbc32035903a84b85fe3c97df80b8f4d4a3197db))

## [4.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.1.3...arize-phoenix-v4.2.0) (2024-05-23)


### Features

* docker image runs as root by default with tags for nonroot and debug images ([#3282](https://github.com/Arize-ai/phoenix/issues/3282)) ([7178c25](https://github.com/Arize-ai/phoenix/commit/7178c25676447a5d83c2e4300584c8ba89da576d))

## [4.1.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.1.2...arize-phoenix-v4.1.3) (2024-05-22)


### Bug Fixes

* need to check ".get()" because attribute may not be a dict ([#3267](https://github.com/Arize-ai/phoenix/issues/3267)) ([3917fcc](https://github.com/Arize-ai/phoenix/commit/3917fccbb4550db2fcdb23f288b42a2284dff59f))

## [4.1.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.1.1...arize-phoenix-v4.1.2) (2024-05-20)


### Bug Fixes

* join on `trace_id` in `get_qa_with_reference` ([#3248](https://github.com/Arize-ai/phoenix/issues/3248)) ([a88d4ff](https://github.com/Arize-ai/phoenix/commit/a88d4ff99b168f27b6492ed7247c9b3639fa3adc))


### Documentation

* new updated readme ([#3231](https://github.com/Arize-ai/phoenix/issues/3231)) ([f728447](https://github.com/Arize-ai/phoenix/commit/f728447851806e4c4def2440100ff38a52185429))

## [4.1.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.1.0...arize-phoenix-v4.1.1) (2024-05-17)


### Bug Fixes

* resolve rounding issue in postgres ([#3232](https://github.com/Arize-ai/phoenix/issues/3232)) ([3b6c666](https://github.com/Arize-ai/phoenix/commit/3b6c666cef077ed740b85e8583f2b6f452329dd6))

## [4.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.0.3...arize-phoenix-v4.1.0) (2024-05-17)


### Features

* Add ASGI root path parameter to Phoenix server ([#3186](https://github.com/Arize-ai/phoenix/issues/3186)) ([e27cc5d](https://github.com/Arize-ai/phoenix/commit/e27cc5d75f8edd3a86786838401a4ed4747624cd))


### Documentation

* bump base image in kustomize ([#3193](https://github.com/Arize-ai/phoenix/issues/3193)) ([5e8bc3d](https://github.com/Arize-ai/phoenix/commit/5e8bc3dad2036b2febb1d343103d331723413a72))
* PHOENIX_WORKING_DIR default value documentation ([#3190](https://github.com/Arize-ai/phoenix/issues/3190)) ([6957bd9](https://github.com/Arize-ai/phoenix/commit/6957bd94c80d646c07ce38696f82331a9d91094a))

## [4.0.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.0.2...arize-phoenix-v4.0.3) (2024-05-13)


### Bug Fixes

* Always wait a small amount of time between inserts ([#3168](https://github.com/Arize-ai/phoenix/issues/3168)) ([6e18e3c](https://github.com/Arize-ai/phoenix/commit/6e18e3c5fc75d96cfb937ebb1ea5b66e369c3ffd))

## [4.0.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.0.1...arize-phoenix-v4.0.2) (2024-05-11)


### Bug Fixes

* Bulk inserter begins first insert immediately ([#3151](https://github.com/Arize-ai/phoenix/issues/3151)) ([7e17cb2](https://github.com/Arize-ai/phoenix/commit/7e17cb2fd091ad83885fc127083c20945ade530e))
* unflatten attributes when loading spans from `trace_dataset` ([#3170](https://github.com/Arize-ai/phoenix/issues/3170)) ([a165023](https://github.com/Arize-ai/phoenix/commit/a165023144542a80642a5624797aba61745c9582))

## [4.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v4.0.0...arize-phoenix-v4.0.1) (2024-05-09)


### Bug Fixes

* coerce `input.value` to string at ingestion ([#3147](https://github.com/Arize-ai/phoenix/issues/3147)) ([3742ea7](https://github.com/Arize-ai/phoenix/commit/3742ea7a479b2ad46b4787444ccef2daa1a6b6d7))


### Documentation

* update kustomize k8s manifests ([#3148](https://github.com/Arize-ai/phoenix/issues/3148)) ([ba166af](https://github.com/Arize-ai/phoenix/commit/ba166af8a0ebdd96c8b0671f5a8ddfb36bcedbd8))

## [4.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.25.0...arize-phoenix-v4.0.0) (2024-05-09)

⚠ BREAKING CHANGES
* Remove experimental module ([#2945](https://github.com/Arize-ai/phoenix/issues/2945))

### Features
* Add log_traces method that sends TraceDataset traces to Phoenix ([#2897](https://github.com/Arize-ai/phoenix/issues/2897)) ([c8f9ed2](https://github.com/Arize-ai/phoenix/commit/c8f9ed2cd031cb426bbd885bdf827e6c7aaf1c48))
* add a last N time range selector on project / projects pages ([#2907](https://github.com/Arize-ai/phoenix/issues/2907)) ([3c115f8](https://github.com/Arize-ai/phoenix/commit/3c115f872c189d9ce5c3742a147e2ce952ba94d8))
* add bedrock claude tracing tutorial ([#2919](https://github.com/Arize-ai/phoenix/issues/2919)) ([b8b5240](https://github.com/Arize-ai/phoenix/commit/b8b524045fd7531a82f02a82bc5c0659c263621e))
* add default limit to /v1/spans and corresponding client methods ([#3026](https://github.com/Arize-ai/phoenix/issues/3026)) ([e5698d7](https://github.com/Arize-ai/phoenix/commit/e5698d76e3b074aeb9f406f6c2f8948fcc85e04d))
* add gradient start/end to projects table ([#2956](https://github.com/Arize-ai/phoenix/issues/2956)) ([5b6b217](https://github.com/Arize-ai/phoenix/commit/5b6b21704a72002be9f75db2b85cd8cabdb7649a))
* add grpc endpoint ([#2232](https://github.com/Arize-ai/phoenix/issues/2232)) ([8bbd136](https://github.com/Arize-ai/phoenix/commit/8bbd136fe0975c6be353250f450bad75131a7637))
* Add indexes on Annotation tables ([#3082](https://github.com/Arize-ai/phoenix/issues/3082)) ([682ecee](https://github.com/Arize-ai/phoenix/commit/682eceeaf85873090eb322b97601334a0dbca72f))
* Add indexes on spans table ([#3098](https://github.com/Arize-ai/phoenix/issues/3098)) ([12d2574](https://github.com/Arize-ai/phoenix/commit/12d2574c62cc05cb46f9c066f5acd2c90fce7986))
* add opentelemetry trace instrumentation for Phoenix server ([#2990](https://github.com/Arize-ai/phoenix/issues/2990)) ([6ed494e](https://github.com/Arize-ai/phoenix/commit/6ed494e053fa62a53742ea4c272476ab4682553a))
* Add SQL and Code Functionality Eval Templates ([#2861](https://github.com/Arize-ai/phoenix/issues/2861)) ([c7d776a](https://github.com/Arize-ai/phoenix/commit/c7d776a23e1843cc1bb5c74059496615700a3396))
* add trace and document evals to GET v1/evaluations ([#2910](https://github.com/Arize-ai/phoenix/issues/2910)) ([79229f2](https://github.com/Arize-ai/phoenix/commit/79229f20ae95d1cca5919aa9e5558a371a0422f1))
* Add user frustration eval ([#2928](https://github.com/Arize-ai/phoenix/issues/2928)) ([406938b](https://github.com/Arize-ai/phoenix/commit/406938b1f19ee6efb7cec630772d9d8940c0953f))
* Added support for default_headers for azure_openai. ([#2917](https://github.com/Arize-ai/phoenix/issues/2917)) ([6ee5f24](https://github.com/Arize-ai/phoenix/commit/6ee5f243951733e03b361fd16b05e9c80f3b9f2e))
* convert graphql api to pull trace evaluations from db ([#2867](https://github.com/Arize-ai/phoenix/issues/2867)) ([11aa455](https://github.com/Arize-ai/phoenix/commit/11aa455e53bedf5116db0d0c0e132b5f6dff2213))
* Deprecate datasets module, rename to inferences ([#2785](https://github.com/Arize-ai/phoenix/issues/2785)) ([4987ea3](https://github.com/Arize-ai/phoenix/commit/4987ea37b1b9417f0c3b8d5fa7d4b4c8659b7503))
* experimental: postgres support ([a2657d4](https://github.com/Arize-ai/phoenix/commit/a2657d4a99f89aa9beb9b2529c624d88c1727ae7))
* fetch annotation names ([#2964](https://github.com/Arize-ai/phoenix/issues/2964)) ([6c5d25d](https://github.com/Arize-ai/phoenix/commit/6c5d25d4598451b19ad8e82f7d7a962a07f6968f))
* fetch document retrieval metrics per span using SQL ([#2960](https://github.com/Arize-ai/phoenix/issues/2960)) ([9fdb765](https://github.com/Arize-ai/phoenix/commit/9fdb7655efe9fe97897bcd818b2b5de93e5261cb))
* graphql api pulls from db for document evaluations ([#2865](https://github.com/Arize-ai/phoenix/issues/2865)) ([e4b667d](https://github.com/Arize-ai/phoenix/commit/e4b667da68413b0e362d9b6ccd5d8434a4f1a208))
* grpc interceptor for prometheus ([#3056](https://github.com/Arize-ai/phoenix/issues/3056)) ([610c8fa](https://github.com/Arize-ai/phoenix/commit/610c8faa05da0af1697684ef8970105cfefb35a9))
* ingest document evals ([#2847](https://github.com/Arize-ai/phoenix/issues/2847)) ([f3fde50](https://github.com/Arize-ai/phoenix/commit/f3fde5093bf5c0f7de41c29b30c1b61d57c6ce48))
* ingest pyarrow span evals into sqlite ([#2837](https://github.com/Arize-ai/phoenix/issues/2837)) ([3a6666c](https://github.com/Arize-ai/phoenix/commit/3a6666c6663dfc597aeac365f2b3cf10acb095e8))
* ingest trace annotations ([#2852](https://github.com/Arize-ai/phoenix/issues/2852)) ([792f674](https://github.com/Arize-ai/phoenix/commit/792f6740070c4b42087a68a19df74ce7fc920f7c))
* make graphql api for span evaluations read from database ([#2860](https://github.com/Arize-ai/phoenix/issues/2860)) ([5adf750](https://github.com/Arize-ai/phoenix/commit/5adf75078abb61923a8646dd0c5c6e454585a5e4))
* move document evaluation summary to pull from db ([#2888](https://github.com/Arize-ai/phoenix/issues/2888)) ([73ca2d7](https://github.com/Arize-ai/phoenix/commit/73ca2d7484c96cc4de360e4a5e9e3cf01af2b9f1))
* openapi ui for api exploration ([#3041](https://github.com/Arize-ai/phoenix/issues/3041)) ([5b22961](https://github.com/Arize-ai/phoenix/commit/5b22961bf70c7124686c1b86c750f30374fe7eca))
* persistence: add support for sorting by eval scores and labels ([#2977](https://github.com/Arize-ai/phoenix/issues/2977)) ([44c3068](https://github.com/Arize-ai/phoenix/commit/44c306854b95fa6d27d74d978a7355e01085189a))
* persistence: bulk inserter for spans ([#2808](https://github.com/Arize-ai/phoenix/issues/2808)) ([9ce841e](https://github.com/Arize-ai/phoenix/commit/9ce841eb1c9d4f248cae482992ab67447ae53fee))
* persistence: clear project ([#2976](https://github.com/Arize-ai/phoenix/issues/2976)) ([665c166](https://github.com/Arize-ai/phoenix/commit/665c166c282a15837508889e715e6a25dd20cffa))
* persistence: clear traces UI ([#2988](https://github.com/Arize-ai/phoenix/issues/2988)) ([a717ff6](https://github.com/Arize-ai/phoenix/commit/a717ff6c48d2b67dd7505bf2aa1d3db7f2c3e713))
* persistence: dataloader for document retrieval metrics ([#2978](https://github.com/Arize-ai/phoenix/issues/2978)) ([f55c458](https://github.com/Arize-ai/phoenix/commit/f55c4585e28b6941fba7f092922d34a083f88869))
* persistence: dataloader for span descendants ([#2980](https://github.com/Arize-ai/phoenix/issues/2980)) ([d8e10d4](https://github.com/Arize-ai/phoenix/commit/d8e10d4813338e90ba926daba64a279e140cc8fe))
* persistence: ensure migrations run for TreadSession ([#2855](https://github.com/Arize-ai/phoenix/issues/2855)) ([ec4fea7](https://github.com/Arize-ai/phoenix/commit/ec4fea7e9825d57b9dbb5318f013b18a7e1aec41))
* persistence: fetch latency_ms percentiles using sql with dataloaders ([#2818](https://github.com/Arize-ai/phoenix/issues/2818)) ([48d4643](https://github.com/Arize-ai/phoenix/commit/48d46432417473ea918d83fa5d2cb0dfd38bc499))
* persistence: fetch streaming_last_updated_at ([#2819](https://github.com/Arize-ai/phoenix/issues/2819)) ([d665e49](https://github.com/Arize-ai/phoenix/commit/d665e497945d94c862a6a4ed9f2b2491a17a36c2))
* persistence: get or delete projects using sql ([#2839](https://github.com/Arize-ai/phoenix/issues/2839)) ([527b9a9](https://github.com/Arize-ai/phoenix/commit/527b9a989f96089cf0b5463f30993c8d1ab02d13))
* persistence: json binary for postgres ([#2849](https://github.com/Arize-ai/phoenix/issues/2849)) ([29351bf](https://github.com/Arize-ai/phoenix/commit/29351bf77897b1c212951b9149bd595dfb120a3d))
* persistence: launch app with persist ([#2817](https://github.com/Arize-ai/phoenix/issues/2817)) ([add6103](https://github.com/Arize-ai/phoenix/commit/add6103874a79acd98c3a2506754c69de2e9d67f))
* persistence: make launch_app runnable on tmp directory ([#2851](https://github.com/Arize-ai/phoenix/issues/2851)) ([f41e922](https://github.com/Arize-ai/phoenix/commit/f41e9227d11fa18677520b2326b47843ce030de2))
* persistence: span annotation tables ([#2788](https://github.com/Arize-ai/phoenix/issues/2788)) ([874c61e](https://github.com/Arize-ai/phoenix/commit/874c61e3373eda4c8dd8334b68d8de457175ad25))
* persistence: span query DSL with SQL ([#2911](https://github.com/Arize-ai/phoenix/issues/2911)) ([7c01420](https://github.com/Arize-ai/phoenix/commit/7c01420115141b38c2d96167d0ef982923415486))
* persistence: sql sorting for spans ([#2823](https://github.com/Arize-ai/phoenix/issues/2823)) ([eeafb64](https://github.com/Arize-ai/phoenix/commit/eeafb64379a63cc32f33c0d43f7ec5a77f4d8ab6))
* persistence: use sqlean v3.45.1 as sqlite engine ([#2947](https://github.com/Arize-ai/phoenix/issues/2947)) ([3b202d7](https://github.com/Arize-ai/phoenix/commit/3b202d70951a7424dde5b2d6fe82e29fab11785f))
* Remove experimental module ([#2945](https://github.com/Arize-ai/phoenix/issues/2945)) ([01758cf](https://github.com/Arize-ai/phoenix/commit/01758cffd8cf72d2c3a892faa01174b9f2f42c7b))
* restrict project metrics to be last 7 days ([#2896](https://github.com/Arize-ai/phoenix/issues/2896)) ([066bc16](https://github.com/Arize-ai/phoenix/commit/066bc16b7543f9e889b58dac31614ca17c2117be))
* span filtering by span evaluations ([#2923](https://github.com/Arize-ai/phoenix/issues/2923)) ([4458ec4](https://github.com/Arize-ai/phoenix/commit/4458ec404bd1d1e51fb466eb65e73733281e13c8))
* Support basic auth ([#3061](https://github.com/Arize-ai/phoenix/issues/3061)) ([3202256](https://github.com/Arize-ai/phoenix/commit/320225659ee1fd0eee19aea889304fc3f03fa0fc))
* support for span evaluations to get evaluations endpoint ([#2900](https://github.com/Arize-ai/phoenix/issues/2900)) ([379e336](https://github.com/Arize-ai/phoenix/commit/379e3364f173d2c9fe399c68194489a511dcf7b2))
* support pagination on spans resolver ([#3046](https://github.com/Arize-ai/phoenix/issues/3046)) ([2113c5c](https://github.com/Arize-ai/phoenix/commit/2113c5c525113a64a1d03d50261e511e69dd6374))
* Update API for OpenAPI compliance ([#2866](https://github.com/Arize-ai/phoenix/issues/2866)) ([0db65d8](https://github.com/Arize-ai/phoenix/commit/0db65d8d9d3bb1213c0957dae693413db585bc14))
* Update eval summaries to use persistence ([#2920](https://github.com/Arize-ai/phoenix/issues/2920)) ([06eb320](https://github.com/Arize-ai/phoenix/commit/06eb320bd647d8c701fc25c58e910e7d8324b144))

### Bug Fixes
* add the remainder of the sentence ([#2903](https://github.com/Arize-ai/phoenix/issues/2903)) ([64874b8](https://github.com/Arize-ai/phoenix/commit/64874b8eed7c808801a5a5a14fc63c90631b28c5))
* backward compatible truthiness for query from dict parsing ([#3124](https://github.com/Arize-ai/phoenix/issues/3124)) ([b425f9d](https://github.com/Arize-ai/phoenix/commit/b425f9db7e6697b89f58ce77a15789d071522fec))
* cartesian product in sql join ([#2959](https://github.com/Arize-ai/phoenix/issues/2959)) ([c96092d](https://github.com/Arize-ai/phoenix/commit/c96092d47c3a0f57157712bd5214be0d874a44eb))
* cartesian products in get_evaluations ([#3081](https://github.com/Arize-ai/phoenix/issues/3081)) ([64ebec8](https://github.com/Arize-ai/phoenix/commit/64ebec8a767f0af7d7417b67f921bad1f46a9d99))
* check payload for legacy project_name ([#3125](https://github.com/Arize-ai/phoenix/issues/3125)) ([d7eae60](https://github.com/Arize-ai/phoenix/commit/d7eae6017a4f4cb29ecc718a5c3353dfa402e650))
* close delete modal on delete ([#3069](https://github.com/Arize-ai/phoenix/issues/3069)) ([083a467](https://github.com/Arize-ai/phoenix/commit/083a467192e69ab9af2ee0f77d63720185a2119f))
* commit insert into alembic_version ([#3115](https://github.com/Arize-ai/phoenix/issues/3115)) ([93a144f](https://github.com/Arize-ai/phoenix/commit/93a144f6b7b81cf5358196a02752c1e4961e999c))
* disable client-side sorting on trace/span tables ([#2958](https://github.com/Arize-ai/phoenix/issues/2958)) ([139dc3e](https://github.com/Arize-ai/phoenix/commit/139dc3ec4ff553b1d812ec46193d04acb07786da))
* disable grpc when readonly ([#3105](https://github.com/Arize-ai/phoenix/issues/3105)) ([71ceba9](https://github.com/Arize-ai/phoenix/commit/71ceba90904f4b98e86f6500de4a06aa9397a786))
* Dockerfile launches Phoenix that listens on IPv6 ([#3047](https://github.com/Arize-ai/phoenix/issues/3047)) ([75cc979](https://github.com/Arize-ai/phoenix/commit/75cc979e66b5193595380836c77a6126aceb2006))
* eliminate interference on global tracer provider ([#2998](https://github.com/Arize-ai/phoenix/issues/2998)) ([5d7b843](https://github.com/Arize-ai/phoenix/commit/5d7b8430335c26e15e635e623c1d5d18475c32e1))
* Enable listening on IPv6 ([#3037](https://github.com/Arize-ai/phoenix/issues/3037)) ([dee6681](https://github.com/Arize-ai/phoenix/commit/dee66811bc7feb9ef4a5c03dfb525f8a75193329))
* ensure recent version of opentelemetry-proto is used ([#2948](https://github.com/Arize-ai/phoenix/issues/2948)) ([33647f5](https://github.com/Arize-ai/phoenix/commit/33647f5c0b93040cec95152e5fecb77a7ad4c10f))
* evals: incorrect wording in hallucinations ([#3085](https://github.com/Arize-ai/phoenix/issues/3085)) ([7aa0292](https://github.com/Arize-ai/phoenix/commit/7aa029239c2c36b677070e270f7127f6bf6cff5e))
* fix docker build for sql ([b6d508d](https://github.com/Arize-ai/phoenix/commit/b6d508d5aa286768e6fc87b58ed901b3c2f8222c))
* forbid blank or empty evaluation names ([#2962](https://github.com/Arize-ai/phoenix/issues/2962)) ([cb87977](https://github.com/Arize-ai/phoenix/commit/cb87977f764abbeabca112769d31ff23e6e008d6))
* improve error handling and logging for eval insertions ([#2854](https://github.com/Arize-ai/phoenix/issues/2854)) ([d04694b](https://github.com/Arize-ai/phoenix/commit/d04694b7db50fd032c4378ea9933206c0503ea63))
* include migration files ([#2887](https://github.com/Arize-ai/phoenix/issues/2887)) ([b0a772e](https://github.com/Arize-ai/phoenix/commit/b0a772ec017888165cabd53e2cbc7ff00ec752c3))
* Invalidate cache on project reset ([#3113](https://github.com/Arize-ai/phoenix/issues/3113)) ([2944ae5](https://github.com/Arize-ai/phoenix/commit/2944ae586f05dd6a1e4425987137c098e14e60fb))
* normalize datetime for phoenix client ([#3088](https://github.com/Arize-ai/phoenix/issues/3088)) ([94a25ae](https://github.com/Arize-ai/phoenix/commit/94a25ae42b3c3758b5e6bd8082d1adde155d8594))
* normalize telemetry url before setup ([#3001](https://github.com/Arize-ai/phoenix/issues/3001)) ([28389e8](https://github.com/Arize-ai/phoenix/commit/28389e8988b967c6693e4b5bab1586deb8245f29))
* persistence: db race condition between spans and evals ([#2905](https://github.com/Arize-ai/phoenix/issues/2905)) ([2666464](https://github.com/Arize-ai/phoenix/commit/2666464ce0bc19a6e8ab8f3267f78672393e72a8))
* persistence: import asert_never from typing_extensions ([#2850](https://github.com/Arize-ai/phoenix/issues/2850)) ([62644cb](https://github.com/Arize-ai/phoenix/commit/62644cbd905652efe6f4674a185781517e57fbbd))
* persistence: postgres down migration and url support ([#2915](https://github.com/Arize-ai/phoenix/issues/2915)) ([4b4a776](https://github.com/Arize-ai/phoenix/commit/4b4a776162986c5e9c4b94d41904187d0cda6236))
* persistence: postgres json calculations ([#2848](https://github.com/Arize-ai/phoenix/issues/2848)) ([45f084d](https://github.com/Arize-ai/phoenix/commit/45f084d1ce053c4036241dac069cb315e49c0c76))
* persistence: postgres timestamp insertion ([#2844](https://github.com/Arize-ai/phoenix/issues/2844)) ([3477bb9](https://github.com/Arize-ai/phoenix/commit/3477bb9bfa3c27c223e6d9144e1da4326e81975a))
* preserve loggers across migrations ([#2835](https://github.com/Arize-ai/phoenix/issues/2835)) ([2821bb4](https://github.com/Arize-ai/phoenix/commit/2821bb4fe9fda331fccc6aa6f4fd40a54661a18b))
* prometheus transaction timers for bulkloader ([#3066](https://github.com/Arize-ai/phoenix/issues/3066)) ([e0cc58d](https://github.com/Arize-ai/phoenix/commit/e0cc58d1efe8291e326bd8077228cc44438ed283))
* Propagate migration errors and show an informative message ([#2994](https://github.com/Arize-ai/phoenix/issues/2994)) ([3718e10](https://github.com/Arize-ai/phoenix/commit/3718e107daf44252e867087df4a156d41773abe6))
* remove broken non-asyncio prometheus grpc server interceptor ([#3065](https://github.com/Arize-ai/phoenix/issues/3065)) ([af75151](https://github.com/Arize-ai/phoenix/commit/af751511b3d0aff03fc8027a1e50e40d89c3fab3))
* round down time points to facilitate caching ([#3079](https://github.com/Arize-ai/phoenix/issues/3079)) ([42b03c9](https://github.com/Arize-ai/phoenix/commit/42b03c9466ab936caf79f2d5a75d3dee2c1d5ee3))
* run docker as nonroot user ([#3100](https://github.com/Arize-ai/phoenix/issues/3100)) ([c640678](https://github.com/Arize-ai/phoenix/commit/c6406782f91e5ebb7e930002f4c983a01bcffef9))
* safely unpack Evaluations proto in bulk inserter ([#2869](https://github.com/Arize-ai/phoenix/issues/2869)) ([50517f7](https://github.com/Arize-ai/phoenix/commit/50517f7c7e7fec53468e4da60a2e9942a409c68e))
* span and trace evaluation summaries ([#3013](https://github.com/Arize-ai/phoenix/issues/3013)) ([088e6c2](https://github.com/Arize-ai/phoenix/commit/088e6c20c32cccd6570b39072cb9759629d67431))
* span event to dict conversion ([#3009](https://github.com/Arize-ai/phoenix/issues/3009)) ([3c73f03](https://github.com/Arize-ai/phoenix/commit/3c73f03094b3462b355e4290a07b22280d68ea65))
* switch license format in toml ([5c6f345](https://github.com/Arize-ai/phoenix/commit/5c6f345691dcab3d460823329ce31b9060bab02c))
* typo in SpanAnnotation ([#2967](https://github.com/Arize-ai/phoenix/issues/2967)) ([f41044e](https://github.com/Arize-ai/phoenix/commit/f41044ebfc3fc687d47eaf54d7510256f2998f9c))
* typo in trace annotation table name ([#2946](https://github.com/Arize-ai/phoenix/issues/2946)) ([344b858](https://github.com/Arize-ai/phoenix/commit/344b8582d6dff0a02d7f37bd7fe97186c54cef80))
Documentation
* Add log_traces tutorial ([#2902](https://github.com/Arize-ai/phoenix/issues/2902)) ([e583f03](https://github.com/Arize-ai/phoenix/commit/e583f03118f184de0e41a1dafe35731d099ad872))
* development: make it explicit that you need to run pnpm build ([#3035](https://github.com/Arize-ai/phoenix/issues/3035)) ([672cbed](https://github.com/Arize-ai/phoenix/commit/672cbedcea9746ee5ea1d6b61032931110a9b121))
* dockerize manual instrumentation example ([#2797](https://github.com/Arize-ai/phoenix/issues/2797)) ([651efbe](https://github.com/Arize-ai/phoenix/commit/651efbe56e6ce3be35b8471827d83a674b494230))
* manually instrumented chatbot ([#2730](https://github.com/Arize-ai/phoenix/issues/2730)) ([46be32b](https://github.com/Arize-ai/phoenix/commit/46be32b54438a5cc9dc26948138ddacd36699409))
* remove experimental tags in code ([4c4a832](https://github.com/Arize-ai/phoenix/commit/4c4a832adb874a151821b1ef46a709daf5091003))


## [3.25.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.24.0...arize-phoenix-v3.25.0) (2024-05-06)


### Features

* add bedrock claude tracing tutorial ([#2919](https://github.com/Arize-ai/phoenix/issues/2919)) ([b8b5240](https://github.com/Arize-ai/phoenix/commit/b8b524045fd7531a82f02a82bc5c0659c263621e))


### Bug Fixes

* **evals:** incorrect wording in hallucinations ([#3085](https://github.com/Arize-ai/phoenix/issues/3085)) ([7aa0292](https://github.com/Arize-ai/phoenix/commit/7aa029239c2c36b677070e270f7127f6bf6cff5e))
* run docker as nonroot user ([#3100](https://github.com/Arize-ai/phoenix/issues/3100)) ([c640678](https://github.com/Arize-ai/phoenix/commit/c6406782f91e5ebb7e930002f4c983a01bcffef9))


### Documentation

* **development:** make it explicit that you need to run pnpm build ([#3035](https://github.com/Arize-ai/phoenix/issues/3035)) ([672cbed](https://github.com/Arize-ai/phoenix/commit/672cbedcea9746ee5ea1d6b61032931110a9b121))

## [3.24.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.23.0...arize-phoenix-v3.24.0) (2024-04-22)


### Features

* Add user frustration eval ([#2928](https://github.com/Arize-ai/phoenix/issues/2928)) ([406938b](https://github.com/Arize-ai/phoenix/commit/406938b1f19ee6efb7cec630772d9d8940c0953f))


### Bug Fixes

* ensure recent version of opentelemetry-proto is used ([#2948](https://github.com/Arize-ai/phoenix/issues/2948)) ([33647f5](https://github.com/Arize-ai/phoenix/commit/33647f5c0b93040cec95152e5fecb77a7ad4c10f))

## [3.23.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.22.0...arize-phoenix-v3.23.0) (2024-04-19)


### Features

* Added support for default_headers for azure_openai. ([#2917](https://github.com/Arize-ai/phoenix/issues/2917)) ([6ee5f24](https://github.com/Arize-ai/phoenix/commit/6ee5f243951733e03b361fd16b05e9c80f3b9f2e))


### Bug Fixes

* add the remainder of the sentence ([#2903](https://github.com/Arize-ai/phoenix/issues/2903)) ([64874b8](https://github.com/Arize-ai/phoenix/commit/64874b8eed7c808801a5a5a14fc63c90631b28c5))


### Documentation

* Add `log_traces` tutorial ([#2902](https://github.com/Arize-ai/phoenix/issues/2902)) ([e583f03](https://github.com/Arize-ai/phoenix/commit/e583f03118f184de0e41a1dafe35731d099ad872))

## [3.22.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.21.0...arize-phoenix-v3.22.0) (2024-04-16)


### Features

* Add `log_traces` method that sends `TraceDataset` traces to Phoenix ([#2897](https://github.com/Arize-ai/phoenix/issues/2897)) ([c8f9ed2](https://github.com/Arize-ai/phoenix/commit/c8f9ed2cd031cb426bbd885bdf827e6c7aaf1c48))

## [3.21.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.20.0...arize-phoenix-v3.21.0) (2024-04-12)


### Features

* Add SQL and Code Functionality Eval Templates ([#2861](https://github.com/Arize-ai/phoenix/issues/2861)) ([c7d776a](https://github.com/Arize-ai/phoenix/commit/c7d776a23e1843cc1bb5c74059496615700a3396))

## [3.20.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.19.4...arize-phoenix-v3.20.0) (2024-04-10)


### Features

* Deprecate `datasets` module, rename to `inferences` ([#2785](https://github.com/Arize-ai/phoenix/issues/2785)) ([4987ea3](https://github.com/Arize-ai/phoenix/commit/4987ea37b1b9417f0c3b8d5fa7d4b4c8659b7503))


### Documentation

* dockerize manual instrumentation example ([#2797](https://github.com/Arize-ai/phoenix/issues/2797)) ([651efbe](https://github.com/Arize-ai/phoenix/commit/651efbe56e6ce3be35b8471827d83a674b494230))
* remove experimental tags in code ([4c4a832](https://github.com/Arize-ai/phoenix/commit/4c4a832adb874a151821b1ef46a709daf5091003))

## [3.19.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.19.3...arize-phoenix-v3.19.4) (2024-04-04)


### Bug Fixes

* switch license format  in toml ([5c6f345](https://github.com/Arize-ai/phoenix/commit/5c6f345691dcab3d460823329ce31b9060bab02c))


### Documentation

* fix qa with reference tutorial ([e1db1ce](https://github.com/Arize-ai/phoenix/commit/e1db1cee189e36311eb96f7473a8b496340907bc))
* fix qa with reference tutorial ([ba24950](https://github.com/Arize-ai/phoenix/commit/ba249507f24dca801a3986e6275dae5f468ef362))
* make dockerhub URL go to public ([6650f67](https://github.com/Arize-ai/phoenix/commit/6650f6729117e192de9e2435ed543c01b654f2aa))
* manually instrumented chatbot ([#2730](https://github.com/Arize-ai/phoenix/issues/2730)) ([46be32b](https://github.com/Arize-ai/phoenix/commit/46be32b54438a5cc9dc26948138ddacd36699409))

## [3.19.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.19.2...arize-phoenix-v3.19.3) (2024-03-30)


### Bug Fixes

* **ui:** show formatted JSON for attributes ([0d1b719](https://github.com/Arize-ai/phoenix/commit/0d1b71974b26d3fec228f07837dc4c7d2cfa2e18))
* **ui:** show formatted JSON for attributes ([09ad1be](https://github.com/Arize-ai/phoenix/commit/09ad1be7c14c86ac5d68b0fc6216056591a386c3))

## [3.19.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.19.1...arize-phoenix-v3.19.2) (2024-03-29)


### Bug Fixes

* **ui:** broken context for markdown ([556e901](https://github.com/Arize-ai/phoenix/commit/556e901c7dc19ed24fbb466c12fcbe03458070ec))

## [3.19.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.19.0...arize-phoenix-v3.19.1) (2024-03-29)


### Bug Fixes

* **UI:** color rotation for markdown ([3184359](https://github.com/Arize-ai/phoenix/commit/3184359487535331530000eda6e0b24f140f3530))

## [3.19.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.18.1...arize-phoenix-v3.19.0) (2024-03-29)


### Features

* **gql:** add trace node and trace evaluations ([#2662](https://github.com/Arize-ai/phoenix/issues/2662)) ([a985684](https://github.com/Arize-ai/phoenix/commit/a9856847955da5a2dc00d22c4bab424049c94f77))

## [3.18.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.18.0...arize-phoenix-v3.18.1) (2024-03-28)


### Bug Fixes

* ignore docs/ directory when formatting ([#2714](https://github.com/Arize-ai/phoenix/issues/2714)) ([1340f74](https://github.com/Arize-ai/phoenix/commit/1340f74000d8d94aa48611881aa8885995b7745b))
* repair frontend build step in release pipeline  ([#2716](https://github.com/Arize-ai/phoenix/issues/2716)) ([796eb6a](https://github.com/Arize-ai/phoenix/commit/796eb6a95e039c37b8a4904df0d1c1061de0acd0))

## [3.18.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.17.1...arize-phoenix-v3.18.0) (2024-03-28)


### Features

* change docker base image to distroless ([#2708](https://github.com/Arize-ai/phoenix/issues/2708)) ([89d6fe7](https://github.com/Arize-ai/phoenix/commit/89d6fe7bfba0f8cc4feb791f6018cbd59a13a640))

## [3.17.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.17.0...arize-phoenix-v3.17.1) (2024-03-24)


### Bug Fixes

* long project names do not overflow and squash project icon ([#2686](https://github.com/Arize-ai/phoenix/issues/2686)) ([b77bfaa](https://github.com/Arize-ai/phoenix/commit/b77bfaa494d5a1d7d845b967d8a6fe6eff990b9b))


### Documentation

* Add mistral (GITBOOK-594) ([78676af](https://github.com/Arize-ai/phoenix/commit/78676afcde73da59a890f146bfc1674bdbc00716))
* add mistral instrumentation to notebook ([#2681](https://github.com/Arize-ai/phoenix/issues/2681)) ([54dc47d](https://github.com/Arize-ai/phoenix/commit/54dc47d9c745ce443e40659e8f69a2f1304b1ab1))
* add mistral instrumentor to mistral tutorial ([#2682](https://github.com/Arize-ai/phoenix/issues/2682)) ([13fc1f8](https://github.com/Arize-ai/phoenix/commit/13fc1f8a9d696b5a5087d504c32415818d120285))
* Evals Structure! (GITBOOK-547) ([ac23311](https://github.com/Arize-ai/phoenix/commit/ac23311c37cc7cdb0f1c53a64d229a66acd2e2a6))
* fix missing parentheses (GITBOOK-571) ([2353953](https://github.com/Arize-ai/phoenix/commit/2353953cd8a0185f2fd8e391c72aaf340afc1cca))
* Mistral (GITBOOK-595) ([f245844](https://github.com/Arize-ai/phoenix/commit/f2458443df8f474ea8b238fbc0d4faa2dfe5b437))
* No subject (GITBOOK-597) ([b6196ac](https://github.com/Arize-ai/phoenix/commit/b6196ac8f7e05155f352180e712f282a1fc510d7))
* No subject (GITBOOK-598) ([f6a2bd6](https://github.com/Arize-ai/phoenix/commit/f6a2bd6491838440b05a5bfa93d83facad0e2dca))
* Remove pinecone notebook ([#2665](https://github.com/Arize-ai/phoenix/issues/2665)) ([9f1c1d4](https://github.com/Arize-ai/phoenix/commit/9f1c1d45b777673fe39e940415a7a9f4c8120e72))
* trace a deployed app (GITBOOK-593) ([08623ea](https://github.com/Arize-ai/phoenix/commit/08623eaa6354c7b70a5ac8c78ac9a5a939aefeec))

## [3.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.16.3...arize-phoenix-v3.17.0) (2024-03-21)


### Features

* Add `response_format` argument to `MistralAIModel` ([#2660](https://github.com/Arize-ai/phoenix/issues/2660)) ([7da51af](https://github.com/Arize-ai/phoenix/commit/7da51afc77984925cd59d7d909142141530684cc))
* **evals:** Add Mistral as an eval model ([#2640](https://github.com/Arize-ai/phoenix/issues/2640)) ([c13ab6b](https://github.com/Arize-ai/phoenix/commit/c13ab6bf644ec285c37e92cc6a7b114a309cec52))


### Documentation

* example using cron for online phoenix evals ([#2643](https://github.com/Arize-ai/phoenix/issues/2643)) ([5ea99ef](https://github.com/Arize-ai/phoenix/commit/5ea99ef8244d7b72901d6f78dc0b586d8e2a8086))
* mistral tutorial ([#2627](https://github.com/Arize-ai/phoenix/issues/2627)) ([97d4096](https://github.com/Arize-ai/phoenix/commit/97d4096876ab2c84de5d6c1e76e073b0d9824cd7))

## [3.16.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.16.2...arize-phoenix-v3.16.3) (2024-03-20)


### Bug Fixes

* project name for evals ([#2648](https://github.com/Arize-ai/phoenix/issues/2648)) ([14a3c2c](https://github.com/Arize-ai/phoenix/commit/14a3c2c2f00d848602acfcdf0530337a9d05196b))
* **trace:** query dsl for numpy arrays ([#2652](https://github.com/Arize-ai/phoenix/issues/2652)) ([33f7c73](https://github.com/Arize-ai/phoenix/commit/33f7c73ce4ed6e4b01ac5be7f54131c461b30dec))

## [3.16.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.16.1...arize-phoenix-v3.16.2) (2024-03-20)


### Bug Fixes

* **trace:** redefine root span ([#2632](https://github.com/Arize-ai/phoenix/issues/2632)) ([7940c9d](https://github.com/Arize-ai/phoenix/commit/7940c9d4fbce2ec8674733e43d742411e26488c6))
* **ui:** increase pagination size for TracePage ([#2642](https://github.com/Arize-ai/phoenix/issues/2642)) ([6cd456f](https://github.com/Arize-ai/phoenix/commit/6cd456fd4a4c3a9331379ee364221f4fce430c9c))


### Documentation

* Add Qdrant + Langchain tracing example ([#2634](https://github.com/Arize-ai/phoenix/issues/2634)) ([7f014f8](https://github.com/Arize-ai/phoenix/commit/7f014f8c29d378fbf5fe7ead8f018cf4bd262ebc))

## [3.16.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.16.0...arize-phoenix-v3.16.1) (2024-03-19)


### Bug Fixes

* **trace:** eliminate truth ambiguity with non-empty numpy arrays ([#2626](https://github.com/Arize-ai/phoenix/issues/2626)) ([be8ce7d](https://github.com/Arize-ai/phoenix/commit/be8ce7dee124340521e30510d826f3973c4d4d9a))


### Documentation

* Add projects tutorial ([#2611](https://github.com/Arize-ai/phoenix/issues/2611)) ([cca0a0e](https://github.com/Arize-ai/phoenix/commit/cca0a0e1da6f16906dc2f39f33fec4cbe997f18e))

## [3.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.15.1...arize-phoenix-v3.16.0) (2024-03-15)


### Features

* delete project ui ([#2593](https://github.com/Arize-ai/phoenix/issues/2593)) ([7708805](https://github.com/Arize-ai/phoenix/commit/770880567d299fc146bf343000e3cdb7e466cf99))

## [3.15.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.15.0...arize-phoenix-v3.15.1) (2024-03-15)


### Bug Fixes

* handle numpy types in json.dumps for gql ([#2600](https://github.com/Arize-ai/phoenix/issues/2600)) ([13cce4f](https://github.com/Arize-ai/phoenix/commit/13cce4fdc6de1902ce143d3cf2287acb0d6578d8))


### Documentation

* use projects with ragas ([#2569](https://github.com/Arize-ai/phoenix/issues/2569)) ([1e7b31d](https://github.com/Arize-ai/phoenix/commit/1e7b31d7a17d048956732cdb8f70102d74ec6c5b))

## [3.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.14.2...arize-phoenix-v3.15.0) (2024-03-14)


### Features

* launch_app() with experimental span storage using environment variables for storage path and storage type enums ([#2564](https://github.com/Arize-ai/phoenix/issues/2564)) ([8a0b572](https://github.com/Arize-ai/phoenix/commit/8a0b5729ea9a7b24d2ead37c212ae1a2839b128d))
* project archiving and deletion ([#2585](https://github.com/Arize-ai/phoenix/issues/2585)) ([121f904](https://github.com/Arize-ai/phoenix/commit/121f9047ce9fb1d9353f5275c9ae985db74fa1bf))


### Bug Fixes

* **projects:** the home page should direct you to the projects page if there are multiple projects with data ([#2586](https://github.com/Arize-ai/phoenix/issues/2586)) ([ced4e75](https://github.com/Arize-ai/phoenix/commit/ced4e753823e77919d10c3c88e8a2ee08eaf5d21))
* use environment variable for project name ([#2590](https://github.com/Arize-ai/phoenix/issues/2590)) ([e2ace76](https://github.com/Arize-ai/phoenix/commit/e2ace76c08ba5fe20c472934c051f1682d8d7d12))


### Documentation

* Improve projects-related API docstrings ([#2589](https://github.com/Arize-ai/phoenix/issues/2589)) ([9eebb00](https://github.com/Arize-ai/phoenix/commit/9eebb00ea63529ad9b12f2a4aad6716fe1088c05))

## [3.14.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.14.1...arize-phoenix-v3.14.2) (2024-03-14)


### Bug Fixes

* increase attributes limit on spans ([#2575](https://github.com/Arize-ai/phoenix/issues/2575)) ([94b1930](https://github.com/Arize-ai/phoenix/commit/94b1930f7655f0cea3e889adc4962a01c8acbcf6))
* support numpy arrays in span to json encoder ([#2583](https://github.com/Arize-ai/phoenix/issues/2583)) ([3a297d5](https://github.com/Arize-ai/phoenix/commit/3a297d535a769ee462b70f2a49428016bd2a3c8c))

## [3.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.14.0...arize-phoenix-v3.14.1) (2024-03-14)


### Bug Fixes

* sanitize base path ([#2573](https://github.com/Arize-ai/phoenix/issues/2573)) ([f2647a2](https://github.com/Arize-ai/phoenix/commit/f2647a2530babf4d91cf1d022f87df2584792baf))

## [3.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.13.1...arize-phoenix-v3.14.0) (2024-03-14)


### Features

* experimental span storage with append-only text files ([909672b](https://github.com/Arize-ai/phoenix/commit/909672b1f2fd5f10a2cda9833abf4e3eb02b02eb))
* experimental span storage with append-only text files ([#2553](https://github.com/Arize-ai/phoenix/issues/2553)) ([909672b](https://github.com/Arize-ai/phoenix/commit/909672b1f2fd5f10a2cda9833abf4e3eb02b02eb))


### Bug Fixes

* **sagemaker:** graphql base url was incorrect for sagemaker jupyterlab ([#2572](https://github.com/Arize-ai/phoenix/issues/2572)) ([7ecf46e](https://github.com/Arize-ai/phoenix/commit/7ecf46ee14a43010d3c9ff12eb84382633cd4b1d))

## [3.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v3.13.0...arize-phoenix-v3.13.1) (2024-03-13)


### Bug Fixes

* **ui:** scroll column selector when long ([#2552](https://github.com/Arize-ai/phoenix/issues/2552)) ([cbf8df8](https://github.com/Arize-ai/phoenix/commit/cbf8df842b496a53af554552c0b3622d8353c9fd))

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
