import bs4
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger

vector_store: InMemoryVectorStore = None


def load_web_content_to_vector_store(web_post_url):
    bs4_strainer = bs4.SoupStrainer(class_=("post-title", "post-header", "post-content"))
    loader = WebBaseLoader(
        web_paths=(web_post_url,),
        bs_kwargs={"parse_only": bs4_strainer},
    )
    docs = loader.load()
    assert len(docs) == 1
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=200, add_start_index=True
    )
    all_splits = text_splitter.split_documents(docs)
    logger.info(f"Split blog post into {len(all_splits)} sub-documents.")
    
    document_ids = vector_store.add_documents(documents=all_splits)
    logger.info(f"Loaded {len(document_ids)} to vector store.")


def initialize_vector_store(web_post_url):
    # "https://lilianweng.github.io/posts/2023-06-23-agent/"
    logger.info("Loading Vector Store.....")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
    global vector_store
    vector_store = InMemoryVectorStore(embeddings)
    logger.info("Initialized InMemoryVectorStore")
    load_web_content_to_vector_store(web_post_url)
    logger.info("Loaded Web Content to the vector store...")


def get_vector_store():
    return vector_store
