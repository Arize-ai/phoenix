server:
	streamlit run app.py

format:
	ruff check --fix . && ruff format .

typecheck:
	pyright .

requirements:
	uv pip compile pyproject.toml > requirements.txt

docker-build:
	docker build -t frontend .

docker-run:
	docker run 8501:8501 -it frontend
