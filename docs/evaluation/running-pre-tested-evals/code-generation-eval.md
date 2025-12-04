# Code Generation

## When To Use Code Generation Eval Template

This Eval checks the correctness and readability of the code from a code generation process. The template variables are:

* **query:** The query is the coding question being asked
* **code**: The code is the code that was returned.

## Code Generation Eval Template

````
You are a stern but practical senior software engineer who cares a lot about simplicity and
readability of code. Can you review the following code that was written by another engineer?
Focus on readability of the code. Respond with "readable" if you think the code is readable,
or "unreadable" if the code is unreadable or needlessly complex for what it's trying
to accomplish.

ONLY respond with "readable" or "unreadable"

Task Assignment:
```
{query}
```

Implementation to Evaluate:
```
{code}
```
````

\{% hint style="info" %\} We are continually iterating our templates, view the most up-to-date template [on GitHub](https://github.com/Arize-ai/phoenix/blob/ecef5242d2f9bb39a2fdf5d96a2b1841191f7944/packages/phoenix-evals/src/phoenix/evals/default_templates.py#L331). \{% endhint %\}

## How To Run the Code Generation Eval

\`

\`\`python from phoenix.evals import ( CODE\_READABILITY\_PROMPT\_RAILS\_MAP, CODE\_READABILITY\_PROMPT\_TEMPLATE, OpenAIModel, download\_benchmark\_dataset, llm\_classify, )

model = OpenAIModel( model\_name="gpt-4", temperature=0.0, )

\#The rails are used to hold the output to specific values based on the template #It will remove text such as ",,," or "..." #Will ensure the binary value expected from the template is returned rails = list(CODE\_READABILITY\_PROMPT\_RAILS\_MAP.values()) readability\_classifications = llm\_classify( dataframe=df, template=CODE\_READABILITY\_PROMPT\_TEMPLATE, model=model, rails=rails, provide\_explanation=True, #optional to generate explanations for the value produced by the eval LLM )

```

The above shows how to use the code readability template.

## Benchmark Results

This benchmark was obtained using notebook below. It was run using an [OpenAI Human Eval dataset](https://storage.googleapis.com/arize-phoenix-assets/evals/code-readability-classification/openai_humaneval_with_readability_v3.jsonl.zip) as a ground truth dataset. Each example in the dataset was evaluating using the `CODE_READABILITY_PROMPT_TEMPLATE` above, then the resulting labels were compared against the ground truth label in the benchmark dataset to generate the confusion matrices below.

<div data-gb-custom-block data-tag="embed" data-url='https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_code_readability_classifications.ipynb'>

Try it out!

</div>

#### GPT-4 Results

<figure><img src="../../.gitbook/assets/Screenshot 2023-09-16 at 5.45.20 PM.png" alt=""><figcaption></figcaption></figure>

<table><thead><tr><th width="149">Code Eval</th><th>GPT-4</th><th data-hidden>GPT-4</th><th data-hidden>GPT-4</th><th data-hidden>GPT-3.5</th><th data-hidden>GPT-3.5-Instruct</th><th data-hidden>Palm 2 (Text Bison)</th></tr></thead><tbody><tr><td>Precision</td><td><mark style="color:green;">0.93</mark></td><td><mark style="color:green;">0.93</mark></td><td><mark style="color:green;">0.93</mark></td><td><mark style="color:green;">0.76</mark></td><td><mark style="color:orange;">0.67</mark></td><td><mark style="color:green;">0.77</mark></td></tr><tr><td>Recall</td><td><mark style="color:green;">0.78</mark></td><td><mark style="color:green;">0.78</mark></td><td><mark style="color:green;">0.78</mark></td><td><mark style="color:green;">0.93</mark></td><td><mark style="color:green;">1</mark></td><td><mark style="color:green;">0.94</mark></td></tr><tr><td>F1</td><td><mark style="color:green;">0.85</mark></td><td><mark style="color:green;">0.85</mark></td><td><mark style="color:green;">0.85</mark></td><td><mark style="color:green;">0.85</mark></td><td><mark style="color:green;">0.81</mark></td><td><mark style="color:green;">0.85</mark></td></tr></tbody></table>
```
