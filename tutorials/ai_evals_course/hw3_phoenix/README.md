# Homework 3: LLM-as-Judge for Recipe Bot Evaluation with Phoenix

## Evaluate "Adherence to Dietary Preferences" for the Recipe Bot

**Example**: If a user asks for a "vegan" recipe, does the bot provide one that is actually vegan?

We'll provide ~2000 starter Recipe Bot traces and detailed criteria for this failure mode if you want a head start! We picked this criterion because it's fairly easy to align an LLM judge on dietary restrictions - the rules are generally clear and objective.

## Tools You'll Use
- **Phoenix**: For generating and viewing your traces and evaluations. 
- Your preferred LLM (for crafting the judge)
- Your critical thinking & prompt engineering skills!
- The `judgy` Python library: [github.com/ai-evals-course/judgy](https://github.com/ai-evals-course/judgy)

## Understanding Phoenix in This Assignment

**Phoenix** is an observability platform that helps you collect, trace, and evaluate LLM applications. In this assignment, you'll use Phoenix to:

1. **Collect Recipe Bot traces**: Automatically capture user queries, bot responses, and metadata
2. **Run LLM-as-Judge evaluations**: Use Phoenix evals to systematically evaluate traces
3. **Log evaluation results**: Store judge predictions and ground truth labels for analysis
4. **Monitor performance**: Track judge accuracy and bias over time

### Key Phoenix Concepts You'll Use:

- **Spans**: Individual units of work (e.g., a single Recipe Bot query-response)
- **SpanQuery**: Query language to filter and retrieve specific traces
- **Phoenix Evals**: Framework for running LLM evaluations at scale
- **Client Annotations**: Logging evaluation results back to Phoenix using the new client API

> **📚 Phoenix Methods Guide**: For detailed examples and usage patterns, see [phoenix_methods_guide.md](phoenix_methods_guide.md)

## Three Implementation Options

You have three options for how much of the pipeline to implement yourself:

### Option 1: Full Implementation (Most Learning)
Start from scratch and implement the complete pipeline:
- Generate your own Recipe Bot traces with Phoenix
- Label your own data using Phoenix evals
- Build the entire evaluation workflow
- **Learning**: Complete end-to-end experience with LLM-as-Judge methodology and Phoenix observability

### Option 2: Start with Raw Traces (Medium Implementation)
Use our provided traces from Phoenix and focus on the evaluation:
- Skip trace generation, start with labeling
- Implement judge development and evaluation using Phoenix evals
- Focus on the core LLM-as-Judge workflow with Phoenix observability
- **Learning**: Judge development, bias correction, and statistical evaluation with Phoenix

### Option 3: Start with Labeled Data (Judge Development Focus)
Use our provided labeled traces from Phoenix:
- Skip trace generation and labeling
- Focus on judge prompt engineering and evaluation using Phoenix evals
- Implement the statistical correction workflow
- **Learning**: Judge optimization and bias correction techniques with Phoenix

Choose the option that best fits your learning goals and available time!

## Assignment Steps: From Labels to Confident Measurement 📊

### Step 1: Set Up Phoenix and Generate Traces *[Option 1 starts here]*

**Phoenix Setup:**
1. Install Phoenix: `pip install arize-phoenix`
2. Boot up your local Phoenix instance with `phoenix serve` and visit it at localhost:6006

**Generate Traces:**
- **Option 1**: Implement your own trace generation script that:
  - Loads dietary queries from `data/dietary_queries.csv`
  - Calls your Recipe Bot for each query
  - Uses Phoenix instrumentation to log traces with span attributes (query, dietary_restriction, response)
  - Handles concurrency efficiently (consider using ThreadPoolExecutor)
- **Option 2**: Use our provided traces from Phoenix
- Run `generate_traces.py` to build your traces.

**In Phoenix go to projects->recipe-agent (or projects->YOUR_PROJECT_NAME if you made your own script) to view your traces.**

> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#tracing) for Phoenix instrumentation examples

### Step 2: Label Your Data *[Option 2 starts here]*

**Manual Labeling (Ideal, but a bit tedious):**
- Sample a subset of traces (150-200) from your collected data
- Manually label each trace as "Pass" or "Fail" based on the dietary adherence criteria
- This creates the most reliable ground truth for your evaluation
- Store labels in a CSV file for easy manipulation

**Automated Labeling (Alternative):**
- Implement a "ground truth LLM-as-Judge evaluator" that:
  - Uses a more powerful model (e.g., GPT-4) for higher accuracy
  - Creates a detailed labeling prompt with clear Pass/Fail criteria
  - Implements robust output parsing to extract labels and explanations
  - Logs ground truth labels back to Phoenix using the new client API
- **Note**: While automated labeling is faster, it introduces potential bias since you're using an LLM to create ground truth. Manual labeling is preferred for the most reliable evaluation.
- Consider sampling a subset (150-200 traces) for labeling to manage costs

**You can either implement your own script for this, or simply run label_data.py.**

> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#evaluation-methods) for Phoenix evals examples

### Step 3: Split Your Labeled Data *[Option 3 starts here]*

- Implement a data splitting script that:
  - Loads labeled traces from Phoenix
  - Uses stratified splitting to maintain label distribution
  - Creates Train (~15%), Dev (~40%), and Test (~45%) splits
  - Saves splits as Phoenix datasets for further experimentation, with the proper fields (ground truth label, dietary restriction, input query, etc.)
- Consider using scikit-learn's `train_test_split` with stratification

> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#tracing) for querying traces from Phoenix
> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#datasets) for creating Phoenix datasets

### Step 4: Develop Your LLM-as-Judge Prompt *[All options continue from here]*

Craft a clear prompt with:
- The specific task/criterion
- Precise Pass/Fail definitions
- 2-3 clear few-shot examples (input, Recipe Bot output, desired judge reasoning & Pass/Fail label) taken from your Train set
- The structured output format you expect from the judge (e.g., JSON with reasoning and answer)

### Step 5: Refine & Validate Your Judge

- Implement judge evaluation that:
  - Uses Phoenix experiments/evals to test your judge on the Dev set
  - Calculates TPR and TNR metrics as Phoenix evals
  - Iteratively refines the prompt based on performance
- Once finalized, experiment on your Test set for unbiased performance metrics
- **Phoenix Benefits**: Automatic logging of all evaluations, easy comparison of different prompts

> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#logging-results) for logging evaluation results to Phoenix
> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#experiments) for running experiments on Phoenix datasets

### Step 6: Measure on "New" Traces

- Implement a full evaluation script that:
  - Queries all traces from Phoenix using SpanQuery
  - Runs your finalized judge using Phoenix evals
  - Handles large-scale evaluation efficiently
  - Logs results for analysis
- This simulates evaluating production data

> **💡 Tip**: See [phoenix_methods_guide.md](phoenix_methods_guide.md#common-patterns) for complete evaluation pipeline examples

### Step 7: Report Results with judgy

Report:
- The raw pass rate (p_obs) from your judge on the new traces
- The corrected true success rate (θ̂) using judgy
- The 95% Confidence Interval (CI) for θ
- Include a brief interpretation of your results (e.g., How well is the Recipe Bot adhering to dietary preferences? How confident are you in this assessment?)

## Failure Mode: Adherence to Dietary Preferences

**Definition**: When a user requests a recipe with specific dietary restrictions or preferences, the Recipe Bot should provide a recipe that actually meets those restrictions and preferences.

**Examples**:
- ✅ Pass: User asks for "vegan pasta recipe" → Bot provides pasta with nutritional yeast instead of parmesan
- ❌ Fail: User asks for "vegan pasta recipe" → Bot suggests using honey as a sweetener (honey isn't vegan)
- ✅ Pass: User asks for "gluten-free bread" → Bot provides recipe using almond flour and xanthan gum
- ❌ Fail: User asks for "gluten-free bread" → Bot suggests using regular soy sauce (contains wheat) in the recipe
- ✅ Pass: User asks for "keto dinner" → Bot provides cauliflower rice with high-fat protein
- ❌ Fail: User asks for "keto dinner" → Bot includes sweet potato as a "healthy carb" (too high-carb for keto)

### Dietary Restriction Definitions (for reference; taken from OpenAI o4):
- **Vegan**: No animal products (meat, dairy, eggs, honey, etc.)
- **Vegetarian**: No meat or fish, but dairy and eggs are allowed
- **Gluten-free**: No wheat, barley, rye, or other gluten-containing grains
- **Dairy-free**: No milk, cheese, butter, yogurt, or other dairy products
- **Keto**: Very low carb (typically <20g net carbs), high fat, moderate protein
- **Paleo**: No grains, legumes, dairy, refined sugar, or processed foods
- **Pescatarian**: No meat except fish and seafood
- **Kosher**: Follows Jewish dietary laws (no pork, shellfish, mixing meat/dairy)
- **Halal**: Follows Islamic dietary laws (no pork, alcohol, proper slaughter)
- **Nut-free**: No tree nuts or peanuts
- **Low-carb**: Significantly reduced carbohydrates (typically <50g per day)
- **Sugar-free**: No added sugars or high-sugar ingredients
- **Raw vegan**: Vegan foods not heated above 118°F (48°C)
- **Whole30**: No grains, dairy, legumes, sugar, alcohol, or processed foods
- **Diabetic-friendly**: Low glycemic index, controlled carbohydrates
- **Low-sodium**: Reduced sodium content for heart health

## Sample Challenging Queries

**Contradictory Requests:**
- "I'm vegan but I really want to make something with honey - is there a good substitute?"
- "I want a cheeseburger but I'm dairy-free and vegetarian"

**Ambiguous Preferences:**
- "Something not too carb-y for dinner"
- "Something keto-ish but not super strict"
- "Dairy-free but cheese is okay sometimes"

## Key Metrics to Understand
- **True Positive Rate (TPR)**: How often the judge correctly identifies adherent recipes
- **True Negative Rate (TNR)**: How often the judge correctly identifies non-adherent recipes  
- **Corrected Success Rate**: True adherence rate accounting for judge errors
- **95% Confidence Interval**: Range for the corrected success rate

## Deliverables
1. **Your labeled dataset** with train/dev/test splits (from Phoenix)
2. **Your final judge prompt** with few-shot examples
3. **Judge performance metrics** (TPR/TNR on test set)
4. **Final evaluation results** using judgy (raw rate, corrected rate, confidence interval)

## Reference Implementation
This repository contains a complete reference implementation showing one approach to this assignment. You can:
- **Study the code structure** to understand the workflow
- **Use our provided data** as a starting point
- **Implement your own version** from scratch for full learning value

### Phoenix Integration
- Use `phoenix.otel` for automatic instrumentation of your Recipe Bot
- Use `SpanQuery().where("span_kind == 'CHAIN'")` to retrieve traces
- Use `llm_generate` from `phoenix.evals` for scalable evaluation
- Use the new client API to log evaluation results back to Phoenix

> **📚 Complete Guide**: For detailed Phoenix API usage, examples, and best practices, see [phoenix_methods_guide.md](phoenix_methods_guide.md)

### Reference Implementation Structure
```
homeworks/hw3/
├── scripts/
│   ├── generate_traces.py          # Generate Recipe Bot traces with parallel processing
│   ├── label_data.py               # Use GPT-4o to label ground truth (150 examples)
│   ├── split_data.py               # Split data into train/dev/test sets
│   ├── develop_judge.py            # Develop LLM judge with few-shot examples
│   ├── evaluate_judge.py           # Evaluate judge performance on test set
│   └── run_full_evaluation.py      # Run judge on all traces and compute metrics
├── data/
│   ├── dietary_queries.csv         # 60 challenging edge case queries we crafted
│   ├── raw_traces.csv              # Generated Recipe Bot traces (~2400 total)
│   ├── labeled_traces.csv          # Traces with ground truth labels (150)
│   ├── train_set.csv               # Training examples for few-shot (~23)
│   ├── dev_set.csv                 # Development set for judge refinement (~60)
│   └── test_set.csv                # Test set for final evaluation (~67)
└── results/
│   ├── judge_performance.json      # TPR/TNR metrics on test set
│   ├── final_evaluation.json       # Results with confidence intervals
│   └── judge_prompt.txt            # Final judge prompt
└── README.md                       # Project Spec and general project guide
└── ai_evals_hw3_solution.ipynb        # Guide containing helpful Phoenix methods and links to Phoenix documentation
```
