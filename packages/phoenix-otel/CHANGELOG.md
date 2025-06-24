# Changelog

## [0.12.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.12.0...arize-phoenix-otel-v0.12.1) (2025-06-24)


### Documentation

* **otel:** tracer provider kwargs docs ([ac9511e](https://github.com/Arize-ai/phoenix/commit/ac9511e54aa51101d739297c656d5162da40c9d1))

## [0.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.11.0...arize-phoenix-otel-v0.12.0) (2025-06-24)


### Features

* **otel:** support tracer provider arguments ([6b337d9](https://github.com/Arize-ai/phoenix/commit/6b337d9195e176f12e1bd799447ea5f8fbe1734e))
* **otel:** support tracer provider arguments ([#8270](https://github.com/Arize-ai/phoenix/issues/8270)) ([613cdd8](https://github.com/Arize-ai/phoenix/commit/613cdd85923a85d413d2e42546458b0c3a6e7e63))

## [0.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.10.3...arize-phoenix-otel-v0.11.0) (2025-06-18)


### Features

* **auth:** logout ([#7985](https://github.com/Arize-ai/phoenix/issues/7985)) ([63128c5](https://github.com/Arize-ai/phoenix/commit/63128c5328222147fe5c5103d8dd3576d5534bc2))
* Enable phoenix cloud spaces ([#8108](https://github.com/Arize-ai/phoenix/issues/8108)) ([f7c2bca](https://github.com/Arize-ai/phoenix/commit/f7c2bca26e7617da472bb48b91ce696c7c1dc378))
* read OTEL_EXPORTER_OTLP_ENDPOINT when PHOENIX_COLLECTOR_ENDPOINT is missing ([#8095](https://github.com/Arize-ai/phoenix/issues/8095)) ([4cb7e4c](https://github.com/Arize-ai/phoenix/commit/4cb7e4c2cd3b43ee3334c717dc4499634ca12135))


### Documentation

* phoenix-otel documentation header styling - Update conf.py header… ([#7936](https://github.com/Arize-ai/phoenix/issues/7936)) ([0173e7f](https://github.com/Arize-ai/phoenix/commit/0173e7f5e187fe0f4f1c15311a56b878117803a9))
* Readthedocs improvements on naming and structure ([#8009](https://github.com/Arize-ai/phoenix/issues/8009)) ([76a4b92](https://github.com/Arize-ai/phoenix/commit/76a4b9282ff8476757ee1c0b3c85a7767208795b))

## [0.10.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.10.2...arize-phoenix-otel-v0.10.3) (2025-06-04)


### Bug Fixes

* Otel moved the location of span exporters on batch processors ([#7919](https://github.com/Arize-ai/phoenix/issues/7919)) ([6c5a0cf](https://github.com/Arize-ai/phoenix/commit/6c5a0cfa990ca1775062e47ad9c52c3b61f986a4))

## [0.10.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.10.1...arize-phoenix-otel-v0.10.2) (2025-06-03)


### Bug Fixes

* upgrade lower version pin on openinference-instrumentation and openinference-instrumentation-semantic-conventions ([#7901](https://github.com/Arize-ai/phoenix/issues/7901)) ([868c4f2](https://github.com/Arize-ai/phoenix/commit/868c4f2fb173af1e9a2b3891d1aecf40c1398aa6))

## [0.10.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.10.0...arize-phoenix-otel-v0.10.1) (2025-05-28)


### Bug Fixes

* `register` crashes when printing details under certain conditions ([#7754](https://github.com/Arize-ai/phoenix/issues/7754)) ([754d713](https://github.com/Arize-ai/phoenix/commit/754d713fb5d85e0fdc2925aca514da128c9d5586))

## [0.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.9.2...arize-phoenix-otel-v0.10.0) (2025-05-28)


### Features

* Add option to not replace default span processor ([#7736](https://github.com/Arize-ai/phoenix/issues/7736)) ([95a9ac2](https://github.com/Arize-ai/phoenix/commit/95a9ac2098c7efc134b340b3a21b26bf267e1831))

## [0.9.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.9.1...arize-phoenix-otel-v0.9.2) (2025-04-14)


### Bug Fixes

* **otel:** ensure arize-phoenix-otel has no type issues on import when installed as a standalone package ([#7141](https://github.com/Arize-ai/phoenix/issues/7141)) ([b7da769](https://github.com/Arize-ai/phoenix/commit/b7da7691d2ff61946ab1dce278530fbc5b966e92))

## [0.9.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.9.0...arize-phoenix-otel-v0.9.1) (2025-04-05)


### Documentation

* add nice headers ([#7044](https://github.com/Arize-ai/phoenix/issues/7044)) ([9151104](https://github.com/Arize-ai/phoenix/commit/9151104bd4aa69380849a441e3556a3adfa604ca))

## [0.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.8.0...arize-phoenix-otel-v0.9.0) (2025-03-22)


### Features

* Add SimpleSpanProcessor warning ([#6688](https://github.com/Arize-ai/phoenix/issues/6688)) ([dd5a0d9](https://github.com/Arize-ai/phoenix/commit/dd5a0d9179e706c6d4cee256fad582c8b3eb5fd2))


### Documentation

* No subject (GITBOOK-1038) ([812ea2c](https://github.com/Arize-ai/phoenix/commit/812ea2caaee1889741bb893995fb89b4653430d7))
* No subject (GITBOOK-1040) ([1d31ae8](https://github.com/Arize-ai/phoenix/commit/1d31ae8de6c924f9ecd0d3c77f77fef033320c86))
* No subject (GITBOOK-1045) ([0aa0301](https://github.com/Arize-ai/phoenix/commit/0aa03011bda53faad35267facc73047e4be35142))
* No subject (GITBOOK-1087) ([6fa5fd7](https://github.com/Arize-ai/phoenix/commit/6fa5fd71cdf57a9a5a7efc3e2822ad57497f3b5a))
* No subject (GITBOOK-1090) ([024c49f](https://github.com/Arize-ai/phoenix/commit/024c49fe57487ee816317f798ec648331a866ae4))
* No subject (GITBOOK-1099) ([b4357e3](https://github.com/Arize-ai/phoenix/commit/b4357e324a9444704fbf85370c193ef2ee59495f))
* Wording updates (GITBOOK-1030) ([9e9142b](https://github.com/Arize-ai/phoenix/commit/9e9142be0cbc6d5cc08cc373ce1c14eee0479b00))

## [0.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.7.1...arize-phoenix-otel-v0.8.0) (2025-02-18)


### Features

* enable one-line instrumentation with phoenix.otel.register ([#6407](https://github.com/Arize-ai/phoenix/issues/6407)) ([ad95335](https://github.com/Arize-ai/phoenix/commit/ad953357d7f33b3d8e1955fe88375e85c66ebe4d))


### Documentation

* otel README.md python blocks ([3d28d2c](https://github.com/Arize-ai/phoenix/commit/3d28d2c04d04df5eaa65c86a3e07c28b482f4e29))

## [0.7.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.7.0...arize-phoenix-otel-v0.7.1) (2025-01-23)


### Bug Fixes

* use openinference tracer provider in phoenix.otel.register ([#6140](https://github.com/Arize-ai/phoenix/issues/6140)) ([2ec414f](https://github.com/Arize-ai/phoenix/commit/2ec414f16b08817b36c5cad8861165fa7323a76a))

## [0.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.6.1...arize-phoenix-otel-v0.7.0) (2025-01-22)


### Features

* `phoenix.otel` infers GRPC port from env ([#6017](https://github.com/Arize-ai/phoenix/issues/6017)) ([4e036e7](https://github.com/Arize-ai/phoenix/commit/4e036e735cf6abda2352b73d28ed3b095724f04c))
* Explicit OTEL protocol override ([#6067](https://github.com/Arize-ai/phoenix/issues/6067)) ([04264a0](https://github.com/Arize-ai/phoenix/commit/04264a04b18759c71bb106fc15a8f81e78122e68))


### Bug Fixes

* Handle default protocol ([#6146](https://github.com/Arize-ai/phoenix/issues/6146)) ([ee3d061](https://github.com/Arize-ai/phoenix/commit/ee3d0615d6551f8b834af4d8efdccfd118b40da2))


### Documentation

* update sessions (GITBOOK-940) ([88dc135](https://github.com/Arize-ai/phoenix/commit/88dc135f99b03697387df0140533a0808454a88e))

## [0.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.6.0...arize-phoenix-otel-v0.6.1) (2024-10-17)


### Bug Fixes

* increase python upper bound to include python 3.13 for `arize-phoenix-evals` and `arize-phoenix-otel` ([#5077](https://github.com/Arize-ai/phoenix/issues/5077)) ([ef5c893](https://github.com/Arize-ai/phoenix/commit/ef5c893ef7bc81690662a7687ed190f5b6dca701))

## [0.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.5.1...arize-phoenix-otel-v0.6.0) (2024-10-16)


### Features

* Add environment variable setting for structured logging ([#4635](https://github.com/Arize-ai/phoenix/issues/4635)) ([a50ca10](https://github.com/Arize-ai/phoenix/commit/a50ca1018014567d44835680a4daaaa07551d27c))

## [0.5.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.5.0...arize-phoenix-otel-v0.5.1) (2024-09-17)


### Bug Fixes

* Clarify type annotation ([#4626](https://github.com/Arize-ai/phoenix/issues/4626)) ([1931360](https://github.com/Arize-ai/phoenix/commit/1931360e839ee6f18d5722d94cf3a81224348aa8))

## [0.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.4.1...arize-phoenix-otel-v0.5.0) (2024-09-12)


### Features

* Pick up authorization headers from environment variable ([#4590](https://github.com/Arize-ai/phoenix/issues/4590)) ([7648b2a](https://github.com/Arize-ai/phoenix/commit/7648b2a2c363d82f53fbc98852720bb52a0fa3d4))


### Bug Fixes

* Ensure correct dataloader results ordering ([#4524](https://github.com/Arize-ai/phoenix/issues/4524)) ([f9239d6](https://github.com/Arize-ai/phoenix/commit/f9239d63af9d06c04430f9dca808caf08d152d3d))

## [0.4.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.4.0...arize-phoenix-otel-v0.4.1) (2024-08-25)


### Bug Fixes

* **otel:** add semantic conventions dependency ([#4380](https://github.com/Arize-ai/phoenix/issues/4380)) ([a3e1462](https://github.com/Arize-ai/phoenix/commit/a3e14626077fd7aa893126c360a24784c4aa591c))

## [0.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.3.0...arize-phoenix-otel-v0.4.0) (2024-08-23)


### Features

* Improve urlencoding logic + bug fixes ([#4338](https://github.com/Arize-ai/phoenix/issues/4338)) ([604fcef](https://github.com/Arize-ai/phoenix/commit/604fcefc465c8d7534ac2152a84cbe8ddcf06597))


### Bug Fixes

* support pydantic in the range 2.4.1&lt;=pydantic<=2.7.1 ([#4323](https://github.com/Arize-ai/phoenix/issues/4323)) ([fa5eeff](https://github.com/Arize-ai/phoenix/commit/fa5eeff45b0752508d4bc51334607ef4acc19474))


### Documentation

* Refine otel readme ([#4329](https://github.com/Arize-ai/phoenix/issues/4329)) ([beb04a8](https://github.com/Arize-ai/phoenix/commit/beb04a872267178a57dce0211fb16f0c8bb3ea47))

## [0.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.2.0...arize-phoenix-otel-v0.3.0) (2024-08-21)


### Features

* Improve OTel wrapper ergonomics ([#4295](https://github.com/Arize-ai/phoenix/issues/4295)) ([ef533cf](https://github.com/Arize-ai/phoenix/commit/ef533cf16b28ac5b6dbc8f593e7b31c3340f42df))

## [0.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-otel-v0.1.0...arize-phoenix-otel-v0.2.0) (2024-08-19)


### Features

* Clarify `register` API documentation ([#4280](https://github.com/Arize-ai/phoenix/issues/4280)) ([819236c](https://github.com/Arize-ai/phoenix/commit/819236c1e654f168abd725ca2c4e3d7cf187b384))

## 0.1.0 (2024-08-16)


### Features

* Create `phoenix.otel` package ([#4230](https://github.com/Arize-ai/phoenix/issues/4230)) ([4e2ad61](https://github.com/Arize-ai/phoenix/commit/4e2ad615a6685bb60df987e1f23f3162eb5d3ca5))
