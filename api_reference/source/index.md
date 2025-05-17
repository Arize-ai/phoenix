---
myst:
  html_meta:
    "description lang=en": |
      Top-level documentation for phoenix,
      with links to the rest of the site..
html_theme.sidebar_secondary.remove: true
---

# Arize Phoenix API Reference

<a target="_blank" href="https://phoenix.arize.com" style="background:none">
    <img alt="phoenix banner" src="_static/github-large-banner-phoenix.jpg" width="auto" height="auto"></img>
</a>
<br/>
<div id="external-links">
  <a href="https://docs.arize.com/phoenix/">
      <img src="https://img.shields.io/static/v1?message=Docs&logo=data:image/png;base64,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&labelColor=grey&color=blue&logoColor=white&label=%20"/>
  </a>
  <a target="_blank" class="link" href="https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email">
      <img src="https://img.shields.io/static/v1?message=Community&logo=slack&labelColor=grey&color=blue&logoColor=white&label=%20"/>
  </a>
  <a target="_blank" class="link" href="https://twitter.com/ArizePhoenix">
      <img src="https://img.shields.io/badge/-ArizePhoenix-blue.svg?color=blue&labelColor=gray&logo=twitter">
  </a>
  <a target="_blank" class="link" href="https://pypi.org/project/arize-phoenix/">
      <img src="https://img.shields.io/pypi/v/arize-phoenix?color=blue">
  </a>
  <a target="_blank" class="link" href="https://anaconda.org/conda-forge/arize-phoenix">
      <img src="https://img.shields.io/conda/vn/conda-forge/arize-phoenix.svg?color=blue">
  </a>
  <a target="_blank" class="link" href="https://pypi.org/project/arize-phoenix/">
      <img src="https://img.shields.io/pypi/pyversions/arize-phoenix">
  </a>
  <a target="_blank" class="link" href="https://hub.docker.com/r/arizephoenix/phoenix/tags">
      <img src="https://img.shields.io/docker/v/arizephoenix/phoenix?sort=semver&logo=docker&label=image&color=blue">
  </a>
</div>
<br/>

Welcome to Arize Phoenix's API reference. This reference details Phoenix's API and how to use its various features. To get a complete guide on how to use Phoenix, including tutorials, quickstarts, and concept explanations, see the [complete documentation](https://docs.arize.com/phoenix).

```{seealso}
Want to become a member of Phoenix's community? Check out our [Slack](https://arize-ai.slack.com/join/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q#/shared-invite/email) and [GitHub repository](https://docs.arize.com/phoenix)!
```

## API Definition

```{toctree}
:maxdepth: 2

api/session
api/client
api/evals
api/experiments
api/otel
api/inferences_schema
```
