# Synthetic examples in Python

Use synthetic examples when real traffic is thin, before launch, or to cover a
failure that real traces show rarely. Validate behavior on real traces when you
have them.

## Generate from dimensions

1. **Name the dimensions** that change behavior, taken from failures you've seen in
   error analysis, not from a generic list.
2. **Pick combinations** of their values, covering each value at least a few times.
3. **Turn each combination into a natural request** with one model call per
   combination, so requests don't share phrasing.

```python
import itertools
import random

from openai import OpenAI

openai_client = OpenAI()

dimensions = {
    "dish": ["bread", "curry", "brownies"],
    "constraint": ["vegan", "no oven", "under 20 minutes", "none"],
    "skill": ["beginner", "experienced"],
}
combinations = random.sample(list(itertools.product(*dimensions.values())), k=12)


def to_request(dish: str, constraint: str, skill: str) -> str:
    response = openai_client.chat.completions.create(
        model="gpt-6-luna",
        messages=[
            {
                "role": "user",
                "content": (
                    f"Write one realistic message a {skill} cook might send a recipe "
                    f"assistant about {dish} with this constraint: {constraint}. "
                    "Write it the way a person types, not as a template."
                ),
            }
        ],
    )
    return response.choices[0].message.content or ""


examples = [
    {
        "input": {"question": to_request(*combo)},
        "metadata": dict(zip(dimensions, combo)),
    }
    for combo in combinations
]
```

## Check before you upload

- Remove empty, templated, or near-duplicate requests.
- Count examples per dimension value, and fill gaps.
- Keep the dimension values in `metadata`, so you can compare results per slice.

Then upload with `client.datasets.create_dataset(name=..., examples=examples)`; see
[datasets-python](datasets-python.md). Start with a few dozen examples and grow the
set where results are uncertain.
