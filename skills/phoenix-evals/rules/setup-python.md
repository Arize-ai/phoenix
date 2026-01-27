# Setup: Python

Packages required for Phoenix evals and experiments.

## Installation

```bash
# Core Phoenix package (includes client, evals, otel)
pip install arize-phoenix

# Or install individual packages
pip install arize-phoenix-client   # Phoenix client only
pip install arize-phoenix-evals    # Evaluation utilities
pip install arize-phoenix-otel     # OpenTelemetry integration
```

## LLM Providers

For LLM-as-judge evaluators, install your provider's SDK:

```bash
pip install openai      # OpenAI
pip install anthropic   # Anthropic
pip install google-generativeai  # Google
```

## Validation (Optional)

```bash
pip install scikit-learn  # For TPR/TNR metrics
```

## Quick Verify

```python
from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator
from phoenix.otel import register

# All imports should work
print("Phoenix Python setup complete")
```
