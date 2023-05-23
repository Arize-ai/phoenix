"""
Downloads and persists SQuAD training data. Builds and persists LlamaIndex database. Computes OpenAI
embeddings for query and database data.
"""

import json
import logging
import os
import sys
import urllib
from typing import Any, List, Tuple, TypedDict

import numpy as np
import openai  # type: ignore
import pandas as pd
import tiktoken  # type: ignore
import tqdm  # type: ignore
from llama_index import GPTVectorStoreIndex  # type: ignore
from llama_index.data_structs.node import DocumentRelationship, Node  # type: ignore
from typing_extensions import TypeAlias

EmbeddingVector: TypeAlias = Any


class DatabaseData(TypedDict):
    article_index: List[int]
    paragraph_index: List[int]
    granular_subject: List[str]
    broad_subject: List[str]
    text: List[str]


class QueryData(TypedDict):
    id: List[str]
    granular_subject: List[str]
    broad_subject: List[str]
    paragraph_index: List[int]
    text: List[str]
    is_answerable: List[bool]


def main_openai_embeddings() -> None:
    """
    Compute all embeddings with direct call to OpenAI API.
    """
    database_df, query_df = download_squad_training_data()
    split_to_dataframe = {"database": database_df, "query": query_df}
    for split, dataframe in split_to_dataframe.items():
        compute_and_persist_embeddings(dataframe, split)


def main() -> None:
    database_df, query_df = download_squad_training_data()
    split_to_dataframe = {"database": database_df, "query": query_df}
    data_dir = os.path.expanduser("~/Desktop/llama-index-data")
    for split in split_to_dataframe:
        dataframe = split_to_dataframe[split]
        nodes = get_nodes(dataframe)
        index = build_index(nodes)
        split_to_dataframe[split] = add_embedding_vector_column(dataframe, nodes, index)
        persist_index(index, os.path.join(data_dir, f"indexes/{split}_index"))
        persist_dataframe(dataframe, os.path.join(data_dir, "splits"), split)


def get_openai_api_cost_estimate() -> float:
    """
    Estimates the cost of the OpenAI API calls needed to build the indexes for SQuAD training data.
    """
    database_df, query_df = download_squad_training_data()
    token_count = 0
    for dataframe in [database_df, query_df]:
        for text in dataframe["text"].to_list():
            token_count += get_token_count(text)
    cost_per_token = 0.0004 / 1000
    return token_count * cost_per_token


def get_token_count(text: str) -> int:
    encoder = tiktoken.get_encoding("cl100k_base")
    tokens = encoder.encode(text)
    return len(tokens)


def download_squad_training_data() -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Download the SQuAD training dataset. SQuAD is a reading comprehension dataset containing
    Wikipedia articles chunked into paragraphs and questions about the paragraphs.
    """
    url = "https://rajpurkar.github.io/SQuAD-explorer/dataset/train-v2.0.json"
    with urllib.request.urlopen(url) as response:
        raw_data = response.read()
        json_data = raw_data.decode("utf-8")
        squad_data = json.loads(json_data)

    database_data: DatabaseData = {
        "article_index": [],
        "paragraph_index": [],
        "granular_subject": [],
        "broad_subject": [],
        "text": [],
    }
    query_data: QueryData = {
        "id": [],
        "granular_subject": [],
        "broad_subject": [],
        "paragraph_index": [],
        "text": [],
        "is_answerable": [],
    }
    for article_index, article_data in enumerate(squad_data["data"]):
        for paragraph_index, paragraph_data in enumerate(article_data["paragraphs"]):
            database_data["paragraph_index"].append(paragraph_index)
            database_data["article_index"].append(article_index)
            database_data["text"].append(paragraph_data["context"])
            database_data["granular_subject"].append(article_data["title"])
            database_data["broad_subject"].append(GRANULAR_TO_BROAD_SUBJECT[article_data["title"]])
            for question_index, qa_data in enumerate(paragraph_data["qas"]):
                query_data["paragraph_index"].append(paragraph_index)
                query_data["id"].append(qa_data["id"])
                query_data["text"].append(qa_data["question"])
                query_data["granular_subject"].append(article_data["title"])
                query_data["broad_subject"].append(GRANULAR_TO_BROAD_SUBJECT[article_data["title"]])
                query_data["is_answerable"].append(not qa_data["is_impossible"])

    database_dataframe = pd.DataFrame(database_data)
    query_dataframe = pd.DataFrame(query_data)
    return database_dataframe, query_dataframe


def get_nodes(dataframe: pd.DataFrame) -> List[Node]:
    nodes = []
    for granular_subject, group in dataframe.groupby(by="granular_subject"):
        nodes_for_granular_subject = []
        for index, row in group.iterrows():
            nodes_for_granular_subject.append(Node(text=row["text"]))
        for before_node, after_node in zip(
            nodes_for_granular_subject[:-1], nodes_for_granular_subject[1:]
        ):
            before_node.relationships[DocumentRelationship.NEXT] = after_node.get_doc_id()
            after_node.relationships[DocumentRelationship.PREVIOUS] = before_node.get_doc_id()
        nodes.extend(nodes_for_granular_subject)
    return nodes


def compute_and_persist_embeddings(dataframe: pd.DataFrame, split: str) -> None:
    for granular_subject, group in tqdm.tqdm(dataframe.groupby("granular_subject")):
        save_path = os.path.expanduser(
            f"~/Desktop/openai-embeddings/splits/{split}/{granular_subject}.npy"
        )
        save_dir = os.path.dirname(save_path)
        if not os.path.exists(save_dir):
            os.makedirs(save_dir, exist_ok=True)
        if not os.path.exists(save_path):
            try:
                embeddings = compute_embeddings_with_openai(group["text"])
                np.save(
                    save_path,
                    embeddings,
                )
            except Exception as err:
                print(f'Error processing granular subject: "{granular_subject}"')
                print(err)


def compute_embeddings_with_openai(
    text_column: "pd.Series[str]", model_name: str = "text-embedding-ada-002"
) -> "pd.Series[Any]":
    response = openai.Embedding.create(input=text_column.to_list(), model=model_name)
    embeddings = []
    for data in response["data"]:
        embeddings.append(np.array(data["embedding"]))
    return pd.Series(embeddings)


def build_index(nodes: List[Node]) -> GPTVectorStoreIndex:
    return GPTVectorStoreIndex(nodes)


def persist_index(index: GPTVectorStoreIndex, persist_dir: str) -> None:
    index.storage_context.persist(persist_dir=persist_dir)


def add_embedding_vector_column(
    dataframe: pd.DataFrame, nodes: List[Node], index: GPTVectorStoreIndex
) -> pd.DataFrame:
    vector_store_data = index.storage_context.vector_store.to_dict()
    embedding_vectors = []
    for node in nodes:
        embedding_vectors.append(np.array(vector_store_data["embedding_dict"][node.doc_id]))
    dataframe["text_vector"] = embedding_vectors
    return dataframe


def persist_dataframe(dataframe: pd.DataFrame, data_dir: str, split: str) -> None:
    os.makedirs(data_dir, exist_ok=True)
    dataframe.to_parquet(os.path.join(data_dir, f"{split}.parquet"))


# This dictionary maps the granular subjects of the original SQuAD dataset to more general subjects
# found with ChatGPT.
GRANULAR_TO_BROAD_SUBJECT = {
    "Buddhism": "Religion and Spirituality",
    "New_York_City": "Geography and Places",
    "American_Idol": "Entertainment and Arts",
    "Israel": "Geography and Places",
    "Portugal": "Geography and Places",
    "Southampton": "Geography and Places",
    "Greece": "Geography and Places",
    "Gamal_Abdel_Nasser": "History",
    "Hellenistic_period": "History",
    "Paris": "Geography and Places",
    "Middle_Ages": "History",
    "The_Blitz": "History",
    "Dwight_D._Eisenhower": "History",
    "Pub": "Entertainment and Arts",
    "Napoleon": "History",
    "Modern_history": "History",
    "Mexico_City": "Geography and Places",
    "Alps": "Geography and Places",
    "Arnold_Schwarzenegger": "Entertainment and Arts",
    "Gramophone_record": "Entertainment and Arts",
    "Age_of_Enlightenment": "History",
    "Saint_Helena": "Geography and Places",
    "Oklahoma_City": "Geography and Places",
    "Frédéric_Chopin": "Music",
    "Roman_Republic": "History",
    "Qing_dynasty": "History",
    "Religion_in_ancient_Rome": "Religion and Spirituality",
    "Plymouth": "Geography and Places",
    "Catalan_language": "Language and Linguistics",
    "Computer": "Science and Technology",
    "Detroit": "Geography and Places",
    "Financial_crisis_of_2007%E2%80%9308": "History",
    "Kanye_West": "Music",
    "Boston": "Geography and Places",
    "History_of_India": "History",
    "Adolescence": "Health and Medicine",
    "Switzerland": "Geography and Places",
    "London": "Geography and Places",
    "Institute_of_technology": "Education",
    "2008_Sichuan_earthquake": "History",
    "John,_King_of_England": "History",
    "Muammar_Gaddafi": "History",
    "Madonna_(entertainer)": "Entertainment and Arts",
    "Protestantism": "Religion and Spirituality",
    "Korean_War": "History",
    "Dog": "Nature and Environment",
    "2008_Summer_Olympics_torch_relay": "Sports",
    "Alexander_Graham_Bell": "Science and Technology",
    "Antenna_(radio)": "Science and Technology",
    "Myanmar": "Geography and Places",
    "Sino-Tibetan_relations_during_the_Ming_dynasty": "History",
    "Estonia": "Geography and Places",
    "Somalis": "People and Ethnicity",
    "Pacific_War": "History",
    "Anti-aircraft_warfare": "History",
    "Space_Race": "History",
    "Montevideo": "Geography and Places",
    "Wood": "Nature and Environment",
    "Ottoman_Empire": "History",
    "Classical_music": "Music",
    "Dissolution_of_the_Soviet_Union": "History",
    "History_of_science": "History",
    "Josip_Broz_Tito": "History",
    "Beyoncé": "Music",
    "USB": "Science and Technology",
    "Chihuahua_(state)": "Geography and Places",
    "New_Haven,_Connecticut": "Geography and Places",
    "Nanjing": "Geography and Places",
    "Han_dynasty": "History",
    "Race_(human_categorization)": "People and Ethnicity",
    "Melbourne": "Geography and Places",
    "Mosaic": "Entertainment and Arts",
    "Brain": "Science and Technology",
    "Egypt": "Geography and Places",
    "Daylight_saving_time": "Science and Technology",
    "John_von_Neumann": "People and Ethnicity",
    "Szlachta": "History",
    "Chicago_Cubs": "Sports",
    "Bird": "Nature and Environment",
    "To_Kill_a_Mockingbird": "Literature",
    "Crimean_War": "History",
    "MP3": "Science and Technology",
    "Professional_wrestling": "Sports",
    "Tuvalu": "Geography and Places",
    "Black_people": "People and Ethnicity",
    "Seven_Years%27_War": "History",
    "North_Carolina": "Geography and Places",
    "Child_labour": "Politics and Government",
    "Richmond,_Virginia": "Geography and Places",
    "IPod": "Science and Technology",
    "British_Empire": "History",
    "Hydrogen": "Science and Technology",
    "Iran": "Geography and Places",
    "Insect": "Nature and Environment",
    "Philadelphia": "Geography and Places",
    "Cyprus": "Geography and Places",
    "On_the_Origin_of_Species": "Science and Technology",
    "Near_East": "Geography and Places",
    "Queen_(band)": "Music",
    "Franco-Prussian_War": "History",
    "Kathmandu": "Geography and Places",
    "Lighting": "Science and Technology",
    "Armenia": "Geography and Places",
    "Treaty": "Politics and Government",
    "The_Bronx": "Geography and Places",
    "United_States_Air_Force": "Politics and Government",
    "Political_corruption": "Politics and Government",
    "Gene": "Science and Technology",
    "Chinese_characters": "Language and Linguistics",
    "Nutrition": "Health and Medicine",
    "Indigenous_peoples_of_the_Americas": "People and Ethnicity",
    "Bird_migration": "Nature and Environment",
    "University_of_Notre_Dame": "Education",
    "Pope_Paul_VI": "Religion and Spirituality",
    "Arena_Football_League": "Sports",
    "Oklahoma": "Geography and Places",
    "Nigeria": "Geography and Places",
    "The_Times": "Media and Communication",
    "Adult_contemporary_music": "Music",
    "Sexual_orientation": "People and Ethnicity",
    "Hyderabad": "Geography and Places",
    "Seattle": "Geography and Places",
    "Solar_energy": "Science and Technology",
    "New_Delhi": "Geography and Places",
    "Apollo": "Religion and Spirituality",
    "Tucson,_Arizona": "Geography and Places",
    "Carnival": "Entertainment and Arts",
    "Bern": "Geography and Places",
    "Elevator": "Science and Technology",
    "John_Kerry": "Politics and Government",
    "Dutch_language": "Language and Linguistics",
    "Valencia": "Geography and Places",
    "Botany": "Science and Technology",
    "Bacteria": "Science and Technology",
    "Marshall_Islands": "Geography and Places",
    "Ashkenazi_Jews": "People and Ethnicity",
    "List_of_numbered_streets_in_Manhattan": "Geography and Places",
    "Tennessee": "Geography and Places",
    "Guinea-Bissau": "Geography and Places",
    "Galicia_(Spain)": "Geography and Places",
    "Friedrich_Hayek": "People and Ethnicity",
    "FC_Barcelona": "Sports",
    "Samurai": "History",
    "LaserDisc": "Science and Technology",
    "San_Diego": "Geography and Places",
    "Slavs": "People and Ethnicity",
    "The_Sun_(United_Kingdom)": "Media and Communication",
    "Macintosh": "Science and Technology",
    "Steven_Spielberg": "Entertainment and Arts",
    "Charleston,_South_Carolina": "Geography and Places",
    "Houston": "Geography and Places",
    "Alaska": "Geography and Places",
    "Red": "Nature and Environment",
    "Affirmative_action_in_the_United_States": "Politics and Government",
    "Windows_8": "Science and Technology",
    "Capital_punishment_in_the_United_States": "Law and Legal",
    "Bermuda": "Geography and Places",
    "Alfred_North_Whitehead": "People and Ethnicity",
    "Atlantic_City,_New_Jersey": "Geography and Places",
    "Jehovah%27s_Witnesses": "Religion and Spirituality",
    "Yale_University": "Education",
    "Westminster_Abbey": "Architecture",
    "Canadian_Armed_Forces": "Politics and Government",
    "High-definition_television": "Science and Technology",
    "Elizabeth_II": "People and Ethnicity",
    "Dell": "Business and Economy",
    "Cardinal_(Catholicism)": "Religion and Spirituality",
    "Federal_Bureau_of_Investigation": "Politics and Government",
    "Miami": "Geography and Places",
    "Anthropology": "Science and Technology",
    "Molotov%E2%80%93Ribbentrop_Pact": "History",
    "Greeks": "People and Ethnicity",
    "Multiracial_American": "People and Ethnicity",
    "Dialect": "Language and Linguistics",
    "Antarctica": "Geography and Places",
    "Nintendo_Entertainment_System": "Science and Technology",
    "Emotion": "Science and Technology",
    "Northwestern_University": "Education",
    "Dominican_Order": "Religion and Spirituality",
    "PlayStation_3": "Science and Technology",
    "Pharmaceutical_industry": "Business and Economy",
    "Montana": "Geography and Places",
    "House_music": "Music",
    "Eton_College": "Education",
    "Quran": "Religion and Spirituality",
    "Light-emitting_diode": "Science and Technology",
    "Spectre_(2015_film)": "Entertainment and Arts",
    "Karl_Popper": "People and Ethnicity",
    "Mandolin": "Music",
    "Queen_Victoria": "People and Ethnicity",
    "Incandescent_light_bulb": "Science and Technology",
    "Military_history_of_the_United_States": "History",
    "Electric_motor": "Science and Technology",
    "Universal_Studios": "Entertainment and Arts",
    "Uranium": "Science and Technology",
    "Labour_Party_(UK)": "Politics and Government",
    "Separation_of_church_and_state_in_the_United_States": "Politics and Government",
    "Mary_(mother_of_Jesus)": "Religion and Spirituality",
    "Gothic_architecture": "Architecture",
    "Late_Middle_Ages": "History",
    "Premier_League": "Sports",
    "Department_store": "Business and Economy",
    "Edmund_Burke": "People and Ethnicity",
    "Renewable_energy_commercialization": "Science and Technology",
    "Eritrea": "Geography and Places",
    "Cubism": "Entertainment and Arts",
    "Copyright_infringement": "Law and Legal",
    "Tibet": "Geography and Places",
    "Kievan_Rus%27": "History",
    "Republic_of_the_Congo": "Geography and Places",
    "Namibia": "Geography and Places",
    "Royal_assent": "Politics and Government",
    "Federalism": "Politics and Government",
    "Human_Development_Index": "Science and Technology",
    "Zhejiang": "Geography and Places",
    "Presbyterianism": "Religion and Spirituality",
    "Zinc": "Science and Technology",
    "Architecture": "Architecture",
    "Capacitor": "Science and Technology",
    "Freemasonry": "Religion and Spirituality",
    "Brigham_Young_University": "Education",
    "Comics": "Entertainment and Arts",
    "Somerset": "Geography and Places",
    "Jews": "People and Ethnicity",
    "Prime_minister": "Politics and Government",
    "Guam": "Geography and Places",
    "Athanasius_of_Alexandria": "Religion and Spirituality",
    "Asphalt": "Science and Technology",
    "Police": "Politics and Government",
    "Hunting": "Nature and Environment",
    "Neptune": "Science and Technology",
    "University_of_Kansas": "Education",
    "Avicenna": "People and Ethnicity",
    "Printed_circuit_board": "Science and Technology",
    "Washington_University_in_St._Louis": "Education",
    "Sony_Music_Entertainment": "Business and Economy",
    "Ann_Arbor,_Michigan": "Geography and Places",
    "Florida": "Geography and Places",
    "Appalachian_Mountains": "Geography and Places",
    "Umayyad_Caliphate": "History",
    "Annelid": "Science and Technology",
    "Education": "Education",
    "Madrasa": "Education",
    "Raleigh,_North_Carolina": "Geography and Places",
    "Aspirated_consonant": "Language and Linguistics",
    "Aircraft_carrier": "Politics and Government",
    "Russian_Soviet_Federative_Socialist_Republic": "History",
    "British_Isles": "Geography and Places",
    "Railway_electrification_system": "Science and Technology",
    "Arsenal_F.C.": "Sports",
    "Tajikistan": "Geography and Places",
    "Beer": "Entertainment and Arts",
    "BeiDou_Navigation_Satellite_System": "Science and Technology",
    "Hunter-gatherer": "History",
    "United_States_Army": "Politics and Government",
    "Strasbourg": "Geography and Places",
    "YouTube": "Media and Communication",
    "Estonian_language": "Language and Linguistics",
    "Unicode": "Science and Technology",
    "Energy": "Science and Technology",
    "Materialism": "Philosophy",
    "Pain": "Health and Medicine",
    "The_Legend_of_Zelda:_Twilight_Princess": "Entertainment and Arts",
    "FA_Cup": "Sports",
    "United_States_dollar": "Business and Economy",
    "Richard_Feynman": "People and Ethnicity",
    "Paper": "Science and Technology",
    "Sumer": "History",
    "Crucifixion_of_Jesus": "Religion and Spirituality",
    "Textual_criticism": "Language and Linguistics",
    "Germans": "People and Ethnicity",
    "Biodiversity": "Nature and Environment",
    "Database": "Science and Technology",
    "51st_state": "Politics and Government",
    "Memory": "Science and Technology",
    "St._John%27s,_Newfoundland_and_Labrador": "Geography and Places",
    "Copper": "Science and Technology",
    "Tuberculosis": "Health and Medicine",
    "Poultry": "Nature and Environment",
    "Vacuum": "Science and Technology",
    "East_India_Company": "History",
    "BBC_Television": "Media and Communication",
    "War_on_Terror": "Politics and Government",
    "Endangered_Species_Act": "Law and Legal",
    "Party_leaders_of_the_United_States_House_of_Representatives": "Politics and Government",
    "Russian_language": "Language and Linguistics",
    "Cork_(city)": "Geography and Places",
    "Humanism": "Philosophy",
    "Cotton": "Nature and Environment",
    "Infection": "Health and Medicine",
    "Group_(mathematics)": "Science and Technology",
    "Norfolk_Island": "Geography and Places",
    "Separation_of_powers_under_the_United_States_Constitution": "Politics and Government",
    "Heresy": "Religion and Spirituality",
    "Matter": "Science and Technology",
    "Economy_of_Greece": "Business and Economy",
    "Translation": "Language and Linguistics",
    "Time": "Science and Technology",
    "Tristan_da_Cunha": "Geography and Places",
    "Software_testing": "Science and Technology",
    "Idealism": "Philosophy",
    "Thuringia": "Geography and Places",
    "Buckingham_Palace": "Architecture",
    "Association_football": "Sports",
    "Christian": "Religion and Spirituality",
    "Czech_language": "Language and Linguistics",
    "European_Central_Bank": "Business and Economy",
    "National_Archives_and_Records_Administration": "Politics and Government",
    "East_Prussia": "History",
    "Muslim_world": "Religion and Spirituality",
    "Green": "Nature and Environment",
    "Comcast": "Business and Economy",
    "Swaziland": "Geography and Places",
    "Utrecht": "Geography and Places",
    "University": "Education",
    "Law_of_the_United_States": "Law and Legal",
    "Royal_Institute_of_British_Architects": "Architecture",
    "Political_party": "Politics and Government",
    "Alsace": "Geography and Places",
    "Pesticide": "Science and Technology",
    "Geological_history_of_Earth": "Science and Technology",
    "Punjab,_Pakistan": "Geography and Places",
    "Antibiotics": "Health and Medicine",
    "Film_speed": "Science and Technology",
    "ASCII": "Science and Technology",
    "Southeast_Asia": "Geography and Places",
    "Myocardial_infarction": "Health and Medicine",
    "Xbox_360": "Science and Technology",
    "IBM": "Business and Economy",
    "Genocide": "History",
    "Data_compression": "Science and Technology",
    "Predation": "Nature and Environment",
    "United_States_presidential_election,_2004": "Politics and Government",
    "Liberal_Party_of_Australia": "Politics and Government",
    "Glass": "Science and Technology",
    "Sichuan": "Geography and Places",
    "Wayback_Machine": "Media and Communication",
    "Armenians": "People and Ethnicity",
    "Marvel_Comics": "Entertainment and Arts",
    "Ministry_of_Defence_(United_Kingdom)": "Politics and Government",
    "Communications_in_Somalia": "Media and Communication",
    "Orthodox_Judaism": "Religion and Spirituality",
    "Computer_security": "Science and Technology",
    "Empiricism": "Philosophy",
    "Pope_John_XXIII": "Religion and Spirituality",
    "Hindu_philosophy": "Religion and Spirituality",
    "Airport": "Geography and Places",
    "Compact_disc": "Science and Technology",
    "Asthma": "Health and Medicine",
    "CBC_Television": "Media and Communication",
    "Southern_Europe": "Geography and Places",
    "Sahara": "Geography and Places",
    "Hard_rock": "Music",
    "Genome": "Science and Technology",
    "Imperial_College_London": "Education",
    "Samoa": "Geography and Places",
    "Comprehensive_school": "Education",
    "Royal_Dutch_Shell": "Business and Economy",
    "Mammal": "Nature and Environment",
    "Palermo": "Geography and Places",
    "Flowering_plant": "Nature and Environment",
    "Rule_of_law": "Law and Legal",
    "Saint_Barth%C3%A9lemy": "Geography and Places",
    "Culture": "People and Ethnicity",
    "God": "Religion and Spirituality",
    "Planck_constant": "Science and Technology",
    "States_of_Germany": "Geography and Places",
    "Web_browser": "Science and Technology",
    "Rajasthan": "Geography and Places",
    "Philosophy_of_space_and_time": "Philosophy",
    "Everton_F.C.": "Sports",
    "Super_Nintendo_Entertainment_System": "Entertainment and Arts",
    "Nonprofit_organization": "Business and Economy",
    "Heian_period": "History",
    "Transistor": "Science and Technology",
    "Baptists": "Religion and Spirituality",
    "Symbiosis": "Science and Technology",
    "Turner_Classic_Movies": "Media and Communication",
    "Gregorian_calendar": "Science and Technology",
    "Glacier": "Nature and Environment",
    "Old_English": "Language and Linguistics",
    "George_VI": "People and Ethnicity",
    "Warsaw_Pact": "Politics and Government",
    "Bras%C3%ADlia": "Geography and Places",
    "Himachal_Pradesh": "Geography and Places",
    "Liberia": "Geography and Places",
    "Virgil": "Literature",
    "Literature": "Literature",
    "Phonology": "Language and Linguistics",
    "Supreme_court": "Law and Legal",
    "Gymnastics": "Sports",
    "Neolithic": "History",
    "Central_African_Republic": "Geography and Places",
    "Spanish_language_in_the_United_States": "Language and Linguistics",
    "A_cappella": "Music",
    "Serbo-Croatian": "Language and Linguistics",
    "Alloy": "Science and Technology",
    "United_Nations_Population_Fund": "Politics and Government",
    "Circadian_rhythm": "Science and Technology",
    "Immaculate_Conception": "Religion and Spirituality",
    "Post-punk": "Music",
    "Santa_Monica,_California": "Geography and Places",
    "Neoclassical_architecture": "Architecture",
    "Canon_law": "Law and Legal",
    "Mali": "Geography and Places",
    "Sanskrit": "Language and Linguistics",
    "Geography_of_the_United_States": "Geography and Places",
    "Clothing": "People and Ethnicity",
    "Hanover": "Geography and Places",
    "Identity_(social_science)": "Social Sciences",
    "Hokkien": "Language and Linguistics",
    "Great_power": "Politics and Government",
    "Videoconferencing": "Science and Technology",
    "Digimon": "Entertainment and Arts",
    "Intellectual_property": "Law and Legal",
    "Canadian_football": "Sports",
    "Bill_%26_Melinda_Gates_Foundation": "Nonprofit Organizations",
    "Political_philosophy": "Philosophy",
    "Diarrhea": "Health and Medicine",
    "Iranian_languages": "Language and Linguistics",
    "Exhibition_game": "Sports",
    "Internet_service_provider": "Business and Economy",
    "Georgian_architecture": "Architecture",
    "Dutch_Republic": "History",
    "Lancashire": "Geography and Places",
    "Infrared": "Science and Technology",
    "Digestion": "Health and Medicine",
    "Immunology": "Science and Technology",
    "Animal": "Nature and Environment",
    "General_Electric": "Business and Economy",
    "Central_Intelligence_Agency": "Politics and Government",
    "Mesozoic": "Science and Technology",
    "Imamah_(Shia_doctrine)": "Religion and Spirituality",
    "Order_of_the_British_Empire": "Politics and Government",
    "Great_Plains": "Geography and Places",
    "Race_and_ethnicity_in_the_United_States_Census": "People and Ethnicity",
    "Letter_case": "Language and Linguistics",
    "Communication": "Media and Communication",
    "England_national_football_team": "Sports",
    "Federal_Aviation_Administration": "Politics and Government",
    "Grape": "Nature and Environment",
    "Pitch_(music)": "Music",
}


if __name__ == "__main__":
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))
    main_openai_embeddings()
    # main()
    # print(f"OpenAI API Cost Estimate: ${get_openai_api_cost_estimate():.2f}")
