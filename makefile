.PHONY: setup dev

# Set up the development environment
# Installs uv, node (via nvm), pnpm, and tox
setup:
	@bash scripts/setup.sh

# Start the development server
# Installs dependencies and runs the app in development mode
dev:
	@cd app && pnpm i && uv sync --all-extras && pnpm dev
