---
説明: AI 観測性と評価
---
# Arize Phoenix
Phoenix は、実験、評価、トラブルシューティング用に設計されたオープンソースの観測性ライブラリです。AI エンジニアやデータサイエンティストがデータを迅速に可視化し、パフォーマンスを評価し、問題を追跡し、データをエクスポートして改善できるようにします。
Phoenixは、業界をリードするAI可視化プラットフォームを提供する企業である[Arize AI](https://www.arize.com)と、コアな貢献者たちによって開発されました。
## Phoenixのインストール
{% tabs %}
{% tab title=「pipの使用」 %}
JupyterまたはColab環境で、次のコマンドを実行してインストールします。
```sh
pip install arize-phoenix
```
Databricks などのさまざまな環境で phoenix を実行する方法の詳細については、[環境ガイド] を参照してください。(deployment/environments.md)
{% endtab %}
{% tab title=「Using conda」 %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}
{% tab title=「Container」 %}
Phoenixはコンテナでも実行できます。イメージは次の場所にあります。
{% embed url=「https://hub.docker.com/r/arizephoenix/phoenix」 %}
PhoenixのイメージはDockerHubで公開されています
{% endembed %}
詳細は、[環境セクション](deployment/environments.md)と[デプロイメントガイド](deployment/deploying-phoenix.md)を参照してください。
{% endtab %}
{% endtabs %}
PhoenixはOpenTelemetryと[OpenInference](https://github.com/Arize-ai/openinference)のインストゥルメンテーションと連携します。ライブラリではなくサービスとしてPhoenixをデプロイしたい場合は、[deployment](deployment/ 「mention」)を参照してください


## クイックスタート
Phoenixを初めて実行しますか？以下のクイックスタートを選択してください。
クイックスタート 初めてPhoenixを実行しますか？ 以下のクイックスタートを選択してください。 <table data-card-size=「large」 data-view=「cards」><thead><tr><th align=「center」></th><th data-hidden data-card-target data-type=「content-ref」></th><th data-hidden data-card-cover data-type=「files」></th></tr></thead><tbody><tr><td align=「center」><strong>トレース</strong></td><td><a href=」 tracing/llm-traces-1.md「>llm-traces-1.md</a></td><td><a href=」.gitbook/assets/Screenshot 2023-09-27 at 1.51.45 PM.png「>Screenshot 2023-09-27 at 1.51.45 PM.png</a></td></tr><tr><td align=」center「><strong>評価</strong></td><td><a href=」evaluation/evals.md「>evals.md</a></td><td><a href=」.gitbook/ ></td></tr><tr><td align=「center」><strong>評価</strong></td><td><a href=「evaluation/evals.md」>evals.md</a></td><td><a href=「.gitbook/assets/evals.png」>evals.png</a></td></tr><tr><td align=「center」><strong>推論</strong></td><td><a href="inferences/ phoenix-inferences.md</a></td><td><a href=「.gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png」>Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr><tr ><td align=「center」><strong>Datasets and Experiments</strong></td><td><a href=「datasets-and-experiments/quickstart-datasets.md」>quickstart-datasets.md</a></td><td><a href=「.gitbook/assets/experiments_preview.png」>experiments_preview.png</a></td></tr></tbody></table>
## 利用可能なパッケージ
Phoenixのメインパッケージはarize-phoenixです。 特定のユースケースに対応するヘルパーパッケージを以下にいくつか提供しています。
| パッケージ名
| arize-phoenix                      | <p>Phoenix クライアントの実行と接続。 使用:<br>- Phoenix のセルフホスティング<br>- Phoenix クライアント（Phoenix Developer Edition またはセルフホスティング）への接続（スパンへの問い合わせ、評価の実行、データセットの生成など）<br><br><em>*arize-phoenix は自動的に arize -phoenix-otelとarize-phoenix-evals</em></p>が自動的に含まれます。 <img src=「https://img.shields.io/pypi/v/arize-phoenix」 alt=「PyPI - Version」 data-size=「original」>                      |
| arize-phoenix-otel | Phoenix インスタンスに OpenTelemetry トレースを送信します。 <img src=「https://img.shields.io/pypi/v/arize-phoenix-otel」 alt=「PyPI - Version」 data-size=「original」>
arize-phoenix-otel | Phoenix インスタンスに OpenTelemetry トレースを送信
arize-phoenix-evals                | あなたの環境で評価を実行中                                                                                                                                                                                                                                                                                             | <img src=「https://img.shields.io/pypi/v/arize-phoenix-evals」 alt=「PyPI - Version」 data-size=「original」>                |
| openinference-semantic-conventions | OpenTelemetryにLLMテレメトリを追加する弊社のセマンティックレイヤー
openinference-instrumentation-xxxx | 人気のあるパッケージを自動的にインストルメント化します。
### [コミュニティ](https://join.slack.com/t/arize-ai/shared_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)
Phoenix Slack コミュニティに参加して、質問をしたり、調査結果を共有したり、フィードバックを提供したり、他の開発者とつながったりしましょう。
