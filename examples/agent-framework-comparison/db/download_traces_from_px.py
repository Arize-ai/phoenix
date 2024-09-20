import phoenix as px
from database import save_df_to_db
import dotenv

dotenv.load_dotenv()

def save_traces_to_db():
    df = px.Client().get_trace_dataset()
    save_df_to_db(df.dataframe)
    
if __name__ == "__main__":
    save_traces_to_db()