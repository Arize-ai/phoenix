import json
import random
import uuid
from pathlib import Path
from typing import Any, Dict, List

from faker import Faker

import phoenix as px
from phoenix.experiments import run_experiment

fake = Faker()

# --- Configurable parameters ---
NUM_EXAMPLES = 20
NUM_EXPERIMENTS = 3
DATASET_NAME = "test-dataset-" + str(uuid.uuid4())


# --- Helper functions ---
def generate_document() -> Dict[str, Any]:
    return {
        "rating": random.randint(0, 1),
        "internal_id": fake.random_number(digits=13),
        "document": fake.text(max_nb_chars=300),
        "internal_hub_id": fake.uuid4(),
    }


def generate_example() -> Dict[str, Any]:
    # Input is a list of documents
    input_docs = [generate_document() for _ in range(random.randint(3, 7))]
    # Output is a summary or answer
    output = {
        "summary": fake.sentence(nb_words=20),
        "relevant_ids": [doc["internal_id"] for doc in input_docs if doc["rating"] == 1],
        "notes": fake.text(max_nb_chars=100),
    }
    return {"input": {"documents": input_docs}, "output": output}


def generate_dataset(num_examples: int) -> List[Dict[str, Any]]:
    return [generate_example() for _ in range(num_examples)]


def save_dataset(examples: List[Dict[str, Any]], path: Path) -> None:
    with path.open("w") as f:
        for ex in examples:
            f.write(json.dumps(ex) + "\n")


def main() -> None:
    client = px.Client()
    # Generate dataset
    print(f"Generating {NUM_EXAMPLES} examples...")
    examples = generate_dataset(NUM_EXAMPLES)
    dataset = client.upload_dataset(
        dataset_name=DATASET_NAME,
        inputs=[ex["input"] for ex in examples],
        outputs=[ex["output"] for ex in examples],
    )

    # Define a simple experiment function (e.g., count relevant docs)
    def experiment_task(example: Any) -> Dict[str, Any]:
        docs = example.input["documents"]
        relevant = [doc for doc in docs if doc["rating"] == 1]
        return {
            "relevant_count": len(relevant),
            "all_ids": [doc["internal_id"] for doc in docs],
            # Additional fake data fields
            "user_name": fake.name(),
            "user_email": fake.email(),
            "user_address": fake.address(),
            "company": fake.company(),
            "job_title": fake.job(),
            "date_of_birth": fake.date_of_birth().isoformat(),
            "phone_number": fake.phone_number(),
            "website": fake.url(),
            "ipv4": fake.ipv4(),
            "ipv6": fake.ipv6(),
            "credit_card": fake.credit_card_full(),
            "ssn": fake.ssn(),
            "profile": fake.simple_profile(),
            "sentence": fake.sentence(),
            "paragraph": fake.paragraph(),
            "timestamp": fake.iso8601(),
            "uuid": str(fake.uuid4()),
            "boolean_flag": fake.boolean(),
            "currency_code": fake.currency_code(),
            "color_name": fake.color_name(),
            "country": fake.country(),
            "city": fake.city(),
            "zipcode": fake.zipcode(),
            "latitude": fake.latitude(),
            "longitude": fake.longitude(),
            "random_int": fake.random_int(),
            "random_digit": fake.random_digit(),
            "random_letter": fake.random_letter(),
            "words": fake.words(nb=5),
            "hex_color": fake.hex_color(),
            "mac_address": fake.mac_address(),
            "file_name": fake.file_name(),
            "mime_type": fake.mime_type(),
            "user_agent": fake.user_agent(),
            "company_email": fake.company_email(),
            "iban": fake.iban(),
            "license_plate": fake.license_plate(),
            "catch_phrase": fake.catch_phrase(),
            "bs": fake.bs(),
        }

    def evaluator_contains_relevant_ids(output: Dict[str, Any]) -> bool:
        if not output or "relevant_count" not in output:
            return False
        return output["relevant_count"] > 0

    # Run multiple experiments
    for i in range(NUM_EXPERIMENTS):
        run_experiment(
            dataset=dataset,
            task=experiment_task,
            evaluators=[evaluator_contains_relevant_ids],
            experiment_name=f"experiment_{i + 1}",
            experiment_description=f"Experiment {i + 1}",
            experiment_metadata={"num_examples": NUM_EXAMPLES},
            concurrency=1,
            timeout=10,
            print_summary=True,
        )


if __name__ == "__main__":
    main()
