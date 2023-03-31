<p align="center">
    <a target="_blank" href="https://arize.com" style="background:none">
        <img alt="phoenix logo" src="https://storage.googleapis.com/arize-assets/phoenix/assets/phoenix-logo-light.svg" width="auto" height="200"></img>
    </a>
    <br/>
    <br/>
    <a href="https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q">
        <img src="https://img.shields.io/badge/slack-Arize%20AI%20Community-blue.svg?logo=slack"/>
    </a>
    <a href="https://pypi.org/project/arize-phoenix/">
        <img src="https://img.shields.io/pypi/v/arize-phoenix?color=blue">
    </a>
    <a href="https://pypi.org/project/arize-phoenix/">
        <img src="https://img.shields.io/pypi/pyversions/arize-phoenix">
    </a>
</p>

Phoenix provides MLOps insights at lightning speed with zero-config observability for model drift, performance, and data quality.

**_Phoenix is under active development. APIs may change at any time._**

## Installation

```shell
pip install arize-phoenix
```

## Try it out

In this section, you will get Phoenix up and running with a few lines of code.

After installing `arize-phoenix` in your Jupyter or Colab environment, open your notebook and run

```python
import phoenix as px

datasets = px.load_example("sentiment_classification_language_drift")
session = px.launch_app(datasets.primary, datasets.reference)
```

Next, visualize your embeddings and inspect problematic clusters of your production data.

Don't forget to close the app when you're done.

```
px.close_app()
```

For more details, check out the [Sentiment Classification Tutorial](./tutorials/sentiment_classification_tutorial.ipynb).

## Documentation

For in-depth examples and explanations, read the [docs](https://docs.arize.com/phoenix).

## Community

Join our community to connect with thousands of machine learning practitioners and ML observability enthusiasts.

-   🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q).
-   💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
-   🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
-   🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
-   🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
-   🎓 Learn the fundamentals of ML observability with our [introductory](https://arize.com/ml-observability-fundamentals/) and [advanced](https://arize.com/blog-course/) courses.

## Contributing

-   💻 Read our [developer's guide](./DEVELOPMENT.md).
-   🗣️ Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q) and chat with us in the _#phoenix-devs_ channel.

## License

Arize-Phoenix is licensed under the [Elastic License 2.0 (ELv2)](./LICENSE).
