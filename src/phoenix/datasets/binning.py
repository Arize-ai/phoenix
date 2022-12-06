"""
Strategies for binning numerical data.
"""

import abc

import pandas as pd


class BinningStrategy(abc.ABC):
    @abc.abstractmethod
    def bin(self, primary: pd.DataFrame, reference: pd.DataFrame) -> (pd.DataFrame, pd.DataFrame):
        pass

# class QuantileBinningStrategy(BinningStrategy):
#     def __init__(self, num_quantiles: int) -> None:
#         self.num_quantiles = num_quantiles
#         super().__init__()
#
#     def bin(self, primary: Dataset, reference: Dataset) -> (Histogram, Histogram):
#         raise NotImplementedError()
