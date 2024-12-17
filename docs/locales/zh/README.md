---
'0': 描
'1': 述
'2': ：
'3': 人
'4': 工
'5': 智
'6': 能
'7': 可
'8': 观
'9': 察
'10': 性
'11': 和
'12': 评
'13': 估
---

# Arize Phoenix

Phoenix 是一个开源的可观测性库，用于实验、评估和故障排除。它允许人工智能工程师和数据科学家快速可视化数据、评估性能、追踪问题并导出数据以进行改进。 Phoenix 由[Arize AI](https://www.arize.com)和一组核心贡献者共同开发，该公司是业界领先的人工智能可观测性平台的幕后推手。

## 安装 Phoenix

\{% 选项卡 %\} \{% 选项卡标题=“使用pip” %\} 在 Jupyter 或 Colab 环境中，运行以下命令进行安装。

```sh
pip install arize-phoenix
```

有关如何在 Databricks 等各种环境中运行 phoenix 的详细信息，请参阅我们的环境指南。 \{% 选项卡结束 %\}

```sh
conda install -c conda-forge arize-phoenix[evals]
```

Phoenix 也可以通过容器运行。镜像地址：

查看环境部分和部署指南了解详情。

Phoenix 可与 OpenTelemetry 和[OpenInference](https://github.com/Arize-ai/openinference)工具配合使用。如果您希望将 phoenix 部署为服务而非库，请参阅\[部署]\(deployment/ “mention”)



## 可用的软件包

Phoenix 的主要软件包是 arize-phoenix。我们为特定用例提供了以下几个辅助软件包。

| 软件包                | 用途                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| arize-phoenix      | <p>运行并连接到 Phoenix 客户端。使用：<br>- 自托管 Phoenix<br>- 连接到 Phoenix 客户端（Phoenix 开发版或自托管版）以查询跨度、运行评估、生成数据集等。<br><br><em>*arize-phoenix 会自动包含 ari ze-phoenix-otel 和 arize-phoenix evals</em></p> |
| arize-phoenix-otel | 将 OpenTelemetry 跟踪发送到 Phoenix 实例                                                                                                                                                       |

## 下一步

### [社区](https://join.slack.com/t/arize-ai/shared/_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg)

加入 Phoenix Slack 社区，提出问题、分享发现、提供反馈并与其他开发人员交流。
