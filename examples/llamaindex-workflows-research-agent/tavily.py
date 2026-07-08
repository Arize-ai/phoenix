import os

import requests
from dotenv import load_dotenv
from llama_index.core.schema import Document


async def get_docs_from_tavily_search(sub_query: str, visited_urls: set[str]):
    load_dotenv()
    api_key = os.getenv("TAVILY_API_KEY")
    base_url = "https://api.tavily.com/search"
    headers = {
        "Content-Type": "application/json",
    }
    data = {
        "query": sub_query,
        "api_key": api_key,
        "include_raw_content": True,
    }

    docs = []
    print(f"\n> Searching Tavily for sub query: {sub_query}\n")
    response = requests.post(base_url, headers=headers, json=data)
    if response.status_code == 200:
        search_results = response.json().get("results", [])
        for search_result in search_results:
            url = search_result.get("url")
            if not search_result.get("raw_content"):
                continue
            if url not in visited_urls:
                visited_urls.add(url)
                docs.append(
                    Document(
                        text=search_result.get("raw_content"),
                        metadata={
                            "source": url,
                            "title": search_result.get("title"),
                        },
                    )
                )
        print(f"\n> Found {len(docs)} docs from Tavily search on {sub_query}\n")
        return docs, visited_urls
    else:
        response.raise_for_status()
