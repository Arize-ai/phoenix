from typing import List

# from phoenix.datasets import Dataset


class Model:
    def __init__(self, primary_dataset_name: str, reference_dataset_name: str):
        self.primary_dataset_name = primary_dataset_name
        self.reference_dataset_name = reference_dataset_name
        # self.primary_dataset = Dataset.from_name(primary_dataset_name)
        # self.reference_dataset = Dataset.from_name(reference_dataset_name)

        # TODO construct model dimensions from the dataset schemas

    @property
    def dimensions(self) -> List[str]:
        # TODO return the model dimensions as a list of tuples (name, dimension_type)
        return ["bank", "chargeAmount"]

    @property
    def embedding_dimensions(self) -> List[str]:
        return ["vector_1", "vector_2"]
