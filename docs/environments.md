---
description: >-
  The Phoenix app can be run in various notebook environments such as colab and
  SageMaker as well as be served via the terminal or a docker container
---

# Environments

Phoenix app is first and foremost an application that can be run just in in your notebook! This makes it an extremely flexible app since it can be accessed directly as you iterate on your AI-powered app!\


### Notebooks

Currently phoenix supports local, colab and SageMaker notebooks.



### Container

{% hint style="info" %}
Container images are still actively being worked on. If you are interested in hosted phoenix, please get in touch!
{% endhint %}

Phoenix server images are now available via [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix). The hosted phoenix server runs as a trace collector and can be used if you want observability for LLM traces via docker compose or simply want a long-running phoenix instance.
