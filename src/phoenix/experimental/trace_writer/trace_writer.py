from abc import ABC, abstractmethod

import numpy as np
import pandas as pd
import snowflake.connector as sf_sql
from databricks import sql as db_sql
from snowflake.connector.pandas_tools import write_pandas

from phoenix.experimental.trace_writer.constants import (
    SPAN_DATAFRAME_TYPES,
    SQL_TYPE_MAP,
)
from phoenix.session.session import Session


def generate_query_fields():
    """
    key_names: valid column names
    query_fields: the CREATE TABLE query body (COLNAME TYPE,...)
    """
    key_names = []
    query_fields = ""
    for colname, dtype in SPAN_DATAFRAME_TYPES.items():
        key_name = f"`{colname}`" if "." in colname else colname
        key_names.append(key_name)
        query_fields = f"{query_fields} {key_name} {SQL_TYPE_MAP.get(dtype, 'STRING')},"
    # remove final ',' in column_types
    return key_names, query_fields[:-1]


class TraceStore(ABC):
    key_names, query_fields = generate_query_fields()

    def __init__(self, friendly_name, table_name, **connection_params):
        self.friendly_name = friendly_name
        self.table_name = table_name
        self.conn = self._connect(**connection_params)
        self.timestamp = None
        self.create_table()

    @abstractmethod
    def _connect(self, **connection_params):
        ...

    @abstractmethod
    def _create(self):
        ...

    @abstractmethod
    def _insert(self, traces):
        ...

    @abstractmethod
    def _process_insert(self, df: pd.DataFrame):
        ...

    def create_table(self):
        """create table (if it doesn't exist)"""
        try:
            self._create()
            print(
                f"{self.friendly_name} table '{self.table_name}' created and ready for uploads"
            )
        except Exception as e:
            print(
                f"Failed to create {self.friendly_name} table {self.table_name}. Error: {str(e)}"
            )

    def insert_traces_in_table(self, traces):
        """insert rows of traces into table"""
        try:
            self._insert(traces)
            print(
                f"""Inserted {len(traces)} trace records to
                {self.friendly_name} table {self.table_name}"""
            )
        except Exception as e:
            print(
                f"""Failed to insert data into {self.friendly_name}
                table {self.table_name}. Error: {str(e)}"""
            )

    def upload(self, session: Session):
        # only grab spans that have been added since last upload timestamp
        df = session.get_spans_dataframe(start_time=self.timestamp)
        if df is not None:
            self._process_insert(df)
            # Update and shift timestamp to avoid duplicate writes
            self.timestamp = df.start_time.max() + pd.Timedelta(milliseconds=1)
        else:
            print("No new spans found")


class SQLTypeStore(TraceStore):
    def __init__(self, friendly_name, table_name, **connection_params):
        super().__init__(friendly_name, table_name, **connection_params)

    def _create(self):
        """create SQL table (if it doesn't exist)"""
        query = f"CREATE TABLE IF NOT EXISTS {self.table_name} ({self.query_fields});"
        self._run_query(query)

    def _insert(self, traces):
        """insert rows into table in SQL"""
        query = f"""INSERT INTO {self.table_name}
        ({', '.join(self.key_names)}) VALUES {', '.join(traces)};"""
        self._run_query(query)

    def _run_query(self, query):
        with self.conn.cursor() as cursor:
            cursor.execute(query)

    def _convert_datetime(self, df: pd.DataFrame):
        """convert datetime columns from string to datetime"""
        for col in ["start_time", "end_time"]:
            df[col] = pd.to_datetime(df[col])
        return df

    def _process_insert(self, df: pd.DataFrame):
        """Get recent spans from active session and insert in SQL table"""
        # convert from string to datetime to match TIMESTAMP
        df = self._convert_datetime(df)
        traces = []
        for _, row in df.iterrows():
            values = []
            for span_key, span_dtype in SPAN_DATAFRAME_TYPES.items():
                value = row[span_key]
                if value is None or np.all(pd.isna(value)):
                    values.append("NULL")
                elif span_dtype.endswith("64"):
                    # numeric types
                    values.append(f"{value}")
                else:
                    # string, list, and datetime
                    val = str(value).replace('"', "'")
                    values.append(f'"{val}"')
            traces.append(f"({','.join(values)})")
        self.insert_traces_in_table(traces)


class DatabricksTraceStore(SQLTypeStore):
    """
    Databricks SQL Trace Store
    Send Phoenix traces to Databricks SQL table
    """

    def __init__(self, table_name, server_hostname, http_path, access_token):
        super().__init__(
            "DataBricks",
            table_name,
            server_hostname=server_hostname,
            http_path=http_path,
            access_token=access_token,
        )

    def _connect(self, **connection_params):
        return db_sql.connect(**connection_params)

    def _create(self):
        """create DataBricks SQL table (if it doesn't exist)"""
        query = f"CREATE TABLE IF NOT EXISTS {self.table_name} ({self.query_fields}) USING DELTA;"
        self._run_query(query)


class SnowflakeTraceStore(SQLTypeStore):
    """
    Snowflake Trace Store
    Send Phoenix traces to Snowflake wharehouse table
    """

    def __init__(
        self, table_name, user, password, account, warehouse, database, schema
    ):
        super().__init__(
            "Snowflake",
            table_name,
            user=user,
            password=password,
            account=account,
            warehouse=warehouse,
            database=database,
            schema=schema,
        )

    def _connect(self, **connection_params):
        return sf_sql.Connect(**connection_params)

    def _insert(self, df: pd.DataFrame):
        reset_columns = df.columns
        df.columns = map(
            lambda x: str(x).upper() if "." not in x else f"`{str(x).upper()}`",
            df.columns,
        )
        write_pandas(self.conn, df, table_name=self.table_name)
        df.columns = reset_columns

    def _process_insert(self, df: pd.DataFrame):
        """Get recent spans from active session and insert in SQL table"""
        df = self._convert_datetime(df)
        self.insert_traces_in_table(df)
