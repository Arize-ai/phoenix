---
描述：人工智能可观察性和评估
---

# Arize Phoenix

Phoenix 是一个开源的可观测性库，用于实验、评估和故障排除。它允许人工智能工程师和数据科学家快速可视化数据、评估性能、追踪问题并导出数据以进行改进。
Phoenix 由[Arize AI](https://www.arize.com)和一组核心贡献者共同开发，该公司是业界领先的人工智能可观测性平台的幕后推手。

## 安装 Phoenix

{% 选项卡 %}
{% 选项卡标题=“使用pip” %}
在 Jupyter 或 Colab 环境中，运行以下命令进行安装。

```sh
pip install arize-phoenix
```

有关如何在 Databricks 等各种环境中运行 phoenix 的详细信息，请参阅我们的[环境指南。](deployment/environments.md)
{% 选项卡结束 %}

{% tab title=“使用conda” %}

```sh
conda install -c conda-forge arize-phoenix[evals]
```

{% endtab %}

{% tab title=“容器” %}
Phoenix 也可以通过容器运行。镜像地址：

{% embed url=“https://hub.docker.com/r/arizephoenix/phoenix” %}
phoenix 的镜像发布在 dockerhub 上
{% endembed %}

查看[环境部分](deployment/environments.md)和[部署指南](deployment/deploying-phoenix.md)了解详情。
{% endtab %}
{% endtabs %}

Phoenix 可与 OpenTelemetry 和[OpenInference](https://github.com/Arize-ai/openinference)工具配合使用。如果您希望将 phoenix 部署为服务而非库，请参阅[部署](deployment/ “mention”)

## 快速入门

这是您第一次运行 Phoenix 吗？请选择以下快速入门。

<table data-card-size=“large” data-view=“cards”><thead><tr><th align=“center”></th><th data-hidden data-card-target data-type=“content-ref”></th><th data-hidden data-card-cover data-type=“files”></th></tr></thead><tbody><tr><td align=“center”><strong>追踪</strong></td><td><a href=” tracing/llm-traces-1.md“>llm-traces-1.md</a></td><td><a href=”.gitbook/assets/Screenshot 2023-09-27 at 1.51.45 PM.png">Screenshot 2023-09-27 at 1.51.45 PM.png</a ></td></tr><tr><td align=“center”><strong>评估</strong></td><td><a href=“evaluation/evals.md”>evals.md</a></td><td><a href=“.gitbook/assets/evals.png”>evals.png</a></td></tr><tr><td align=“center”><strong>推论</strong></td><td><a href="inferences/ phoenix-inferences.md“>phoenix-inferences.md</a></td><td><a href=”.gitbook/assets/Screenshot 2023-09-27 at 1.53.06 PM.png">Screenshot 2023-09-27 at 1.53.06 PM.png</a></td></tr><tr ><td align=“center”><strong>数据集和实验</strong></td><td><a href=“datasets-and-experiments/quickstart-datasets.md”>quickstart-datasets.md</a></td><td><a href=“.gitbook/assets/experiments_preview.png”>experiments_preview.png</a></td></tr></tbody></table>

## 可用的软件包

Phoenix 的主要软件包是 arize-phoenix。我们为特定用例提供了以下几个辅助软件包。

| 软件包             | 用途                                                                                                                                                                                                                                            | Pypi                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| arize-phoenix      | <p>运行并连接到 Phoenix 客户端。使用：<br>- 自托管 Phoenix<br>- 连接到 Phoenix 客户端（Phoenix 开发版或自托管版）以查询跨度、运行评估、生成数据集等。<br><br><em>\*arize-phoenix 会自动包含 ari ze-phoenix-otel 和 arize-phoenix evals</em></p> | <img src=“https://img.shields.io/pypi/v/arize-phoenix” alt=“PyPI - Version” data-size=“original”>      |
| arize-phoenix-otel | 将 OpenTelemetry 跟踪发送到 Phoenix 实例                                                                                                                                                                                                        | <img src=“https://img.shields.io/pypi/v/arize-phoenix-otel” alt=“PyPI - Version” data-size=“original”> |

arize-phoenix-evals 在您的环境中运行评估 <img src=“https://img.shields.io/pypi/v/arize-phoenix-evals” alt=“PyPI - Version” data-size=“original”>
| openinference-semantic-conventions | 我们的语义层，用于将 LLM 遥测添加到 OpenTelemetry 中。<img src=“https://img.shields.io/pypi/v/openinference-semantic-conventions” alt=“PyPI - Version” data-size=“original”> |
| openinference-instrumentation-xxxx | 自动检测常用软件包。| 参见 [integrations-tracing](tracing/integrations-tracing/ “mention”) |

## 下一步

### [尝试我们的教程](notebooks.md)

查看 LLM 跟踪、评估、RAG 分析等示例笔记本的完整列表。

### [社区](https://join.slack.com/t/arize-ai/shared/_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)

加入 Phoenix Slack 社区，提出问题、分享发现、提供反馈并与其他开发人员交流。
