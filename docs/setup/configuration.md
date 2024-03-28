---
description: How to configure Phoenix for your needs
---

# Configuration

## Environment Variables

Phoenix uses environment variables to control how data is sent, received, and stored. Here is the comprehensive list:

* **PHOENIX\_PORT:** The port to run the phoenix server. Defaults to 6006 (since this port works best with other tools like SageMaker notebooks. )
* &#x20;**PHOENIX\_HOST:** The host to run the phoenix server. Defaults to 0.0.0.0&#x20;
* **PHOENIX\_NOTEBOOK\_ENV:** The notebook environment. Typically you do not need to set this but it can be set explicitly (e.x. `sagemaker`)
* **PHOENIX\_COLLECTOR\_ENDPOINT:** The endpoint traces and evals are sent to. This must be set if the Phoenix server is running on a remote instance. For example if phoenix is running at `http://125.2.3.5:4040` , this environment variable must be set where your LLM application is running and being traced. Note that the endpoint should not contain trailing slashes or slugs.
* &#x20;**PHOENIX\_WORKING\_DIR:** The directory in which to save, load, and export datasets. This directory must be accessible by both the Phoenix server and the notebook environment.&#x20;
* **PHOENIX\_PROJECT\_NAME:** The project under which traces will be sent. See [projects](../tracing/how-to-tracing/customize-traces.md#log-to-a-specific-project).
