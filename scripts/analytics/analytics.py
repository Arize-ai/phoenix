import json
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

import pypistats
import requests

GITHUB_API_URL = "https://api.github.com"
REPO = "Arize-ai/phoenix"

assert "GITHUB_TOKEN" in os.environ, "Please set the GITHUB_TOKEN environment variable"

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]

headers = {
    "Accept": "application/vnd.github.v3.star+json",
    "Authorization": f"token {GITHUB_TOKEN}",
}


def get_stars(repo: str) -> List[Dict[str, Any]]:
    stars = []
    page = 1
    while True:
        response = requests.get(
            f"{GITHUB_API_URL}/repos/{repo}/stargazers",
            headers=headers,
            params={"per_page": 100, "page": page},
        )
        if response.status_code != 200:
            break
        data = response.json()
        if not data:
            break
        stars.extend(data)
        page += 1
    return stars


def aggregate_weekly(stars: List[Dict[str, Any]]) -> Dict[str, int]:
    weekly_counts: Dict[str, int] = defaultdict(int)
    for star in stars:
        starred_at = star["starred_at"]
        week = datetime.strptime(starred_at, "%Y-%m-%dT%H:%M:%SZ").strftime("%Y-%U")
        weekly_counts[week] += 1
    return weekly_counts


def pull_github_metrics() -> None:
    stars = get_stars(REPO)
    weekly_star_counts = aggregate_weekly(stars)

    # Output or store the weekly counts with column headers
    with open("weekly_star_counts.csv", "w") as f:
        f.write("Date,Weekly_Stars,Cumulative_Stars\n")
        for week, count in sorted(weekly_star_counts.items()):
            date = datetime.strptime(week + "-1", "%Y-%W-%w").strftime("%Y-%m-%d")
            cumulative_stars = sum(count for w, count in weekly_star_counts.items() if w <= week)
            f.write(f"{date},{count},{cumulative_stars}\n")


def pull_npm_metrics() -> None:
    # Pull download metrics for specified npm packages by week starting from March 2023

    NPM_API_URL = "https://api.npmjs.org/downloads/point"
    PACKAGES = [
        "@arizeai/openinference-instrumentation-openai",
        "@arizeai/openinference-instrumentation-langchain",
        "@arizeai/openinference-semantic-conventions",
    ]

    def get_npm_downloads(package: str, start_date: str, end_date: str) -> int:
        url = f"{NPM_API_URL}/{start_date}:{end_date}/{package}"
        response = requests.get(url)
        if response.status_code == 200:
            downloads = response.json().get("downloads", 0)
            return int(downloads) if isinstance(downloads, int) else 0
        else:
            print(f"Failed to fetch data for {package}: {response.status_code}")
            return 0

    # Set start date to March 1, 2023
    start_date = datetime(2023, 3, 1)
    end_date = datetime.now()

    with open("npm_download_counts.csv", "w") as f:
        f.write("Package,Week,Downloads\n")
        for package in PACKAGES:
            current_date = start_date
            while current_date < end_date:
                week_end = min(current_date + timedelta(days=6), end_date)
                downloads = get_npm_downloads(
                    package,
                    current_date.strftime("%Y-%m-%d"),
                    week_end.strftime("%Y-%m-%d"),
                )
                f.write(f"{package},{current_date.strftime('%Y-%m-%d')},{downloads}\n")
                current_date += timedelta(days=7)

    print("NPM download metrics have been written to npm_download_counts.csv")


def pull_pypi_metrics() -> None:
    # Pull download metrics for specified PyPI packages by month starting from 180 days ago

    PACKAGES = [
        "arize-phoenix",
        "arize-phoenix-evals",
        "openinference-semantic-conventions",
        "openinference-instrumentation-openai",
        "openinference-instrumentation-mistralai",
        "openinference-instrumentation-langchain",
        "openinference-instrumentation-llama-index",
        "openinference-instrumentation-haystack",
        "openinference-instrumentation-vertexai",
        "openinference-instrumentation-groq",
        "openinference-instrumentation-dspy",
        "openinference-instrumentation-bedrock",
        "openinference-instrumentation-crewai",
        "openinference-instrumentation-litellm",
    ]

    def get_pypi_downloads(package: str, start_date: datetime, end_date: datetime) -> int:
        try:
            data = pypistats.overall(
                package,
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d"),
                format="json",
            )
            data_json = json.loads(data)
            return next(
                (
                    item["downloads"]
                    for item in data_json["data"]
                    if item["category"] == "with_mirrors"
                ),
                0,
            )
        except Exception as e:
            print(f"Failed to fetch data for {package}: {str(e)}")
            return 0

    # Set start date to 180 days ago
    start_date = datetime.now() - timedelta(days=180)
    end_date = datetime.now()

    with open("pypi_download_counts.csv", "w") as f:
        f.write("Package,Week,Downloads\n")
        for package in PACKAGES:
            current_date = start_date
            while current_date < end_date:
                week_end = min(current_date + timedelta(days=6), end_date)
                downloads = get_pypi_downloads(package, current_date, week_end)
                f.write(f"{package},{current_date.strftime('%Y-%m-%d')},{downloads}\n")
                current_date += timedelta(days=7)

    print("PyPI download metrics have been written to pypi_download_counts.csv")


if __name__ == "__main__":
    pull_pypi_metrics()
    pull_npm_metrics()
    pull_github_metrics()
