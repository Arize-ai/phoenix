"""
Llama Index implementation of a chunking and query testing system
"""
from phoenix.experimental import evals
from llama_index.callbacks import CallbackManager, LlamaDebugHandler, CBEventType

from plotresults import (
    plot_mean_precision_graphs, plot_mean_average_precision_graphs, plot_latency_graphs, 
    plot_mrr_graphs, plot_ndcg_graphs, plot_percentage_incorrect
)
import datetime 
from sklearn.metrics import ndcg_score
import cohere

import phoenix.experimental.evals.templates.default_templates as templates
from phoenix.experimental.evals.functions.binary import retrieval_concat_and_truncate
from phoenix.experimental.evals import (
    OpenAIModel,
    llm_eval_binary,
    run_relevance_eval,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR
)
from llama_index.indices.postprocessor.cohere_rerank import CohereRerank
from io import StringIO
import csv
import config
import pickle
import time
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from llama_index.query_engine.multistep_query_engine import MultiStepQueryEngine
from llama_index.indices.query.query_transform.base import StepDecomposeQueryTransform
from llama_index.node_parser import SimpleNodeParser
from llama_index.indices.query.query_transform import HyDEQueryTransform
from llama_index.query_engine.transform_query_engine import TransformQueryEngine

from llama_index import (
    QuestionAnswerPrompt, RefinePrompt, StorageContext, download_loader,
    VectorStoreIndex, LLMPredictor, ServiceContext, load_index_from_storage,
)

from llama_index.llms import OpenAI
import requests
from bs4 import BeautifulSoup

import os
import openai
from llama_index.llms import OpenAI


#URL and Website download utilities
def get_urls(base_url):
    if not base_url.endswith("/"):
        base_url = base_url + "/"
    page = requests.get(f"{base_url}sitemap.xml")
    scraper = BeautifulSoup(page.content, "xml")

    urls_from_xml = []

    loc_tags = scraper.find_all("loc")

    for loc in loc_tags:
        urls_from_xml.append(loc.get_text())

    return urls_from_xml

#Plots 
def plot_graphs(all_data, k, save_dir="./", show=True, remove_zero=True):
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    plot_latency_graphs(all_data, save_dir, show)
    plot_mean_average_precision_graphs(all_data, save_dir, show,  remove_zero)
    plot_mean_precision_graphs(all_data, save_dir, show,remove_zero)
    plot_ndcg_graphs(all_data, save_dir, show, remove_zero)
    plot_mrr_graphs(all_data, save_dir, show,remove_zero)
    plot_percentage_incorrect(all_data, save_dir, show, remove_zero)

#LamaIndex performance optimizaitons 
def get_transformation_query_engine(index, name, k, lama_index_model):
    if name == "original":
        # query cosine similarity to nodes engine
        llama_debug = LlamaDebugHandler(print_trace_on_end=True)
        callback_manager = CallbackManager([llama_debug])
        service_context = ServiceContext.from_defaults(
            llm=OpenAI(temperature=float(0.6), model= lama_index_model),
            callback_manager=callback_manager,
        )
        query_engine = index.as_query_engine(
            similarity_top_k=k,
            response_mode="compact",
            service_context=service_context,
        )  # response mode can also be parameterized
        return query_engine
    elif name == "original_rerank":
        cohere_rerank = CohereRerank(api_key=cohere.api_key, top_n=k)
        service_context = ServiceContext.from_defaults(
            llm=OpenAI(temperature=0.6, model=lama_index_model)
        )
        query_engine = index.as_query_engine(
            similarity_top_k=k * 2,
            response_mode="refine",  # response mode can also be parameterized
            service_context=service_context,
            node_postprocessors=[cohere_rerank],
        )
        return query_engine
    elif name == "hyde":
        service_context = ServiceContext.from_defaults(
            llm=OpenAI(temperature=0.6, model=lama_index_model)  # change to model
        )
        query_engine = index.as_query_engine(
            similarity_top_k=k, response_mode="refine", service_context=service_context
        )
        hyde = HyDEQueryTransform(include_original=True)
        hyde_query_engine = TransformQueryEngine(query_engine, hyde)

        return hyde_query_engine

    elif name == "hyde_rerank":
        cohere_rerank = CohereRerank(api_key=cohere.api_key, top_n=k)

        llama_debug = LlamaDebugHandler(print_trace_on_end=True)
        callback_manager = CallbackManager([llama_debug])
        service_context = ServiceContext.from_defaults(
            llm=OpenAI(temperature=0.6, model=lama_index_model),
            callback_manager=callback_manager,
        )
        query_engine = index.as_query_engine(
            similarity_top_k=k * 2,
            response_mode="compact",
            service_context=service_context,
            node_postprocessors=[cohere_rerank],
        )
        hyde = HyDEQueryTransform(include_original=True)
        hyde_rerank_query_engine = TransformQueryEngine(query_engine, hyde)

        return hyde_rerank_query_engine

    elif name == "multistep":
        gpt4 = OpenAI(temperature=0.6, model=lama_index_model)
        service_context_gpt4 = ServiceContext.from_defaults(llm=gpt4)

        step_decompose_transform = StepDecomposeQueryTransform(
            LLMPredictor(llm=gpt4), verbose=True
        )

        multi_query_engine = MultiStepQueryEngine(
            query_engine=index.as_query_engine(
                service_context=service_context_gpt4, similarity_top_k=k
            ),
            query_transform=step_decompose_transform,
            index_summary="documentation",  # llama index isn't really clear on how this works
        )

        return multi_query_engine

    else:
        return

#Main run experiment function
def run_experiments(
    documents, queries, chunk_sizes, query_transformations, k_values, 
    web_title, save_dir,  lama_index_model, eval_model, qa_templ, all_data = {} 
):
    
    for chunk_size in chunk_sizes:
        print(f"PARSING WITH CHUNK SIZE {chunk_size}")
        persist_dir = f"./indices/{web_title}_{chunk_size}"
        if os.path.isdir(persist_dir):
            print("EXISTING INDEX FOUND, LOADING...")
            # Rebuild storage context
            storage_context = StorageContext.from_defaults(persist_dir=persist_dir)

            # Load index from the storage context
            index = load_index_from_storage(storage_context)
        else:
            print("BUILDING INDEX...")
            node_parser = SimpleNodeParser.from_defaults(
                chunk_size=chunk_size, chunk_overlap=0
            )  # you can also experiment with the chunk overlap too
            nodes = node_parser.get_nodes_from_documents(documents)
            index = VectorStoreIndex(nodes, show_progress=True)
            index.storage_context.persist(persist_dir)

        engines = {}
        for k in k_values:  # <-- This is where we add the loop for k.
            # create different query transformation engines
            for name in query_transformations:
                this_engine = get_transformation_query_engine(index, name, k,  lama_index_model)
                engines[name] = this_engine

            query_transformation_data = {name: [] for name in engines}
            #Loop through query engines - testing each  
            for name in engines:

                engine = engines[name]
                if chunk_size not in all_data:
                    all_data[chunk_size] = {}
                if name not in all_data[chunk_size]:
                    all_data[chunk_size][name] = {}
                # these take some time to compute...
                for i, query in enumerate(queries):
                    print("-" * 50)
                    print(f"QUERY {i + 1}: ", query)
                    print("-" * 10)
                    print(f"TRANSFORMATION: {name}")
                    print(f"CHUNK SIZE: {chunk_size}")
                    print(f"K : {k}")
                    print(f"LAMAINDEX MODEL : {lama_index_model}")
                    
                    time_start = time.time()
                    response = engine.query(query)
                    time_end = time.time()
                    response_latency = time_end - time_start

                    print(f"RESPONSE: ", response, "\n")
                    print(f"LATENCY: {response_latency:.2f}", "\n")
                    contexts = [
                        source_node.node.get_content()
                        for source_node in response.source_nodes
                    ]

                    scores = [source_node.score for source_node in response.source_nodes]

                    row = (
                        [query, response.response]
                        + [response_latency]
                        + contexts
                        + [contexts]
                        + [scores]
                    )
                    query_transformation_data[name].append(row)

                    print("-" * 50)

            columns = (
                ["query", "response"]
                + ["response_latency"]
                + [f"retrieved_context_{i}" for i in range(1, k + 1)]
                + ["retrieved_context_list"]
                + ["scores"]
            )

            for name, data in query_transformation_data.items():
                if name == "multistep":
                    df = pd.DataFrame(
                        data,
                        columns=[
                            "query",
                            "response",
                            "response_evaluation",
                            "response_latency",
                        ],
                    )
                    all_data[chunk_size][name][k] = df
                else:
                    df = pd.DataFrame(data, columns=columns)
                print(f"RUNNING EVALS\n")
                print(f"RUNNING EVALS\n")
                time_start = time.time()
                df = df_evals(df, eval_model, formatted_evals_column="retrieval_evals")
                time_end = time.time()
                eval_latency = time_end - time_start   
                print(f"EVAL LATENCY: {eval_latency:.2f}", "\n") 
                #Calculate MRR/NDCG on top of Eval metrics
                df= calculate_metrics(df, k,  formatted_evals_column="retrieval_evals")
                all_data[chunk_size][name][k] = df
            
            tmp_save_dir = save_dir + "tmp_" + str(chunk_size) + '/'
            #Save tmp plots
            plot_graphs(all_data, k, tmp_save_dir, show=False)
            #Save tmp raw data
            with open( tmp_save_dir + 'data_all_data.pkl', 'wb') as file:
                pickle.dump(all_data, file)

    return all_data

#Running the main Phoenix Evals both Q&A and Retrieval
def df_evals(df, eval_model, formatted_evals_column = "retrieval_evals",qa_templ=templates.QA_PROMPT_TEMPLATE_STR):
        model = OpenAIModel(model_name=eval_model, temperature=0.0)
        # Then use the function in a single call
        df['context'] = df['retrieved_context_list'].apply(lambda x: retrieval_concat_and_truncate(x, 
                                                                                                   encoding_name=model.model_name))
        df = df.rename(columns={"query": "question", "response":"sampled_answer"})
        #Q&A Eval: Did the LLM get the answer right? Checking the LLM
        Q_and_A_classifications = llm_eval_binary(
            dataframe=df,
            template=qa_templ,
            model=model,
            rails=["correct", "incorrect"],
        )
        df['qa_evals'] = Q_and_A_classifications
        #Retreival Eval: Did I have the relevant data to even answer the question? 
        #Checking retrieval system

        df[formatted_evals_column] = run_relevance_eval(dataframe=df, query_column_name="question", 
                           retrieved_documents_column_name = "retrieved_context_list",
                           template=RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
                           model = model,
                           output_map={"relevant":1, "irrelevant":0}, 
                            trace_data=False)
        return df

#Calculatae performance metrics 
def calculate_metrics(df, k, formatted_evals_column = "formatted_evals"):
    df['data'] = df.apply(lambda row: process_row(row, formatted_evals_column, k), axis=1)
    # Separate the list of data into separate columns
    derived_columns = (
        [f"context_precision_at_{i}" for i in range(1, k + 1)]
        + [f"average_context_precision_at_{i}" for i in range(1, k + 1)]
        + [f"ndcg_at_{i}" for i in range(1, k + 1)]
        + [f"rank_at_{i}" for i in range(1, k + 1)]
    )
    df_new = pd.DataFrame(df['data'].tolist(), columns=derived_columns, index=df.index)
    # Concatenate this new DataFrame with the old one:
    df_combined = pd.concat([df, df_new], axis=1)
    # don't want the 'data' column anymore:
    df_combined.drop('data', axis=1, inplace=True)
    return df_combined

#Performance metrics 
def compute_precision_at_i(eval_scores, i):
    return sum(eval_scores[:i]) / i

def compute_average_precision_at_i(evals, cpis, i):
    if np.sum(evals[:i]) == 0:
        return 0
    subset = cpis[:i]
    return (np.array(evals[:i]) @ np.array(subset)) / np.sum(evals[:i])

def get_rank(evals):
    for i, eval in enumerate(evals):
        if eval == 1:
            return i + 1
    return np.inf

#Run performance metrics on row of Evals data
def process_row(row, formatted_evals_column, k):
    formatted_evals = row[formatted_evals_column]
    cpis = [compute_precision_at_i(formatted_evals, i) for i in range(1, k + 1)]
    acpk = [compute_average_precision_at_i(formatted_evals, cpis, i) for i in range(1, k + 1)]
    ndcgis = [ndcg_score([formatted_evals], [row['scores']], k=i) for i in range(1, k + 1)]
    ranki = [get_rank(formatted_evals[:i]) for i in range(1, k + 1)]
    return cpis + acpk + ndcgis + ranki


def read_strings_from_csv(url):
    # Fetch the CSV data
    response = requests.get(url)
    response.raise_for_status()  # This will raise an error if the request failed
    # Use StringIO to simulate a file object
    csv_file = StringIO(response.text)
    # Parse the CSV data
    reader = csv.reader(csv_file)
    # Assuming each row in the CSV has a single string (in the first column)
    strings = [row[0] for row in reader]
    return strings

def main():
    name = "BeautifulSoupWebReader"
    BeautifulSoupWebReader = download_loader(name)
    now = datetime.datetime.now()
    run_name = now.strftime('%Y%m%d_%H%M')
    # Directory parameter for saving data!

    openai.api_key = (
        config.open_ai_key
    )  # replace with the string containing the API key if needed
    cohere.api_key = config.cohere_key
    #Used by Arize Evals
    os.environ['OPENAI_API_KEY'] =  config.open_ai_key

    # if loading from scratch, change these below
    web_title = "arize"  # nickname for this website, used for saving purposes
    base_url = "https://docs.arize.com/arize"
    #Local files
    file_name = 'raw_documents.pkl'
    save_base = f"./experiment_data/" 
    save_dir = save_base + run_name + "/"

    # Read strings from CSV
    questions = read_strings_from_csv("https://storage.googleapis.com/arize-assets/fixtures/Embeddings/GENERATIVE/constants.csv")

    if not os.path.exists(save_base + file_name):
        print(f"'{save_base}{file_name}' does not exists.")
        urls = get_urls(base_url) #you need to - pip install lxml
        print(f"LOADED {len(urls)} URLS")

    print("GRABBING DOCUMENTS")
    # two options here, either get the documents from scratch or load one from disk
    if not os.path.exists(save_base + file_name):
        print("LOADING DOCUMENTS FROM URLS")
        #You need to 'pip install lxml'
        loader = BeautifulSoupWebReader()
        documents = loader.load_data(urls=urls)  # may take some time
        with open(save_base + file_name, "wb") as file:
            pickle.dump(documents, file)
        print("Documents saved to raw_documents.pkl")
    else:
        print("LOADING DOCUMENTS FROM FILE")
        print("Opening raw_documents.pkl")
        with open(save_base + file_name, "rb") as file:
            documents = pickle.load(file)
    chunk_sizes = [
        100,
        300,
        500,
        #1000,
        #2000,
    ]  # change this, perhaps experiment from 500 to 3000 in increments of 500
    
    k = [4, 6, 10]
    #k = [10]  # num documents to retrieve

    #transformations = ["original", "original_rerank","hyde", "hyde_rerank"]
    transformations = ["original", "original_rerank"]

    lama_index_model = "gpt-4"
    #lama_index_model = "gpt-3.5-turbo"

    eval_model = "gpt-4"
    #QA template (using default)
    qa_templ = templates.QA_PROMPT_TEMPLATE_STR 
    #Uncomment below when testing to limit questions to 3
    #questions = questions[0:3]
    all_data = run_experiments(
        documents,
        questions,
        chunk_sizes,
        transformations,
        k,
        web_title,
        save_dir,
        lama_index_model,
        eval_model,
        qa_templ
    )


    with open(f"{save_dir}{web_title}_all_data.pkl", "wb") as f:
        pickle.dump(all_data, f)

    plot_graphs(all_data, k, save_dir +  "/results_zero_removed/", show=False)
    plot_graphs(all_data, k, save_dir + "/results_no_zero_remove/", show=False, 
                remove_zero=False)


if __name__ == "__main__":
    program_start = time.time()
    main()
    program_end = time.time()
    total_time = (program_end - program_start) / (60 * 60)
    print(f"EXPERIMENTS FINISHED: {total_time:.2f} hrs")
