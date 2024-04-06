server:
	uvicorn chat.app:app --reload

format:
	ruff check --fix . && ruff format .

typecheck:
	pyright .

requirements:
	uv pip compile pyproject.toml > requirements.txt

schema:
	python export_schema.py

docker-build:
	docker build -t chat-service .

docker-run:
	docker run -e "OPENAI_API_KEY=$OPENAI_API_KEY" -p 8000:8000 -it chat-service
