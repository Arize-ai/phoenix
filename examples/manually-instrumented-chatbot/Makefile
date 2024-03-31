server:
	uvicorn chat.app:app --reload

streamlit:
	streamlit run app.py

format:
	ruff check --fix . && ruff format .

typecheck:
	pyright .
