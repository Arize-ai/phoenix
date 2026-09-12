# Harbor needs Python 3.13; the main Phoenix environment remains independent.
MCP_DIR := evals/mcp
MCP_PYTHON := $(MCP_DIR)/.venv/bin/python

.PHONY: mcp-prepare mcp-check mcp-run mcp-format
mcp-prepare mcp-run:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) -m evals.mcp.scripts.experiment $(patsubst mcp-%,%,$@) $(ARGS)

mcp-check: export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1
mcp-check: export PYTEST_ADDOPTS=-p pytest_asyncio.plugin
mcp-check: export PYTHONPATH=$(CURDIR)
mcp-check:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) -m ruff format --check $(MCP_DIR) tests/evals/mcp
	$(MCP_PYTHON) -m ruff check $(MCP_DIR) tests/evals/mcp
	$(MCP_PYTHON) -m pytest -q -c $(MCP_DIR)/pyproject.toml --confcutdir=tests/evals/mcp tests/evals/mcp
	$(MCP_PYTHON) -m mypy --config-file $(MCP_DIR)/pyproject.toml
	.venv/bin/python -m pytest -q -c $(MCP_DIR)/pyproject.toml --confcutdir=tests/evals/mcp -o addopts= tests/evals/mcp/integration

mcp-format:
	$(MCP_PYTHON) -m ruff format $(MCP_DIR) tests/evals/mcp
