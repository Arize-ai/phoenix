# Agent Path Convergence

When your agents take multiple steps to get to an answer or resolution, it's important to evaluate the pathway it took to get there. You want most of your runs to be consistent and not take unnecessarily frivolous or wrong actions.

<figure><img src="../../../.gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

One way of doing this is to calculate convergence:

1. Run your agent on a set of similar queries
2. Record the number of steps taken for each
3. Calculate the convergence score: `avg(minimum steps taken for this query / steps in the run)`

This will give a convergence score of 0-1, with 1 being a perfect score.

```python
# Assume you have an output which has a list of messages, which is the path taken
all_outputs = [
]

optimal_path_length = 999
ratios_sum = 0

for output in all_outputs:
    run_length = len(output)
    optimal_path_length = min(run_length, optimal_path_length)
    ratio = optimal_path_length / run_length
    ratios_sum += ratio

# Calculate the average ratio
if len(all_outputs) > 0:
    convergence = ratios_sum / len(all_outputs)
else:
    convergence = 0

print(f"The optimal path length is {optimal_path_length}")
print(f"The convergence is {convergence}")
```

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/evals/evaluate_agent.ipynb" %}
