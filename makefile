.PHONY: setup dev

setup:
	@bash scripts/setup.sh

dev:
	@cd app && pnpm i && uv sync --all-extras && pnpm dev
