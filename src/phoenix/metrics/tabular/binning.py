"""
Strategies for binning numerical data.
"""

import abc
from typing import List, Union

import numpy as np

from phoenix.datasets import Dataset


BinBoundariesType = Union[List[float], np.ndarray]


class Histogram(np.ndarray):
    pass


class BinningStrategy(abc.ABC):
    @abc.abstractmethod
    def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
        pass


class QuantileBinningStrategy(BinningStrategy):
    def __init__(self, num_quantiles: int) -> None:
        self.num_quantiles = num_quantiles
        super().__init__()

    def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
        raise NotImplementedError()


class IntegerBinningStrategy(BinningStrategy):
    def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
        raise NotImplementedError()


class CustomBinningStrategy(BinningStrategy):
    def __init__(self, boundaries: BinBoundariesType):
        raise NotImplementedError()

    def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
        raise NotImplementedError()


class CategoricalBinningStrategy(BinningStrategy):
    def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
        raise NotImplementedError()
