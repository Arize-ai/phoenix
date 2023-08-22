from pandas import DataFrame


class Traces:
    """
    Traces class is used to contain abstractions around the traces dataframe
    """

    _dataframe: DataFrame

    def __init__(self, dataframe: DataFrame):
        self._dataframe = dataframe
