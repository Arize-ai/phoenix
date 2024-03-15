# Online Evals Periodic Running

The following documentation works through running online Evals client side as traces and spans are generated. The spans are collected in Phoenix and run through Evals, augmenting the dataset periodically.&#x20;

<figure><img src="../.gitbook/assets/oneline Evals.png" alt=""><figcaption></figcaption></figure>

Client Side Online Eval Script:

* The script loads persisted data in new phoenix session&#x20;
* Data is filtered down to the last 2 days
* Data is also filtered to only look at the traces & spans that are missing Evals
* Evals are run in a batch&#x20;
* The data is sent back to phoenix and persisted

The script can be run as a Chron Job using the following chrontab script&#x20;

```
*/5 * * * * /usr/bin/python3 /path/to/your/periodically_get_spans.py
```

The Evals that are run in this script include:

* Hallucination
* Q\&A Evals
* Retrieval Evals

The Hallucination and Q\&A evals run on the QA spans where the retrieval Evals run on the document retriever spans.

Python Script here:\


{% file src="../.gitbook/assets/online_evals_periodic_eval_chron.py" %}
