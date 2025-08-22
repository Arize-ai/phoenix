---
myst:
  html_meta:
    "description lang=en": |
      Top-level documentation for phoenix,
      with links to the rest of the site..
html_theme.sidebar_secondary.remove: true
---

# Arize Phoenix Python Reference

Welcome to Arize Phoenix's Python reference. This reference details Phoenix's Python API and how to use its various features. To get a complete guide on how to use Phoenix, including tutorials, quickstarts, and concept explanations, see the [complete documentation](https://arize.com/docs/phoenix).

## Sub-Packages

The `arize-phoenix` package includes the entire Phoenix platform. However if you have deployed the Phoenix platform, there are light-weight Python packages that can be used in conjunction with the platform.

- **[arize-phoenix-otel](https://phoenix-otel.readthedocs.io/)** - Provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults
- **[arize-phoenix-client](https://phoenix-client.readthedocs.io/)** - Lightweight client for interacting with the Phoenix server via its OpenAPI REST interface

- **[arize-phoenix-evals](https://phoenix-evals.readthedocs.io/)** - Tooling to evaluate LLM applications including RAG relevance, answer relevance, and more
