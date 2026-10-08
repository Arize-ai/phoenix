from typing import Optional

from pydantic import Field

from .base_model import BaseModel
from .enums import GenerativeModelKind, TokenKind


class GenerativeModels(BaseModel):
    generative_models: "GenerativeModelsGenerativeModels" = Field(
        alias="generativeModels"
    )


class GenerativeModelsGenerativeModels(BaseModel):
    page_info: "GenerativeModelsGenerativeModelsPageInfo" = Field(alias="pageInfo")
    edges: list["GenerativeModelsGenerativeModelsEdges"]


class GenerativeModelsGenerativeModelsPageInfo(BaseModel):
    has_next_page: bool = Field(alias="hasNextPage")
    end_cursor: Optional[str] = Field(alias="endCursor")


class GenerativeModelsGenerativeModelsEdges(BaseModel):
    node: "GenerativeModelsGenerativeModelsEdgesNode"


class GenerativeModelsGenerativeModelsEdgesNode(BaseModel):
    name: str
    name_pattern: str = Field(alias="namePattern")
    kind: GenerativeModelKind
    provider: Optional[str]
    token_prices: list["GenerativeModelsGenerativeModelsEdgesNodeTokenPrices"] = Field(
        alias="tokenPrices"
    )


class GenerativeModelsGenerativeModelsEdgesNodeTokenPrices(BaseModel):
    token_type: str = Field(alias="tokenType")
    kind: TokenKind
    cost_per_token: float = Field(alias="costPerToken")
    cost_per_million_tokens: float = Field(alias="costPerMillionTokens")


GenerativeModels.model_rebuild()
GenerativeModelsGenerativeModels.model_rebuild()
GenerativeModelsGenerativeModelsEdges.model_rebuild()
GenerativeModelsGenerativeModelsEdgesNode.model_rebuild()
