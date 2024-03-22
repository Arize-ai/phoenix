---
description: >-
  Easily share data when you discover interesting insights so your data science
  team can perform further investigation or kickoff retraining workflows.
---

# Export Data from Arize to Phoenix

Oftentimes, the team that notices an issue in their model, for example a prompt/response LLM model, may not be the same team that continues the investigations or kicks off retraining workflows.&#x20;

To help connect teams and workflows, Phoenix enables continued analysis of production data from [Arize](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/-MAlgpMyBRcl2qFZRQ67/) in a notebook environment for fine tuning workflows.&#x20;

For example, a user may have noticed in [Arize](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/-MAlgpMyBRcl2qFZRQ67/) that this prompt template is not performing well.

<figure><img src="../.gitbook/assets/image (1) (2).png" alt=""><figcaption><p>Arize UI, investigating prompt template: "You are an agent created to accurately translate sentences into the desired language."</p></figcaption></figure>

With a few lines of Python code, users can export this data into Phoenix for further analysis. This allows team members, such as data scientists, who may not have access to production data today, an easy way to access relevant product data for further analysis in an environment they are familiar with.&#x20;

They can then easily augment and fine tune the data and verify improved performance, before deploying back to production.&#x20;

There are two ways export data out of [Arize](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/-MAlgpMyBRcl2qFZRQ67/) for further investigation:

1. The easiest way is to click the export button on the Embeddings and Datasets pages. This will produce a code snippet that you can copy into a Python environment and install Phoenix. This code snippet will include the date range you have selected in the [Arize](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/-MAlgpMyBRcl2qFZRQ67/) platform, in addition to the datasets you have selected.

<figure><img src="../.gitbook/assets/image (4).png" alt=""><figcaption><p>Export button on Embeddings tab in Arize UI</p></figcaption></figure>

<figure><img src="../.gitbook/assets/image (6).png" alt=""><figcaption><p>Export to Phoenix module in Arize UI</p></figcaption></figure>

2. Users can also query [Arize](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/-MAlgpMyBRcl2qFZRQ67/) for data directly using the Arize Python export client. We recommend doing this once you're more comfortable with the in-platform export functionality, as you will need to manually enter in the data ranges and datasets you want to export.

```python
os.environ['ARIZE_API_KEY'] = ARIZE_API_KEY

from datetime import datetime

from arize.exporter import ArizeExportClient
from arize.utils.types import Environments

client = ArizeExportClient()

primary_df = client.export_model_to_df(
    space_id='U3BhY2U6NzU0',
    model_name='test_home_prices_LLM',
    environment=Environments.PRODUCTION,
    start_time=datetime.fromisoformat('2023-02-11T07:00:00.000+00:00'),
    end_time=datetime.fromisoformat('2023-03-14T00:59:59.999+00:00'),
)
```

#### Test out this workflow by signing up for a [free Arize account](https://app.arize.com/auth/join).
