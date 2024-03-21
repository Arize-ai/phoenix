---
description: Run evals periodically with cron
---

# Online Evals

You can use cron to run evals client-side as your traces and spans are generated, augmenting your dataset with evaluations in an online manner. View the [example in Github](https://github.com/Arize-ai/phoenix/tree/main/examples/cron-evals).

<figure><img src="../.gitbook/assets/oneline Evals.png" alt=""><figcaption></figcaption></figure>

This example:

* Continuously queries a LangChain application to send new traces and spans to your Phoenix session
* Queries new spans once per minute and runs evals, including:
  * Hallucination
  * Q\&A Correctness
  * Relevance
* Logs evaluations back to Phoenix so they appear in the UI

The evaluation script is run as a cron job, enabling you to adjust the frequency of the evaluation job:

```
* * * * * /path/to/python /path/to/run_evals.py
```

{% file src="../.gitbook/assets/online_evals_periodic_eval_chron.py" %}
Example Online Evals Script
{% endfile %}

The above script can be run periodically to augment Evals in Phoenix.

