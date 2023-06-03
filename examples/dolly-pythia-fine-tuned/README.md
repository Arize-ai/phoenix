# Dolly vs. Pythia Comparison

The notebooks in this directory are used to:

- Generate responses from prompts from the Alpaca dataset, an instruction-following dataset, using two generative LLM models, Dolly and Pythia. Pythia is a generative LLM from [Eleuther AI](https://www.eleuther.ai/). Dolly is a Pythia base model that has been fine-tuned on an instruction-following dataset (also named Dolly).
- Extract and visualize embeddings from each model during response generation.
- Evaluate each model using a more powerful LLM, in this case, GPT-4.
- Visualize your data in Phoenix.

The data used in `dolly_vs_pythia.ipynb` was created from the `create_data_with_dolly_and_pythia.ipynb` notebook. You can either
- Run `dolly_vs_pythia.ipynb` by itself to download previously computed data.
- Run `create_data_with_dolly_and_pythia.ipynb` to create and save your own data, then run `dolly_vs_pythia.ipynb` to run with your own data (you'll need to change the path to the dataframe).
