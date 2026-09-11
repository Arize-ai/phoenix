# Harbor needs Python 3.13; the main Phoenix environment remains independent.
MCP_DIR := evals/mcp
MCP_PYTHON := $(MCP_DIR)/.venv/bin/python

.PHONY: mcp-prepare mcp-check mcp-run
mcp-prepare mcp-check mcp-run:
	uv sync --project $(MCP_DIR) --python 3.13 --locked
	$(MCP_PYTHON) -m evals.mcp.scripts.experiment $(patsubst mcp-%,%,$@) $(ARGS)
