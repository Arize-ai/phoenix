<p align="center">
    <a target="_blank" href="https://arize.com" style="background:none">
        <img alt="phoenix logo" src="./assets/phoenix-logo-light.svg" width="auto" height="200"></img>
    </a>
    <br/>
    <br/>
    <a href="https://twitter.com/ArizePhoenix">
        <img src="https://img.shields.io/badge/twitter-%40ArizePhoenix-blue.svg?logo=twitter&logoColor=white"/>
    </a>
    <a href="https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q">
        <img src="https://img.shields.io/badge/slack-Arize%20AI%20Community-blue.svg?logo=slack"/>
    </a>
    <a href="https://www.linkedin.com/company/arizeai/mycompany/">
        <img src="https://img.shields.io/badge/linkedin-Arize--Phoenix-blue.svg?logo=linkedin"/>
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

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Community](#community)
- [Contributing](#contributing)
- [License](#license)

## Installation

```shell
pip install arize-phoenix
```

## Getting Started

In this section, you will get Phoenix up and running with a few lines of code.

After installing `arize-phoenix` in your Jupyter or Colab environment, open your notebook and run

```python
import phoenix as px

train_ds, prod_ds = px.load_dataset("sentiment_classification_language_drift")
px.launch_app(train_ds, prod_ds)
```

Next, visualize your embeddings and inspect problematic clusters of your production data.

TODO(#297): Include GIF where we navigate to embeddings, zoom in and rotate, and select a cluster.

Don't forget to close the app when you're done.
```
px.close_app()
```

For more details, check out the [Sentiment Classification Tutorial](./examples/sentiment_classification_tutorial.ipynb).

## Documentation

For in-depth examples and explanations, read the [docs](https://docs.arize.com/phoenix).

## Community

Join our community to connect with thousands of machine learning practitioners and ML observability enthusiasts 👁️

- 🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q).
- 💡 Ask questions and provide feedback in the *#phoenix-support* channel.
- 🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
- 🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
- 🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
- 🎓 Learn the fundamentals of ML observability with our [introductory](https://arize.com/ml-observability-fundamentals/) and [advanced](https://arize.com/blog-course/) courses.
- ✏️ Check out our [blog](https://arize.com/blog/). TODO(#291): Add blog filter for Phoenix
- ✉️ Subscribe to our mailing list. TODO(#294): Add link
- 🐦 Follow us on [Twitter](https://twitter.com/ArizePhoenix).
- 👔 Check out our LinkedIn. TODO(#292): Add link, fix badge

## Contributing

- 💻 Read our [developer's guide](./DEVELOPMENT.md).
- 🗣️ Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q) and chat with us in the *#phoenix-devs* channel.

## License
Arize-Phoenix is licensed under the [Elastic License 2.0 (ELv2)](./LICENSE).
