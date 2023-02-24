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

Install with `pip` 🐍

```shell
pip install arize-phoenix
```

## Getting Started

Import `phoenix` 🔥🐦

```
import phoenix as px
```

Load example datasets 📊
```
train_ds, prod_ds = px.load_dataset("sentiment_classification_language_drift")
```

Launch the app 🛫
```
px.launch_app()
```

Explore your embeddings to identify problematic clusters of your production data 🌌

TODO: Include GIF where we navigate to embeddings, zoom in and rotate, and select a cluster.

Close the app when you're done 🛬
```
px.close_app()
```

## Documentation

For in-depth examples and explanations, read the docs 📖 TODO: Add link

## Community

Join our community to connect with thousands of machine learning practitioners and ML observability enthusiasts 👁️

- Join the [Arize Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q) 🌍
- Ask questions and provide feedback in the *#phoenix-support* channel 💡
- Leave a 🌟 on our [GitHub](https://github.com/Arize-ai/phoenix)
- Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues) 🐞
- Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next 🗺️📍
- Learn the fundamentals of ML observability with our [introductory](https://arize.com/ml-observability-fundamentals/) and [advanced](https://arize.com/blog-course/) courses 🎓
- Check out the [Arize blog](https://arize.com/blog/) ✏️
- Subscribe to the Arize newsletter ✉️ TODO: Add link
- Watch the [Arize YouTube channel](https://www.youtube.com/@arizeai9240/videos) 📺
- Follow us on [Twitter](https://twitter.com/ArizePhoenix) 🐦
- Check out our LinkedIn 👔 TODO: Add link, fix badge



## Contributing

- Read our [developer's guide](./DEVELOPMENT.md) 💻
- Join the [Arize Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q) and chat with us in the *#phoenix-devs* channel 🗣️

## License
Arize-Phoenix is licensed under the [Elastic License 2.0 (ELv2)](./LICENSE).
