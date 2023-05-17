import numpy as np
from build_database import download_squad_training_data

database_df, query_df = download_squad_training_data()
database_df = database_df.reset_index(drop=True)
query_df = query_df.reset_index(drop=True)

split_to_dataframe = {"database": database_df, "query": query_df}
for split in split_to_dataframe.keys():
    embeddings = []
    for granular_subject in split_to_dataframe[split]["granular_subject"].unique():
        embeddings.append(
            np.load(
                f"/Users/xandersong/Desktop/openai-embeddings/splits/{split}/{granular_subject}.npy",
                allow_pickle=True,
            )
        )
    embeddings_column = np.concatenate(embeddings)
    split_to_dataframe[split]["text_vector"] = embeddings_column
database_df = split_to_dataframe["database"]
query_df = split_to_dataframe["query"]

granular_subjects = list(
    set(database_df["granular_subject"].unique().tolist()).union(
        set(query_df["granular_subject"].unique().tolist())
    )
)
granular_subject_to_count_map = {granular_subject: 1 for granular_subject in granular_subjects}
granular_subject_to_count_map["Arsenal_F.C."] = 2
granular_subject_to_count_map["FC_Barcelona"] = 3
granular_subject_to_count_map["Chicago_Cubs"] = 4

dropped_database_granular_subjects = [
    "Beyoncé",
    "American_Idol",
    "Neptune",
    "Marvel_Comics",
    "Richard_Feynman",
]

query_granular_subject_paragraph_index_pairs = set(
    query_df.apply(lambda row: (row["granular_subject"], row["paragraph_index"]), axis=1).to_list()
)
sample_database_df = database_df[
    database_df.apply(
        lambda row: (row["granular_subject"], row["paragraph_index"])
        in query_granular_subject_paragraph_index_pairs,
        axis=1,
    )
].sample(n=1000)
database_granular_subject_paragraph_index_pairs = set(
    sample_database_df.apply(
        lambda row: (row["granular_subject"], row["paragraph_index"]), axis=1
    ).to_list()
)
