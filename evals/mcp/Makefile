# Included by the repository Makefile. All paths are relative to its root.
MCP_DIR := evals/mcp
MCP_PYTHON := $(MCP_DIR)/.venv/bin/python

.PHONY: mcp-setup mcp-test mcp-lint mcp-preflight mcp-smoke mcp-plugin-test
mcp-setup:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) $(MCP_DIR)/runtime.py

mcp-test:
	PYTHONPATH=$(MCP_DIR):. $(MCP_PYTHON) -m pytest -q $(MCP_DIR)/tests

.PHONY: mcp-typecheck
mcp-typecheck:
	.venv/bin/mypy --config-file $(MCP_DIR)/pyproject.toml --python-executable $(MCP_PYTHON)

mcp-lint:
	$(MCP_DIR)/.venv/bin/ruff check $(MCP_DIR) scripts/prepare_patronus_trail.py
	$(MCP_DIR)/.venv/bin/ruff format --check $(MCP_DIR) scripts/prepare_patronus_trail.py

mcp-preflight:
	$(MCP_PYTHON) $(MCP_DIR)/preflight.py $(ARGS)

mcp-smoke: mcp-live-sample

mcp-plugin-test:
	$(MCP_PYTHON) -m pytest -q -o addopts='' packages/phoenix-client/tests/client/harbor packages/phoenix-client/tests/client/helpers/atif

.PHONY: mcp-format
mcp-format:
	$(MCP_DIR)/.venv/bin/ruff format $(MCP_DIR) scripts/prepare_patronus_trail.py
	$(MCP_DIR)/.venv/bin/ruff check --fix $(MCP_DIR) scripts/prepare_patronus_trail.py

.PHONY: mcp-fixture
mcp-fixture:
	$(MCP_PYTHON) -m scripts.prepare_patronus_trail --output $(MCP_DIR)/.private/trail $(ARGS)

.PHONY: mcp-isolation-probe
mcp-isolation-probe:
	$(MCP_PYTHON) $(MCP_DIR)/isolation.py --docker-probe

.PHONY: mcp-stage-task
mcp-stage-task:
	$(MCP_PYTHON) $(MCP_DIR)/stage_task.py $(ARGS)

.PHONY: mcp-matrix
mcp-matrix:
	$(MCP_PYTHON) $(MCP_DIR)/matrix.py $(ARGS)

.PHONY: mcp-report
mcp-report:
	PYTHONPATH=$(MCP_DIR) $(MCP_PYTHON) $(MCP_DIR)/report.py $(ARGS)

.PHONY: mcp-smoke-images mcp-live-sample mcp-smoke-target
mcp-smoke-images:
	$(MCP_PYTHON) $(MCP_DIR)/smoke_images.py

mcp-smoke-target:
	PYTHONPATH=src:$(MCP_DIR) .venv/bin/python $(MCP_DIR)/smoke_target.py --truth $(MCP_DIR)/.private/trail/truth.json --audit $(MCP_DIR)/.private/target-audit.jsonl

mcp-live-sample:
	PYTHONPATH=$(MCP_DIR) $(MCP_PYTHON) $(MCP_DIR)/smoke_run.py $(ARGS)

.PHONY: mcp-smoke-boundary-test
mcp-smoke-boundary-test:
	PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=$(MCP_DIR) .venv/bin/python -m pytest -p pytest_asyncio.plugin -q -o addopts='' $(MCP_DIR)/live_tests

.PHONY: mcp-smoke-verifier-probe
mcp-smoke-verifier-probe:
	$(MCP_PYTHON) $(MCP_DIR)/smoke_verifier_probe.py $(ARGS)

.PHONY: mcp-smoke-check
mcp-smoke-check:
	PYTHONPATH=$(MCP_DIR) $(MCP_PYTHON) $(MCP_DIR)/smoke_check.py $(ARGS)
