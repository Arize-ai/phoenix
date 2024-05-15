---
description: Frequently asked questions about deploying phoenix
---

# FAQs: Deployment

## Permission denied writing to disc

The phoenix containers run as nonroot and therefore must be granted explicit write permissions to the mounted disc.

## Persistence using launch\_app

While it's not recommended to deploy phoenix via `launch_app` which is designed to be used only in jupyter notebooks, you can set the `use_temp_dir` parameter to false to write to the PHOENIX\_WORKING\_DIR. See [configuration.md](../setup/configuration.md "mention")

## Interacting with a deployed instance

If you have deployed a phoenix instance, there is no need to use `px.launch_app`. Simply set the endpoint parameter in `px.Client` to the url of your phoenix instance. See [client.md](../api/client.md "mention")
