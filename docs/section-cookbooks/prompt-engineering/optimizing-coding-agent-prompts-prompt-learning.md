---
description: Optimizing coding agent prompts and tracking coding agent improvement
---

# Optimizing Coding Agent Prompts - Prompt Learning

## Task Description

### Coding Agents and Rule Files

Coding agents are a focal point of agent development today. They are often described as the industry's most powerful agents, using state of the art LLMs, descriptive and effective tools, and carefully crafted architectures. Coding agents like Claude Code, Cursor, Cline, etc. tend to use one large system prompt for the entire application. Since this prompt plays a huge role in the execution of the agent, rule files are offered - where the user can write down a custom set of instructions to be appended to the system prompt. Developers spend time thinking about writing good rules so their coding agents can perform better.

In this cookbook, we use Prompt Learning, an optimization technique, to optimize a user's coding agent rules automatically. We use Prompt Learning to generate rulesets that lead to better accuracy for the user's coding agent on their tasks.

### What is Prompt Learning?

Prompt Learning is an algorithm developed by Arize to optimize prompts based on data.

See our [detailed blog on Prompt Learning](https://arize.com/blog/prompt-learning-using-english-feedback-to-optimize-llm-systems/), and/or a quick summary of the algorithm below.

<figure><img src="../../../.gitbook/assets/Screenshot 2025-10-13 at 11.22.19 AM.png" alt=""><figcaption></figcaption></figure>

The pipeline works as follows:

* Build dataset of inputs/queries
* Generate outputs with your unoptimized, base prompt
* Build LLM evals or human annotations to return **natural language feedback**
  * e.g. explanations -> why this output was correct/incorrect (most powerful)
  * e.g. confusion reason -> why the model may have been confused
  * e.g. improvement suggestions -> where the prompt should be improved based on this input/output pair
* Use meta-prompting to optimize the original prompt
  * feed prompt + inputs + outputs + evals + annotations to another LLM
  * ask it to generate an optimized prompt!
* Run and evaluate new, optimized prompt with another experiment

### Cline - Coding Agent

We chose to optimize Cline - a powerful, open source coding agent. We chose Cline because its open source - which allowed us to run benchmarks like SWE Bench (see below) much more easily!

Cline exposes its rules through ./clinerules, in every project.

Specifically, we'll be running Cline in **Act Mode** - where Cline actually edits the codebase and generates patches. It will have full permissions to read, edit, delete, or generate any files.

[More about Cline](https://cline.bot/get-cline?utm_source=google\&utm_medium=cpc\&utm_campaign=22808605657\&utm_content=cline%20ai%20coding\&utm_term=engine:google|campaignid:22808605657|adid:764554892819|gclid:CjwKCAjwxrLHBhA2EiwAu9EdM-9DCoV4EspjzoXRVw0nXuGlUX27wzHzqcrAV-B881iMZe-liJ5_vxoC28kQAvD_BwE\&gad_source=1\&gad_campaignid=22808605657\&gbraid=0AAAAA-2etQiiDMXnFfRW5A1eD6Xdi_y-H\&gclid=CjwKCAjwxrLHBhA2EiwAu9EdM-9DCoV4EspjzoXRVw0nXuGlUX27wzHzqcrAV-B881iMZe-liJ5_vxoC28kQAvD_BwE)

[./clinerules](https://docs.cline.bot/features/cline-rules)

### Benchmark - SWE Bench

We need a way to test the rules we are generating/optimizing. For this, we use widely known benchmark SWE Bench Lite - a set of 300 real issue pull requests from famous Python repositories, like Scikit-learn or Sympy.

### Phoenix - Experiment Tracking

We use [Phoenix's Experiments feature](https://arize.com/docs/phoenix/datasets-and-experiments/overview-datasets) to track our Cline runs. Every time we run Cline with a ruleset, we can log that experiment to Phoenix, and track improvements over time.

## Setup

### Prompt Learning Repository + Cline Cookbook

To view and run this cookbook, first clone the Prompt Learning repository.

```
git clone https://github.com/Arize-ai/prompt-learning.git
```

Navigate to `cline` -> `act_mode` -> `optimize_cline_act_PX.ipynb`

You can see the notebook [here](https://github.com/Arize-ai/prompt-learning/blob/main/cline/act_mode/optimize_cline_act_PX.ipynb). But keep in mind **you will have to clone the repositor**y and run the notebook within the `cline` folder for the notebook to run!

### Cline + SWE Bench Setup

Make sure to go through `cline` -> `README.md` . This walks you through how to set up Cline and SWE Bench.

### Configuration

Configure the optimization with the following parameters:

```python
LOOPS = 5
TRAIN_SIZE = 150
TEST_SIZE = 150
WORKERS = 52
```

**`LOOPS`**: How many Prompt Learning loops - how many times you want to optimize Cline's rules. We will be starting a blank, empty ruleset. So loop #1 generates a set of rules from scratch, and all loops afterwards will be optimizing the last loop's ruleset.

**`TRAIN_SIZE` :** Size of training set. SWE Bench Lite has 300 datapoints. Here you can select how many of those datapoints you want to use to train the Prompt Learning optimizer on.

**`TEST_SIZE` :** Size of test set. Here you can select how many SWE Bench Lite datapoints you want to test each Cline ruleset with.

**`WORKERS` :** Concurrency. SWE-bench with Cline is set up to run in parallel, with however many workers you specify. 50 workers means each training/test set runs 50 examples at a time.

{% hint style="info" %}
An individual Cline run can make anywhere from 5-25 LLM calls, making it an expensive task. Running Cline in parallel can also trigger rate limiting, depending on your plan with the LLM provider.

\
Select your TRAIN\_SIZE, TEST\_SIZE, and WORKERS accordingly.
{% endhint %}

{% hint style="info" %}
We recommend a 50/50 split here. A healthy balance between enough training data for Prompt Learning to succeed, but also enough test data for new rules to be properly evaluated, is required. Too much training data -> overfitting, too much test data - unreliable test accuracies.
{% endhint %}

### Train/Test Datasets

Let's load SWE Bench Lite, split it into train/test datasets, and then upload our training set to Phoenix.

```python
from phoenix.client import Client

phoenix_client = Client(base_url=HOSTNAME, api_key=os.getenv("PHOENIX_API_KEY"))

train_dataset = phoenix_client.datasets.create_dataset(
    name="Cline Act Mode: SWE-bench Train",
    dataset_description="Cline Act Mode: SWE-bench Train",
    dataframe=train_pd,
    input_keys=['problem_statement'],
    metadata_keys=['instance_id', 'test_patch'],
    output_keys=[]
)

test_dataset = phoenix_client.datasets.create_dataset(
    name="Cline Act Mode: SWE-bench Test",
    dataset_description="Cline Act Mode: SWE-bench Test",
    dataframe=test_pd,
    input_keys=['problem_statement'],
    metadata_keys=['instance_id', 'test_patch'],
    output_keys=[]
)
```

### Helper: Log Experiments to Phoenix

This helper function logs experiment results to Phoenix, allowing us to visualize and track optimization progress across iterations.

```python
from phoenix_experiments import log_experiment_to_phoenix
```

## Optimization

```python
ruleset = ""

for loop in range(LOOPS):
    print(f"Running for loop: {loop}")

    train_run_id = f"train_{loop}"
    test_run_id = f"test_{loop}"

    train_df = run_act(dataset_name=dataset_name, instance_ids=train_ids, run_id=train_run_id, ruleset=ruleset, workers=WORKERS)
    test_df = run_act(dataset_name=dataset_name, instance_ids=test_ids, run_id=test_run_id, ruleset=ruleset, workers=WORKERS)

    test_df.to_csv(f"act_results/test_results_{loop}.csv", index=False)
    
    train_acc = sum(train_df["pass_or_fail"] == "pass") / len(train_df)
    test_acc = sum(test_df["pass_or_fail"] == "pass") / len(test_df)
    print(f"Train Accuracy: {train_acc}")
    print(f"Test Accuracy: {test_acc}")

    # make sure any swebench package installations did not affect phoenix package
    subprocess.run([
        "/opt/anaconda3/envs/cline/bin/python3",
        "-m",
        "pip",
        "install",
        "-qq",
        "--upgrade",
        "arize-phoenix",
        "wrapt",
    ])
    evaluated_train_results = evaluate_results(train_df)
    evaluated_train_results.to_csv(f"act_results/train_results_{loop}.csv", index=False)
    
    # Log experiment to Phoenix using REST API
    log_experiment_to_phoenix(
        hostname=HOSTNAME,
        api_key=os.getenv("PHOENIX_API_KEY"),
        dataset_obj=train_dataset,
        experiment_name=f"Train {loop}",
        experiment_df=evaluated_train_results,
        metadata={
            "loop": loop,
            "train_accuracy": train_acc,
            "test_accuracy": test_acc,
            "train_size": TRAIN_SIZE,
            "test_size": TEST_SIZE
        }
    )

    pl_optimizer = PromptLearningOptimizer(
        prompt=CLINE_PROMPT,
        model_choice="gpt-5",
        openai_api_key=os.getenv("OPENAI_API_KEY")
    )
    ruleset = pl_optimizer.optimize(
        dataset=evaluated_train_results,
        output_column="cline_patch",
        feedback_columns=["correctness", "explanation"],
        ruleset=ruleset,
        context_size_k=400000
    )
    with open(f"act_rulesets/ruleset_{loop}.txt", "w") as f:
        f.write(f"train_accuracy: {train_acc} \n")
        f.write(f"test_accuracy: {test_acc} \n")
        f.write(f"optimized ruleset_{loop}: \n {ruleset} \n")


```

We start with an empty ruleset. So at loop 1, Cline will be generating a ruleset from scratch.

You can see the code for the functions used above in different python files within the `cline` folder. You can see the [Code Appendix](optimizing-coding-agent-prompts-prompt-learning.md#code-appendix) on this page as well.

In each loop, we

1. Call `run_act` to run Cline in Act Mode on the training set + test set. This function
   1. Runs Cline on your chosen train/test subset of SWE Bench in parallel based on `WORKERS`
   2. Runs unit tests for each row, using `run_evaluation` in the SWE Bench package, computing accuracy (how many problems did Cline accurately solve)
   3. Returns Cline's patches (git diff) for every row, along with pass/fail
2. Call `evaluate_results` on the training set to generate LLM Evals. We ask an LLM to evaluate the patch from Cline, telling us why its wrong/right, and why Cline may have made those changes.
3. Call `log_experiment_with_ids` to log this training run to Phoenix. This helps us view each iteration on a graph, so we can track if our ruleset optimizations are making Cline improve.
4. Initialize `PromptLearningOptimizer` and call `optimize` , which generates a new ruleset based on the training data we collected, and the old ruleset.
5. Saves training accuracy, test accuracy, and optimized ruleset to `act_rulesets` folder.

Each loop after loop 1 edits and optimizes the previous iteration's ruleset.

## Results

Visit the Datasets and Experiments tab in Phoenix and view your experiment results. Here's an example of one run, where we just ran 2 loops and saw a huge boost in training accuracy.

<figure><img src="../../../.gitbook/assets/Screenshot 2025-10-13 at 11.28.40 AM.png" alt=""><figcaption></figcaption></figure>

You can view all generated rulesets, along with training/test accuracy, in the `act_rulesets` folder.

## Code Appendix

A lot of the code in this notebook is abstracted into helper functions.

`cline` -> `CODE_APPENDIX.md` covers what some of the most important helper functions do.
