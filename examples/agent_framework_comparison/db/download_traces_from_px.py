# type: ignore
import dotenv
from database import save_df_to_db
from phoenix.client import Client

dotenv.load_dotenv()


def save_traces_to_db():
    df = Client().spans.get_spans_dataframe()
    save_df_to_db(df)


if __name__ == "__main__":
    save_traces_to_db()
