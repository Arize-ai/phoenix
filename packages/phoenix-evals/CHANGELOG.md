# Changelog

## [2.7.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.7.0...arize-phoenix-evals-v2.7.1) (2025-12-12)


### Bug Fixes

* **evals:** rate limiter fixes ([#10576](https://github.com/Arize-ai/phoenix/issues/10576)) ([5bbd5de](https://github.com/Arize-ai/phoenix/commit/5bbd5de427c8b33e0c48dab0f00e526f71561e43))

## [2.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.6.1...arize-phoenix-evals-v2.7.0) (2025-12-04)


### Features

* **evals:** support prompt/template messages ([#10356](https://github.com/Arize-ai/phoenix/issues/10356)) ([7d3dc7d](https://github.com/Arize-ai/phoenix/commit/7d3dc7d2846807053da63a8aa9cb776283deb370))

## [2.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.6.0...arize-phoenix-evals-v2.6.1) (2025-11-22)


### Bug Fixes

* handle None values for top_p and temperature in AnthropicModel ([#10361](https://github.com/Arize-ai/phoenix/issues/10361)) ([2ade906](https://github.com/Arize-ai/phoenix/commit/2ade9067080e3557472518472c76efbfd08b343f))

## [2.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.5.0...arize-phoenix-evals-v2.6.0) (2025-11-12)


### Features

* Add anthropic and google-genai adapters ([#9993](https://github.com/Arize-ai/phoenix/issues/9993)) ([724b2de](https://github.com/Arize-ai/phoenix/commit/724b2de51fea41f21890a3c8ad55ee78d4686c86))
* Add GPT-5 support to Azure OpenAI models ([#9829](https://github.com/Arize-ai/phoenix/issues/9829)) ([e4c664d](https://github.com/Arize-ai/phoenix/commit/e4c664d4c3f890338e1313a9da543d75869133fb))
* Support invocation params in ClassificationEvaluators ([#9831](https://github.com/Arize-ai/phoenix/issues/9831)) ([1530304](https://github.com/Arize-ai/phoenix/commit/15303046cd95a203f2863524c8770fbacb7e7de9))


### Bug Fixes

* **evals:** discourage positional arguments in favor of kwargs ([#9996](https://github.com/Arize-ai/phoenix/issues/9996)) ([efdc954](https://github.com/Arize-ai/phoenix/commit/efdc954f818915b5b59207cad1c9cb1fb17b7063))
* **evals:** miscellaneous fixes and ergonomic improvements ([#9879](https://github.com/Arize-ai/phoenix/issues/9879)) ([5546179](https://github.com/Arize-ai/phoenix/commit/5546179b230812d38770e011d541d3ac5107d652))


### Documentation

* merge main into docs ([#10087](https://github.com/Arize-ai/phoenix/issues/10087)) ([740aca0](https://github.com/Arize-ai/phoenix/commit/740aca004b28e31a5bde0735d26d2e5d8c78b276))
* sync main to docs ([65a68f4](https://github.com/Arize-ai/phoenix/commit/65a68f4c05635e76068b2c85b2929b4d13ca2668))

## [2.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.4.0...arize-phoenix-evals-v2.5.0) (2025-10-07)


### Features

* **evals:** add regex evaluator ([#9756](https://github.com/Arize-ai/phoenix/issues/9756)) ([d3ba324](https://github.com/Arize-ai/phoenix/commit/d3ba324a75a7863d54f028f2f1d92fc2d8b00966))
* Improve binding ergonomics ([#9612](https://github.com/Arize-ai/phoenix/issues/9612)) ([2989a91](https://github.com/Arize-ai/phoenix/commit/2989a914ef3249327a0f06592aa2cc226d2d367c))
* support more providers with LLM ([#9701](https://github.com/Arize-ai/phoenix/issues/9701)) ([b6bd07d](https://github.com/Arize-ai/phoenix/commit/b6bd07d295cb2553bf80030c5fd1f8bd15c46e82))


### Documentation

* **evals:** update classification evaluator doc string ([#9715](https://github.com/Arize-ai/phoenix/issues/9715)) ([cb71cfd](https://github.com/Arize-ai/phoenix/commit/cb71cfded1458d76ccfb7b6bae5348d016a11266))

## [2.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.3.0...arize-phoenix-evals-v2.4.0) (2025-10-02)


### Features

* Coroutine Fn support for `phoenix.evals.create_evaluator` ([#9746](https://github.com/Arize-ai/phoenix/issues/9746)) ([3f6a182](https://github.com/Arize-ai/phoenix/commit/3f6a1825f53e4deb73e285846495770e9bac0966))


### Documentation

* **evals:** add examples to evaluators module ([#9727](https://github.com/Arize-ai/phoenix/issues/9727)) ([f62468d](https://github.com/Arize-ai/phoenix/commit/f62468d9cddabcf3b96c0e4ced2da764aa211f85))
* **evals:** automatically document metrics, utils ([#9737](https://github.com/Arize-ai/phoenix/issues/9737)) ([e5d6ede](https://github.com/Arize-ai/phoenix/commit/e5d6ede2dfa34efe2a183228b79f25e498770925))

## [2.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.2.0...arize-phoenix-evals-v2.3.0) (2025-10-01)


### Features

* Allow dot delimited fstring keys in evals Templates ([#9725](https://github.com/Arize-ai/phoenix/issues/9725)) ([505ead8](https://github.com/Arize-ai/phoenix/commit/505ead838725ab447ef323d6549286d00d132b1e))


### Bug Fixes

* **evals:** try extracting key from eval_input directly before searching jsonpath ([#9721](https://github.com/Arize-ai/phoenix/issues/9721)) ([04f3da7](https://github.com/Arize-ai/phoenix/commit/04f3da7b6c9aa318924a4abd61256dc81ae2afa8))

## [2.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.1.0...arize-phoenix-evals-v2.2.0) (2025-09-27)


### Features

* **evals:** add document relevance evaluator ([#9661](https://github.com/Arize-ai/phoenix/issues/9661)) ([34b583f](https://github.com/Arize-ai/phoenix/commit/34b583f85128f35ff0d8c85ce13343b2b7e66c9c))
* **evals:** add utility to format dataframe evaluations as annotations for logging to Phoenix ([#9610](https://github.com/Arize-ai/phoenix/issues/9610)) ([58cce2b](https://github.com/Arize-ai/phoenix/commit/58cce2bbe838aace1995f32cb17cbcf26bbb08bd))

## [2.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.0.1...arize-phoenix-evals-v2.1.0) (2025-09-24)


### Features

* Add Azure provider support ([#9605](https://github.com/Arize-ai/phoenix/issues/9605)) ([edf448a](https://github.com/Arize-ai/phoenix/commit/edf448a14954a63ec0251cdf6b4f2e24b0b09bc2))


### Bug Fixes

* Remove openai sdk retries ([#9587](https://github.com/Arize-ai/phoenix/issues/9587)) ([08d78f9](https://github.com/Arize-ai/phoenix/commit/08d78f9d12d0e29c0a154b93ee99d18657c0fe13))
* Use OITracer ([#9588](https://github.com/Arize-ai/phoenix/issues/9588)) ([8bb7743](https://github.com/Arize-ai/phoenix/commit/8bb7743c8fbbe231d500d49109c04a56624328bf))

## [2.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v2.0.0...arize-phoenix-evals-v2.0.1) (2025-09-17)


### Documentation

* fix docs preview import paths ([#9538](https://github.com/Arize-ai/phoenix/issues/9538)) ([dc771e7](https://github.com/Arize-ai/phoenix/commit/dc771e72370de513eb0fb5ae7d32f2b6b4017735))

## [2.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.29.0...arize-phoenix-evals-v2.0.0) (2025-09-17)

## What is evals 2.0?

The new Phoenix evals library provides lightweight, composable building blocks for writing and running automatic evaluations.

- Works with your preferred model SDKs via adapters (OpenAI, LiteLLM, LangChain).
- Features powerful input mapping and binding for working with complex data structures.
- Includes several pre-built metrics for common evaluation tasks.
- Evaluators are instrumented for Open Telemetry tracing.
- Plus, tons of convenience features to improve the developer experience!

### Quickstart

```python
from phoenix.evals import create_classifier
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o")

evaluator = create_classifier(
    name="helpfulness",
    prompt_template="Rate the response to the user query as helpful or not:\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"helpful": 1.0, "not_helpful": 0.0},
)

# Simple evaluation
scores = evaluator.evaluate({"input": "How do I reset?", "output": "Go to settings > reset."})
scores[0].pretty_print()

# With input mapping for nested data
scores = evaluator.evaluate(
    {"data": {"query": "How do I reset?", "response": "Go to settings > reset."}},
    input_mapping={"input": "data.query", "output": "data.response"}
)
scores[0].pretty_print()
```

### ⚠ BREAKING CHANGES

- Move Evals 2.0 out of preview ([#9526](https://github.com/Arize-ai/phoenix/issues/9526))
- If using `LLMEvaluator` with `run_evals`, the import statement is now: `phoenix.evals.legacy import LLMEvaluator`
  - 2.0 introduces a new `LLMEvaluator` abstraction that's different from the previous version.

### Features

- **evals:** add rate limiting to llm methods ([#9271](https://github.com/Arize-ai/phoenix/issues/9271)) ([67ca56b](https://github.com/Arize-ai/phoenix/commit/67ca56b3293812cbf4ec96e9c2a57afd516ae73c))
- **evals:** async version of evaluate dataframe ([#9315](https://github.com/Arize-ai/phoenix/issues/9315)) ([da6d88f](https://github.com/Arize-ai/phoenix/commit/da6d88f70907223257aeb08c903afc44f6c3b765))
- Experiments&lt;-&gt;Evals 2.0 compatibility ([#9442](https://github.com/Arize-ai/phoenix/issues/9442)) ([90e4dbc](https://github.com/Arize-ai/phoenix/commit/90e4dbc08e63ee707f3ab7e42dc5146ad6054e82))
- Move Evals 2.0 out of preview ([#9526](https://github.com/Arize-ai/phoenix/issues/9526)) ([c644766](https://github.com/Arize-ai/phoenix/commit/c644766a7eea3784e155c1df2ffd7403efecb514))

### Bug Fixes

- add Gemini 2.0 Flash support ([#9440](https://github.com/Arize-ai/phoenix/issues/9440)) ([3521599](https://github.com/Arize-ai/phoenix/commit/35215995b681e021b94b670e4177f730c705d983))
- **evals:** unify sync and async llm ([#9287](https://github.com/Arize-ai/phoenix/issues/9287)) ([21b8dfe](https://github.com/Arize-ai/phoenix/commit/21b8dfee05c71ce9b614aca8def32ffda821862b))

### Documentation

- add docs links to all readmes ([#9322](https://github.com/Arize-ai/phoenix/issues/9322)) ([b0b671b](https://github.com/Arize-ai/phoenix/commit/b0b671bbabf05279ea7254e2b92972725a7a86b6))
- **client:** fix python client docs ([#9317](https://github.com/Arize-ai/phoenix/issues/9317)) ([d94835a](https://github.com/Arize-ai/phoenix/commit/d94835aad129216fdb7d480a70aa2a501e615a8e))
- consistent docstrings ([#9324](https://github.com/Arize-ai/phoenix/issues/9324)) ([00dcea9](https://github.com/Arize-ai/phoenix/commit/00dcea97aac7a8165395bfaefe52f771feadca2d))
- **evals:** update autodocs for preview evals ([#9426](https://github.com/Arize-ai/phoenix/issues/9426)) ([756c1b6](https://github.com/Arize-ai/phoenix/commit/756c1b64b9552af723d853f1e5e6c98d2996cab1))

## [0.29.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.28.1...arize-phoenix-evals-v0.29.0) (2025-08-26)

### Features

- Add evals 2.0 tracing ([#9163](https://github.com/Arize-ai/phoenix/issues/9163)) ([aee7edf](https://github.com/Arize-ai/phoenix/commit/aee7edf7fdf8fb37a243166589fdb92615067bad))
- **evals:** add evaluate_dataframe function ([#9197](https://github.com/Arize-ai/phoenix/issues/9197)) ([47c562c](https://github.com/Arize-ai/phoenix/commit/47c562c5b434828152bc5199ca7a3a913e0f36c6))

### Bug Fixes

- **evals:** switch from glom to jsonpath-ng for input mapping ([#9199](https://github.com/Arize-ai/phoenix/issues/9199)) ([5daaada](https://github.com/Arize-ai/phoenix/commit/5daaadac605269d96a17fb5cce68b773619e6abc))

### Documentation

- **evals:** docs for evals preview module ([#9159](https://github.com/Arize-ai/phoenix/issues/9159)) ([8f38e06](https://github.com/Arize-ai/phoenix/commit/8f38e066edc8659478a40a4b3d99db8b555b8f06))

## [0.28.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.28.0...arize-phoenix-evals-v0.28.1) (2025-08-20)

### Bug Fixes

- **evals:** make evaluator input schema more explicit and discoverable ([#9109](https://github.com/Arize-ai/phoenix/issues/9109)) ([b5c7170](https://github.com/Arize-ai/phoenix/commit/b5c71702a1e634c8ac6df130f2b5ea0355e9e7e2))
- **evals:** update `create_evaluator` decorator handle casting function outputs to valid Scores ([#9143](https://github.com/Arize-ai/phoenix/issues/9143)) ([b51b677](https://github.com/Arize-ai/phoenix/commit/b51b677c90e6379f427db3120604113b2813f4b8))

## [0.28.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.27.0...arize-phoenix-evals-v0.28.0) (2025-08-19)

### Features

- Dynamic concurrency ([#8992](https://github.com/Arize-ai/phoenix/issues/8992)) ([3e48611](https://github.com/Arize-ai/phoenix/commit/3e48611896011e820c628b73f592aaa2f5c53889))

### Bug Fixes

- [evals] drop batch evaluation methods ([#9052](https://github.com/Arize-ai/phoenix/issues/9052)) ([38df753](https://github.com/Arize-ai/phoenix/commit/38df753a1916ca970c6288cd81e00efa25beb2e1))
- [evals] raise exceptions as-is ([#9066](https://github.com/Arize-ai/phoenix/issues/9066)) ([f8703b5](https://github.com/Arize-ai/phoenix/commit/f8703b511b41feb47eb1f43b08a06d0b8158286e))

## [0.27.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.26.1...arize-phoenix-evals-v0.27.0) (2025-08-13)

### Features

- [evals] add precision recall fscore metric ([#9000](https://github.com/Arize-ai/phoenix/issues/9000)) ([7aeec60](https://github.com/Arize-ai/phoenix/commit/7aeec60d6a9e91a88e56b9d803b49a99fe922ebe))
- new evaluator and score abstractions ([#8842](https://github.com/Arize-ai/phoenix/issues/8842)) ([f56b9cf](https://github.com/Arize-ai/phoenix/commit/f56b9cf92f7853575d0892aaea165a36dcf6c7a3))

### Bug Fixes

- [evals] rename and update evaluator decorator ([#9044](https://github.com/Arize-ai/phoenix/issues/9044)) ([bb3500b](https://github.com/Arize-ai/phoenix/commit/bb3500b657e13741d23badb3a74ad262fc64f8de))
- Pass default headers to non-azure OpenAI clients ([#9001](https://github.com/Arize-ai/phoenix/issues/9001)) ([baf54a0](https://github.com/Arize-ai/phoenix/commit/baf54a040a1a6cbc258d960f18b3fe4efdf53413))
- Properly return objects from Anthropic adapter ([#8977](https://github.com/Arize-ai/phoenix/issues/8977)) ([e9a2e11](https://github.com/Arize-ai/phoenix/commit/e9a2e11719de53ff1f54879f38463746a6813de8))
- Support o4 in Azure ([#9059](https://github.com/Arize-ai/phoenix/issues/9059)) ([9bec39f](https://github.com/Arize-ai/phoenix/commit/9bec39fc2e184b0778e1fb59d84077b2f6cdbe0a))

## [0.26.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.26.0...arize-phoenix-evals-v0.26.1) (2025-08-01)

### Bug Fixes

- revert function return types to `str` for `_generate` and `_async_generate` ([#8901](https://github.com/Arize-ai/phoenix/issues/8901)) ([91550dc](https://github.com/Arize-ai/phoenix/commit/91550dc8039cf3d1087e63ef763cdee6f95a75f2))

## [0.26.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.25.0...arize-phoenix-evals-v0.26.0) (2025-08-01)

### Features

- Enable specifying object generation method ([#8884](https://github.com/Arize-ai/phoenix/issues/8884)) ([c73e1a6](https://github.com/Arize-ai/phoenix/commit/c73e1a6752b88e73f030cff3b23df42b958b425f))
- **evals:** return token usage in `llm_classify` ([#8692](https://github.com/Arize-ai/phoenix/issues/8692)) ([aa71d81](https://github.com/Arize-ai/phoenix/commit/aa71d8164124c88028d1c18b217d3ec899e5b4f9))
- Improved evals templating ([#8799](https://github.com/Arize-ai/phoenix/issues/8799)) ([b32717c](https://github.com/Arize-ai/phoenix/commit/b32717c94971d43124253e21ba10f366bc8228fa))

### Bug Fixes

- Add emoji guard to experimental module warning ([#8887](https://github.com/Arize-ai/phoenix/issues/8887)) ([0c63de7](https://github.com/Arize-ai/phoenix/commit/0c63de70b2891a09b6fa5ad74704e21ff96c70a4))
- **evals:** add priority for LLM client selection ([#8868](https://github.com/Arize-ai/phoenix/issues/8868)) ([06bda51](https://github.com/Arize-ai/phoenix/commit/06bda51affb5a2e034e3c6473565a13f3fee4ada))
- Windows has problems rendering emojis sometimes ([#8880](https://github.com/Arize-ai/phoenix/issues/8880)) ([c592e5c](https://github.com/Arize-ai/phoenix/commit/c592e5c766e9ac457cab5d84846e44413f611794))

### Documentation

- Update docs for GoogleGenAI support ([#8858](https://github.com/Arize-ai/phoenix/issues/8858)) ([a8bef55](https://github.com/Arize-ai/phoenix/commit/a8bef55b65a92b0d325e54c715f342728e63aa7b))

## [0.25.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.24.0...arize-phoenix-evals-v0.25.0) (2025-07-30)

### Features

- generate classification primitive ([#8816](https://github.com/Arize-ai/phoenix/issues/8816)) ([88d5090](https://github.com/Arize-ai/phoenix/commit/88d5090d33fbe384c08cf305ab75863520e7fa03))

### Bug Fixes

- remove dependency on requests library ([#8854](https://github.com/Arize-ai/phoenix/issues/8854)) ([ad9f311](https://github.com/Arize-ai/phoenix/commit/ad9f311aee3997c8caa8e505cc84faa1e8fb7428))

## [0.24.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.23.1...arize-phoenix-evals-v0.24.0) (2025-07-30)

### Features

- **evals:** adding support for google-genai SDK ([#8798](https://github.com/Arize-ai/phoenix/issues/8798)) ([08ad038](https://github.com/Arize-ai/phoenix/commit/08ad0384d0d53d6068234b8a2d0a9fd4859b020e))
- LLM wrapper prototype ([#8729](https://github.com/Arize-ai/phoenix/issues/8729)) ([1b25009](https://github.com/Arize-ai/phoenix/commit/1b25009683dd52803162786466a34e0b897c6fc0))

## [0.23.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.23.0...arize-phoenix-evals-v0.23.1) (2025-07-21)

### Bug Fixes

- get response from tool calls function argument ([#8706](https://github.com/Arize-ai/phoenix/issues/8706)) ([0db40ca](https://github.com/Arize-ai/phoenix/commit/0db40cadc5f7bcc015aa13dfa7c2a2a46c41c02f))

## [0.23.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.22.0...arize-phoenix-evals-v0.23.0) (2025-07-16)

### Features

- prompt variables skip parse ([#8587](https://github.com/Arize-ai/phoenix/issues/8587)) ([a031c3c](https://github.com/Arize-ai/phoenix/commit/a031c3cedad3203b29ca4b9ef23ca89a40444ff8))

## [0.22.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.21.1...arize-phoenix-evals-v0.22.0) (2025-07-02)

### Features

- allow additional keyword arguments for vertex GenerativeModel instantiation ([#8387](https://github.com/Arize-ai/phoenix/issues/8387)) ([a09a6ce](https://github.com/Arize-ai/phoenix/commit/a09a6ce88806dfbe606d1bd971a1b9180de6690a))

## [0.21.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.21.0...arize-phoenix-evals-v0.21.1) (2025-07-02)

### Documentation

- Adding templates for agent tool selection and parameter extraction ([#8353](https://github.com/Arize-ai/phoenix/issues/8353)) ([e4a2e73](https://github.com/Arize-ai/phoenix/commit/e4a2e732e670aad64dc4256767e198c024593266))

## [0.21.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.8...arize-phoenix-evals-v0.21.0) (2025-06-21)

### Features

- **auth:** logout ([#7985](https://github.com/Arize-ai/phoenix/issues/7985)) ([63128c5](https://github.com/Arize-ai/phoenix/commit/63128c5328222147fe5c5103d8dd3576d5534bc2))
- separate docs phoenix client evals ([#7948](https://github.com/Arize-ai/phoenix/issues/7948)) ([e569b68](https://github.com/Arize-ai/phoenix/commit/e569b6802ab9e31cb230a30dbc08f60d7e28e993))

### Documentation

- Readthedocs improvements on naming and structure ([#8009](https://github.com/Arize-ai/phoenix/issues/8009)) ([76a4b92](https://github.com/Arize-ai/phoenix/commit/76a4b9282ff8476757ee1c0b3c85a7767208795b))
- updates phoenix-evals README ([#8029](https://github.com/Arize-ai/phoenix/issues/8029)) ([3261555](https://github.com/Arize-ai/phoenix/commit/326155513813f05b617f27f674fdb34151c5735b))

## [0.20.8](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.7...arize-phoenix-evals-v0.20.8) (2025-06-04)

### Bug Fixes

- **evals:** add support for out of order evals ([#7849](https://github.com/Arize-ai/phoenix/issues/7849)) ([63c012d](https://github.com/Arize-ai/phoenix/commit/63c012d49bf318190cd3170e664d50dbb8179e8a))

## [0.20.7](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.6...arize-phoenix-evals-v0.20.7) (2025-05-28)

### Bug Fixes

- Stabilize label extraction ([#7499](https://github.com/Arize-ai/phoenix/issues/7499)) ([830247e](https://github.com/Arize-ai/phoenix/commit/830247ef97bca6f4bcbeb6fc2f9ac663c1e19344))

## [0.20.6](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.5...arize-phoenix-evals-v0.20.6) (2025-04-17)

### Bug Fixes

- azure max tokens update ([#7144](https://github.com/Arize-ai/phoenix/issues/7144)) ([ce72e76](https://github.com/Arize-ai/phoenix/commit/ce72e76242fef34dbe7eaa4544da7c12a37138cd))

## [0.20.5](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.4...arize-phoenix-evals-v0.20.5) (2025-04-16)

### Bug Fixes

- Formatting of additionalModelRequestFields based on model ([#6943](https://github.com/Arize-ai/phoenix/issues/6943)) ([aec9541](https://github.com/Arize-ai/phoenix/commit/aec9541524e5aa1e91ea7c3bf96d8960f202ba35))

## [0.20.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.3...arize-phoenix-evals-v0.20.4) (2025-03-24)

### Bug Fixes

- Migrate from Bedrock invoke_model API to converse API ([#6503](https://github.com/Arize-ai/phoenix/issues/6503)) ([a393dc9](https://github.com/Arize-ai/phoenix/commit/a393dc9ce864cfb2ce06296e70f39459b195053a))

### Documentation

- fix image (GITBOOK-1022) ([171c65e](https://github.com/Arize-ai/phoenix/commit/171c65e95053aece8ed182cfd1547cb2cf4df0f7))
- Fixing community link (GITBOOK-1026) ([432ed92](https://github.com/Arize-ai/phoenix/commit/432ed9297533edbef73c8c58ae4af098d5ff94b1))
- No subject (GITBOOK-1020) ([6c0ef74](https://github.com/Arize-ai/phoenix/commit/6c0ef74930c7ee0baa38659e21524b25b5b5fd71))
- No subject (GITBOOK-1038) ([812ea2c](https://github.com/Arize-ai/phoenix/commit/812ea2caaee1889741bb893995fb89b4653430d7))
- No subject (GITBOOK-1040) ([1d31ae8](https://github.com/Arize-ai/phoenix/commit/1d31ae8de6c924f9ecd0d3c77f77fef033320c86))
- No subject (GITBOOK-1045) ([0aa0301](https://github.com/Arize-ai/phoenix/commit/0aa03011bda53faad35267facc73047e4be35142))
- No subject (GITBOOK-1087) ([6fa5fd7](https://github.com/Arize-ai/phoenix/commit/6fa5fd71cdf57a9a5a7efc3e2822ad57497f3b5a))
- No subject (GITBOOK-1090) ([024c49f](https://github.com/Arize-ai/phoenix/commit/024c49fe57487ee816317f798ec648331a866ae4))
- No subject (GITBOOK-1099) ([b4357e3](https://github.com/Arize-ai/phoenix/commit/b4357e324a9444704fbf85370c193ef2ee59495f))
- Wording updates (GITBOOK-1030) ([9e9142b](https://github.com/Arize-ai/phoenix/commit/9e9142be0cbc6d5cc08cc373ce1c14eee0479b00))

## [0.20.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.2...arize-phoenix-evals-v0.20.3) (2025-02-13)

### Bug Fixes

- o1-preview does not support developer role ([#6370](https://github.com/Arize-ai/phoenix/issues/6370)) ([9ea8651](https://github.com/Arize-ai/phoenix/commit/9ea8651b7734898a8b3050b335a759657ea18712))

## [0.20.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.1...arize-phoenix-evals-v0.20.2) (2025-02-06)

### Bug Fixes

- Use max completion tokens and tool calling check ([#6287](https://github.com/Arize-ai/phoenix/issues/6287)) ([e5e5294](https://github.com/Arize-ai/phoenix/commit/e5e5294b2b2b2f725ee673520a71cdca0457936d))

## [0.20.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.20.0...arize-phoenix-evals-v0.20.1) (2025-02-06)

### Bug Fixes

- Update parameter filtering logic ([#6285](https://github.com/Arize-ai/phoenix/issues/6285)) ([0f552e6](https://github.com/Arize-ai/phoenix/commit/0f552e6aec08f918408d82a248788e21bac8803d))

## [0.20.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.19.0...arize-phoenix-evals-v0.20.0) (2025-02-05)

### Features

- Enable overriding executor timeouts per model ([#6206](https://github.com/Arize-ai/phoenix/issues/6206)) ([23fb2b0](https://github.com/Arize-ai/phoenix/commit/23fb2b03e2aa8cf3f0940b857cd2ca3f7dfd71b7))
- Support OpenAI reasoning models that don't use the "system" role ([#6239](https://github.com/Arize-ai/phoenix/issues/6239)) ([84f9d8e](https://github.com/Arize-ai/phoenix/commit/84f9d8e96846a496aafa1c360932268cba935d3c))

### Bug Fixes

- local variable 'prompt_message' referenced before assignment ([#6102](https://github.com/Arize-ai/phoenix/issues/6102)) ([10b1535](https://github.com/Arize-ai/phoenix/commit/10b1535dc7c9c5016d2b7c30574fa7e771601992))

## [0.19.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.18.1...arize-phoenix-evals-v0.19.0) (2025-01-16)

### Features

- Audio evals & data processor for llm_classify() ([#5616](https://github.com/Arize-ai/phoenix/issues/5616)) ([0eda8ce](https://github.com/Arize-ai/phoenix/commit/0eda8ce9d1443d679734fe76cd6481f9a352e59b))

## [0.18.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.18.0...arize-phoenix-evals-v0.18.1) (2025-01-07)

### Bug Fixes

- Allow ClassificationTemplate w/o explanation template ([#5877](https://github.com/Arize-ai/phoenix/issues/5877)) ([d2df7ad](https://github.com/Arize-ai/phoenix/commit/d2df7ad8792df3d0637c003ba367dc483f6ad40d))

## [0.18.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.5...arize-phoenix-evals-v0.18.0) (2024-12-20)

### Features

- Enable `phoenix.evals` to handle multimodal message templates ([#5522](https://github.com/Arize-ai/phoenix/issues/5522)) ([41a4fc2](https://github.com/Arize-ai/phoenix/commit/41a4fc2ef98b8a06747e5cdd07f07d9bbe5662c3))

### Bug Fixes

- spelling errors in prompt templates ([#5571](https://github.com/Arize-ai/phoenix/issues/5571)) ([9646c8e](https://github.com/Arize-ai/phoenix/commit/9646c8ebc7ba81043f4e1a678977a8c6a0fa50c1))

### Documentation

- update sessions (GITBOOK-940) ([88dc135](https://github.com/Arize-ai/phoenix/commit/88dc135f99b03697387df0140533a0808454a88e))

## [0.17.5](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.4...arize-phoenix-evals-v0.17.5) (2024-11-19)

### Bug Fixes

- Allow dot key values in templates ([#5436](https://github.com/Arize-ai/phoenix/issues/5436)) ([8181094](https://github.com/Arize-ai/phoenix/commit/8181094ebd66e01f01a00ebe97473a965f7274e8))

## [0.17.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.3...arize-phoenix-evals-v0.17.4) (2024-11-12)

### Bug Fixes

- **evals:** increase default max tokens ([#5339](https://github.com/Arize-ai/phoenix/issues/5339)) ([b4af61e](https://github.com/Arize-ai/phoenix/commit/b4af61ee544c929fb01ac97724c1c657f0a46715))

## [0.17.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.2...arize-phoenix-evals-v0.17.3) (2024-11-06)

### Bug Fixes

- **evals:** only allow keyword arguments for model instantiation ([#5287](https://github.com/Arize-ai/phoenix/issues/5287)) ([aa95902](https://github.com/Arize-ai/phoenix/commit/aa95902e82b9207d6108e2a19b8531a817273e06))

## [0.17.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.1...arize-phoenix-evals-v0.17.2) (2024-10-18)

### Bug Fixes

- allow progress bar to be disabled ([#5064](https://github.com/Arize-ai/phoenix/issues/5064)) ([07d9856](https://github.com/Arize-ai/phoenix/commit/07d985672de77ed5f90a8195cbac24554c951ac4))

## [0.17.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.17.0...arize-phoenix-evals-v0.17.1) (2024-10-17)

### Bug Fixes

- increase python upper bound to include python 3.13 for `arize-phoenix-evals` and `arize-phoenix-otel` ([#5077](https://github.com/Arize-ai/phoenix/issues/5077)) ([ef5c893](https://github.com/Arize-ai/phoenix/commit/ef5c893ef7bc81690662a7687ed190f5b6dca701))

## [0.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.16.1...arize-phoenix-evals-v0.17.0) (2024-10-09)

### Features

- Always prompt as system for OpenAI Models ([#4937](https://github.com/Arize-ai/phoenix/issues/4937)) ([5f28ef2](https://github.com/Arize-ai/phoenix/commit/5f28ef244db2c4dd59fad6c6d6f1b63ff235817b))

## [0.16.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.16.0...arize-phoenix-evals-v0.16.1) (2024-09-27)

### Bug Fixes

- Use python string formatting for standard template delimiters ([#4781](https://github.com/Arize-ai/phoenix/issues/4781)) ([26b422f](https://github.com/Arize-ai/phoenix/commit/26b422f70dd5e7b295f79a30a82dab1cc1ed9173))

## [0.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.15.1...arize-phoenix-evals-v0.16.0) (2024-09-17)

### Features

- OpenAI support for o1 preview ([#4633](https://github.com/Arize-ai/phoenix/issues/4633)) ([1ad7b79](https://github.com/Arize-ai/phoenix/commit/1ad7b79d95bd362ca15f34f2cebe7e1332a19846))

### Bug Fixes

- Ensure correct dataloader results ordering ([#4524](https://github.com/Arize-ai/phoenix/issues/4524)) ([f9239d6](https://github.com/Arize-ai/phoenix/commit/f9239d63af9d06c04430f9dca808caf08d152d3d))

## [0.15.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.15.0...arize-phoenix-evals-v0.15.1) (2024-08-27)

### Bug Fixes

- support pydantic in the range 2.4.1&lt;=pydantic<=2.7.1 ([#4323](https://github.com/Arize-ai/phoenix/issues/4323)) ([fa5eeff](https://github.com/Arize-ai/phoenix/commit/fa5eeff45b0752508d4bc51334607ef4acc19474))

## [0.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.14.1...arize-phoenix-evals-v0.15.0) (2024-08-15)

### Features

- Expose configuration for initial rate limit ([#4087](https://github.com/Arize-ai/phoenix/issues/4087)) ([194a66d](https://github.com/Arize-ai/phoenix/commit/194a66d6315ffd93275e1a8e19560a435701ddc8))

### Bug Fixes

- use dataloader for span annotations ([#4139](https://github.com/Arize-ai/phoenix/issues/4139)) ([2456ad4](https://github.com/Arize-ai/phoenix/commit/2456ad47c6cb73901152bec5b4bfed8c77c96933))

### Documentation

- api ref updates and docstring fixes ([e089f99](https://github.com/Arize-ai/phoenix/commit/e089f99fa2e63cdf9cb342bc3810361947c28e61))
- Fix docstring ([#3969](https://github.com/Arize-ai/phoenix/issues/3969)) ([f6a5b62](https://github.com/Arize-ai/phoenix/commit/f6a5b62a1f53ba34d22c678e7bbb314693641993))
- Update LiteLLM and OpenAI docstrings ([#3910](https://github.com/Arize-ai/phoenix/issues/3910)) ([be57127](https://github.com/Arize-ai/phoenix/commit/be5712761a1eb59c73ca38bc207f9e6078bf60f6))

## [0.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.14.0...arize-phoenix-evals-v0.14.1) (2024-07-16)

### Bug Fixes

- Run Bedrock calls in executor for async ([#3884](https://github.com/Arize-ai/phoenix/issues/3884)) ([46e3b1c](https://github.com/Arize-ai/phoenix/commit/46e3b1c7c705e6fd6df7cdcc10f1ec0f14efb03c))

## [0.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.2...arize-phoenix-evals-v0.14.0) (2024-07-12)

### Features

- Add function call evaluator template to span_templates.py & tutorial notebook

### Bug Fixes

- ensure experiment errors messages work on python 3.8 and 3.9 ([#3840](https://github.com/Arize-ai/phoenix/issues/3840)) ([25a7fb9](https://github.com/Arize-ai/phoenix/commit/25a7fb93fe7512a0ac2da9a59915c9e145c58ae2))

### Documentation

- Update model wrapper docstrings ([#3834](https://github.com/Arize-ai/phoenix/issues/3834)) ([531360b](https://github.com/Arize-ai/phoenix/commit/531360b4f1a7180c892504ffbc567d78503283f2))

## [0.13.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.1...arize-phoenix-evals-v0.13.2) (2024-07-03)

### Bug Fixes

- allow invocations of OpenAIModel without api key ([#3820](https://github.com/Arize-ai/phoenix/issues/3820)) ([4dd8c0e](https://github.com/Arize-ai/phoenix/commit/4dd8c0e15308971fe42c5fd11f04f80b18c55746))

## [0.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.13.0...arize-phoenix-evals-v0.13.1) (2024-06-30)

### Bug Fixes

- llm_classify from warning message ([#3752](https://github.com/Arize-ai/phoenix/issues/3752)) ([717a0c7](https://github.com/Arize-ai/phoenix/commit/717a0c786b1aa78000d6bc3e47f369bbba7662a3))

## [0.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.12.0...arize-phoenix-evals-v0.13.0) (2024-06-26)

### Features

- added SQLEvaluator ([#3577](https://github.com/Arize-ai/phoenix/issues/3577)) ([0a79535](https://github.com/Arize-ai/phoenix/commit/0a79535f20426072c8ffa60960b605a8dbb95a18))

### Bug Fixes

- add support for querying datetimes ([#3439](https://github.com/Arize-ai/phoenix/issues/3439)) ([90fd619](https://github.com/Arize-ai/phoenix/commit/90fd61927d11a0eaf151ca41b81f149b9fc8214f))
- resolves the authentication issue for GeminiModel in evals model ([#3662](https://github.com/Arize-ai/phoenix/issues/3662)) ([b79d946](https://github.com/Arize-ai/phoenix/commit/b79d946cebd7447bcda7edbdf23603a2ceef5f03))

## [0.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.11.0...arize-phoenix-evals-v0.12.0) (2024-06-06)

### Features

- add span-level templates for evaluation hallucinations and qa correctness ([#3380](https://github.com/Arize-ai/phoenix/issues/3380)) ([1689b49](https://github.com/Arize-ai/phoenix/commit/1689b49cfa3ea99d39bd98873580e5253101a0c7))
- Adds timing info to llm_classify ([#3377](https://github.com/Arize-ai/phoenix/issues/3377)) ([3e2785f](https://github.com/Arize-ai/phoenix/commit/3e2785f7d53dd628e7027fe988ae066fa1be0da1))

## [0.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.10.0...arize-phoenix-evals-v0.11.0) (2024-05-31)

### Features

- Allow skipping on template mapping errors, returning debug info ([#3350](https://github.com/Arize-ai/phoenix/issues/3350)) ([dc18123](https://github.com/Arize-ai/phoenix/commit/dc1812379c33fbb89537c6aed6361f808f29ec73))
- Serializable execution details ([#3358](https://github.com/Arize-ai/phoenix/issues/3358)) ([fc74513](https://github.com/Arize-ai/phoenix/commit/fc7451372c9b938a27c7b36f7e32704f7b3a8e87))

## [0.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.2...arize-phoenix-evals-v0.10.0) (2024-05-29)

### Features

- docker image runs as root by default with tags for nonroot and debug images ([#3280](https://github.com/Arize-ai/phoenix/issues/3280)) ([41a4826](https://github.com/Arize-ai/phoenix/commit/41a4826733e104a3ec533a73049df5b778391e7f))
- Support mistral ([#3270](https://github.com/Arize-ai/phoenix/issues/3270)) ([4e38531](https://github.com/Arize-ai/phoenix/commit/4e3853159881fa936d04beff5feb971df72ad038))

## [0.9.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.1...arize-phoenix-evals-v0.9.2) (2024-05-21)

### Bug Fixes

- Bypass signal handler if running in a thread ([#3251](https://github.com/Arize-ai/phoenix/issues/3251)) ([8c82306](https://github.com/Arize-ai/phoenix/commit/8c8230606d173a55a2f84b2fbdbb48e920cbdb70))

## [0.9.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.9.0...arize-phoenix-evals-v0.9.1) (2024-05-21)

### Bug Fixes

- clarify error message for missing azure api-key ([#3256](https://github.com/Arize-ai/phoenix/issues/3256)) ([58a1398](https://github.com/Arize-ai/phoenix/commit/58a1398b4f1fcc64af7fdb06463f9a0fc0f53b76))

## [0.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.2...arize-phoenix-evals-v0.9.0) (2024-05-17)

### Features

- Added support for default_headers for azure_openai. ([#3211](https://github.com/Arize-ai/phoenix/issues/3211)) ([2d48192](https://github.com/Arize-ai/phoenix/commit/2d48192d57a1b97e4b08efc30f5c689423667c93))

## [0.8.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.1...arize-phoenix-evals-v0.8.2) (2024-05-14)

### Bug Fixes

- evaluators no longer have incorrect type hints ([#3195](https://github.com/Arize-ai/phoenix/issues/3195)) ([7d57e2e](https://github.com/Arize-ai/phoenix/commit/7d57e2e760a98095c57b45b3e39e2d009972faaf))

## [0.8.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.8.0...arize-phoenix-evals-v0.8.1) (2024-05-03)

### Bug Fixes

- **evals:** incorrect wording in hallucinations ([#3085](https://github.com/Arize-ai/phoenix/issues/3085)) ([7aa0292](https://github.com/Arize-ai/phoenix/commit/7aa029239c2c36b677070e270f7127f6bf6cff5e))

## [0.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.7.0...arize-phoenix-evals-v0.8.0) (2024-04-22)

### Features

- Add user frustration eval ([#2928](https://github.com/Arize-ai/phoenix/issues/2928)) ([406938b](https://github.com/Arize-ai/phoenix/commit/406938b1f19ee6efb7cec630772d9d8940c0953f))

## [0.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.6.1...arize-phoenix-evals-v0.7.0) (2024-04-12)

### Features

- Add SQL and Code Functionality Eval Templates ([#2861](https://github.com/Arize-ai/phoenix/issues/2861)) ([c7d776a](https://github.com/Arize-ai/phoenix/commit/c7d776a23e1843cc1bb5c74059496615700a3396))

## [0.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.6.0...arize-phoenix-evals-v0.6.1) (2024-04-04)

### Bug Fixes

- switch license format in toml ([5c6f345](https://github.com/Arize-ai/phoenix/commit/5c6f345691dcab3d460823329ce31b9060bab02c))

## [0.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.5.0...arize-phoenix-evals-v0.6.0) (2024-03-29)

### Features

- update bedrock.py to use messages API for claude ([#2636](https://github.com/Arize-ai/phoenix/issues/2636)) ([3d7d91a](https://github.com/Arize-ai/phoenix/commit/3d7d91ac6f399ceb40771461cd1fc7bfe60ff04f))

## [0.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.4.0...arize-phoenix-evals-v0.5.0) (2024-03-20)

### Features

- Add `response_format` argument to `MistralAIModel` ([#2660](https://github.com/Arize-ai/phoenix/issues/2660)) ([7da51af](https://github.com/Arize-ai/phoenix/commit/7da51afc77984925cd59d7d909142141530684cc))

## [0.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.3.1...arize-phoenix-evals-v0.4.0) (2024-03-20)

### Features

- **evals:** Add Mistral as an eval model ([#2640](https://github.com/Arize-ai/phoenix/issues/2640)) ([c13ab6b](https://github.com/Arize-ai/phoenix/commit/c13ab6bf644ec285c37e92cc6a7b114a309cec52))

## [0.3.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.3.0...arize-phoenix-evals-v0.3.1) (2024-03-15)

### Bug Fixes

- pass verbose to evaluators ([#2597](https://github.com/Arize-ai/phoenix/issues/2597)) ([9467e1d](https://github.com/Arize-ai/phoenix/commit/9467e1deabe58c0079ad8bdb9dfc972ee2ae5c0b))

## [0.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.2.0...arize-phoenix-evals-v0.3.0) (2024-03-13)

### Features

- add phoenix-evals support for python 3.12 ([#2554](https://github.com/Arize-ai/phoenix/issues/2554)) ([efb6a76](https://github.com/Arize-ai/phoenix/commit/efb6a764a2aaecfff271b2cd7b7569771989a6a1))

## [0.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.1.0...arize-phoenix-evals-v0.2.0) (2024-03-07)

### Features

- Update `AnthropicModel` to use `messages` API ([#2489](https://github.com/Arize-ai/phoenix/issues/2489)) ([5aa3842](https://github.com/Arize-ai/phoenix/commit/5aa3842d3e3d8a1fe21fb62c594032474899fb81))

### Bug Fixes

- `llm_generate` now preserves input index when constructing the output ([#2441](https://github.com/Arize-ai/phoenix/issues/2441)) ([ee36987](https://github.com/Arize-ai/phoenix/commit/ee369874649ac36fadcce3322cf87cf22d04aed4))

## [0.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.5...arize-phoenix-evals-v0.1.0) (2024-03-05)

### Features

- Removes token processing module from `phoenix.evals` ([#2421](https://github.com/Arize-ai/phoenix/issues/2421)) ([fbd4961](https://github.com/Arize-ai/phoenix/commit/fbd496163d6cf46b3299da4ac7962b19da054bd8))

### Bug Fixes

- Properly define `BedrockModel` ([#2425](https://github.com/Arize-ai/phoenix/issues/2425)) ([81a720c](https://github.com/Arize-ai/phoenix/commit/81a720c8264f80fc37fcfe76c1c982014e9f12b3))
- source distribution build ([#2407](https://github.com/Arize-ai/phoenix/issues/2407)) ([1e67d7e](https://github.com/Arize-ai/phoenix/commit/1e67d7e4eb037f85b1e33e59b42014fe3daa876d))

## [0.0.5](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.4...arize-phoenix-evals-v0.0.5) (2024-02-24)

### Bug Fixes

- **evals:** reference link template export ([#2393](https://github.com/Arize-ai/phoenix/issues/2393)) ([d9e21b7](https://github.com/Arize-ai/phoenix/commit/d9e21b7cb6f4c9cc9c863623696f3987f96dd174))

## [0.0.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.3...arize-phoenix-evals-v0.0.4) (2024-02-24)

### Bug Fixes

- export reference link templates ([#2390](https://github.com/Arize-ai/phoenix/issues/2390)) ([d5e4121](https://github.com/Arize-ai/phoenix/commit/d5e41213e897bfb64e121a72b85c614b29e1358c))

## [0.0.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-evals-v0.0.2...arize-phoenix-evals-v0.0.3) (2024-02-23)

### Bug Fixes

- remove run_relevance_evals and fix import issues ([#2375](https://github.com/Arize-ai/phoenix/issues/2375)) ([9a97e62](https://github.com/Arize-ai/phoenix/commit/9a97e6251cddf4ca7aa03ba71d4831cb0de4a165))

### Documentation

- **evals:** add README ([#2363](https://github.com/Arize-ai/phoenix/issues/2363)) ([47842da](https://github.com/Arize-ai/phoenix/commit/47842da560f004944852ea1071edf30eb3993ac8))

## [0.0.2](https://github.com/Arize-ai/phoenix/compare/phoenix-evals-v0.0.1...phoenix-evals-v0.0.2) (2024-02-22)

### Features

- extract `phoenix.experimental.evals` to separate `phoenix.evals` package ([#2142](https://github.com/Arize-ai/phoenix/issues/2142)) ([7b63431](https://github.com/Arize-ai/phoenix/commit/7b63431ee329a3916a9898e1437efef0added22f))

### Bug Fixes

- use static version in pyproject.toml for packages ([#2346](https://github.com/Arize-ai/phoenix/issues/2346)) ([ef2148c](https://github.com/Arize-ai/phoenix/commit/ef2148c18bbbece08755fdee58f66c50ab6a7de8))
