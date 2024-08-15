frontend:
	streamlit run ./src/app.py

format:
	ruff check --fix . && ruff format .

typecheck:
	pyright .

types:
	datamodel-codegen  --input schema.json --input-file-type openapi --output frontend/request_types.py --enum-field-as-literal all

requirements:
	uv pip compile pyproject.toml > requirements.txt

docker-build:
	docker build -t frontend .

docker-run:
	docker run -p 8501:8501 -it frontend
