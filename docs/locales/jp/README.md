---
説明: AI 観測性と評価
---

# Arize Phoenix

Phoenix は、実験、評価、トラブルシューティング用に設計されたオープンソースの観測性ライブラリです。AI エンジニアやデータサイエンティストがデータを迅速に可視化し、パフォーマンスを評価し、問題を追跡し、データをエクスポートして改善できるようにします。 Phoenixは、業界をリードするAI可視化プラットフォームを提供する企業である[Arize AI](https://www.arize.com)と、コアな貢献者たちによって開発されました。

## Phoenixのインストール

{% tabs %}
{% tab title="Python" %}
JupyterまたはColab環境で、次のコマンドを実行してインストールします。

```sh
pip install arize-phoenix
```

Databricks などのさまざまな環境で phoenix を実行する方法の詳細については、環境ガイド を参照してください.
{% endtab %}

{% tab title="Conda" %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}

{% tab title="コンテナ" %}
Phoenixはコンテナでも実行できます。イメージは次の場所にあります.

詳細は、[環境セクション](deployment/environments.md)とデプロイメントガイドを参照してください。
{% endtab %}
{% endtabs %}

PhoenixはOpenTelemetryと[OpenInference](https://github.com/Arize-ai/openinference) のインストゥルメンテーションと連携します。ライブラリではなくサービスとしてPhoenixをデプロイしたい場合は、Deployment を参照してください.

### [コミュニティ](https://join.slack.com/t/arize-ai/shared_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)

Phoenix Slack コミュニティに参加して、質問をしたり、調査結果を共有したり、フィードバックを提供したり、他の開発者とつながったりしましょう。
