# Changelog

## [9.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.4.0...arize-phoenix-v9.5.0) (2025-05-17)


### Features

* **dashboards:** dashboard panel ([#7564](https://github.com/Arize-ai/phoenix/issues/7564)) ([cb8cd07](https://github.com/Arize-ai/phoenix/commit/cb8cd078e463c7300c0a3e72f0bae3df159f1875))
* graphql query for hourly span count timeseries ([#6997](https://github.com/Arize-ai/phoenix/issues/6997)) ([fe6a80a](https://github.com/Arize-ai/phoenix/commit/fe6a80aaa939ebe445af04c17e46b2c29080bc60))


### Bug Fixes

* check sql validity of filter expression ([#7581](https://github.com/Arize-ai/phoenix/issues/7581)) ([12a0620](https://github.com/Arize-ai/phoenix/commit/12a062081a0bc402ba8068ca8a10414232c6d623))
* remove GlobalID as custom scalar from GraphQL schema ([#7544](https://github.com/Arize-ai/phoenix/issues/7544)) ([4a0659a](https://github.com/Arize-ai/phoenix/commit/4a0659a76715ce73df082b2d6aab95e26b9866a2))


### Documentation

* update docstring for experiment evaluators ([#7575](https://github.com/Arize-ai/phoenix/issues/7575)) ([4fa5c57](https://github.com/Arize-ai/phoenix/commit/4fa5c57aa4ee92da50fb898e2372bda35ef1d592))

## [9.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.3.0...arize-phoenix-v9.4.0) (2025-05-15)


### Features

* **dashboards:** rudamentary routes for dashboards ([#7554](https://github.com/Arize-ai/phoenix/issues/7554)) ([ff8cb74](https://github.com/Arize-ai/phoenix/commit/ff8cb74ffdeb935e24d9af4b0df0c0d15bd14262))


### Bug Fixes

* correct limit clause in span query statement ([#7565](https://github.com/Arize-ai/phoenix/issues/7565)) ([2bd7799](https://github.com/Arize-ai/phoenix/commit/2bd77998fdef8e29e6d3b1bc97c618f512a1b403))

## [9.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.2.0...arize-phoenix-v9.3.0) (2025-05-13)


### Features

* add claude 3.7 ([#7539](https://github.com/Arize-ai/phoenix/issues/7539)) ([db8ceaf](https://github.com/Arize-ai/phoenix/commit/db8ceaf9ada165d045568cb8900ef99dfa35b6ce))
* **api:** expose experiment routes ([#7543](https://github.com/Arize-ai/phoenix/issues/7543)) ([7882615](https://github.com/Arize-ai/phoenix/commit/7882615fb22c487833b76c784edda668921e21db))

## [9.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.1.0...arize-phoenix-v9.2.0) (2025-05-13)


### Features

* **ui:** agno, mcp, gemini integrations ([#7537](https://github.com/Arize-ai/phoenix/issues/7537)) ([8fb1bba](https://github.com/Arize-ai/phoenix/commit/8fb1bba58b3d5f7163c5519791a92b28f0ae708c))


### Documentation

* update readme with agno, mcp ([#7532](https://github.com/Arize-ai/phoenix/issues/7532)) ([f132606](https://github.com/Arize-ai/phoenix/commit/f132606d59e0db261bfa99d39a253773a7459a26))

## [9.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.0.1...arize-phoenix-v9.1.0) (2025-05-13)


### Features

* List, sort,  and filter projects in UI ([#7453](https://github.com/Arize-ai/phoenix/issues/7453)) ([c7ad67e](https://github.com/Arize-ai/phoenix/commit/c7ad67ee9119d579c9ebbb4f5377742bb31279ad))
* Open span details sections when hotkeys are pressed ([#7494](https://github.com/Arize-ai/phoenix/issues/7494)) ([aacae6a](https://github.com/Arize-ai/phoenix/commit/aacae6a24b365f534b5d816e1a71c95435de2b85))


### Bug Fixes

* content wrap in markdown block ([#7508](https://github.com/Arize-ai/phoenix/issues/7508)) ([18d6518](https://github.com/Arize-ai/phoenix/commit/18d65186cf28e6ed925f8e1bb2272aca21651c5b))
* remove version lowerbound for starlette ([#7527](https://github.com/Arize-ai/phoenix/issues/7527)) ([292a827](https://github.com/Arize-ai/phoenix/commit/292a82775173d3eebbbfa79518e62d03bab63ad6))

## [9.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v9.0.0...arize-phoenix-v9.0.1) (2025-05-11)


### Bug Fixes

* pin strawberry ([#7514](https://github.com/Arize-ai/phoenix/issues/7514)) ([f85847c](https://github.com/Arize-ai/phoenix/commit/f85847cf93498dcfc50e528e59d8fab1199c19df))

## [9.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.32.1...arize-phoenix-v9.0.0) (2025-05-09)


### ⚠ BREAKING CHANGES

* db table for trace data retention policies ([#6703](https://github.com/Arize-ai/phoenix/issues/6703))

### Features

* add `get_span_annotations_dataframe` to client ([#7366](https://github.com/Arize-ai/phoenix/issues/7366)) ([94c0c02](https://github.com/Arize-ai/phoenix/commit/94c0c029dee31e017da112cf1f5db36127cedf1b))
* Add get span annotations route ([#7339](https://github.com/Arize-ai/phoenix/issues/7339)) ([407bab0](https://github.com/Arize-ai/phoenix/commit/407bab0f3a43e4de03b57f7a41f57b5e9b8f28d3))
* Add input for configuring global retention policy ([#6957](https://github.com/Arize-ai/phoenix/issues/6957)) ([b114ee8](https://github.com/Arize-ai/phoenix/commit/b114ee83d83cdadb66932383554430d33ea14851))
* Add sorting to span annotations table ([#7445](https://github.com/Arize-ai/phoenix/issues/7445)) ([36fa3a3](https://github.com/Arize-ai/phoenix/commit/36fa3a30949ebc72786b758163afaa48446c1837))
* Add span comment mutation ([#7260](https://github.com/Arize-ai/phoenix/issues/7260)) ([a23a453](https://github.com/Arize-ai/phoenix/commit/a23a453972a3655b8605bc565d881d925aa99de2))
* **admin:** add the ability to edit / delete retention policies ([#7225](https://github.com/Arize-ai/phoenix/issues/7225)) ([c7525a6](https://github.com/Arize-ai/phoenix/commit/c7525a66da5a937124911c08038716ae0ab7778f))
* **admin:** create retention policy UI ([#7145](https://github.com/Arize-ai/phoenix/issues/7145)) ([4f83a41](https://github.com/Arize-ai/phoenix/commit/4f83a41506c738936e5e1461858bc1dcd363122c))
* **admin:** project retention policy for admins ([#7162](https://github.com/Arize-ai/phoenix/issues/7162)) ([f4a7bba](https://github.com/Arize-ai/phoenix/commit/f4a7bba561d416956ba1ca5e211b1684bbc66999))
* **admin:** system level retention policies table ([#7130](https://github.com/Arize-ai/phoenix/issues/7130)) ([f701ba1](https://github.com/Arize-ai/phoenix/commit/f701ba15d3858e475415c8227393708fe74b1c7c))
* Allow multiple annotations per span with the same name ([#6573](https://github.com/Arize-ai/phoenix/issues/6573)) ([fe3d61d](https://github.com/Arize-ai/phoenix/commit/fe3d61d9b8f9f9613e21430482a504b453b7544c))
* Annotation Configurations ([#6495](https://github.com/Arize-ai/phoenix/issues/6495)) ([66913da](https://github.com/Arize-ai/phoenix/commit/66913daa38e757cf27b1edaf55419ae4316992a4))
* **annotations:** add notes UI ([#7074](https://github.com/Arize-ai/phoenix/issues/7074)) ([e17db79](https://github.com/Arize-ai/phoenix/commit/e17db791f53db5004a5fcfdaefca8277570a916c))
* **annotations:** add timestamps to annotation gql type ([#7076](https://github.com/Arize-ai/phoenix/issues/7076)) ([08724eb](https://github.com/Arize-ai/phoenix/commit/08724eba3160d823d1899435c1035e73de6a8fb7))
* **annotations:** Annotate spans based on project annotation configs ([#7174](https://github.com/Arize-ai/phoenix/issues/7174)) ([7d59bdf](https://github.com/Arize-ai/phoenix/commit/7d59bdf413f0c176c1c82eed55617990ae9ab91e))
* **annotations:** Annotation Config UI ([#6856](https://github.com/Arize-ai/phoenix/issues/6856)) ([e75b69d](https://github.com/Arize-ai/phoenix/commit/e75b69ddf60cc85a5e99cf890c4d1ee07913e790))
* **annotations:** Associate annotation configs from span aside ([#7096](https://github.com/Arize-ai/phoenix/issues/7096)) ([94f1bd3](https://github.com/Arize-ai/phoenix/commit/94f1bd30fb187beec54b65db8ec8d12cc919c8ae))
* **annotations:** associate user with annotation for /v1/span_annotations ([16ad299](https://github.com/Arize-ai/phoenix/commit/16ad2999de3285fcb8cad36fc1fb92a75416e850))
* **annotations:** ensure all span annotations are included in dataset examples ([#7412](https://github.com/Arize-ai/phoenix/issues/7412)) ([2095b5e](https://github.com/Arize-ai/phoenix/commit/2095b5e0b29ed98625b2ef690912de4b124c0648))
* **annotations:** full annotations table ([#7097](https://github.com/Arize-ai/phoenix/issues/7097)) ([32bfc6c](https://github.com/Arize-ai/phoenix/commit/32bfc6c2267e1c4a6b6195c199c1bef129e84858))
* **annotations:** Implement annotation config form elements ([#7063](https://github.com/Arize-ai/phoenix/issues/7063)) ([6a47ac9](https://github.com/Arize-ai/phoenix/commit/6a47ac9292b3ff964dd7df71ad3e65519e20b265))
* **annotations:** make the project annotation config more clear ([#7281](https://github.com/Arize-ai/phoenix/issues/7281)) ([a62b3b0](https://github.com/Arize-ai/phoenix/commit/a62b3b0a6bf37cfd8613c3be672db0e2f5c6d987))
* **annotations:** Paginate between traces on spans table or traces table ([#7357](https://github.com/Arize-ai/phoenix/issues/7357)) ([f03448a](https://github.com/Arize-ai/phoenix/commit/f03448a1c5cb2c69fcc702756141458752714d40))
* **annotations:** project annotation config ([#6970](https://github.com/Arize-ai/phoenix/issues/6970)) ([4acd45b](https://github.com/Arize-ai/phoenix/commit/4acd45b13db3c2074c6f8a950bdd97495e65efab))
* **annotations:** record user for /v1/trace_annotations ([94900cd](https://github.com/Arize-ai/phoenix/commit/94900cde6c6e3d79bc2db133526b86751c6e05c8))
* **annotations:** span annotation filters ([#7109](https://github.com/Arize-ai/phoenix/issues/7109)) ([547e90e](https://github.com/Arize-ai/phoenix/commit/547e90ee5b366ce5c0e4b95af394ab1009572ef5))
* **annotations:** Summarize annotations on spans, tables, project header ([#7247](https://github.com/Arize-ai/phoenix/issues/7247)) ([5ea2a75](https://github.com/Arize-ai/phoenix/commit/5ea2a756d36b77d6fe799bbed5cd10c24c560a34))
* **auth:** add arize auth, auto trigger login ([#7480](https://github.com/Arize-ai/phoenix/issues/7480)) ([b699bf8](https://github.com/Arize-ai/phoenix/commit/b699bf8e55fd08e5c57a1b275e0a4aaaf100cc80))
* **datasets:** support json dataset upload via the ui ([#7410](https://github.com/Arize-ai/phoenix/issues/7410)) ([29557f4](https://github.com/Arize-ai/phoenix/commit/29557f4a18ad645bb2fdb0d968196d70d5b1a6ac))
* db table for trace data retention policies ([#6703](https://github.com/Arize-ai/phoenix/issues/6703)) ([47b8bfe](https://github.com/Arize-ai/phoenix/commit/47b8bfe16d6effa84aec83da19e62a4ce52ef1a4))
* graphql queries for trace retention policy CRUD operations ([#6875](https://github.com/Arize-ai/phoenix/issues/6875)) ([0e7c278](https://github.com/Arize-ai/phoenix/commit/0e7c278092fb90342af4e5215e28106db2315a23))
* graphql query for annotation summaries per span ([#7129](https://github.com/Arize-ai/phoenix/issues/7129)) ([9bf45c0](https://github.com/Arize-ai/phoenix/commit/9bf45c0398926ed4cd62314a6e2f0d0978e86427))
* mutation to remove project annotation config association ([#6889](https://github.com/Arize-ai/phoenix/issues/6889)) ([83211a6](https://github.com/Arize-ai/phoenix/commit/83211a6c53145ed3d7a8fa8cb2d79f6c59e9f798))
* Reserve note annotation name ([#7274](https://github.com/Arize-ai/phoenix/issues/7274)) ([56eee74](https://github.com/Arize-ai/phoenix/commit/56eee74d2271ef75ce00abfd0e2b770f27301d0d))
* **retention:** Add capability based access to retention policy ([#7098](https://github.com/Arize-ai/phoenix/issues/7098)) ([d4d1663](https://github.com/Arize-ai/phoenix/commit/d4d1663c8904b27e33a750d441f743715995c0aa))
* span annotation POST methods for client ([#7359](https://github.com/Arize-ai/phoenix/issues/7359)) ([218cc63](https://github.com/Arize-ai/phoenix/commit/218cc63cac84d48477d5359cc31aaf6ccca7f8bf))
* Span note resolver ([#7276](https://github.com/Arize-ai/phoenix/issues/7276)) ([ec583b8](https://github.com/Arize-ai/phoenix/commit/ec583b8169b17d74320cbe2c5da040ab9e6604ce))
* Stabilize categorical annotation summary pie chart colors ([#7384](https://github.com/Arize-ai/phoenix/issues/7384)) ([4dc9a43](https://github.com/Arize-ai/phoenix/commit/4dc9a4307597022b624c79374bb198d81c31f287))
* style keyboard tokens to look more like keys ([#7442](https://github.com/Arize-ai/phoenix/issues/7442)) ([9cda7f6](https://github.com/Arize-ai/phoenix/commit/9cda7f6284a32d795d1f96bbb8b2e5abcd0a26e0))
* Summarize dynamic annotation columns ([#7346](https://github.com/Arize-ai/phoenix/issues/7346)) ([849108c](https://github.com/Arize-ai/phoenix/commit/849108cd9e6c13584b692c680486d0a0800bb643))
* **ui:** add a link to all retention policies on the settings general page ([#7280](https://github.com/Arize-ai/phoenix/issues/7280)) ([480976d](https://github.com/Arize-ai/phoenix/commit/480976d34938702472102733e985f8fc5274ce18))
* **ui:** Group component with refactored pagination buttons ([#7444](https://github.com/Arize-ai/phoenix/issues/7444)) ([8235adc](https://github.com/Arize-ai/phoenix/commit/8235adcbec2fce7dc5de5705dbe043f4f5830e47))
* Update spans dsl to search for annotation existence ([#7406](https://github.com/Arize-ai/phoenix/issues/7406)) ([326b9c5](https://github.com/Arize-ai/phoenix/commit/326b9c50c24fb7900db8523e81bc673202c1d693))
* Upsert on annotation identifier conflict ([#7082](https://github.com/Arize-ai/phoenix/issues/7082)) ([dbe5dec](https://github.com/Arize-ai/phoenix/commit/dbe5decd5396a06128bf1967793b078c4f36c70e))


### Bug Fixes

* add db schema comparison tests before/after migration and drop unused indices on score and label ([#7496](https://github.com/Arize-ai/phoenix/issues/7496)) ([26d8988](https://github.com/Arize-ai/phoenix/commit/26d89888ffdc5acb6a7329013e0227a731fe65e4))
* **admin:** make retention days step 1 ([#7344](https://github.com/Arize-ai/phoenix/issues/7344)) ([29d9e5a](https://github.com/Arize-ai/phoenix/commit/29d9e5a6b5428973f49fa1719a852b661adbaf40))
* **annotation-configs:** make mutations read-only ([#6850](https://github.com/Arize-ai/phoenix/issues/6850)) ([3559411](https://github.com/Arize-ai/phoenix/commit/355941174484bbdb513e003c918d4dc261bb8a30))
* **annotations:** add fields to annotations table ([#6933](https://github.com/Arize-ai/phoenix/issues/6933)) ([658d486](https://github.com/Arize-ai/phoenix/commit/658d48649ed9a6e92d0cf3f263745a09190bb6c2))
* **annotations:** allow `None` optimization direction ([#7258](https://github.com/Arize-ai/phoenix/issues/7258)) ([5110321](https://github.com/Arize-ai/phoenix/commit/51103212e14e1addad6a8945ade4fb0b1b8b591e))
* **annotations:** ensure create annotation mutations do not upsert ([#7248](https://github.com/Arize-ai/phoenix/issues/7248)) ([e4d67ae](https://github.com/Arize-ai/phoenix/commit/e4d67ae4fcec4a3eae5f6b3804833763d584dad5))
* **annotations:** ensure patching an annotation via UI updates source to APP ([#7501](https://github.com/Arize-ai/phoenix/issues/7501)) ([c6e8b20](https://github.com/Arize-ai/phoenix/commit/c6e8b207634c000408153c58f4fbe6f4ee441795))
* **annotations:** ensure response types for annotation configs are nested under a data key ([#7443](https://github.com/Arize-ai/phoenix/issues/7443)) ([145dba3](https://github.com/Arize-ai/phoenix/commit/145dba3978a2ae542a5b5d0e56098e3b0f019a6c))
* **annotations:** ensure user identifiers are stable ([#7414](https://github.com/Arize-ai/phoenix/issues/7414)) ([daed870](https://github.com/Arize-ai/phoenix/commit/daed87020a8b0fd62a79cd80f321b856c6c15629))
* **annotations:** fix facilitator ([e5bfe23](https://github.com/Arize-ai/phoenix/commit/e5bfe23108a3869a91c97ebb13bcb0e0831a3ce8))
* **annotations:** make identifier type non-optional in rest and graphql apis ([#7459](https://github.com/Arize-ai/phoenix/issues/7459)) ([949823e](https://github.com/Arize-ai/phoenix/commit/949823e4029048a94a3655c34a3c447025d35648))
* **annotations:** revert bulk insert ([#7456](https://github.com/Arize-ai/phoenix/issues/7456)) ([beb1c9c](https://github.com/Arize-ai/phoenix/commit/beb1c9cfb3e23049a7d31a549a5dbb781642cc6a))
* **annotations:** Safeguard against null spanAnnotationSummaries ([#7403](https://github.com/Arize-ai/phoenix/issues/7403)) ([7e4f36b](https://github.com/Arize-ai/phoenix/commit/7e4f36b5ed64d0d7c1bf13866c017c907c750a02))
* **annotations:** Show 0 scores in summary labels ([#7371](https://github.com/Arize-ai/phoenix/issues/7371)) ([178b945](https://github.com/Arize-ai/phoenix/commit/178b945432ff987614062d286e12fb7efbccf615))
* **annotations:** Truncate long category names in annotation config table ([#7251](https://github.com/Arize-ai/phoenix/issues/7251)) ([b42ec8c](https://github.com/Arize-ai/phoenix/commit/b42ec8c18866671f1ba482e940d5a4cd41d59276))
* **annotations:** validate values for categorical annotation config ([#7235](https://github.com/Arize-ai/phoenix/issues/7235)) ([41de2d1](https://github.com/Arize-ai/phoenix/commit/41de2d18d25ab3585247fc7ec25bb118e49c4e88))
* **annotations:** Write to annotation explanation instead of label for freeform annotations ([#7448](https://github.com/Arize-ai/phoenix/issues/7448)) ([988360f](https://github.com/Arize-ai/phoenix/commit/988360f6559e9ae4b1d2a3bbaad93601683c0c92))
* Avoid division by zero ([#7446](https://github.com/Arize-ai/phoenix/issues/7446)) ([4f4b18d](https://github.com/Arize-ai/phoenix/commit/4f4b18d4668026105d8be131b95aae3e2c177445))
* db migrate from JSONB to JSON ([#7289](https://github.com/Arize-ai/phoenix/issues/7289)) ([6c06859](https://github.com/Arize-ai/phoenix/commit/6c068590295ea7b030ef9c6592f9b48c56c4f77b))
* firefox table css compat ([#7356](https://github.com/Arize-ai/phoenix/issues/7356)) ([d8640d2](https://github.com/Arize-ai/phoenix/commit/d8640d2183be93fb80c507cd9940f8ae99bd106b))
* for identifier column use empty string as db server default ([#7475](https://github.com/Arize-ai/phoenix/issues/7475)) ([4d5fdf9](https://github.com/Arize-ai/phoenix/commit/4d5fdf9888ea0ccab118161ac2aa151b7e28a943))
* forbid deletion of default policy ([#7220](https://github.com/Arize-ai/phoenix/issues/7220)) ([a043717](https://github.com/Arize-ai/phoenix/commit/a043717b04bfd8f67965ace3ee8d26086c8a1b26))
* forbid renaming of default policy ([#7221](https://github.com/Arize-ai/phoenix/issues/7221)) ([3794459](https://github.com/Arize-ai/phoenix/commit/3794459fb5b4c6a9389adf42b6b6700784d5d769))
* make it clear in the UI that cron expression applies to times in UTC ([#7467](https://github.com/Arize-ai/phoenix/issues/7467)) ([69ce2b0](https://github.com/Arize-ai/phoenix/commit/69ce2b09f9ca5b19c17f8c4f7fce2322951ddfd5))
* pass null user for unauthenticated ([#7458](https://github.com/Arize-ai/phoenix/issues/7458)) ([18d725a](https://github.com/Arize-ai/phoenix/commit/18d725a5456338f9c3139bc842286db6481a7475))
* Polish annotations UI ([#7439](https://github.com/Arize-ai/phoenix/issues/7439)) ([54567a8](https://github.com/Arize-ai/phoenix/commit/54567a87edc5f680ac1edb9005ec4d67130569da))
* Prevent time range context error when opening trace details slideover ([#7418](https://github.com/Arize-ai/phoenix/issues/7418)) ([a97529e](https://github.com/Arize-ai/phoenix/commit/a97529e5636ee10a83a0dc03e28c19997c0202d9))
* replace joinedload with selectinload for retention policy query ([#7471](https://github.com/Arize-ai/phoenix/issues/7471)) ([f8f11f0](https://github.com/Arize-ai/phoenix/commit/f8f11f08ad79073f9fc0c9a5a3d49108ef2d4aea))
* step for number of days should be 1 ([#7464](https://github.com/Arize-ai/phoenix/issues/7464)) ([930ea7b](https://github.com/Arize-ai/phoenix/commit/930ea7bf8e8427ea3ed79b8fff68b7940e317802))
* take worker timeout as input to allow longer task runtimes ([#7488](https://github.com/Arize-ai/phoenix/issues/7488)) ([d93a0c6](https://github.com/Arize-ai/phoenix/commit/d93a0c6ef13297bb2818316e70a774180a990e51))
* **ui:** fix import for react router ([#6913](https://github.com/Arize-ai/phoenix/issues/6913)) ([edafadc](https://github.com/Arize-ai/phoenix/commit/edafadcd234c1e45c5f3577775ebaeaa4de708fa))
* Unique annotation per user ([#7238](https://github.com/Arize-ai/phoenix/issues/7238)) ([7f08c88](https://github.com/Arize-ai/phoenix/commit/7f08c889849034a734a2e34894b375fffcca97e3))
* use leading visual for the icon ([#7427](https://github.com/Arize-ai/phoenix/issues/7427)) ([9ffc8a8](https://github.com/Arize-ai/phoenix/commit/9ffc8a8c5824032831f477a807d4e967fb0c83df))


### Documentation

* add gemini ([6b4abff](https://github.com/Arize-ai/phoenix/commit/6b4abff3ccf5d3cc19c6cdd9faf8a19972859967))
* **annotations:** add MIGRATION warning ([#7461](https://github.com/Arize-ai/phoenix/issues/7461)) ([54f8038](https://github.com/Arize-ai/phoenix/commit/54f80383a2b3550a1bf395d472db0c851da5ba9d))

## [8.32.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.32.0...arize-phoenix-v8.32.1) (2025-05-08)


### Bug Fixes

* add flag for `orphan_span_as_root_span` on client for span query ([#7465](https://github.com/Arize-ai/phoenix/issues/7465)) ([1e8d78a](https://github.com/Arize-ai/phoenix/commit/1e8d78acbda1a7e10703f6e41d95fc0ce77780b8))


### Documentation

* add google-genai ([#7432](https://github.com/Arize-ai/phoenix/issues/7432)) ([22f3bf2](https://github.com/Arize-ai/phoenix/commit/22f3bf2f10545c556e92199b8369dc94533ab177))

## [8.32.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.31.0...arize-phoenix-v8.32.0) (2025-05-06)


### Features

* Adding demo_agent project with traces ([#7391](https://github.com/Arize-ai/phoenix/issues/7391)) ([6f4731a](https://github.com/Arize-ai/phoenix/commit/6f4731ab20394f88aaf596f043898cc543141bbb))
* **onboarding:** datasets empty ([#7380](https://github.com/Arize-ai/phoenix/issues/7380)) ([9d34909](https://github.com/Arize-ai/phoenix/commit/9d3490961dad279afee13af29e99235c01ffb8ce))
* Simple support for message_contents span content in playground ([#7402](https://github.com/Arize-ai/phoenix/issues/7402)) ([0cf871e](https://github.com/Arize-ai/phoenix/commit/0cf871ea44a90d6eb9ac6e82728867364a13bf0a))


### Bug Fixes

* handle ssl query params in postgresql connection strings ([#7428](https://github.com/Arize-ai/phoenix/issues/7428)) ([0437677](https://github.com/Arize-ai/phoenix/commit/04376772703f0891d7ce2e1d449eacaa126d295b))
* metadata filters for nested fields ([#7408](https://github.com/Arize-ai/phoenix/issues/7408)) ([b582f95](https://github.com/Arize-ai/phoenix/commit/b582f95b7d44612edc511839134287602d2cf3cb))
* normalize gemini roles ([#7404](https://github.com/Arize-ai/phoenix/issues/7404)) ([b566d40](https://github.com/Arize-ai/phoenix/commit/b566d401ea0dc6de15621f1acf82a1d3f8b7c62f))

## [8.31.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.30.0...arize-phoenix-v8.31.0) (2025-05-01)


### Features

* **components:** video for tutorials ([#7376](https://github.com/Arize-ai/phoenix/issues/7376)) ([c858268](https://github.com/Arize-ai/phoenix/commit/c85826869b5177e06be051cf9a6e8d042e5f95d4))


### Bug Fixes

* **subscriptions:** make gql subscriptions basename aware ([#7382](https://github.com/Arize-ai/phoenix/issues/7382)) ([19674f4](https://github.com/Arize-ai/phoenix/commit/19674f4cee732ce48ff7f423c5ad0f2f1f26f7ab))

## [8.30.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.29.0...arize-phoenix-v8.30.0) (2025-04-30)


### Features

* Add "copy name" button to project menu ([#7358](https://github.com/Arize-ai/phoenix/issues/7358)) ([78d05a3](https://github.com/Arize-ai/phoenix/commit/78d05a3be0d45deab7f21938e5508a47607b0918))
* Add `SpanQuery` DSL to phoenix client and include `get_spans_dataframe` to client ([#7071](https://github.com/Arize-ai/phoenix/issues/7071)) ([ee56e9a](https://github.com/Arize-ai/phoenix/commit/ee56e9a9bf9e13c8793bd4a3b915ef083f679f2a))
* **api:** add RBAC primitives for fastAPI / REST ([#7349](https://github.com/Arize-ai/phoenix/issues/7349)) ([9d2cc9c](https://github.com/Arize-ai/phoenix/commit/9d2cc9cc087659a9e6f6126e780ae2996c54b87d))
* separate TLS enabled flags for HTTP and gRPC ([#7370](https://github.com/Arize-ai/phoenix/issues/7370)) ([602277d](https://github.com/Arize-ai/phoenix/commit/602277d1be4b043680c7445000ddb5f322fc32bf))


### Bug Fixes

* **playground:** log playground subscription errors ([#7353](https://github.com/Arize-ai/phoenix/issues/7353)) ([5b6edb8](https://github.com/Arize-ai/phoenix/commit/5b6edb8f6b26c55252a28f13784e68c435622ed5))

## [8.29.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.28.1...arize-phoenix-v8.29.0) (2025-04-28)


### Features

* environment variables for TLS ([#7296](https://github.com/Arize-ai/phoenix/issues/7296)) ([91e8875](https://github.com/Arize-ai/phoenix/commit/91e8875b169976a0e25fc2c48aa381859048ea09))

## [8.28.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.28.0...arize-phoenix-v8.28.1) (2025-04-28)


### Bug Fixes

* Improve browser compatibility for Table sizing features ([#7321](https://github.com/Arize-ai/phoenix/issues/7321)) ([a7c03ec](https://github.com/Arize-ai/phoenix/commit/a7c03ec7e623c51fe89bdbcf95ebfcc8c42caf4f))
* simplify homeLoaderQuery ([#7336](https://github.com/Arize-ai/phoenix/issues/7336)) ([d92d037](https://github.com/Arize-ai/phoenix/commit/d92d037d4d37d55ce6dd12b87381c2196471ebd2))

## [8.28.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.27.1...arize-phoenix-v8.28.0) (2025-04-28)


### Features

* gracefully handle ctrl-c ([#7305](https://github.com/Arize-ai/phoenix/issues/7305)) ([6365934](https://github.com/Arize-ai/phoenix/commit/63659344d288b1a4742ebb1a78b9108c6b9f72c6))


### Bug Fixes

* use float for token count summaries ([#7319](https://github.com/Arize-ai/phoenix/issues/7319)) ([783a385](https://github.com/Arize-ai/phoenix/commit/783a385ce9842e6646545e3af4c35698279f7d0c))

## [8.27.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.27.0...arize-phoenix-v8.27.1) (2025-04-25)


### Bug Fixes

* Allow scroll on settings pages ([#7284](https://github.com/Arize-ai/phoenix/issues/7284)) ([c25b071](https://github.com/Arize-ai/phoenix/commit/c25b07143b9c714b75e3d9655ca9db161542acb0))

## [8.27.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.26.3...arize-phoenix-v8.27.0) (2025-04-24)


### Features

* Add /readyz endpoint to confirm database connectivity ([#7262](https://github.com/Arize-ai/phoenix/issues/7262)) ([ec11ed3](https://github.com/Arize-ai/phoenix/commit/ec11ed31c3501e91d66282dedaa5a4e0cbaedd58))
* **tracing:** scroll selected span into view when navigating to a trace ([#7227](https://github.com/Arize-ai/phoenix/issues/7227)) ([970c721](https://github.com/Arize-ai/phoenix/commit/970c721187a2b9024452ff7cef9a89a599d42bec))


### Documentation

* Update README.md ([#7213](https://github.com/Arize-ai/phoenix/issues/7213)) ([dc27c32](https://github.com/Arize-ai/phoenix/commit/dc27c322c1f73fa696f34e650129ee54dec9a96f))

## [8.26.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.26.2...arize-phoenix-v8.26.3) (2025-04-18)


### Bug Fixes

* require starlette&gt;=0.46.0 ([#7199](https://github.com/Arize-ai/phoenix/issues/7199)) ([c3bb73e](https://github.com/Arize-ai/phoenix/commit/c3bb73e911857d9da9737cb5d1d3fcf42ed1a753))

## [8.26.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.26.1...arize-phoenix-v8.26.2) (2025-04-17)


### Bug Fixes

* remove WebSocket dependency ([#7172](https://github.com/Arize-ai/phoenix/issues/7172)) ([d390b37](https://github.com/Arize-ai/phoenix/commit/d390b37a749e3e667042d7e8723fac5f74e5d3a8))

## [8.26.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.26.0...arize-phoenix-v8.26.1) (2025-04-16)


### Bug Fixes

* disallow admin user to change their own role ([#7165](https://github.com/Arize-ai/phoenix/issues/7165)) ([48a79cc](https://github.com/Arize-ai/phoenix/commit/48a79ccda74323686e1de2d862c147865039723e))
* **ui:** hide menu for changing role for self in UsersTable ([#7167](https://github.com/Arize-ai/phoenix/issues/7167)) ([44f7e67](https://github.com/Arize-ai/phoenix/commit/44f7e6725958213bc5833144ab7dc012af2a5310))

## [8.26.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.25.0...arize-phoenix-v8.26.0) (2025-04-16)


### Features

* add PHOENIX_ADMIN_SECRET environment variable ([#7151](https://github.com/Arize-ai/phoenix/issues/7151)) ([bde184e](https://github.com/Arize-ai/phoenix/commit/bde184efda680fc212fdd4fd4346d66e9914cf38))
* **tracing:** add load more and loading state to the infinite scroll ([#7132](https://github.com/Arize-ai/phoenix/issues/7132)) ([7e97c51](https://github.com/Arize-ai/phoenix/commit/7e97c519aa8813cfa1deff22b9b15cb49d723c00))

## [8.25.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.24.2...arize-phoenix-v8.25.0) (2025-04-15)


### Features

* Display tool call and tool result Ids in span details ([#7114](https://github.com/Arize-ai/phoenix/issues/7114)) ([4390d7a](https://github.com/Arize-ai/phoenix/commit/4390d7ad964da9fd28fa9658cb1b52d9efa82d29))


### Bug Fixes

* Do not refetch tables when trace/span details closed ([#7110](https://github.com/Arize-ai/phoenix/issues/7110)) ([c6a6b45](https://github.com/Arize-ai/phoenix/commit/c6a6b45bb9c3b1d4339db8d49068dc40d48a630d))
* redirect GET v1/* to home ([#7139](https://github.com/Arize-ai/phoenix/issues/7139)) ([3790907](https://github.com/Arize-ai/phoenix/commit/37909070a64d1617bc119e8db8334e559c6e5fcf))
* update gpt models for playground ([#7146](https://github.com/Arize-ai/phoenix/issues/7146)) ([41d0574](https://github.com/Arize-ai/phoenix/commit/41d0574174dc56b4a647371d03d0a43caff62ad2))

## [8.24.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.24.1...arize-phoenix-v8.24.2) (2025-04-10)


### Bug Fixes

* restore streaming ([#7107](https://github.com/Arize-ai/phoenix/issues/7107)) ([a78c2e4](https://github.com/Arize-ai/phoenix/commit/a78c2e42cde6e8a4895dde6a046968ba5c52c564))
* update Gemini models for playground ([#7102](https://github.com/Arize-ai/phoenix/issues/7102)) ([960a5a1](https://github.com/Arize-ai/phoenix/commit/960a5a14f6662314bb0ed3f10aaa71e3061cca9d))

## [8.24.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.24.0...arize-phoenix-v8.24.1) (2025-04-09)


### Bug Fixes

* route user to forgot-password page in welcome email url ([#7089](https://github.com/Arize-ai/phoenix/issues/7089)) ([5fbd2f0](https://github.com/Arize-ai/phoenix/commit/5fbd2f0d4716703abeeddcac215de650959a7fbb))

## [8.24.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.23.0...arize-phoenix-v8.24.0) (2025-04-09)


### Features

* allow project name as identifier in REST path for projects endpoints ([#7064](https://github.com/Arize-ai/phoenix/issues/7064)) ([8ccf2d7](https://github.com/Arize-ai/phoenix/commit/8ccf2d761100cefb2afc5a2d70690f9a5d15483e))
* send welcome email after user creation ([#6982](https://github.com/Arize-ai/phoenix/issues/6982)) ([ee56a1b](https://github.com/Arize-ai/phoenix/commit/ee56a1b5866e206d3429d0b2b3dfb63a3645a34a))

## [8.23.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.22.1...arize-phoenix-v8.23.0) (2025-04-09)


### Features

* add PHOENIX_ALLOWED_ORIGINS env to phoenix server ([#7051](https://github.com/Arize-ai/phoenix/issues/7051)) ([f6c57a7](https://github.com/Arize-ai/phoenix/commit/f6c57a7b3db15fd78bc6a91dcc691b499320ca59))
* REST API for CRUD operations on projects ([#7006](https://github.com/Arize-ai/phoenix/issues/7006)) ([b30c7ff](https://github.com/Arize-ai/phoenix/commit/b30c7ff65ee418c225d54a6fd00d4f7f29ad84e8))
* **tracing:** delete annotations in the feedback column ([#7085](https://github.com/Arize-ai/phoenix/issues/7085)) ([0cc306a](https://github.com/Arize-ai/phoenix/commit/0cc306a79cea3d8024c963b882cb7797c04a3409))
* **tracing:** make feedback table scroll ([#7081](https://github.com/Arize-ai/phoenix/issues/7081)) ([6c86bed](https://github.com/Arize-ai/phoenix/commit/6c86bed040f3ea234b111308490467e8cbd41214))


### Bug Fixes

* Allow scrolling the entire experiment compare table ([#7069](https://github.com/Arize-ai/phoenix/issues/7069)) ([4a6a0dc](https://github.com/Arize-ai/phoenix/commit/4a6a0dc7d86c9d056a69a0ad875f8bcb722bba41))
* Don't close model settings dialog when picking azure version ([#7067](https://github.com/Arize-ai/phoenix/issues/7067)) ([d24a3af](https://github.com/Arize-ai/phoenix/commit/d24a3af5f5d8c23e1173dcb51ea3dcf0148bb951))
* Make time range selector more accessible ([#7066](https://github.com/Arize-ai/phoenix/issues/7066)) ([199c08f](https://github.com/Arize-ai/phoenix/commit/199c08ffc1541da6afaec13a1c966d99ab95bff5))
* **session:** improve PostgreSQL error message in launch_app ([#7072](https://github.com/Arize-ai/phoenix/issues/7072)) ([90d936b](https://github.com/Arize-ai/phoenix/commit/90d936b596d0e5466c198ccbeac7f6de4440dec8))


### Documentation

* add bluesky ([227e08e](https://github.com/Arize-ai/phoenix/commit/227e08e2afd73ba232de8a4c28d7ffc23b66c947))
* fix readmes for MCP ([#7042](https://github.com/Arize-ai/phoenix/issues/7042)) ([a687808](https://github.com/Arize-ai/phoenix/commit/a687808b073fbd92a3bd66ac79cb5b020fd761f9))

## [8.22.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.22.0...arize-phoenix-v8.22.1) (2025-04-04)


### Bug Fixes

* add aiohttp to container for azure-identity ([#6995](https://github.com/Arize-ai/phoenix/issues/6995)) ([6eb3eb1](https://github.com/Arize-ai/phoenix/commit/6eb3eb1ad6b65eec98b2f26ba6526709e4d5ecef))

## [8.22.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.21.0...arize-phoenix-v8.22.0) (2025-04-03)


### Features

* add REST endpoints to list or create prompt version tags ([#6984](https://github.com/Arize-ai/phoenix/issues/6984)) ([959622d](https://github.com/Arize-ai/phoenix/commit/959622d335274a0cb59dbf6b78e94fe6f3613bd3))

## [8.21.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.20.0...arize-phoenix-v8.21.0) (2025-04-02)


### Features

* Allow no working dir configured w/ postgres ([#6972](https://github.com/Arize-ai/phoenix/issues/6972)) ([e7fd445](https://github.com/Arize-ai/phoenix/commit/e7fd4450a3aa5fca7dc4efc789b641e495f31f18))
* Move Span Annotation Editor into Span Aside ([#6937](https://github.com/Arize-ai/phoenix/issues/6937)) ([9dc2dc7](https://github.com/Arize-ai/phoenix/commit/9dc2dc7e526e67140009398014166d04eb528a15))
* **ui:** add chat / message components for note taking ([#6940](https://github.com/Arize-ai/phoenix/issues/6940)) ([d3af052](https://github.com/Arize-ai/phoenix/commit/d3af052c2d26a4ee3d82014e7b16cb029518a16d))
* **ui:** select ([#6951](https://github.com/Arize-ai/phoenix/issues/6951)) ([beb9640](https://github.com/Arize-ai/phoenix/commit/beb964007e355a00c5f5ccb20a47378a05232a9e))


### Performance Improvements

* Cache project table results when toggling details slide over ([#6973](https://github.com/Arize-ai/phoenix/issues/6973)) ([bd1f5db](https://github.com/Arize-ai/phoenix/commit/bd1f5db938b48b976f884aa4c51335b2a3c993f3))

## [8.20.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.19.1...arize-phoenix-v8.20.0) (2025-03-28)


### Features

* **UI:** use icon only buttons in span details when view is small ([#6931](https://github.com/Arize-ai/phoenix/issues/6931)) ([258aa5b](https://github.com/Arize-ai/phoenix/commit/258aa5bcce15a0773fd1ef921223dc96a086969c))


### Bug Fixes

* **perf:** disable streaming when dialog is open ([#6936](https://github.com/Arize-ai/phoenix/issues/6936)) ([f5510bd](https://github.com/Arize-ai/phoenix/commit/f5510bdf5a60fdb1affece91a4787691f284828d))
* Remove unpredictable playground transformations ([#6914](https://github.com/Arize-ai/phoenix/issues/6914)) ([7ff1dbc](https://github.com/Arize-ai/phoenix/commit/7ff1dbc84fe1c3421a1a9d0cfe486f8121eeabb7))
* use CTE for orphan span query ([#6939](https://github.com/Arize-ai/phoenix/issues/6939)) ([977b3f2](https://github.com/Arize-ai/phoenix/commit/977b3f2501d2ae267465aad8dd98af6b746eb35c))


### Documentation

* Update stories.mdc ([8ac711b](https://github.com/Arize-ai/phoenix/commit/8ac711b14cc42492b1d4a89b61f82336706b964f))

## [8.19.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.19.0...arize-phoenix-v8.19.1) (2025-03-25)


### Bug Fixes

* **perf:** add a toggle to treat orphans as root ([#6922](https://github.com/Arize-ai/phoenix/issues/6922)) ([2aa65b3](https://github.com/Arize-ai/phoenix/commit/2aa65b3f522f028b04843b69f538256325e02df5))
* Prevent toggle button text from wrapping ([#6909](https://github.com/Arize-ai/phoenix/issues/6909)) ([7298c8d](https://github.com/Arize-ai/phoenix/commit/7298c8d64a9d5f75f93e00583239a7317e34bf4d))

## [8.19.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.18.0...arize-phoenix-v8.19.0) (2025-03-25)


### Features

* **tracing:** add a config tab ([#6857](https://github.com/Arize-ai/phoenix/issues/6857)) ([65f5cfa](https://github.com/Arize-ai/phoenix/commit/65f5cfaf9606107f8a818bd19e0749f03546147d))
* Upgrade react-router, vite, vitest ([#6896](https://github.com/Arize-ai/phoenix/issues/6896)) ([3e9dc43](https://github.com/Arize-ai/phoenix/commit/3e9dc43bcc686e8ff3d57a028a9fcc15f3935490))


### Bug Fixes

* Rename missing import ([#6901](https://github.com/Arize-ai/phoenix/issues/6901)) ([28d03ed](https://github.com/Arize-ai/phoenix/commit/28d03edfb3bcb5f493c9695c5f85c61b1874d345))
* use correlated subquery for orphan spans ([#6904](https://github.com/Arize-ai/phoenix/issues/6904)) ([6ac67b6](https://github.com/Arize-ai/phoenix/commit/6ac67b6e6e35c14573a43bf2347294f8c236400e))

## [8.18.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.17.1...arize-phoenix-v8.18.0) (2025-03-22)


### Features

* **ui:** use skeleton loader ([#6891](https://github.com/Arize-ai/phoenix/issues/6891)) ([4ac4373](https://github.com/Arize-ai/phoenix/commit/4ac4373138d12e1f95571f9376c52cf6a577a4e1))

## [8.17.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.17.0...arize-phoenix-v8.17.1) (2025-03-21)


### Bug Fixes

* **annotations:** show metadata ([#6886](https://github.com/Arize-ai/phoenix/issues/6886)) ([435d139](https://github.com/Arize-ai/phoenix/commit/435d1399e8f311a83d1f0609e4ed863f5e35d9ce))
* **feedback:** show full metadata ([#6887](https://github.com/Arize-ai/phoenix/issues/6887)) ([a0fbd15](https://github.com/Arize-ai/phoenix/commit/a0fbd15350e5c34298cccebdca33fda55355f1e3))
* Improve performance on projects page ([#6847](https://github.com/Arize-ai/phoenix/issues/6847)) ([e8c4e23](https://github.com/Arize-ai/phoenix/commit/e8c4e236a6df59ef8d95a70fafaba176c8cd3416))
* **UI:** close time selector on duplicate selection ([#6882](https://github.com/Arize-ai/phoenix/issues/6882)) ([822bc39](https://github.com/Arize-ai/phoenix/commit/822bc391cf7ce9d9f62a68cb10a51a76f8134da5))

## [8.17.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.16.0...arize-phoenix-v8.17.0) (2025-03-21)


### Features

* environment variable for inserting admin users at startup ([#6851](https://github.com/Arize-ai/phoenix/issues/6851)) ([77bd4f0](https://github.com/Arize-ai/phoenix/commit/77bd4f0e260a085932f73b67acbbf86c6a9902ae))
* **perf:** smaller page sizes ([#6858](https://github.com/Arize-ai/phoenix/issues/6858)) ([7b529f7](https://github.com/Arize-ai/phoenix/commit/7b529f73b5a32a4ae5b29d1f917e3003c50aff24))


### Bug Fixes

* Allow hover anywhere on experiment cell ([#6865](https://github.com/Arize-ai/phoenix/issues/6865)) ([2ec2a17](https://github.com/Arize-ai/phoenix/commit/2ec2a173693dc59d8de9c1293e292990571b9dbd))
* Remove sticky project nav history ([#6867](https://github.com/Arize-ai/phoenix/issues/6867)) ([d4adb44](https://github.com/Arize-ai/phoenix/commit/d4adb443c03dc33918255820ac68f6f8660700e3))

## [8.16.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.15.0...arize-phoenix-v8.16.0) (2025-03-20)


### Features

* add delete experiment to action menu ([#6754](https://github.com/Arize-ai/phoenix/issues/6754)) ([b6b1181](https://github.com/Arize-ai/phoenix/commit/b6b11812a1f9b4e56e73e7f5761f31441fffb2f1))
* **ui:** show the date format in the explanation ([#6848](https://github.com/Arize-ai/phoenix/issues/6848)) ([4235cc1](https://github.com/Arize-ai/phoenix/commit/4235cc1a9967790cab55c98572964b414c2ae763))

## [8.15.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.14.1...arize-phoenix-v8.15.0) (2025-03-19)


### Features

* add integrations ([#6844](https://github.com/Arize-ai/phoenix/issues/6844)) ([6e3983e](https://github.com/Arize-ai/phoenix/commit/6e3983e120cc6b2dabb5b45cba508d22af5f5e44))


### Bug Fixes

* temporarily stop grouping by table names in db stats for SQLite ([#6846](https://github.com/Arize-ai/phoenix/issues/6846)) ([2d29236](https://github.com/Arize-ai/phoenix/commit/2d29236b0fa6d843ec38956800d078fa59cf8e8b))
* **ui:** cleanup query block ([#6835](https://github.com/Arize-ai/phoenix/issues/6835)) ([5225361](https://github.com/Arize-ai/phoenix/commit/52253613ec201931549fbddebff7be27d4174ebc))

## [8.14.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.14.0...arize-phoenix-v8.14.1) (2025-03-18)


### Bug Fixes

* remove shadow on button group ([#6819](https://github.com/Arize-ai/phoenix/issues/6819)) ([3bfd6b1](https://github.com/Arize-ai/phoenix/commit/3bfd6b14394e38c2f6b6fd83ae164bb15e4ebf1f))
* styles for markdown ([#6831](https://github.com/Arize-ai/phoenix/issues/6831)) ([29273dc](https://github.com/Arize-ai/phoenix/commit/29273dc0effcd600c017ab6d951c82232230018b))
* **ui:** broken popovers ([#6830](https://github.com/Arize-ai/phoenix/issues/6830)) ([7eeccb0](https://github.com/Arize-ai/phoenix/commit/7eeccb0604d532fbaa67a54213e12afdf1579f7b))

## [8.14.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.13.2...arize-phoenix-v8.14.0) (2025-03-18)


### Features

* Add resize capability to Span, Trace, and Session table ([#6796](https://github.com/Arize-ai/phoenix/issues/6796)) ([80a8b64](https://github.com/Arize-ai/phoenix/commit/80a8b6430b08d2bc2bf6dd46074efdf733cda8a3))
* Split settings page into tabs ([#6792](https://github.com/Arize-ai/phoenix/issues/6792)) ([187c857](https://github.com/Arize-ai/phoenix/commit/187c857dc0fbd692ebadea740f763ac3bb19deac))


### Bug Fixes

* **langgraph:** don't aggregate status ([#6814](https://github.com/Arize-ai/phoenix/issues/6814)) ([483a6bc](https://github.com/Arize-ai/phoenix/commit/483a6bcb35b903e7b093cf3db634dd370beff86d))
* resolve codemirror duplicate package issue ([#6817](https://github.com/Arize-ai/phoenix/issues/6817)) ([c0b60a9](https://github.com/Arize-ai/phoenix/commit/c0b60a911da4efb495995d72572274f79745595c))


### Documentation

* add agents sdk to readme ([#6810](https://github.com/Arize-ai/phoenix/issues/6810)) ([860778c](https://github.com/Arize-ai/phoenix/commit/860778c41c7cb1dded9e119343030e6b43b719b0))
* add beeai to readme ([#6811](https://github.com/Arize-ai/phoenix/issues/6811)) ([c9442e0](https://github.com/Arize-ai/phoenix/commit/c9442e081f10013cac592ad1a467530394fb71a3))
* remove gif for now ([753c1a9](https://github.com/Arize-ai/phoenix/commit/753c1a9b53e2931165425a03a54ca1faa596af87))
* Remove the featurs list ([b5a2d57](https://github.com/Arize-ai/phoenix/commit/b5a2d574678903b54893be327ee22b75543976ee))

## [8.13.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.13.1...arize-phoenix-v8.13.2) (2025-03-17)


### Bug Fixes

* make azure api key optional for playground ([#6788](https://github.com/Arize-ai/phoenix/issues/6788)) ([4d34d86](https://github.com/Arize-ai/phoenix/commit/4d34d86b069e0a511ec2b37d2ae984e014c726f7))
* **onboarding:** add space between link and text in new project guide ([#6781](https://github.com/Arize-ai/phoenix/issues/6781)) ([0250610](https://github.com/Arize-ai/phoenix/commit/02506102fb049c8bfd46fccd88bcc397d8e4121a))

## [8.13.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.13.0...arize-phoenix-v8.13.1) (2025-03-14)


### Bug Fixes

* **ui:** heading size ([#6776](https://github.com/Arize-ai/phoenix/issues/6776)) ([f4a2505](https://github.com/Arize-ai/phoenix/commit/f4a2505aff159e472e4db8c446078a93602dcbbf))

## [8.13.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.12.1...arize-phoenix-v8.13.0) (2025-03-14)


### Features

* **components:** Add react-aria Tabs components ([#6771](https://github.com/Arize-ai/phoenix/issues/6771)) ([374fa66](https://github.com/Arize-ai/phoenix/commit/374fa66c9e0990f0aafbd59dceff939d1e9751ab))
* download experiment runs and annotations as csv ([#6749](https://github.com/Arize-ai/phoenix/issues/6749)) ([305f10b](https://github.com/Arize-ai/phoenix/commit/305f10b28dc73b7468b9795bb834e6ff6e61e377))
* **perf:** make the spans table the default tab ([#6756](https://github.com/Arize-ai/phoenix/issues/6756)) ([99d56c6](https://github.com/Arize-ai/phoenix/commit/99d56c64a23566ada3be0234bf5c4c0a65202062))
* **trace:** move info out of side ([#6773](https://github.com/Arize-ai/phoenix/issues/6773)) ([be4732c](https://github.com/Arize-ai/phoenix/commit/be4732c4d5a2312c5122b3585a4340c0b7757fb7))


### Bug Fixes

* **playground:** ai message size ([#6775](https://github.com/Arize-ai/phoenix/issues/6775)) ([a0adba8](https://github.com/Arize-ai/phoenix/commit/a0adba8e4fbe6a77cb18aa1b723a3f444d14cf8d))
* Tighten padding and height tolerances for Slider component ([#6770](https://github.com/Arize-ai/phoenix/issues/6770)) ([7194f34](https://github.com/Arize-ai/phoenix/commit/7194f348460640fc393940b6a7e2de5a065eba55))
* **ui:** annotation button color ([#6765](https://github.com/Arize-ai/phoenix/issues/6765)) ([800633f](https://github.com/Arize-ai/phoenix/commit/800633f9e153937d93fea11a98754b1ba1c86fd5))

## [8.12.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.12.0...arize-phoenix-v8.12.1) (2025-03-08)


### Bug Fixes

* be more careful about metadata structure ([#6750](https://github.com/Arize-ai/phoenix/issues/6750)) ([86a4a0e](https://github.com/Arize-ai/phoenix/commit/86a4a0e5d5a68301a68442bad21abed88dcfcbfc))

## [8.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.11.0...arize-phoenix-v8.12.0) (2025-03-08)


### Features

* **ui:** high contrast ui ([#6718](https://github.com/Arize-ai/phoenix/issues/6718)) ([faa0777](https://github.com/Arize-ai/phoenix/commit/faa0777d204794e871922869d65f1eafcb1527fc))


### Bug Fixes

* add `none` as option for tool choice for anthropic 0.49.0 ([#6740](https://github.com/Arize-ai/phoenix/issues/6740)) ([825915c](https://github.com/Arize-ai/phoenix/commit/825915c89b401b8b4911c9a75983273c821da8af))
* add annotations to experiment json download ([#6744](https://github.com/Arize-ai/phoenix/issues/6744)) ([14005dc](https://github.com/Arize-ai/phoenix/commit/14005dce4c9b62ee160a3cb8af79232730ff3338))
* apply constraints related to extended thinking on anthropic invocation parameters ([#6738](https://github.com/Arize-ai/phoenix/issues/6738)) ([6e50edf](https://github.com/Arize-ai/phoenix/commit/6e50edfb1f2992054fb1a026ef88844123b3b9bc))

## [8.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.10.0...arize-phoenix-v8.11.0) (2025-03-07)


### Features

* Port slider component to react-aria ([#6719](https://github.com/Arize-ai/phoenix/issues/6719)) ([5b61fc4](https://github.com/Arize-ai/phoenix/commit/5b61fc47b589de05670388edce4fe8b75485afa7))
* Specialized UI for thinking budget parameter ([#6726](https://github.com/Arize-ai/phoenix/issues/6726)) ([86054c3](https://github.com/Arize-ai/phoenix/commit/86054c350f6f682c31d39af0c717e45678709e64))


### Bug Fixes

* typo in variable reference ([#6727](https://github.com/Arize-ai/phoenix/issues/6727)) ([33f3f21](https://github.com/Arize-ai/phoenix/commit/33f3f217146b07fee699cbc5d36233b7ea21fa7a))

## [8.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.9.0...arize-phoenix-v8.10.0) (2025-03-06)


### Features

* **admin:** show percent used of DB ([#6722](https://github.com/Arize-ai/phoenix/issues/6722)) ([9812d2e](https://github.com/Arize-ai/phoenix/commit/9812d2e2b507ff8641f24ab6072b8b2799f225a7))
* delete selected traces ([#6681](https://github.com/Arize-ai/phoenix/issues/6681)) ([5a2e4b6](https://github.com/Arize-ai/phoenix/commit/5a2e4b64cffb56d92ffbbcff71c2a1441197315d))


### Bug Fixes

* add model validator for template type ([#6475](https://github.com/Arize-ai/phoenix/issues/6475)) ([4d3a1bc](https://github.com/Arize-ai/phoenix/commit/4d3a1bc838d90cc0ffc41ede4c78070e53efd1c9))
* ensure type is correct on run_experiment ([#6708](https://github.com/Arize-ai/phoenix/issues/6708)) ([995cb50](https://github.com/Arize-ai/phoenix/commit/995cb506a8a6aafa05dc99c779ef9b1de20dc4f3))
* ignore top_p if extended thinking is enabled for playground ([#6720](https://github.com/Arize-ai/phoenix/issues/6720)) ([7549f11](https://github.com/Arize-ai/phoenix/commit/7549f1101975e83a08fe872b3fcb5fe91065cff9))
* update strawberry ([#6716](https://github.com/Arize-ai/phoenix/issues/6716)) ([9dd5195](https://github.com/Arize-ai/phoenix/commit/9dd5195205f15fb75eee2c2fbf075371d02a962d))

## [8.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.8.0...arize-phoenix-v8.9.0) (2025-03-06)


### Features

* add anthropic thinking config param for python client ([#6659](https://github.com/Arize-ai/phoenix/issues/6659)) ([d03d57e](https://github.com/Arize-ai/phoenix/commit/d03d57e0efaedcba4731caa18b74db35f9b104f1))
* add environment variable for allocated DB storage capacity in gibibytes ([#6664](https://github.com/Arize-ai/phoenix/issues/6664)) ([0161333](https://github.com/Arize-ai/phoenix/commit/016133315d65e624160150339fcd4e0320712199))
* Add thinking budget invocation parameter ([#6670](https://github.com/Arize-ai/phoenix/issues/6670)) ([8edd118](https://github.com/Arize-ai/phoenix/commit/8edd11857a082e0e5581ef30300e5a90c1ec1676))
* **components:** ToggleButton ([#6679](https://github.com/Arize-ai/phoenix/issues/6679)) ([f062960](https://github.com/Arize-ai/phoenix/commit/f062960cf43fa34f80a290b6ef2f1a6a052d4d6d))
* experiment json downloads ([#6642](https://github.com/Arize-ai/phoenix/issues/6642)) ([3cf20bf](https://github.com/Arize-ai/phoenix/commit/3cf20bfd44614e31c966f5a70041346b9641f5e8))
* **traces:** make trace tree more readable on smaller sizes ([#6665](https://github.com/Arize-ai/phoenix/issues/6665)) ([04c72d4](https://github.com/Arize-ai/phoenix/commit/04c72d4d5395c42443eb296a1a7d8e499bfd760b))


### Bug Fixes

* broken url from session to trace ([#6705](https://github.com/Arize-ai/phoenix/issues/6705)) ([d2d8edf](https://github.com/Arize-ai/phoenix/commit/d2d8edf7f00d907318ff20ed6ac2d425e39b6c47))
* respect read only mode for prompt mutations ([#6686](https://github.com/Arize-ai/phoenix/issues/6686)) ([a988a38](https://github.com/Arize-ai/phoenix/commit/a988a38af3ea83efbddda607b75527aad3981d7e))


### Documentation

* update python developer guide to use tox ([#6637](https://github.com/Arize-ai/phoenix/issues/6637)) ([922aa3d](https://github.com/Arize-ai/phoenix/commit/922aa3daa79e4f1f73447b8e9e6eed48d66bad14))

## [8.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.7.0...arize-phoenix-v8.8.0) (2025-03-01)


### Features

* Implement quick filtering support for metadata cells in trace table ([#6623](https://github.com/Arize-ai/phoenix/issues/6623)) ([fe8b0b0](https://github.com/Arize-ai/phoenix/commit/fe8b0b094469d6c68d59bfb3983c18f1215d79e1))


### Documentation

* Update README.md with smolagents ([97cc3c7](https://github.com/Arize-ai/phoenix/commit/97cc3c70da85fe91b3dae918d5e7e6e0ad7fdfdb))

## [8.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.6.1...arize-phoenix-v8.7.0) (2025-02-28)


### Features

* **components:** Add Token component ([#6596](https://github.com/Arize-ai/phoenix/issues/6596)) ([c4bc506](https://github.com/Arize-ai/phoenix/commit/c4bc5067e31b37e36b76843e6efdf7c538ebb786))
* **playground:** add gpt-4.5-preview ([#6629](https://github.com/Arize-ai/phoenix/issues/6629)) ([955ae61](https://github.com/Arize-ai/phoenix/commit/955ae6181a7ae290f475d7acf88b0e2b57fa6335))
* **traces:** root only filter ([#6624](https://github.com/Arize-ai/phoenix/issues/6624)) ([c696564](https://github.com/Arize-ai/phoenix/commit/c6965647996c4011f44a765b3d7b33af6a6437af))
* Upgrade relay packages ([#6620](https://github.com/Arize-ai/phoenix/issues/6620)) ([5aad5ec](https://github.com/Arize-ai/phoenix/commit/5aad5ec1a7f0c8ae05374ce03d071913763576dd))

## [8.6.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.6.0...arize-phoenix-v8.6.1) (2025-02-27)


### Bug Fixes

* Improve performance on project tables ([#6616](https://github.com/Arize-ai/phoenix/issues/6616)) ([d972f65](https://github.com/Arize-ai/phoenix/commit/d972f6560a56035df17a4dba1f469ecb5c5585d1))

## [8.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.5.0...arize-phoenix-v8.6.0) (2025-02-27)


### Features

* **perf:** show + n more spans in traces table ([#6607](https://github.com/Arize-ai/phoenix/issues/6607)) ([f803ea5](https://github.com/Arize-ai/phoenix/commit/f803ea508ee47d7e8be8107ff7a400be8a8e5bb0))

## [8.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.4.1...arize-phoenix-v8.5.0) (2025-02-27)


### Features

* **graphql:** query to get number of spans for each trace ([#6599](https://github.com/Arize-ai/phoenix/issues/6599)) ([45e7352](https://github.com/Arize-ai/phoenix/commit/45e7352fccb18113394f5a46ddbf0949b2989147))


### Bug Fixes

* return float instead of int for numBytes in DbTableStats ([#6605](https://github.com/Arize-ai/phoenix/issues/6605)) ([705dee4](https://github.com/Arize-ai/phoenix/commit/705dee4bcddefe498d5acf578cb9d918a6cc9fe7))
* **ui:** span status on the left of table ([#6600](https://github.com/Arize-ai/phoenix/issues/6600)) ([1ed1f54](https://github.com/Arize-ai/phoenix/commit/1ed1f5488bbbdc24facef094931ca604de2cdc9d))

## [8.4.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.4.0...arize-phoenix-v8.4.1) (2025-02-26)


### Bug Fixes

* **performance:** limit depth (defaults to 3) on descendant spans query ([#6578](https://github.com/Arize-ai/phoenix/issues/6578)) ([e2facc3](https://github.com/Arize-ai/phoenix/commit/e2facc3f39d6808b4f095452355057405e7592d5))

## [8.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.3.0...arize-phoenix-v8.4.0) (2025-02-26)


### Features

* **admin:** introspection into DB usage ([#6582](https://github.com/Arize-ai/phoenix/issues/6582)) ([94c2fd4](https://github.com/Arize-ai/phoenix/commit/94c2fd4bf7030a4720a26d8ddc6701a29f04364f))
* graphql query for number of child spans ([#6580](https://github.com/Arize-ai/phoenix/issues/6580)) ([9ea38e4](https://github.com/Arize-ai/phoenix/commit/9ea38e43fae88bab96dd750e08b74517a56c2fda))
* graphql query to get byte size of each db table ([#6560](https://github.com/Arize-ai/phoenix/issues/6560)) ([66586a8](https://github.com/Arize-ai/phoenix/commit/66586a878a84a2d5bc04271894d5da9574e0dcae))
* Persist project table column selections ([#6572](https://github.com/Arize-ai/phoenix/issues/6572)) ([c2e40d3](https://github.com/Arize-ai/phoenix/commit/c2e40d3d791f97bbd068cff12f2936e5dde05dac))


### Bug Fixes

* **perf:** remove double fetching of spans ([#6571](https://github.com/Arize-ai/phoenix/issues/6571)) ([e26d08c](https://github.com/Arize-ai/phoenix/commit/e26d08cc290348db2f46e05170095e75546320f1))
* **ui:** fix lack of scrolling on trace tree ([#6575](https://github.com/Arize-ai/phoenix/issues/6575)) ([e38b0ff](https://github.com/Arize-ai/phoenix/commit/e38b0fff1c799f431a406dc4336d0ec30fdf800b))


### Documentation

* **prompts:** promote prompt managemt ([c3e13e8](https://github.com/Arize-ai/phoenix/commit/c3e13e87d87d30972a9384a44172794c572e2a8b))

## [8.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.2.2...arize-phoenix-v8.3.0) (2025-02-24)


### Features

* **client:** typedoc docs gen for phoenix-client ([#6504](https://github.com/Arize-ai/phoenix/issues/6504)) ([14a2730](https://github.com/Arize-ai/phoenix/commit/14a27305d72e152742c81a1cf31cbe87e56e350d))


### Bug Fixes

* Add max_completion_tokens to openai param validation ([#6550](https://github.com/Arize-ai/phoenix/issues/6550)) ([c99ee6f](https://github.com/Arize-ai/phoenix/commit/c99ee6fe69bc0ebde8d0fe018044f796142fcdc9))
* remove unused span annotations in span details query ([#6544](https://github.com/Arize-ai/phoenix/issues/6544)) ([f097568](https://github.com/Arize-ai/phoenix/commit/f097568b06adb645e2bb5fec446cc3374397f867))
* sort root spans in trace details ([#6548](https://github.com/Arize-ai/phoenix/issues/6548)) ([ffcfc2c](https://github.com/Arize-ai/phoenix/commit/ffcfc2c59c9551adbb55fb5649cba8f38156c222))
* update playground for anthropic 0.47 ([#6553](https://github.com/Arize-ai/phoenix/issues/6553)) ([bc63e28](https://github.com/Arize-ai/phoenix/commit/bc63e28bf5153b7c593db4a1650da970557c48a3))

## [8.2.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.2.1...arize-phoenix-v8.2.2) (2025-02-24)


### Bug Fixes

* don't flex the trace tree toolbar ([#6513](https://github.com/Arize-ai/phoenix/issues/6513)) ([c557af5](https://github.com/Arize-ai/phoenix/commit/c557af5733eabf0b0c5088087b9c856c63489ff7))
* **graphql:** return None for null input output values on spans  ([#6537](https://github.com/Arize-ai/phoenix/issues/6537)) ([1b735c0](https://github.com/Arize-ai/phoenix/commit/1b735c0993f76d39686206106f77f5e1c7d0165e))

## [8.2.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.2.0...arize-phoenix-v8.2.1) (2025-02-22)


### Bug Fixes

* suppress token icons in trace tree when count is zero ([#6511](https://github.com/Arize-ai/phoenix/issues/6511)) ([0ccbdd7](https://github.com/Arize-ai/phoenix/commit/0ccbdd75d4653fe2ede1bcfb76a8800f3492bfe1))
* wrap annotation summaries in an error boundary ([#6510](https://github.com/Arize-ai/phoenix/issues/6510)) ([e21f665](https://github.com/Arize-ai/phoenix/commit/e21f665afb526f8e90062a5a4bcbc17fe0e264e8))

## [8.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.1.0...arize-phoenix-v8.2.0) (2025-02-21)


### Features

* **performance:** don't fetch new traces when the traces slideover is visible ([#6482](https://github.com/Arize-ai/phoenix/issues/6482)) ([21ca64b](https://github.com/Arize-ai/phoenix/commit/21ca64be24c3b069478e714d0d6a1936e54aa761))


### Bug Fixes

* handle nan in annotation score for graphql ([#6506](https://github.com/Arize-ai/phoenix/issues/6506)) ([663ba4e](https://github.com/Arize-ai/phoenix/commit/663ba4e014e1966858dd1e75441c9704633d6846))
* **performance:** add graphql dataloaders for all fields in Span(Node) ([#6490](https://github.com/Arize-ai/phoenix/issues/6490)) ([d96162a](https://github.com/Arize-ai/phoenix/commit/d96162a3c43e82a6abb1d6c87ad0687121efd9bc))

## [8.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.0.1...arize-phoenix-v8.1.0) (2025-02-20)


### Features

* Allow configuration of postgres username/password/db/host using standard env vars ([#6422](https://github.com/Arize-ai/phoenix/issues/6422)) ([b8641bc](https://github.com/Arize-ai/phoenix/commit/b8641bc3e6b815b2d2f4b311ab482b3b07710201))


### Bug Fixes

* remove jsonschema dependency ([#6473](https://github.com/Arize-ai/phoenix/issues/6473)) ([bd77b99](https://github.com/Arize-ai/phoenix/commit/bd77b99df63bcb86a18415620ced709c7558fb8c))

## [8.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v8.0.0...arize-phoenix-v8.0.1) (2025-02-20)


### Bug Fixes

* also reject on template_type ([#6468](https://github.com/Arize-ai/phoenix/issues/6468)) ([02a9668](https://github.com/Arize-ai/phoenix/commit/02a966838b824a0845b54ed72b5c19a916d1c7fb))


### Documentation

* Update README.md ([ab40e23](https://github.com/Arize-ai/phoenix/commit/ab40e238cc095781089dae8b562fa025384878a7))

## [8.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.12.3...arize-phoenix-v8.0.0) (2025-02-19)


### Features

* Add `previous_version` resolver on `PromptVersion` ([#5933](https://github.com/Arize-ai/phoenix/issues/5933)) ([d7dfe70](https://github.com/Arize-ai/phoenix/commit/d7dfe70fbd4a83c5df042c5d31c57c6e19cbb6d1))
* Add delete Prompt and delete PromptVersionTag mutations ([#5935](https://github.com/Arize-ai/phoenix/issues/5935)) ([caa8b69](https://github.com/Arize-ai/phoenix/commit/caa8b69cb4a576fb4a100ca0810df1a10a8af547))
* Add GET /prompts route to REST API ([#6071](https://github.com/Arize-ai/phoenix/issues/6071)) ([69cf199](https://github.com/Arize-ai/phoenix/commit/69cf199fcb61505d31f80ea9cf4d3e85d0730aa3))
* Add label color and version metadata ([#6145](https://github.com/Arize-ai/phoenix/issues/6145)) ([200ce72](https://github.com/Arize-ai/phoenix/commit/200ce7288e1f86e3c631bf25234ccc5f0feb54a2))
* Add patchPromptDescription mutation ([#6025](https://github.com/Arize-ai/phoenix/issues/6025)) ([fc37a4c](https://github.com/Arize-ai/phoenix/commit/fc37a4c2264f78e6d2b8f2bfb9e74cfd6a1bb117))
* Add Prompt to setPromptVersionTag mutation ([#6010](https://github.com/Arize-ai/phoenix/issues/6010)) ([f0c0e7f](https://github.com/Arize-ai/phoenix/commit/f0c0e7fe3a384a2d6b7f08d5d119c3f198d8905d))
* Add prompt verions REST route `/prompts/{id}/versions` ([#6098](https://github.com/Arize-ai/phoenix/issues/6098)) ([87ecece](https://github.com/Arize-ai/phoenix/commit/87ecece658da66c75ea487fed89d66d02ccbc31c))
* Add prompthub models migration ([#5745](https://github.com/Arize-ai/phoenix/issues/5745)) ([f86e75d](https://github.com/Arize-ai/phoenix/commit/f86e75d8c342689f3519a42eeebcaa68c9f00c77))
* Add PromptTemplate type ([#5787](https://github.com/Arize-ai/phoenix/issues/5787)) ([b848ae3](https://github.com/Arize-ai/phoenix/commit/b848ae37f5932c38bb1edc83deb6e537934ecba7))
* Add PromptTemplate type ([#5787](https://github.com/Arize-ai/phoenix/issues/5787)) ([7221d79](https://github.com/Arize-ai/phoenix/commit/7221d7927eed1f5665427c27ee8ee73f930ae5b2))
* Add SetPromptVersionTag mutation ([#5912](https://github.com/Arize-ai/phoenix/issues/5912)) ([15a0732](https://github.com/Arize-ai/phoenix/commit/15a0732ba365a121415f5d0f36b8089c0505d7be))
* Add tags with prompt version create ([#6147](https://github.com/Arize-ai/phoenix/issues/6147)) ([8159ab1](https://github.com/Arize-ai/phoenix/commit/8159ab1c553c9891efd13d5fed8a5d1f100504be))
* **components:** date and time fields ([#6036](https://github.com/Arize-ai/phoenix/issues/6036)) ([369ae43](https://github.com/Arize-ai/phoenix/commit/369ae4357521912264096c1dfc403c539226eec2))
* **components:** Link button ([#6219](https://github.com/Arize-ai/phoenix/issues/6219)) ([2c1cc9a](https://github.com/Arize-ai/phoenix/commit/2c1cc9a932187eba62eb13998f78fa279af6b55b))
* **components:** Port RadioGroup and ToggleButtonGroup from react aria ([#6143](https://github.com/Arize-ai/phoenix/issues/6143)) ([2d1c3bb](https://github.com/Arize-ai/phoenix/commit/2d1c3bbd500763daafb009357b4be9c56130c064))
* **components:** time range form ([#6156](https://github.com/Arize-ai/phoenix/issues/6156)) ([1ad372b](https://github.com/Arize-ai/phoenix/commit/1ad372b2da75ba27e20a002d06db82eb63edff9b))
* Name experiments after prompts ([#6288](https://github.com/Arize-ai/phoenix/issues/6288)) ([5315dc5](https://github.com/Arize-ai/phoenix/commit/5315dc5d107cca5bfe313013e92db3fb8e01bd2f))
* **playground:** hotkey to run the playground ([#6326](https://github.com/Arize-ai/phoenix/issues/6326)) ([d717cbd](https://github.com/Arize-ai/phoenix/commit/d717cbd40851c42d4569aebbb2476a3f83790ded))
* PromptLabel gql interface ([#6100](https://github.com/Arize-ai/phoenix/issues/6100)) ([61013c3](https://github.com/Arize-ai/phoenix/commit/61013c3d9e540669eeb3c63caa89c69a7d86d289))
* **prompts:** Add "Clone Prompt" flow to prompts UI ([#5993](https://github.com/Arize-ai/phoenix/issues/5993)) ([3649cea](https://github.com/Arize-ai/phoenix/commit/3649cea5a79f3e81d66482a3e083761867b59b4f))
* **prompts:** Add Anthropic code snippets to prompt details ([#6341](https://github.com/Arize-ai/phoenix/issues/6341)) ([a02a171](https://github.com/Arize-ai/phoenix/commit/a02a1719cabcd9f86b75770a912aa7682372e31f))
* **prompts:** add client helpers for openai and anthropic prompts ([#6109](https://github.com/Arize-ai/phoenix/issues/6109)) ([4083257](https://github.com/Arize-ai/phoenix/commit/4083257aabcc371b465752bb6153ec1f4fbcba79))
* **prompts:** add code snippets using the phoenix-clients ([#6441](https://github.com/Arize-ai/phoenix/issues/6441)) ([3fd8296](https://github.com/Arize-ai/phoenix/commit/3fd8296ea2cbbe165afb60f1f7f8e11e7d48493c))
* **prompts:** add description, last updated at to the prompts table ([#6294](https://github.com/Arize-ai/phoenix/issues/6294)) ([f27d619](https://github.com/Arize-ai/phoenix/commit/f27d619354a0e5174a4dd49074f9d34e980c73b2))
* **prompts:** add open in playground action button on the table ([#6185](https://github.com/Arize-ai/phoenix/issues/6185)) ([40af5f5](https://github.com/Arize-ai/phoenix/commit/40af5f52841f0e4bbeaa1c8526d0cb40b7a72aaf))
* **prompts:** Add prompt combobox to playground page + deeplink to prompt specific playground ([#5748](https://github.com/Arize-ai/phoenix/issues/5748)) ([7132620](https://github.com/Arize-ai/phoenix/commit/713262094931c6c89b9be6c8ebed95d8cbff4071))
* **prompts:** Add prompt combobox to playground page + deeplink to prompt specific playground ([#5748](https://github.com/Arize-ai/phoenix/issues/5748)) ([602c1c8](https://github.com/Arize-ai/phoenix/commit/602c1c82608b4497f640db65337eb792e740564d))
* **prompts:** add rule for identifier pattern on ui forms for prompt and tag names ([#6204](https://github.com/Arize-ai/phoenix/issues/6204)) ([9fb5812](https://github.com/Arize-ai/phoenix/commit/9fb58122e0f71904f6229f510480ab08fe49223e))
* **prompts:** add tool choice in openapi schema for python client sdk helpers ([#6291](https://github.com/Arize-ai/phoenix/issues/6291)) ([20c8bef](https://github.com/Arize-ai/phoenix/commit/20c8bef27adb7b0d6efafcf22c3189d3c29af973))
* **prompts:** Break message content into parts ([#6027](https://github.com/Arize-ai/phoenix/issues/6027)) ([28edde9](https://github.com/Arize-ai/phoenix/commit/28edde92afefb3aa3944830301980b723fe3474e))
* **prompts:** Convert from Prompt message schema to LLM Provider schema for code snippets ([#6132](https://github.com/Arize-ai/phoenix/issues/6132)) ([4a74ff1](https://github.com/Arize-ai/phoenix/commit/4a74ff1b5c20052aa52d94188922808fdec82283))
* **prompts:** Create new prompt and prompt versions from Playground ([#5914](https://github.com/Arize-ai/phoenix/issues/5914)) ([7dd42d1](https://github.com/Arize-ai/phoenix/commit/7dd42d16ae733962f3e9f4a99f76775c8540e04f))
* **prompts:** create prompt mutation ([#5812](https://github.com/Arize-ai/phoenix/issues/5812)) ([9ab4ec2](https://github.com/Arize-ai/phoenix/commit/9ab4ec24d36af37e625dc764a020025d99b534fc))
* **prompts:** create prompt version mutation ([#5901](https://github.com/Arize-ai/phoenix/issues/5901)) ([5934167](https://github.com/Arize-ai/phoenix/commit/5934167f54043860cf0f1e9e3fb124da572d8fb6))
* **prompts:** default tags for prod / staging / dev ([#5980](https://github.com/Arize-ai/phoenix/issues/5980)) ([b1232eb](https://github.com/Arize-ai/phoenix/commit/b1232ebbb6219aa9336ec3e9599065fa50d3410e))
* **prompts:** delete prompt ([#6073](https://github.com/Arize-ai/phoenix/issues/6073)) ([38ba41c](https://github.com/Arize-ai/phoenix/commit/38ba41c12c799524f50f19f4989b90b8c993c34a))
* **prompts:** Denormalize tool choice in playground ([#6301](https://github.com/Arize-ai/phoenix/issues/6301)) ([e4d7fea](https://github.com/Arize-ai/phoenix/commit/e4d7fea2334d712562e3c52802d471ad24c612e6))
* **prompts:** display author, tags, etc. in version list ([#6097](https://github.com/Arize-ai/phoenix/issues/6097)) ([fc5bbc7](https://github.com/Arize-ai/phoenix/commit/fc5bbc7056b7c59073b71841a2fc2a7837e680c9))
* **prompts:** Display basic LLM details on Prompt Details pages ([#6104](https://github.com/Arize-ai/phoenix/issues/6104)) ([4b3d070](https://github.com/Arize-ai/phoenix/commit/4b3d0709c9910d2b0decc0994c31deb81655ec40))
* **prompts:** Display dirty state on playground instance ([#5961](https://github.com/Arize-ai/phoenix/issues/5961)) ([8bbacde](https://github.com/Arize-ai/phoenix/commit/8bbacde4c88e7a32b39c61c0c53a08991914e714))
* **prompts:** display prompt vesion tags in the promt versions list ([#5875](https://github.com/Arize-ai/phoenix/issues/5875)) ([0896b8b](https://github.com/Arize-ai/phoenix/commit/0896b8b807dc085eda7bb76f3566d54aa7fddf05))
* **prompts:** display the cloned prompt in header ([#6225](https://github.com/Arize-ai/phoenix/issues/6225)) ([ffa9712](https://github.com/Arize-ai/phoenix/commit/ffa9712b1f7624f00496c9329c90a461a7af7de7))
* **prompts:** Display tool definitions on prompt page ([#5926](https://github.com/Arize-ai/phoenix/issues/5926)) ([bd7ca4f](https://github.com/Arize-ai/phoenix/commit/bd7ca4f355668b6d12fa2dbc6e0e51bccc8c3c9a))
* **prompts:** edit description ([#6319](https://github.com/Arize-ai/phoenix/issues/6319)) ([0ab8fa5](https://github.com/Arize-ai/phoenix/commit/0ab8fa57ea577b7be9129d60e58644125ecb976a))
* **prompts:** graphql types for tools, output_schema ([#5849](https://github.com/Arize-ai/phoenix/issues/5849)) ([8ffd22d](https://github.com/Arize-ai/phoenix/commit/8ffd22dbf866b91445f42d79063db9fb46d88d93))
* **prompts:** graphql types for tools, output_schema ([#5849](https://github.com/Arize-ai/phoenix/issues/5849)) ([95de1a1](https://github.com/Arize-ai/phoenix/commit/95de1a16b9e289adb4e3a1782c5221c6c9d61517))
* **prompts:** Implement prompts as code examples beneath prompt ([#5843](https://github.com/Arize-ai/phoenix/issues/5843)) ([360496b](https://github.com/Arize-ai/phoenix/commit/360496b5e3bc13c68e57c27fbf5d82041893f39c))
* **prompts:** Implement prompts as code examples beneath prompt ([#5843](https://github.com/Arize-ai/phoenix/issues/5843)) ([4ae84ab](https://github.com/Arize-ai/phoenix/commit/4ae84ab09fba11504860b1a7774e154264fbea79))
* **prompts:** Implement SavePromptForm for creating new prompts ([#5751](https://github.com/Arize-ai/phoenix/issues/5751)) ([ffe406b](https://github.com/Arize-ai/phoenix/commit/ffe406b189f2422940205851a4d230bb30534e34))
* **prompts:** Improve post-save prompt ux ([#6093](https://github.com/Arize-ai/phoenix/issues/6093)) ([97fadd1](https://github.com/Arize-ai/phoenix/commit/97fadd1f90cfdf19bb36fa520bddcd76cd7c7ac4))
* **prompts:** Load prompt into playground via url ([#5893](https://github.com/Arize-ai/phoenix/issues/5893)) ([3aea33c](https://github.com/Arize-ai/phoenix/commit/3aea33c4c9c14827cfa855b4567741c4e8ba3e9a))
* **prompts:** POST method for prompts endpoint ([#6347](https://github.com/Arize-ai/phoenix/issues/6347)) ([77eab0c](https://github.com/Arize-ai/phoenix/commit/77eab0cc3251a0f50c077149d985a87cadb2d0f8))
* **prompts:** preview of last 5 versions ([#5837](https://github.com/Arize-ai/phoenix/issues/5837)) ([d65ecfd](https://github.com/Arize-ai/phoenix/commit/d65ecfd7100919aacb79b3d9b0d65104bd5bd09f))
* **prompts:** prompt version tags config ([#5948](https://github.com/Arize-ai/phoenix/issues/5948)) ([6ef923a](https://github.com/Arize-ai/phoenix/commit/6ef923aeae4c81c7b2e3d381a44a2506566701fd))
* **prompts:** Render model invocation params in prompt details view ([#5780](https://github.com/Arize-ai/phoenix/issues/5780)) ([2384299](https://github.com/Arize-ai/phoenix/commit/2384299aa2bf480abaeac9b683389bde35f2130f))
* **prompts:** Render prompt messages on prompt detail view ([#5786](https://github.com/Arize-ai/phoenix/issues/5786)) ([5f4935d](https://github.com/Arize-ai/phoenix/commit/5f4935d25c932187fecfdcc69f56b17d7d27210d))
* **prompts:** Render prompt messages on prompt detail view ([#5786](https://github.com/Arize-ai/phoenix/issues/5786)) ([a840d5d](https://github.com/Arize-ai/phoenix/commit/a840d5d9b20a1f83f6b1a7b1e84840540c1b124c))
* **prompts:** REST endpoint to get prompt version by prompt version ID ([#5915](https://github.com/Arize-ai/phoenix/issues/5915)) ([be6a8e4](https://github.com/Arize-ai/phoenix/commit/be6a8e418c30dad06880db4a037861b328b999ff))
* **prompts:** REST endpoint to get prompt version by tag name ([#5907](https://github.com/Arize-ai/phoenix/issues/5907)) ([c355d5b](https://github.com/Arize-ai/phoenix/commit/c355d5bec5617caec55e1d7c9e0c1bacfab48100))
* **prompts:** REST endpoint to get the latest prompt version ([#6166](https://github.com/Arize-ai/phoenix/issues/6166)) ([77c2359](https://github.com/Arize-ai/phoenix/commit/77c23593fe962807f581a502dafb53e8d83fe5cb))
* **prompts:** rudimentary playwright tests for prompts ([#6356](https://github.com/Arize-ai/phoenix/issues/6356)) ([558cbe8](https://github.com/Arize-ai/phoenix/commit/558cbe86f14d22fb9c0d72532731f2a9d3c5a079))
* **prompts:** rudimentary prompt details page [#5741](https://github.com/Arize-ai/phoenix/issues/5741) ([#5752](https://github.com/Arize-ai/phoenix/issues/5752)) ([5455c4d](https://github.com/Arize-ai/phoenix/commit/5455c4d37e69bac35a7716af9999d0b7d3f52d26))
* **prompts:** rudimentary prompt details page [#5741](https://github.com/Arize-ai/phoenix/issues/5741) ([#5752](https://github.com/Arize-ai/phoenix/issues/5752)) ([87abfad](https://github.com/Arize-ai/phoenix/commit/87abfad9022c460cb994c643418b0a6c12c576ba))
* **prompts:** Save and display playground instances as multi-part content prompts ([#6084](https://github.com/Arize-ai/phoenix/issues/6084)) ([7f4d6bd](https://github.com/Arize-ai/phoenix/commit/7f4d6bddce067804246b24eff358b0fbde32b625))
* **prompts:** Save and load invocation parameters from/into playground ([#5942](https://github.com/Arize-ai/phoenix/issues/5942)) ([4e5503d](https://github.com/Arize-ai/phoenix/commit/4e5503dc6d88eb32b12cef8fe79368d029cdaaa4))
* **prompts:** Scaffold prompt versions tab / list ([#5766](https://github.com/Arize-ai/phoenix/issues/5766)) ([d2bccad](https://github.com/Arize-ai/phoenix/commit/d2bccad241b9ae003a1d037f336fc5751cb7d1e5))
* **prompts:** Scaffold prompt versions tab / list ([#5766](https://github.com/Arize-ai/phoenix/issues/5766)) ([75ec0ea](https://github.com/Arize-ai/phoenix/commit/75ec0ea58497584a9bc3ea898c53c4309488e0b6))
* **prompts:** show the tags that can be set on a promt version ([#5913](https://github.com/Arize-ai/phoenix/issues/5913)) ([0693932](https://github.com/Arize-ai/phoenix/commit/0693932528e90d0b6b5e438413fbe177df7855ce))
* **prompts:** show version timestamp ([#5911](https://github.com/Arize-ai/phoenix/issues/5911)) ([ea8f62a](https://github.com/Arize-ai/phoenix/commit/ea8f62aeb13bfe7b36dd899df35ceffec1535cc6))
* **prompts:** tool call definitions ([#5922](https://github.com/Arize-ai/phoenix/issues/5922)) ([e7549b5](https://github.com/Arize-ai/phoenix/commit/e7549b5ce4b834e3d4caf1605de7fb9150c99785))
* **prompts:** UI for setting tags ([#5937](https://github.com/Arize-ai/phoenix/issues/5937)) ([268092b](https://github.com/Arize-ai/phoenix/commit/268092be065e93c878e3c3ab9bb318d258c95989))
* **prompts:** update prompt version tags on set ([#5946](https://github.com/Arize-ai/phoenix/issues/5946)) ([eeba8cf](https://github.com/Arize-ai/phoenix/commit/eeba8cff219116f45f22a5da8543283f165b902a))
* **prompts:** use generative provider icon ([#6342](https://github.com/Arize-ai/phoenix/issues/6342)) ([8b4e935](https://github.com/Arize-ai/phoenix/commit/8b4e935aa55883f194f4b86665b54eb61a1d7790))
* **promts:** skeleton UI for promts ([#5726](https://github.com/Arize-ai/phoenix/issues/5726)) ([1071b13](https://github.com/Arize-ai/phoenix/commit/1071b13aa8fe5d1c518a75d39cf2d8aa74da4ba5))
* **promts:** skeleton UI for promts ([#5726](https://github.com/Arize-ai/phoenix/issues/5726)) ([f471dd0](https://github.com/Arize-ai/phoenix/commit/f471dd04705aecd349328d1ebb5e6a6f306c4952))
* Propagate prompt id to playground spans metadata ([#6224](https://github.com/Arize-ai/phoenix/issues/6224)) ([d819976](https://github.com/Arize-ai/phoenix/commit/d819976a9d29e7b5032875da43e085453294fb24))
* Replace dummy data and wire up connections to database ([#5854](https://github.com/Arize-ai/phoenix/issues/5854)) ([2a070a4](https://github.com/Arize-ai/phoenix/commit/2a070a493a80f2cbb3f00a22490d40e9039963c3))
* Resolve source prompts ([#6026](https://github.com/Arize-ai/phoenix/issues/6026)) ([20a257d](https://github.com/Arize-ai/phoenix/commit/20a257d8745f2f7a0e0f5ad205a58e918c960a3e))
* Resolve versions on Prompt ([#6033](https://github.com/Arize-ai/phoenix/issues/6033)) ([461278d](https://github.com/Arize-ai/phoenix/commit/461278df005291e9269067d93a046119aac537b6))
* Spike out dummy PromptVersion connection ([#5767](https://github.com/Arize-ai/phoenix/issues/5767)) ([f4608b1](https://github.com/Arize-ai/phoenix/commit/f4608b1a54d4d9ffc7c0fdbe6335dfb4d4a1e48e))
* time range selector ([#6214](https://github.com/Arize-ai/phoenix/issues/6214)) ([d3018e6](https://github.com/Arize-ai/phoenix/commit/d3018e6585b3a93f928b8282c656bde41844da26))


### Bug Fixes

* **components:** fix button size and variance props ([#6083](https://github.com/Arize-ai/phoenix/issues/6083)) ([502f5d2](https://github.com/Arize-ai/phoenix/commit/502f5d24255541a30825b6b5c2310cfee2e457f0))
* eliminate cartesian join ([#6353](https://github.com/Arize-ai/phoenix/issues/6353)) ([7aeefff](https://github.com/Arize-ai/phoenix/commit/7aeefff90bc20025c12cac6e810f778edb6222a1))
* get prompts route ([#6382](https://github.com/Arize-ai/phoenix/issues/6382)) ([9402dcd](https://github.com/Arize-ai/phoenix/commit/9402dcd2accbc8f7cc59986ecbebc7fd4ebe9477))
* login a11y via autocomplete ([#6360](https://github.com/Arize-ai/phoenix/issues/6360)) ([ffe048d](https://github.com/Arize-ai/phoenix/commit/ffe048d99b8db188a8bfce815fc63487f2ad1155))
* Manually check for conflicts in setPromptVersionTag mutation ([#5949](https://github.com/Arize-ai/phoenix/issues/5949)) ([5bb2909](https://github.com/Arize-ai/phoenix/commit/5bb2909a7d25fed0be49f13e3aa8713de2384ebb))
* missing slash in examples url printed after dataset upload ([#6378](https://github.com/Arize-ai/phoenix/issues/6378)) ([83ab853](https://github.com/Arize-ai/phoenix/commit/83ab853f8844c65accd0613ca7226e163b9fcb12))
* **prompts:** add sqlite_autoincrement for primary key on prompt_versions table ([#5810](https://github.com/Arize-ai/phoenix/issues/5810)) ([f7a9b86](https://github.com/Arize-ai/phoenix/commit/f7a9b86257f2a996da1e2f3b922a2a9179ded13c))
* **prompts:** add types for create prompt mutation input ([#5894](https://github.com/Arize-ai/phoenix/issues/5894)) ([dd3b8a9](https://github.com/Arize-ai/phoenix/commit/dd3b8a904f7759b2ae71f48c1d75ba8928e6bb64))
* **prompts:** Do not wipe playground response format when switching providers ([#6339](https://github.com/Arize-ai/phoenix/issues/6339)) ([1850332](https://github.com/Arize-ai/phoenix/commit/18503324c1758085345ad269865ac9d08d30dbab))
* **prompts:** drop support for pydantic v1 ([#6181](https://github.com/Arize-ai/phoenix/issues/6181)) ([9ac9fa5](https://github.com/Arize-ai/phoenix/commit/9ac9fa5a3a554fe37d836fa30adbb4498a30fe09))
* **prompts:** Fix code disclosure width on prompts ui ([#5904](https://github.com/Arize-ai/phoenix/issues/5904)) ([618908e](https://github.com/Arize-ai/phoenix/commit/618908edac9ba27943ec2e91db0c5621804b3bcf))
* **prompts:** fix regex validation logic so it shows up in the form ([#6228](https://github.com/Arize-ai/phoenix/issues/6228)) ([da654b8](https://github.com/Arize-ai/phoenix/commit/da654b8b0f8a6aa05e28d01c7e84498b7366aa29))
* **prompts:** Fix syntax highlighting in template editors ([#6377](https://github.com/Arize-ai/phoenix/issues/6377)) ([4c4017d](https://github.com/Arize-ai/phoenix/commit/4c4017d7b27ab924811df7a52985960c5e937b8c)), closes [#6374](https://github.com/Arize-ai/phoenix/issues/6374)
* **prompts:** Fix tool definition copy paste button ([#6350](https://github.com/Arize-ai/phoenix/issues/6350)) ([7997835](https://github.com/Arize-ai/phoenix/commit/7997835ab285507690cfd03f8dfb3895b1dbf737))
* **prompts:** Make playground page blocking less intrusive ([#6249](https://github.com/Arize-ai/phoenix/issues/6249)) ([81a2b77](https://github.com/Arize-ai/phoenix/commit/81a2b770dc641931b946624ef5d9ca018a53f1a5))
* **prompts:** make prompts and configuration collapsible ([#6303](https://github.com/Arize-ai/phoenix/issues/6303)) ([870aea6](https://github.com/Arize-ai/phoenix/commit/870aea6221a7caa7ef213a6a1743835c1d015b2c))
* **prompts:** Make tool schema properties field optional ([#6455](https://github.com/Arize-ai/phoenix/issues/6455)) ([53cf4ba](https://github.com/Arize-ai/phoenix/commit/53cf4ba29993c475f3c9da3abbcbf9d802e19436))
* **prompts:** nest json schema fields in discriminated union ([#6246](https://github.com/Arize-ai/phoenix/issues/6246)) ([fc7c7c8](https://github.com/Arize-ai/phoenix/commit/fc7c7c8152de9aef36a7e7093340583816e2580e))
* **prompts:** normalized tools ([#6220](https://github.com/Arize-ai/phoenix/issues/6220)) ([42a31ad](https://github.com/Arize-ai/phoenix/commit/42a31adca6c25068e94decb437ff79b187f85903))
* **prompts:** output schema ([#6194](https://github.com/Arize-ai/phoenix/issues/6194)) ([a4c877f](https://github.com/Arize-ai/phoenix/commit/a4c877f7f675f6fea2d3aac528391ddf017570d9))
* **prompts:** Parse tool result json correctly ([#6454](https://github.com/Arize-ai/phoenix/issues/6454)) ([7fb4ef6](https://github.com/Arize-ai/phoenix/commit/7fb4ef6cdc9d6f72ceed0111a964135ccc10a7a9))
* **prompts:** Perform prompt table sorting on the client ([#6363](https://github.com/Arize-ai/phoenix/issues/6363)) ([4478c7a](https://github.com/Arize-ai/phoenix/commit/4478c7a6edf78f800c91e2ad8ceaa2f17c5e741b))
* **prompts:** prompt invocation parameters ([#6309](https://github.com/Arize-ai/phoenix/issues/6309)) ([c0e2998](https://github.com/Arize-ai/phoenix/commit/c0e2998e8b56ffb5276d671d8d9654c2494eaaf7))
* **prompts:** record user who mutates prompt ([#5916](https://github.com/Arize-ai/phoenix/issues/5916)) ([bcabb00](https://github.com/Arize-ai/phoenix/commit/bcabb00b694b027179d32eb0a3c619707b2af9b5))
* **prompts:** refetch tags after set ([#6066](https://github.com/Arize-ai/phoenix/issues/6066)) ([d3ff190](https://github.com/Arize-ai/phoenix/commit/d3ff190c65bd904363c846e9bc3e808dbc537818))
* **prompts:** remove template type from input for create prompt mutations ([#6196](https://github.com/Arize-ai/phoenix/issues/6196)) ([0b61c62](https://github.com/Arize-ai/phoenix/commit/0b61c6245e80a3cc00e996a3b2eba558ac5e1aba))
* **prompts:** rename google provider ([#6452](https://github.com/Arize-ai/phoenix/issues/6452)) ([2ecac95](https://github.com/Arize-ai/phoenix/commit/2ecac9527ec3d718bdb75d21596ef1ee3b0b9d6b))
* **prompts:** rename output schema to response format ([#6261](https://github.com/Arize-ai/phoenix/issues/6261)) ([b61123a](https://github.com/Arize-ai/phoenix/commit/b61123af3357be20551c63099962b3629f61227a))
* **prompts:** rename tables ([#5805](https://github.com/Arize-ai/phoenix/issues/5805)) ([a0d10ed](https://github.com/Arize-ai/phoenix/commit/a0d10edbc271642f6e34d003582bcc19a76e53db))
* **prompts:** Restore azure openai params from prompt into playground ([#6330](https://github.com/Arize-ai/phoenix/issues/6330)) ([7c5e316](https://github.com/Arize-ai/phoenix/commit/7c5e316465764d5f4937da65464b2e00198165de))
* **prompts:** Save tool calls from playground message into prompt ([#6333](https://github.com/Arize-ai/phoenix/issues/6333)) ([96c0a82](https://github.com/Arize-ai/phoenix/commit/96c0a8271709371efbaae3026489eae054ce5378))
* **prompts:** sqlalchemy types ([#6177](https://github.com/Arize-ai/phoenix/issues/6177)) ([d6614b6](https://github.com/Arize-ai/phoenix/commit/d6614b6494f4e7a29212559bb8275edef2b80601))
* **prompts:** suppress pydantic warning ([#6355](https://github.com/Arize-ai/phoenix/issues/6355)) ([e733bae](https://github.com/Arize-ai/phoenix/commit/e733bae3eb2114302280e7e901edb5aa9c2ffc83))
* **prompts:** unterminated quote ([#6444](https://github.com/Arize-ai/phoenix/issues/6444)) ([53d2807](https://github.com/Arize-ai/phoenix/commit/53d2807a1630757b2228495811bc832e9da20a5e))
* **prompts:** use discriminated union for content parts ([#6205](https://github.com/Arize-ai/phoenix/issues/6205)) ([cc6ae45](https://github.com/Arize-ai/phoenix/commit/cc6ae459957602a032f364097a4d1841bff887b9))
* **promts:** dataset URL ([#6401](https://github.com/Arize-ai/phoenix/issues/6401)) ([cfbc6a7](https://github.com/Arize-ai/phoenix/commit/cfbc6a7303fcf9fd2f7b4e2aedfc72761459d439))
* **promts:** load invocation parameters for azure openai ([#6383](https://github.com/Arize-ai/phoenix/issues/6383)) ([f783101](https://github.com/Arize-ai/phoenix/commit/f78310188e64451ad5e8e6c4c2db87ade40d466d))
* put tool choice back in invocation parameters when sent to graphql ([#6351](https://github.com/Arize-ai/phoenix/issues/6351)) ([5df1dad](https://github.com/Arize-ai/phoenix/commit/5df1dadf0cd0a17644863769a1f9c1871a690ea0))
* record user id when creating prompts via post ([#6443](https://github.com/Arize-ai/phoenix/issues/6443)) ([10d6361](https://github.com/Arize-ai/phoenix/commit/10d6361eff0cff2017956f2f7c18791af82166c1))
* reject sting templates in post requests ([#6458](https://github.com/Arize-ai/phoenix/issues/6458)) ([0f5d5aa](https://github.com/Arize-ai/phoenix/commit/0f5d5aa0759f4e79e8d6b75291cc5b74e74a43fa))
* remove v1 from examples url ([#6386](https://github.com/Arize-ai/phoenix/issues/6386)) ([39a917f](https://github.com/Arize-ai/phoenix/commit/39a917fa3d7093d8258593e32545426626eca175))
* request.user raises an exception when auth is not enabled ([#6446](https://github.com/Arize-ai/phoenix/issues/6446)) ([1fb2a13](https://github.com/Arize-ai/phoenix/commit/1fb2a13534e523cdb560f0d04ae752e4a25330ab))
* Resolve source prompts properly ([#6031](https://github.com/Arize-ai/phoenix/issues/6031)) ([a8ed533](https://github.com/Arize-ai/phoenix/commit/a8ed533962c12d3c4ecc88dc20a63db319d7708c))
* restore playwright passing ([#6352](https://github.com/Arize-ai/phoenix/issues/6352)) ([e918ebf](https://github.com/Arize-ai/phoenix/commit/e918ebf729f06b5b9812a68c50e23d0cad4a2d60))
* stop propagation on playground button ([#6298](https://github.com/Arize-ai/phoenix/issues/6298)) ([ce125da](https://github.com/Arize-ai/phoenix/commit/ce125da8b6ea8b1f260f39e07d71a2c47e26b46e))
* Tweak experiment names and descriptions ([#6457](https://github.com/Arize-ai/phoenix/issues/6457)) ([4bf19df](https://github.com/Arize-ai/phoenix/commit/4bf19dfb4f3d2835b0f1404c91f62295fb1b9689))
* types in model config button ([6b9dc14](https://github.com/Arize-ai/phoenix/commit/6b9dc14ebd9ecb09d1e276583b3060d42680d1b1))
* Update metadata key ([#6354](https://github.com/Arize-ai/phoenix/issues/6354)) ([7d30631](https://github.com/Arize-ai/phoenix/commit/7d3063187faa8d032578ac17ff66b40091db9a33))


### Documentation

* **prompts:** Add deno notebook example for TS phoenix-client ([#6328](https://github.com/Arize-ai/phoenix/issues/6328)) ([f81f873](https://github.com/Arize-ai/phoenix/commit/f81f873f3ea6bae7ae8ea399026baf25f1cefe55))
* Update README.md ([#6055](https://github.com/Arize-ai/phoenix/issues/6055)) ([21a588d](https://github.com/Arize-ai/phoenix/commit/21a588d6cfdb3806e9f32390aa944d257a170100))

## [7.12.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.12.2...arize-phoenix-v7.12.3) (2025-02-19)


### Bug Fixes

* strip leading and trailing whitespace characters from values of string environment variables ([#6445](https://github.com/Arize-ai/phoenix/issues/6445)) ([90837e3](https://github.com/Arize-ai/phoenix/commit/90837e37a09da8bb293e1dd35453b1579e105607))

## [7.12.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.12.1...arize-phoenix-v7.12.2) (2025-02-13)


### Bug Fixes

* **prompts:** trim leading and trailing whitespace from mustache template variables ([#6357](https://github.com/Arize-ai/phoenix/issues/6357)) ([0743206](https://github.com/Arize-ai/phoenix/commit/074320697855419c9e6cb5bfb9d4a06e9c259648))

## [7.12.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.12.0...arize-phoenix-v7.12.1) (2025-02-11)


### Bug Fixes

* allow `prepared_statement_cache_size` for asyncpg ([#6324](https://github.com/Arize-ai/phoenix/issues/6324)) ([713cf97](https://github.com/Arize-ai/phoenix/commit/713cf97a1f1b20bf26bd6a16dfb7eb335d575261))

## [7.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.11.0...arize-phoenix-v7.12.0) (2025-02-05)


### Features

* **playground:** record url info in playground spans ([#6252](https://github.com/Arize-ai/phoenix/issues/6252)) ([602143b](https://github.com/Arize-ai/phoenix/commit/602143be06de5e473d759866dfe45eac4a1be635))

## [7.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.10.3...arize-phoenix-v7.11.0) (2025-02-05)


### Features

* **playground:** central ai provider config ([#6248](https://github.com/Arize-ai/phoenix/issues/6248)) ([0e076be](https://github.com/Arize-ai/phoenix/commit/0e076be257a40a5064e9c0219404259c639e1b20))

## [7.10.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.10.2...arize-phoenix-v7.10.3) (2025-02-04)


### Bug Fixes

* **playground:** if base url is provided but not api key, use fake api key for openai client ([#6259](https://github.com/Arize-ai/phoenix/issues/6259)) ([afb818a](https://github.com/Arize-ai/phoenix/commit/afb818aab3611a943d1548efa16af2895a1e2631))

## [7.10.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.10.1...arize-phoenix-v7.10.2) (2025-02-04)


### Bug Fixes

* **playground:** disable retry and auth refresh if auth is disabled ([#6256](https://github.com/Arize-ai/phoenix/issues/6256)) ([8dd3ad5](https://github.com/Arize-ai/phoenix/commit/8dd3ad53d2b0d86acbc905e54ccc14d350c956a9))

## [7.10.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.10.0...arize-phoenix-v7.10.1) (2025-02-04)


### Bug Fixes

* Replace corepack with pinned pnpm version in Dockerfile ([#6250](https://github.com/Arize-ai/phoenix/issues/6250)) ([08195bc](https://github.com/Arize-ai/phoenix/commit/08195bc9395a1a87f062e47d931e068fef54cfe9))

## [7.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.9.4...arize-phoenix-v7.10.0) (2025-02-04)


### Features

* Experiment and dataset improvements ([#6163](https://github.com/Arize-ai/phoenix/issues/6163)) ([846f080](https://github.com/Arize-ai/phoenix/commit/846f08068db3a6b1bb9c40d8b4aadd0bc00e12f1))
* **ui:** in playground model config add text field for base url ([#6244](https://github.com/Arize-ai/phoenix/issues/6244)) ([794f466](https://github.com/Arize-ai/phoenix/commit/794f466335e478d85708b2b352ca6330eef72caa))


### Bug Fixes

* **auth:** refresh tokens on websockets ([#6240](https://github.com/Arize-ai/phoenix/issues/6240)) ([ad19645](https://github.com/Arize-ai/phoenix/commit/ad19645b7c01e4b4419ab5b18ca071f63b64a5ec))
* sanitize db urls in launch_app ([#6243](https://github.com/Arize-ai/phoenix/issues/6243)) ([bb93b0a](https://github.com/Arize-ai/phoenix/commit/bb93b0a2b55b9bbae66fba2453bf1dce3db3935f))

## [7.9.4](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.9.3...arize-phoenix-v7.9.4) (2025-01-31)


### Bug Fixes

* **graphql:** add default values for TimeRange input ([#6212](https://github.com/Arize-ai/phoenix/issues/6212)) ([5089881](https://github.com/Arize-ai/phoenix/commit/5089881367fe0ae99f0b198ffd560867cb5a746f))
* Prevent error when parsing invalid json out of tool calls ([#6217](https://github.com/Arize-ai/phoenix/issues/6217)) ([0482e87](https://github.com/Arize-ai/phoenix/commit/0482e877c0e91473aed08b612661d905d952c135))

## [7.9.3](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.9.2...arize-phoenix-v7.9.3) (2025-01-30)


### Bug Fixes

* upgrading wrapt to 1.17.2 to fix cross-platform issues ([#6209](https://github.com/Arize-ai/phoenix/issues/6209)) ([0de4b7d](https://github.com/Arize-ai/phoenix/commit/0de4b7da69b2ac488e0d2741b80b36ddfdcf0ea7))

## [7.9.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.9.1...arize-phoenix-v7.9.2) (2025-01-23)


### Bug Fixes

* incorporate headers from environment for the trace span exporter when running experiments ([#6161](https://github.com/Arize-ai/phoenix/issues/6161)) ([b7a1bd5](https://github.com/Arize-ai/phoenix/commit/b7a1bd5a2d696c165d655067ae7c0bbb4c357f0f))


### Documentation

* fix typo in readme ([#6155](https://github.com/Arize-ai/phoenix/issues/6155)) ([9a7eae2](https://github.com/Arize-ai/phoenix/commit/9a7eae2fc9e6286fbdf209484795accad680c65b))

## [7.9.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.9.0...arize-phoenix-v7.9.1) (2025-01-23)


### Bug Fixes

* Allow experiment table resize for large inputs ([#6134](https://github.com/Arize-ai/phoenix/issues/6134)) ([b87c3c7](https://github.com/Arize-ai/phoenix/commit/b87c3c733120cee45e55ec6e48a0da37b5c0611f))
* handle span events as ndarray for `TraceDataset.to_span` ([#6135](https://github.com/Arize-ai/phoenix/issues/6135)) ([42c0ae5](https://github.com/Arize-ai/phoenix/commit/42c0ae5bc705f62519737d6800867cf0551f9dd7))

## [7.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.8.1...arize-phoenix-v7.9.0) (2025-01-21)


### Features

* Add support for o1 dev messages + reasoning param ([#6110](https://github.com/Arize-ai/phoenix/issues/6110)) ([1b90c33](https://github.com/Arize-ai/phoenix/commit/1b90c33929837454bc01aa47f6949cdbebf7fac3))


### Documentation

* add smolagents to the readme ([#6121](https://github.com/Arize-ai/phoenix/issues/6121)) ([26205d0](https://github.com/Arize-ai/phoenix/commit/26205d02c181e06f0c6eee44975ed56a8c84c40a))
* Update README.md ([c1f8612](https://github.com/Arize-ai/phoenix/commit/c1f8612b3a1212c28fc78c1fa6e92df0191b69f9))

## [7.8.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.8.0...arize-phoenix-v7.8.1) (2025-01-18)


### Bug Fixes

* reduce query memory usage in DatasetExampleRevisionsDataLoader ([#6116](https://github.com/Arize-ai/phoenix/issues/6116)) ([7412bb9](https://github.com/Arize-ai/phoenix/commit/7412bb9cc92390d090a956f6a573fa353347efb3))

## [7.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.7.2...arize-phoenix-v7.8.0) (2025-01-17)


### Features

* Prettify mutations with user facing errors ([#6049](https://github.com/Arize-ai/phoenix/issues/6049)) ([f14a4ec](https://github.com/Arize-ai/phoenix/commit/f14a4eca14d3c7e72bec9c419488baedda37de19))


### Bug Fixes

* correct errors in run experiment python code snippet ([#6103](https://github.com/Arize-ai/phoenix/issues/6103)) ([0f04e2a](https://github.com/Arize-ai/phoenix/commit/0f04e2a53da17065f4934685acea20a84ee6089b))
* **playground:** remove gpt-3.5-turbo-instruct ([#6081](https://github.com/Arize-ai/phoenix/issues/6081)) ([7c59f66](https://github.com/Arize-ai/phoenix/commit/7c59f66c1db7ddc76950131cea98b66908d43391))

## [7.7.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.7.1...arize-phoenix-v7.7.2) (2025-01-15)


### Bug Fixes

* allow import of LLMRelationalEvaluator ([#6045](https://github.com/Arize-ai/phoenix/issues/6045)) ([49e893d](https://github.com/Arize-ai/phoenix/commit/49e893dc1cb300d1c04d5716ee4ccdeb8f1f6e94))

## [7.7.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.7.0...arize-phoenix-v7.7.1) (2025-01-14)


### Bug Fixes

* don't lock delete dataset mutation ([#6038](https://github.com/Arize-ai/phoenix/issues/6038)) ([95084b5](https://github.com/Arize-ai/phoenix/commit/95084b5f2adbeb5c1070ffccaeb685e4f14b74aa))

## [7.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.6.0...arize-phoenix-v7.7.0) (2025-01-14)


### Features

* **experiments:** add experiment run filter to compare experiments page ([#5738](https://github.com/Arize-ai/phoenix/issues/5738)) ([0bf194d](https://github.com/Arize-ai/phoenix/commit/0bf194d1051e7cd0c9a878c37be3c9692fb2be41))


### Bug Fixes

* Coerce incoming span token counts to int ([#5976](https://github.com/Arize-ai/phoenix/issues/5976)) ([8711b21](https://github.com/Arize-ai/phoenix/commit/8711b2168e8d947f02b8e65a6c51d8bb7a42c912))
* pin upper bound on litellm to prevent windows break ([#6004](https://github.com/Arize-ai/phoenix/issues/6004)) ([abdd24f](https://github.com/Arize-ai/phoenix/commit/abdd24fd56ca3677851f88ca233f280d651bafda))
* Update schema.py to make extensions a list, not chain ([#6024](https://github.com/Arize-ai/phoenix/issues/6024)) ([6e6e181](https://github.com/Arize-ai/phoenix/commit/6e6e181b90c61803717cfa061d9a9e74ade77d3c))

## [7.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.5.2...arize-phoenix-v7.6.0) (2025-01-09)


### Features

* **playground:** Support anyOf json schema ([#5927](https://github.com/Arize-ai/phoenix/issues/5927)) ([16ca5f9](https://github.com/Arize-ai/phoenix/commit/16ca5f9463ef43b684847a94fdc756e57529a435))


### Bug Fixes

* return 200 status code for POST v1/traces ([#5962](https://github.com/Arize-ai/phoenix/issues/5962)) ([421852b](https://github.com/Arize-ai/phoenix/commit/421852b7dedefa0b910dd1d0cee693620af4c98b))

## [7.5.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.5.1...arize-phoenix-v7.5.2) (2025-01-07)


### Bug Fixes

* add id fields to annotations so that relay caches anotations correctly ([#5919](https://github.com/Arize-ai/phoenix/issues/5919)) ([09a4c25](https://github.com/Arize-ai/phoenix/commit/09a4c2537bb384f508f9aaaf04dd7d71ab28195a))

## [7.5.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.5.0...arize-phoenix-v7.5.1) (2025-01-04)


### Bug Fixes

* default prompt / completion tokens to 0 ([#5897](https://github.com/Arize-ai/phoenix/issues/5897)) ([8cfc138](https://github.com/Arize-ai/phoenix/commit/8cfc138ace0ec05794f0efb1dc1ed0f93ea8d298))

## [7.5.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.4.0...arize-phoenix-v7.5.0) (2025-01-03)


### Features

* **components:** Disclosure (fka Accordion) ([#5873](https://github.com/Arize-ai/phoenix/issues/5873)) ([ea8a7c7](https://github.com/Arize-ai/phoenix/commit/ea8a7c7fba24c289c8009ea3f795cf463557d63a))


### Bug Fixes

* **components:** Add class names to Disclosure for backwards compatibility with Accordion ([#5889](https://github.com/Arize-ai/phoenix/issues/5889)) ([8c8271e](https://github.com/Arize-ai/phoenix/commit/8c8271e1bd22b71e4f3b98fd5ac372d3afb00170))
* **graphql:** coerce to string when output.value is not None (e.g. bool) ([#5892](https://github.com/Arize-ai/phoenix/issues/5892)) ([5c7e6d3](https://github.com/Arize-ai/phoenix/commit/5c7e6d3ebcd63e98586060732f3cf974a6f8c7aa))

## [7.4.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.3.2...arize-phoenix-v7.4.0) (2025-01-02)


### Features

* **components:** TextField ([#5850](https://github.com/Arize-ai/phoenix/issues/5850)) ([e91408d](https://github.com/Arize-ai/phoenix/commit/e91408d6ce07d08c2fef09415803c234ca728106))
* **docs:** add support links ([#5829](https://github.com/Arize-ai/phoenix/issues/5829)) ([dd8ae20](https://github.com/Arize-ai/phoenix/commit/dd8ae2034cd96029a31ff80ea3bf6852fe1a5112))
* show a breakdown of tokens in the project header ([#5876](https://github.com/Arize-ai/phoenix/issues/5876)) ([179859b](https://github.com/Arize-ai/phoenix/commit/179859bde2986ceb046d3bc318966a6867346746))


### Bug Fixes

* skip json parse if tool call function arguments attribute doesn't exist ([#5874](https://github.com/Arize-ai/phoenix/issues/5874)) ([878f1c1](https://github.com/Arize-ai/phoenix/commit/878f1c1feed8f3d4903601b8722e37a92efea556))

## [7.3.2](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.3.1...arize-phoenix-v7.3.2) (2024-12-24)


### Bug Fixes

* **playground:** add common base class for OpenAI and AzureOpenAI streaming clients ([#5823](https://github.com/Arize-ai/phoenix/issues/5823)) ([9b8f10e](https://github.com/Arize-ai/phoenix/commit/9b8f10e942387e2dc230371a3715c71e2cd01e83))

## [7.3.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.3.0...arize-phoenix-v7.3.1) (2024-12-23)


### Bug Fixes

* increase default wait time for uvicorn server process start ([#5818](https://github.com/Arize-ai/phoenix/issues/5818)) ([a4cef8e](https://github.com/Arize-ai/phoenix/commit/a4cef8e227516fced7bfc8471b988c21a88236bd))

## [7.3.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.2.0...arize-phoenix-v7.3.0) (2024-12-21)


### Features

* **components:** styled button ([#5803](https://github.com/Arize-ai/phoenix/issues/5803)) ([e8afaa8](https://github.com/Arize-ai/phoenix/commit/e8afaa8d5aa421be2cddcaf515162b5d86f0a110))
* **playground:** Update o1 model listing and params ([#5773](https://github.com/Arize-ai/phoenix/issues/5773)) ([aabe535](https://github.com/Arize-ai/phoenix/commit/aabe5359c86dd931fb70fb4f3d7663b9d608882b))
* **tracing:** pretty print JSON strings for structured data outputs ([#5811](https://github.com/Arize-ai/phoenix/issues/5811)) ([b371f7c](https://github.com/Arize-ai/phoenix/commit/b371f7c4a05af80601fdb9660e20baf70d55de6c))


### Bug Fixes

* fix light mode filters and colors ([#5789](https://github.com/Arize-ai/phoenix/issues/5789)) ([6d8f0c6](https://github.com/Arize-ai/phoenix/commit/6d8f0c6cc31d91e0b07edf55786ccbfd486e856d))

## [7.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.1.1...arize-phoenix-v7.2.0) (2024-12-18)


### Features

* **playground:** Enhance template editor ergonomics ([#5715](https://github.com/Arize-ai/phoenix/issues/5715)) ([1c593a4](https://github.com/Arize-ai/phoenix/commit/1c593a47967ea78d569b6538720678a921bcbb92))


### Bug Fixes

* **sessions:** exclude null input/output values in dataloader query for sessions table ([#5781](https://github.com/Arize-ai/phoenix/issues/5781)) ([fb1330f](https://github.com/Arize-ai/phoenix/commit/fb1330fdc61c756adcade2cf29f893d504ef3243))
* update index.html ([#5783](https://github.com/Arize-ai/phoenix/issues/5783)) ([bca3b09](https://github.com/Arize-ai/phoenix/commit/bca3b0972fa75ff27516d98ec4d3f8db3de9fe29))

## [7.1.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.1.0...arize-phoenix-v7.1.1) (2024-12-11)


### Bug Fixes

* increase python upper bound to include python 3.13 ([#5706](https://github.com/Arize-ai/phoenix/issues/5706)) ([4431a0e](https://github.com/Arize-ai/phoenix/commit/4431a0e62470e501d75a5b2c9377c2e0f70a6404))

## [7.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.0.1...arize-phoenix-v7.1.0) (2024-12-11)


### Features

* **playground:** support arbitrary string model names ([#5645](https://github.com/Arize-ai/phoenix/issues/5645)) ([c4999fe](https://github.com/Arize-ai/phoenix/commit/c4999fea0009f62b8a9f6404bfa3c20c885358c0))
* **playground:** Support gemini-2.0-flash-exp model ([#5708](https://github.com/Arize-ai/phoenix/issues/5708)) ([77a3583](https://github.com/Arize-ai/phoenix/commit/77a3583058853e22adc06a909979c00f2058432e))
* Prettify rendered json mimeType inputs/outputs in session details pane ([#5648](https://github.com/Arize-ai/phoenix/issues/5648)) ([f8ff082](https://github.com/Arize-ai/phoenix/commit/f8ff082c614f151e2447d13631fe9702abf2944a))


### Bug Fixes

* add locked mode ([#5636](https://github.com/Arize-ai/phoenix/issues/5636)) ([7d4b3b8](https://github.com/Arize-ai/phoenix/commit/7d4b3b830600d1683382955428d1f2699b812600))
* compute trace latency rather than relying on root span latency ([#5615](https://github.com/Arize-ai/phoenix/issues/5615)) ([7bd7274](https://github.com/Arize-ai/phoenix/commit/7bd727470694833ee18efc1d5006340833ca46e4))
* prevent useless tooltips from appearing in projects ([#5692](https://github.com/Arize-ai/phoenix/issues/5692)) ([e4d754c](https://github.com/Arize-ai/phoenix/commit/e4d754c59202b922db0e996c374f89a461822b64))
* **ui:** support light mode for tool coice picker ([#5693](https://github.com/Arize-ai/phoenix/issues/5693)) ([6c5b43d](https://github.com/Arize-ai/phoenix/commit/6c5b43d2d613d9d10d71dec748189c3948379751))

## [7.0.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v7.0.0...arize-phoenix-v7.0.1) (2024-12-09)


### Bug Fixes

* sslmode query parameter in postgresql database url for asyncpg ([#5679](https://github.com/Arize-ai/phoenix/issues/5679)) ([824d295](https://github.com/Arize-ai/phoenix/commit/824d295f45eb6d4b85b652f98675c7865c5694e8))

## [7.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v6.2.0...arize-phoenix-v7.0.0) (2024-12-09)


### ⚠ BREAKING CHANGES

* release `sessions` feature ([#5674](https://github.com/Arize-ai/phoenix/issues/5674))

### Features

* release `sessions` feature ([#5674](https://github.com/Arize-ai/phoenix/issues/5674)) ([71ba01b](https://github.com/Arize-ai/phoenix/commit/71ba01b40e83f520d3f9225167e6bbc55e2a8be4))
* **sesions:** add session details page ([#5225](https://github.com/Arize-ai/phoenix/issues/5225)) ([311c670](https://github.com/Arize-ai/phoenix/commit/311c6707f26eab38c36b296fdfff639f6452a0eb))
* **sessions:** add ability to navigate from trace to session ([#5229](https://github.com/Arize-ai/phoenix/issues/5229)) ([640c1a8](https://github.com/Arize-ai/phoenix/commit/640c1a8fd42fb8982a1cec8806e6495e5192252d))
* **sessions:** add db table for sessions ([#4961](https://github.com/Arize-ai/phoenix/issues/4961)) ([ab29149](https://github.com/Arize-ai/phoenix/commit/ab29149b7edef474558b5d5039e1ea2bfce1143d))
* **sessions:** add last trace start time column to UI table for sessions ([#5481](https://github.com/Arize-ai/phoenix/issues/5481)) ([567c901](https://github.com/Arize-ai/phoenix/commit/567c90199b4180f31d51430d17b6a854dcdb5832))
* **sessions:** add trace latency p50 to session details ([#5236](https://github.com/Arize-ai/phoenix/issues/5236)) ([4c07ec3](https://github.com/Arize-ai/phoenix/commit/4c07ec388007b4c590fbaa4fead748c6ee3358b4))
* **sessions:** add trace latency percentiles to ui table ([#5482](https://github.com/Arize-ai/phoenix/issues/5482)) ([ed15bfc](https://github.com/Arize-ai/phoenix/commit/ed15bfc4c9874ebbc4a85820c589393e7c76dd45))
* **sessions:** alembic data migration queries for populating the project sessions table ([#5539](https://github.com/Arize-ai/phoenix/issues/5539)) ([50f5794](https://github.com/Arize-ai/phoenix/commit/50f57948bb4e2f9c9a943870a8b034f703f0499f))
* **sessions:** enable sorting on sessions table ([#5292](https://github.com/Arize-ai/phoenix/issues/5292)) ([09c4589](https://github.com/Arize-ai/phoenix/commit/09c458973a637704755558f48b71021809dfc4a3))
* **sessions:** filter sessions via substring search on root span input output values ([#5257](https://github.com/Arize-ai/phoenix/issues/5257)) ([1cc985d](https://github.com/Arize-ai/phoenix/commit/1cc985d68991e346dfb9bff10e7e9f56dfa0bbfe))
* **sessions:** getting started guide ([#5592](https://github.com/Arize-ai/phoenix/issues/5592)) ([5fa9bc5](https://github.com/Arize-ai/phoenix/commit/5fa9bc53fadb1ea6028b0402e5d9f45092df3fc0))
* **sessions:** only recognize session id and user id on root spans ([#5351](https://github.com/Arize-ai/phoenix/issues/5351)) ([9786cf3](https://github.com/Arize-ai/phoenix/commit/9786cf37f502d02856f9cfb0925d6e091f4a5337))
* **sessions:** session trace error count ([#5244](https://github.com/Arize-ai/phoenix/issues/5244)) ([13596d9](https://github.com/Arize-ai/phoenix/commit/13596d91c20c488421891e9036b322788a39ac45))
* **sessions:** sessions table on project page ([#5204](https://github.com/Arize-ai/phoenix/issues/5204)) ([e495619](https://github.com/Arize-ai/phoenix/commit/e4956192355d31a5da867e4d85a3dde74dbd1ec9))


### Bug Fixes

* **sessions:** for each session record first user by earliest span start time ([#5227](https://github.com/Arize-ai/phoenix/issues/5227)) ([eb772bd](https://github.com/Arize-ai/phoenix/commit/eb772bd6878bb5d514ef412be9ab660baffa97f3))
* **sessions:** remove deno style imports ([#5611](https://github.com/Arize-ai/phoenix/issues/5611)) ([846adfc](https://github.com/Arize-ai/phoenix/commit/846adfc8f3ed52a0687cac36648763ba4d3544f1))
* **sessions:** remove end_time from db and ui table ([#5479](https://github.com/Arize-ai/phoenix/issues/5479)) ([16d9edd](https://github.com/Arize-ai/phoenix/commit/16d9eddb9a50e7b71068245adf269434fc36de5d))
* **sessions:** remove requirement that session_id has to be on root span ([#5630](https://github.com/Arize-ai/phoenix/issues/5630)) ([21d6ddc](https://github.com/Arize-ai/phoenix/commit/21d6ddc41348115f4b966cb0ae17abfcdbeca290))
* **sessions:** remove session_user from database table ([#5638](https://github.com/Arize-ai/phoenix/issues/5638)) ([923a198](https://github.com/Arize-ai/phoenix/commit/923a19875ed6b6465596f7c177d113d64cc60efe))
* **sessions:** replace last_trace_start_time with end_time in database table ([#5640](https://github.com/Arize-ai/phoenix/issues/5640)) ([7b718b5](https://github.com/Arize-ai/phoenix/commit/7b718b5d859a44c4025f20a936b6dcd822c106a0))
* **sessions:** separate migration script for populating the project sessions table ([#5612](https://github.com/Arize-ai/phoenix/issues/5612)) ([4beee16](https://github.com/Arize-ai/phoenix/commit/4beee1625252bfc8b94a3f9111ff13188d951d8b))
* **sessions:** sortable last trace start time ([#5606](https://github.com/Arize-ai/phoenix/issues/5606)) ([0af00e5](https://github.com/Arize-ai/phoenix/commit/0af00e5bfbb8aa0b902c07aaa94fa243e07ae0a1))


### Documentation

* **sessions:** add note about pg extra ([#5620](https://github.com/Arize-ai/phoenix/issues/5620)) ([a292041](https://github.com/Arize-ai/phoenix/commit/a2920416cff31ed79650330c3b38efc0ea79b807))

## [6.2.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v6.1.0...arize-phoenix-v6.2.0) (2024-12-09)


### Features

* **client:** add timeout parameters to log_evaluations, get_evaluations ([#5646](https://github.com/Arize-ai/phoenix/issues/5646)) ([c388a9b](https://github.com/Arize-ai/phoenix/commit/c388a9b935e6aa15d3bbf341f3f3ce3b00dc7762))
* **components:** add story book and ComboBox ([#5609](https://github.com/Arize-ai/phoenix/issues/5609)) ([4981f41](https://github.com/Arize-ai/phoenix/commit/4981f41f313fcf7e809e371043bb92096b16f217))
* **playground:** pull prompt template variables from span and capture on playground spans ([#5642](https://github.com/Arize-ai/phoenix/issues/5642)) ([d6382dc](https://github.com/Arize-ai/phoenix/commit/d6382dc68b0a0f23e8ef02f431d5885b1e0420b4))


### Bug Fixes

* fixing other slack link in readme ([#5643](https://github.com/Arize-ai/phoenix/issues/5643)) ([94cd150](https://github.com/Arize-ai/phoenix/commit/94cd150db0df83076e049bb9902876588bdd6290))
* Intel x86_64 macOS issue with wrapt 1.17 ([#5657](https://github.com/Arize-ai/phoenix/issues/5657)) ([c1aa93d](https://github.com/Arize-ai/phoenix/commit/c1aa93d7554b2028081e36b4ec3ece0668899dce))
* postgresql url query param ([#5659](https://github.com/Arize-ai/phoenix/issues/5659)) ([5f51386](https://github.com/Arize-ai/phoenix/commit/5f513860fc7bc617866e4e1e928d0f24386ef905))
* slack link ([df503fa](https://github.com/Arize-ai/phoenix/commit/df503fa6a47839fb0f73a78cd5b0931bd309bace))
* styling of experiment sequence numbers ([#5622](https://github.com/Arize-ai/phoenix/issues/5622)) ([42a67d4](https://github.com/Arize-ai/phoenix/commit/42a67d40b0b6cb8f7e6d5d3795f4fa67073d3799))
* Update README.md ([#5644](https://github.com/Arize-ai/phoenix/issues/5644)) ([016ca63](https://github.com/Arize-ai/phoenix/commit/016ca637a3162890f06688742483ec7aa749ec87))

## [6.1.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v6.0.0...arize-phoenix-v6.1.0) (2024-12-03)


### Features

* Add cancel button to playground runs ([#5566](https://github.com/Arize-ai/phoenix/issues/5566)) ([6bafa46](https://github.com/Arize-ai/phoenix/commit/6bafa463d344038af90fabb3e8ab06bbf6b77c12))
* Show invocation param errors within form ([#5559](https://github.com/Arize-ai/phoenix/issues/5559)) ([eac071f](https://github.com/Arize-ai/phoenix/commit/eac071f492d17ad638b53b9c9aff029daa8131de))


### Bug Fixes

* add copy to clipboard icon for experiment ids on experiment compare page ([#5596](https://github.com/Arize-ai/phoenix/issues/5596)) ([6a62bd2](https://github.com/Arize-ai/phoenix/commit/6a62bd2a9050a31b9d0eeee49366fa8fe215ea4f))
* **playground:** handle experiment id's for non streaming ([#5601](https://github.com/Arize-ai/phoenix/issues/5601)) ([1a51350](https://github.com/Arize-ai/phoenix/commit/1a513506921844bf56b5abda80e17b582d1ad9af))
* Remove deadzone when hovering example table cells ([#5363](https://github.com/Arize-ai/phoenix/issues/5363)) ([03179f4](https://github.com/Arize-ai/phoenix/commit/03179f4f9b13e398a361dd5163cf8156408c9859))


### Documentation

* update feature table on README to include prompt playground ([#5579](https://github.com/Arize-ai/phoenix/issues/5579)) ([fc66650](https://github.com/Arize-ai/phoenix/commit/fc666502e4eaaf1614285698f36b64d5f3885d53))

## [6.0.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.12.0...arize-phoenix-v6.0.0) (2024-12-02)


### ⚠ BREAKING CHANGES

* **playground:** release playground feature ([#5576](https://github.com/Arize-ai/phoenix/issues/5576))

### Features

* Add evaluations to openapi schema ([#5505](https://github.com/Arize-ai/phoenix/issues/5505)) ([01d45f0](https://github.com/Arize-ai/phoenix/commit/01d45f0a19c09df991f50c77f98504adc287f6b5))
* **playground:** release playground feature ([#5576](https://github.com/Arize-ai/phoenix/issues/5576)) ([d3f8370](https://github.com/Arize-ai/phoenix/commit/d3f8370393805535eb1208710f60dd03cc65e52c))


### Bug Fixes

* Detect provider from span attribute, fallback to model name heuristic ([#5535](https://github.com/Arize-ai/phoenix/issues/5535)) ([a479d62](https://github.com/Arize-ai/phoenix/commit/a479d62f3df710b51caa9e9d023ec857ae24223c))
* ensure retrieval documents are unnested when converting from span to dataset example ([#5523](https://github.com/Arize-ai/phoenix/issues/5523)) ([2f6e22e](https://github.com/Arize-ai/phoenix/commit/2f6e22e6bc597669ec6ebdef1ceb5d81f8d41b8d))
* Hide tool button on non-supported providers, Display errors for missing invocation params ([#5470](https://github.com/Arize-ai/phoenix/issues/5470)) ([baecc54](https://github.com/Arize-ai/phoenix/commit/baecc54a0e1608e514ee77506344be4f682079cf))
* **playground:** add AZURE_OPENAI_API_KEY environment variable ([#5570](https://github.com/Arize-ai/phoenix/issues/5570)) ([32e4e64](https://github.com/Arize-ai/phoenix/commit/32e4e64ea35b558d76b858b91f14f7b9d05dc189))
* **playground:** fix wording on missing input variable in playground over a dataset ([#5549](https://github.com/Arize-ai/phoenix/issues/5549)) ([b0ef597](https://github.com/Arize-ai/phoenix/commit/b0ef5974b7d4846d7fe5c10ebbf06eb6bb2740bb))
* **playground:** improve playground default invocation parameters ([#5545](https://github.com/Arize-ai/phoenix/issues/5545)) ([4f95300](https://github.com/Arize-ai/phoenix/commit/4f953008627e9270b8860f74239bc371ea9be639))
* **playground:** prepend `system` message from anthropic spans ([#5527](https://github.com/Arize-ai/phoenix/issues/5527)) ([838d348](https://github.com/Arize-ai/phoenix/commit/838d3480f3098ee9de08418973057cc41fd5e770))
* **playground:** remove cascade of padding on prompts ([#5556](https://github.com/Arize-ai/phoenix/issues/5556)) ([0eb1277](https://github.com/Arize-ai/phoenix/commit/0eb1277749a79d8509a4181ddb6edaaf9ed2ac51))
* **playground:** update saved model config to overwrite all model config if present ([#5544](https://github.com/Arize-ai/phoenix/issues/5544)) ([58dd310](https://github.com/Arize-ai/phoenix/commit/58dd31083605d51e08e2156ff2983e3c0cbe06e8))
* **playground:** use consistent playground experiment run format ([#5524](https://github.com/Arize-ai/phoenix/issues/5524)) ([b770112](https://github.com/Arize-ai/phoenix/commit/b770112f9b0eb7c95a9019e2c5d43cffaafadf64))
* Properly constrain/rename invocation params before submitting ([#5550](https://github.com/Arize-ai/phoenix/issues/5550)) ([b121fe2](https://github.com/Arize-ai/phoenix/commit/b121fe2bde520c5dd9c46599670900272c1f07b2))
* Remove seed parameter (no longer accepted by server) ([#5547](https://github.com/Arize-ai/phoenix/issues/5547)) ([a279136](https://github.com/Arize-ai/phoenix/commit/a279136f6c458cceb30096413a93f9306716e47b))
* spelling errors in prompt templates ([#5571](https://github.com/Arize-ai/phoenix/issues/5571)) ([9646c8e](https://github.com/Arize-ai/phoenix/commit/9646c8ebc7ba81043f4e1a678977a8c6a0fa50c1))

## [5.12.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.11.0...arize-phoenix-v5.12.0) (2024-11-25)


### Features

* Implement "Move Output" button on Playground Output ([#5509](https://github.com/Arize-ai/phoenix/issues/5509)) ([aa8c283](https://github.com/Arize-ai/phoenix/commit/aa8c283ceded7ea4333b74fb02824ba2fade2d55))
* **playground:** add `None` as a template formatter option for messages ([#5500](https://github.com/Arize-ai/phoenix/issues/5500)) ([c439257](https://github.com/Arize-ai/phoenix/commit/c439257144e5de4ca8ec7230fb8731fc70a31b94))


### Bug Fixes

* Add numeric playground defaults ([#5494](https://github.com/Arize-ai/phoenix/issues/5494)) ([2a14933](https://github.com/Arize-ai/phoenix/commit/2a1493377dfccc8f7c2b6ed2aaee7ffc20d0192e))
* Ensure prompt accordion interactables are always visible ([#5536](https://github.com/Arize-ai/phoenix/issues/5536)) ([4cee860](https://github.com/Arize-ai/phoenix/commit/4cee8607e927683f04c542425f6b8abfd0628501))
* **playground:** additional model names for anthropic claude ([#5520](https://github.com/Arize-ai/phoenix/issues/5520)) ([2d67b31](https://github.com/Arize-ai/phoenix/commit/2d67b3108f66dc5a19f2f50c416ac392791a6853))
* **playground:** block playground runs when app is readonly ([#5538](https://github.com/Arize-ai/phoenix/issues/5538)) ([7463069](https://github.com/Arize-ai/phoenix/commit/7463069e3822572fea4047c15a5752eae548e59c))
* **playground:** capture gemini token count for playground spans ([#5518](https://github.com/Arize-ai/phoenix/issues/5518)) ([cb9b1ce](https://github.com/Arize-ai/phoenix/commit/cb9b1ceea34797caca7265aabe5e5b70ca25ab98))
* **playground:** ensure playground timeout errors are displayed ([#5486](https://github.com/Arize-ai/phoenix/issues/5486)) ([38f8f56](https://github.com/Arize-ai/phoenix/commit/38f8f56699de31bc5f525d2f0d33eb7c49563fb2))
* **playground:** improve performance of playground dataset columns ([#5519](https://github.com/Arize-ai/phoenix/issues/5519)) ([3a9c8e0](https://github.com/Arize-ai/phoenix/commit/3a9c8e04fc8509f10b55ecdb57546a2178897aa3))
* Prevent layout shift when scrollbars are introduced ([#5493](https://github.com/Arize-ai/phoenix/issues/5493)) ([bd78a94](https://github.com/Arize-ai/phoenix/commit/bd78a948da3b9265d2417ff5740d3fd9257fc1b7))
* Use more generic `isawaitable` check ([#5508](https://github.com/Arize-ai/phoenix/issues/5508)) ([73d8287](https://github.com/Arize-ai/phoenix/commit/73d828754813630bdeed28bf3b53c4e6bb77223b))

## [5.11.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.10.0...arize-phoenix-v5.11.0) (2024-11-22)


### Features

* add environment variable for default admin initial password ([#5487](https://github.com/Arize-ai/phoenix/issues/5487)) ([748556e](https://github.com/Arize-ai/phoenix/commit/748556e9836466d13d152b742454f5c2759b8086))
* **playground:** block navigation when runs are in progress ([#5476](https://github.com/Arize-ai/phoenix/issues/5476)) ([930576f](https://github.com/Arize-ai/phoenix/commit/930576ff868cbb96f5c75c63c2306af552f68ef6))


### Bug Fixes

* add backup import for ujson_dumps from pandas.io.json ([#5496](https://github.com/Arize-ai/phoenix/issues/5496)) ([c463d57](https://github.com/Arize-ai/phoenix/commit/c463d5744bf293736f22f25fe67036601af6d2b1))
* Allow arbitrary column resizing without tail cell ([#5468](https://github.com/Arize-ai/phoenix/issues/5468)) ([5320343](https://github.com/Arize-ai/phoenix/commit/5320343628398d5b6838caee0bdfd65c957be39d)), closes [#5455](https://github.com/Arize-ai/phoenix/issues/5455)
* Allow shrinking of playground dataset table cells that have long text ([#5450](https://github.com/Arize-ai/phoenix/issues/5450)) ([59ab037](https://github.com/Arize-ai/phoenix/commit/59ab037b3b6ca3be7409b8e66063d6f7866d620d)), closes [#5444](https://github.com/Arize-ai/phoenix/issues/5444)
* deselect dataset when selecting active dataset from dropdown ([#5453](https://github.com/Arize-ai/phoenix/issues/5453)) ([d1b1ccc](https://github.com/Arize-ai/phoenix/commit/d1b1ccc943dc21e1a370919bc3d27cd62e5bae0e))
* eval dataframe should allow a column to be all null if type doesn't match expected ([#5495](https://github.com/Arize-ai/phoenix/issues/5495)) ([69b6594](https://github.com/Arize-ai/phoenix/commit/69b65945a0a23eeb2762a2d90a23a4fb04e15e9c))
* Parse instrumented tool result messages as tool role messages ([#5471](https://github.com/Arize-ai/phoenix/issues/5471)) ([9933521](https://github.com/Arize-ai/phoenix/commit/9933521be4175c14964ab34aede5b12f28b709b8))
* **playground:** add limit on the number of concurrent streams for streaming chat completions over a dataset ([#5440](https://github.com/Arize-ai/phoenix/issues/5440)) ([46ea8e4](https://github.com/Arize-ai/phoenix/commit/46ea8e449583886bb65adaf4dbccf82fc0776c68))
* **playground:** add tool call id to input and output messages ([#5400](https://github.com/Arize-ai/phoenix/issues/5400)) ([283c3e9](https://github.com/Arize-ai/phoenix/commit/283c3e995d80f7fb5697955f50781140919d62f2))
* **playground:** allow serverside api keys ([#5445](https://github.com/Arize-ai/phoenix/issues/5445)) ([dd6a830](https://github.com/Arize-ai/phoenix/commit/dd6a83050aef56ec8f213075f8a443e88a6071c5))
* **playground:** batch chat completion requests for mutation ([#5477](https://github.com/Arize-ai/phoenix/issues/5477)) ([d8189ba](https://github.com/Arize-ai/phoenix/commit/d8189bad220158a407494b62552857fd070e0a7e))
* **playground:** fix tool call ui ([#5467](https://github.com/Arize-ai/phoenix/issues/5467)) ([5c29240](https://github.com/Arize-ai/phoenix/commit/5c2924054c6309cef66089c8f62e61e61561992e))
* **playground:** link to all experiments not just one when running multiple prompts on a dataset ([#5492](https://github.com/Arize-ai/phoenix/issues/5492)) ([91d94a1](https://github.com/Arize-ai/phoenix/commit/91d94a1fdcc197ae996fd0d9af4881e65044c5a3))
* **playground:** return error messages for timeouts and unexpected errors during chat completion over dataset subscription ([#5447](https://github.com/Arize-ai/phoenix/issues/5447)) ([5f6a521](https://github.com/Arize-ai/phoenix/commit/5f6a52130619657aa33e3268319d5073c51771de))
* **playground:** update error handling to show unhandled errors in playground ([#5442](https://github.com/Arize-ai/phoenix/issues/5442)) ([cf24912](https://github.com/Arize-ai/phoenix/commit/cf2491290a23b788df73d53eb4b594dfde913f3a))
* tighten up playground throttling ([#5488](https://github.com/Arize-ai/phoenix/issues/5488)) ([2a3e60e](https://github.com/Arize-ai/phoenix/commit/2a3e60e38e51823868bdc6e1d44a2963d8a38056))

## [5.10.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.9.1...arize-phoenix-v5.10.0) (2024-11-20)


### Features

* Display playground chat completion errors within output card ([#5439](https://github.com/Arize-ai/phoenix/issues/5439)) ([3200245](https://github.com/Arize-ai/phoenix/commit/32002459acacef0882b54c495b1b1f155daf0735))
* Implement "tool" message support for Anthropic ([#5334](https://github.com/Arize-ai/phoenix/issues/5334)) ([b7a9a6c](https://github.com/Arize-ai/phoenix/commit/b7a9a6cf4380b01c5d9dd21443b2b31fff8f40bd))


### Bug Fixes

* **auth:** enable non-https OpenID Connect config URLs for development with local IDPs ([#5418](https://github.com/Arize-ai/phoenix/issues/5418)) ([d78de07](https://github.com/Arize-ai/phoenix/commit/d78de071a3caf2ac83050569ede3155ed6f7bbbb))
* **playground:** add llm provider and llm system attributes to playground spans ([#5429](https://github.com/Arize-ai/phoenix/issues/5429)) ([09fff27](https://github.com/Arize-ai/phoenix/commit/09fff27a8685a62c79b4391837f8e5d786d496f0))
* **playground:** compare invocationName and canonical name in all places where we try to find invocation params ([#5428](https://github.com/Arize-ai/phoenix/issues/5428)) ([3850edd](https://github.com/Arize-ai/phoenix/commit/3850edd36f6eb1584d91651bfa30be27f256e907))

## [5.9.1](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.9.0...arize-phoenix-v5.9.1) (2024-11-19)


### Bug Fixes

* **auth:** ensure auth works behind a proxy ([#5374](https://github.com/Arize-ai/phoenix/issues/5374)) ([b029532](https://github.com/Arize-ai/phoenix/commit/b029532f39113af60a14cde73079bf918e6a2c97))
* Hide Output Schema (response format) button on unsupported provider instances ([#5425](https://github.com/Arize-ai/phoenix/issues/5425)) ([6224363](https://github.com/Arize-ai/phoenix/commit/622436375dc09173ca78326b4ff35c065e88df12))
* **playground:** use saved model config for default model when switching providers ([#5426](https://github.com/Arize-ai/phoenix/issues/5426)) ([afc7d6f](https://github.com/Arize-ai/phoenix/commit/afc7d6f54c90602b31bec791a14c9e82e78771f7))

## [5.9.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.8.0...arize-phoenix-v5.9.0) (2024-11-18)


### Features

* Add Google AI Studio support (for Gemini models w/ an API key) ([#5359](https://github.com/Arize-ai/phoenix/issues/5359)) ([cf9e7f4](https://github.com/Arize-ai/phoenix/commit/cf9e7f43810fd51f4a4e2127ef7c494dd43ba229))
* **playground:** add playground dataset example slideover ([#5324](https://github.com/Arize-ai/phoenix/issues/5324)) ([18333b6](https://github.com/Arize-ai/phoenix/commit/18333b665acc797b7874c5be8b095c6ccf69cbf7))
* **playground:** display streaming outputs for playground runs on datasets ([#5318](https://github.com/Arize-ai/phoenix/issues/5318)) ([ee1d259](https://github.com/Arize-ai/phoenix/commit/ee1d259b932535628484c47b903f5926381a4ac5))
* **playground:** example run slideover ([#5361](https://github.com/Arize-ai/phoenix/issues/5361)) ([fc858e6](https://github.com/Arize-ai/phoenix/commit/fc858e625bddbd315871c9790a4063920acc4279))
* **playground:** graphql mutation for chat completion over dataset ([#5325](https://github.com/Arize-ai/phoenix/issues/5325)) ([d5e133c](https://github.com/Arize-ai/phoenix/commit/d5e133cc0123e8891df3991c41255f5eb24609c7))
* **playground:** pre-emptively show dataset example template application errors in playground dataset table ([#5372](https://github.com/Arize-ai/phoenix/issues/5372)) ([cff0375](https://github.com/Arize-ai/phoenix/commit/cff03750a75a380eb4c176904ee9a031a4493bc5))
* **playground:** support unknown tool / tool call format ([#5401](https://github.com/Arize-ai/phoenix/issues/5401)) ([9309747](https://github.com/Arize-ai/phoenix/commit/930974786496d0430be403e00c62384769c84042))
* **playground:** update PlaygroundDatasetExamplesTable to support mutation (in addition to subscription) ([#5342](https://github.com/Arize-ai/phoenix/issues/5342)) ([78e8a5b](https://github.com/Arize-ai/phoenix/commit/78e8a5b148c568008946e0026c61f0bcc9a2b11e))
* Render field for JSON invocation params ([#5336](https://github.com/Arize-ai/phoenix/issues/5336)) ([b741fc5](https://github.com/Arize-ai/phoenix/commit/b741fc5d37f0824e9a06dece315f055b46d1ed51))


### Bug Fixes

* **auth:** allow login form scroll ([#5366](https://github.com/Arize-ai/phoenix/issues/5366)) ([f801c27](https://github.com/Arize-ai/phoenix/commit/f801c2772c042f76168c84a3488ad04986ba95c1))
* copy output contents on run example ([#5415](https://github.com/Arize-ai/phoenix/issues/5415)) ([e3b6f47](https://github.com/Arize-ai/phoenix/commit/e3b6f47bf6e4165c7ee12dc64a29b608ec399f6c))
* **playground:** add tooltip for dataset examples ([#5352](https://github.com/Arize-ai/phoenix/issues/5352)) ([9a6d16a](https://github.com/Arize-ai/phoenix/commit/9a6d16ab25a87295d719194e4d84ffd2dd2feee8))
* **playground:** fix dataset picker styles and error handling ([#5338](https://github.com/Arize-ai/phoenix/issues/5338)) ([4fdf32e](https://github.com/Arize-ai/phoenix/commit/4fdf32e4fb880a29b2fb772cff83cef35af7cad9))
* **playground:** fix pagination on playground dataset examples table ([#5404](https://github.com/Arize-ai/phoenix/issues/5404)) ([233a27c](https://github.com/Arize-ai/phoenix/commit/233a27c9a5841fb33fdd178f55f5e46511b4dcc9))
* **playground:** for Azure, handle initial chunk with no choices ([#5423](https://github.com/Arize-ai/phoenix/issues/5423)) ([04721ed](https://github.com/Arize-ai/phoenix/commit/04721ed7b34044e242232fa977dcd2e89354c13c))
* **playground:** get token count from streaming client ([#5344](https://github.com/Arize-ai/phoenix/issues/5344)) ([c45e558](https://github.com/Arize-ai/phoenix/commit/c45e558250a217d58c8ea7b2e1e3d5c22b7a92df))
* **playground:** remove extra quotes from tool call function arguments json string ([#5403](https://github.com/Arize-ai/phoenix/issues/5403)) ([60eefec](https://github.com/Arize-ai/phoenix/commit/60eefec057f7c20ff0dc108258a2299c7cd2dd70))
* **playground:** update experiment run for chat completion over dataset mutation ([#5345](https://github.com/Arize-ai/phoenix/issues/5345)) ([8060d24](https://github.com/Arize-ai/phoenix/commit/8060d24884c25edfeea90dcdc22fbe6230148636))
* Prevent over-fetching when typing azure deployment name ([#5421](https://github.com/Arize-ai/phoenix/issues/5421)) ([ecef524](https://github.com/Arize-ai/phoenix/commit/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944))
* replace pyarrow with json for dataframe transfer ([#5375](https://github.com/Arize-ai/phoenix/issues/5375)) ([ab886fc](https://github.com/Arize-ai/phoenix/commit/ab886fca7161637e7e394afcf3fe299ea6b1872d))
* Starlette middleware initialization ([#5424](https://github.com/Arize-ai/phoenix/issues/5424)) ([7e5a92c](https://github.com/Arize-ai/phoenix/commit/7e5a92ca9af70336527772d504b4388c019fdb4f))

## [5.8.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.7.0...arize-phoenix-v5.8.0) (2024-11-11)


### Features

* Add empty state, helper tooltips, when provider clients are not installed in Playground ([#5291](https://github.com/Arize-ai/phoenix/issues/5291)) ([6c33152](https://github.com/Arize-ai/phoenix/commit/6c33152acda24f11bdeac2c56b4c8492e5591e8e))
* Add env var configuration for grpc interceptor extensions ([#5280](https://github.com/Arize-ai/phoenix/issues/5280)) ([6295586](https://github.com/Arize-ai/phoenix/commit/6295586bb75739b5231aa227c48590f3cd173143))
* Add rate limiters to playground clients ([#5289](https://github.com/Arize-ai/phoenix/issues/5289)) ([0efb9f3](https://github.com/Arize-ai/phoenix/commit/0efb9f34acafc57b6864d74538f190a205427a29))
* **playground:** add dataset selector and dataset examples table to playground ([#5297](https://github.com/Arize-ai/phoenix/issues/5297)) ([e403b90](https://github.com/Arize-ai/phoenix/commit/e403b90d766c09c6455f657359f302a266d2dd1d))
* **playground:** add non streaming option to ui ([#5250](https://github.com/Arize-ai/phoenix/issues/5250)) ([5f6976c](https://github.com/Arize-ai/phoenix/commit/5f6976ca5b0f85d797a3055e9a52823a1d529758))
* route to the projects page as the default ([#5319](https://github.com/Arize-ai/phoenix/issues/5319)) ([92e1668](https://github.com/Arize-ai/phoenix/commit/92e16686d3219d536c1ea82fef16c82b5195d55f))
* Support playground anthropic tool calls ([#5296](https://github.com/Arize-ai/phoenix/issues/5296)) ([b6e7499](https://github.com/Arize-ai/phoenix/commit/b6e74999a13d9428063ad73955a1df7a3390f616))
* Support Response Format in Playground ([#5259](https://github.com/Arize-ai/phoenix/issues/5259)) ([d2ff57a](https://github.com/Arize-ai/phoenix/commit/d2ff57a1952ee0f62e155eb46893ba6fb45f5d6f))


### Bug Fixes

* make playground prompts accordion the proper size when collapsed ([#5315](https://github.com/Arize-ai/phoenix/issues/5315)) ([76f0759](https://github.com/Arize-ai/phoenix/commit/76f0759f54397fdc9fd58afbec0cbb82c86ffaeb))
* **playground:** allow scroll in playground prompts ([#5320](https://github.com/Arize-ai/phoenix/issues/5320)) ([04af112](https://github.com/Arize-ai/phoenix/commit/04af1124d23e69cc448586b31f293d18c3752cf4))

## [5.7.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.6.0...arize-phoenix-v5.7.0) (2024-11-06)


### Features

* Add chat completion mutation ([#5255](https://github.com/Arize-ai/phoenix/issues/5255)) ([348fd4c](https://github.com/Arize-ai/phoenix/commit/348fd4c17a65401f0c475c2c401e354a33a26102))
* Add environment configuration for fastapi + gql extensions ([#5275](https://github.com/Arize-ai/phoenix/issues/5275)) ([c0700a3](https://github.com/Arize-ai/phoenix/commit/c0700a3bfd8ed56e7ef763da2d56de948f5ed25a))
* convert tool call schemas between providers ([#5206](https://github.com/Arize-ai/phoenix/issues/5206)) ([16ae9d0](https://github.com/Arize-ai/phoenix/commit/16ae9d0854551a8314756695115fb4f482eca76a))
* Detect websocket availability and pass to client ([#5224](https://github.com/Arize-ai/phoenix/issues/5224)) ([661ec17](https://github.com/Arize-ai/phoenix/commit/661ec1743bda024dc154689d0e64ab40cb87015f))
* Only show providers if dependencies are installed ([#5251](https://github.com/Arize-ai/phoenix/issues/5251)) ([2fd2948](https://github.com/Arize-ai/phoenix/commit/2fd29480409206fe2483ac2ba7dd41949e68fd2e))
* Overhaul invocation parameter specification ([#5228](https://github.com/Arize-ai/phoenix/issues/5228)) ([2e7e670](https://github.com/Arize-ai/phoenix/commit/2e7e670d15078d570bcc3fe3a670a9ffccc695cd))
* **playground:** add `response_format` to invocation parameters ([#5239](https://github.com/Arize-ai/phoenix/issues/5239)) ([2ea4100](https://github.com/Arize-ai/phoenix/commit/2ea4100d62c2f37a6fb80d404fdcfbcf422b89f7))
* **playground:** save model config by provider in preferences ([#5216](https://github.com/Arize-ai/phoenix/issues/5216)) ([d9cb1f1](https://github.com/Arize-ai/phoenix/commit/d9cb1f142af910ea20f1b0085e85b7746dadab17))
* **playground:** streaming chat completion over a dataset ([#5237](https://github.com/Arize-ai/phoenix/issues/5237)) ([cc13eda](https://github.com/Arize-ai/phoenix/commit/cc13eda8f2a4b79c82d575d22ff420fdbaad24ef))
* Provide and then parse invocation params from Span into Playground page store ([#5256](https://github.com/Arize-ai/phoenix/issues/5256)) ([c26e050](https://github.com/Arize-ai/phoenix/commit/c26e050f8d0dec4fc87a9d612116d3130450552e))


### Bug Fixes

* use truncatedValue for descendant span input output values ([#5270](https://github.com/Arize-ai/phoenix/issues/5270)) ([49c0466](https://github.com/Arize-ai/phoenix/commit/49c0466e586cdd083caf490cb1ea94a6c957fcd3))

## [5.6.0](https://github.com/Arize-ai/phoenix/compare/arize-phoenix-v5.5.2...arize-phoenix-v5.6.0) (2024-10-29)


### Features

* Add Annotate button and slide over to run metadata footer ([#5184](https://github.com/Arize-ai/phoenix/issues/5184)) ([106a42f](https://github.com/Arize-ai/phoenix/commit/106a42fd7018d744a3aafb6d8b1bf9a9a03dfc4b))
* Add LLMRelationalEvaluator to phoenix experiments ([#5170](https://github.com/Arize-ai/phoenix/issues/5170)) ([19021e4](https://github.com/Arize-ai/phoenix/commit/19021e4f4780a5d1bec453a1a7d132bd35f67cec))
* Add markdown toggle to playground output cards ([#5212](https://github.com/Arize-ai/phoenix/issues/5212)) ([752b654](https://github.com/Arize-ai/phoenix/commit/752b654d5aca1d94142ee80186bd15f9e7ae24ac))
* **playground:** add token counts for anthropic ([#5161](https://github.com/Arize-ai/phoenix/issues/5161)) ([2eae8c5](https://github.com/Arize-ai/phoenix/commit/2eae8c5df25c4454352d4167b3435675db19ae75))
* **playground:** add tool role messages to ui ([#5103](https://github.com/Arize-ai/phoenix/issues/5103)) ([083ef42](https://github.com/Arize-ai/phoenix/commit/083ef427c794bbf64f66b8ed7e5d8490250050c6))
* **playground:** plumb through message tool_calls from span to playground ([#5197](https://github.com/Arize-ai/phoenix/issues/5197)) ([a1886a0](https://github.com/Arize-ai/phoenix/commit/a1886a022056444c79f244e7750bb9f745ced64b))
* **playground:** plumb through tools on spans to playground ([#5203](https://github.com/Arize-ai/phoenix/issues/5203)) ([be1a103](https://github.com/Arize-ai/phoenix/commit/be1a1030d19eb40b7d4edcab45c3991f6e6c7359))
* Scaffold model invocation params form ([#5040](https://github.com/Arize-ai/phoenix/issues/5040)) ([#5045](https://github.com/Arize-ai/phoenix/issues/5045)) ([6efc700](https://github.com/Arize-ai/phoenix/commit/6efc70087538265068092b6d72b2dbfd6f927688))


### Bug Fixes

* `px.Client().get_dataset_versions` should use `self._client.get` instead of `httpx.get` ([#5220](https://github.com/Arize-ai/phoenix/issues/5220)) ([c810e16](https://github.com/Arize-ai/phoenix/commit/c810e1694914280f024a4f713582dc37179090f0))
* Bubble errors up from nested invocation parameter schema transforms ([#5202](https://github.com/Arize-ai/phoenix/issues/5202)) ([6ccb0c0](https://github.com/Arize-ai/phoenix/commit/6ccb0c0071fc9c1de07b16c2884183e4be562e56))
* Do not pin span in url for playground trace details slideover ([#5200](https://github.com/Arize-ai/phoenix/issues/5200)) ([7f41824](https://github.com/Arize-ai/phoenix/commit/7f418248d39e0f2d739143deb451539b073d37bd))
* **playground:** improve playground error handling ([#5188](https://github.com/Arize-ai/phoenix/issues/5188)) ([b0436d7](https://github.com/Arize-ai/phoenix/commit/b0436d79c64a0db23f46a8fdf3592d1cea965bda))
* remove `embeddings` from core dependencies ([#5150](https://github.com/Arize-ai/phoenix/issues/5150)) ([fab0ca2](https://github.com/Arize-ai/phoenix/commit/fab0ca282096409afaf728ddee8c3567c9a553ba))
* **styles:** make prompt section scrollable to the bottom ([#5173](https://github.com/Arize-ai/phoenix/issues/5173)) ([99a3d1c](https://github.com/Arize-ai/phoenix/commit/99a3d1c0d4adc0b9f64c493769c8c87f9f3d136f))
* update to properly initialize when brought into view ([#5172](https://github.com/Arize-ai/phoenix/issues/5172)) ([26aae5e](https://github.com/Arize-ai/phoenix/commit/26aae5e4c7a8a63cdc66106cb3c30f55ca678d79))


### Documentation

* Typo Fix ([#5157](https://github.com/Arize-ai/phoenix/issues/5157)) ([31749b2](https://github.com/Arize-ai/phoenix/commit/31749b246a168f22ca387e046db90562e25937bd))

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
