# Running Phoenix Evals with Cron

This example demonstrates how to compute and upload Phoenix evals on a regular schedule using `cron`.

## Setup

Install project dependencies using

```
pip install -r requirements.txt
```

First, build and persist LangChain Qdrant vector store over the Arize documentation by running

```
python build_vector_store.py
```

This script will persist your vector store to the `qdrant` directory.

Run Phoenix with

```
python -m phoenix.server.main serve
```

In a new terminal, define, instrument, and run a LangChain `RetrievalQA` chain to answer queries over your newly created vector store.

```
python run_chain.py
```

This script will loop indefinitely while emitting traces to your running instance of Phoenix. At this point, you should confirm that traces are appearing in the Phoenix app.


Add the following line to your crontab, replacing the paths witih the actual paths to your Python interpreter and script.

```
0 * * * * /path/to/python /path/to/phoenix/examples/cron-evals/run_evals.py
```
