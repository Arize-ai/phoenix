from contextlib import AbstractContextManager, nullcontext
from typing import Any, Optional

import pytest

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptAnthropicInvocationParametersContent,
    denormalize_tools,
    normalize_tools,
)


@pytest.mark.parametrize(
    "tool_schema",
    [
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                    },
                },
            },
            id="get-weather-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_delivery_date",
                    "description": "Get the delivery date for a customer's order. Call this whenever you need to know the delivery date, for example when a customer asks 'Where is my package'",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "The customer's order ID.",
                            }
                        },
                        "required": ["order_id"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-delivery-date-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "generate_recipe",
                    "description": "Generate a recipe based on the user's input",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Title of the recipe.",
                            },
                            "ingredients": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of ingredients required for the recipe.",
                            },
                            "instructions": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Step-by-step instructions for the recipe.",
                            },
                        },
                        "required": ["title", "ingredients", "instructions"],
                        "additionalProperties": False,
                    },
                },
            },
            id="generate-recipe-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_product_recommendations",
                    "description": "Searches for products matching certain criteria in the database",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "categories": {
                                "description": "categories that could be a match",
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "enum": [
                                        "coats & jackets",
                                        "accessories",
                                        "tops",
                                        "jeans & trousers",
                                        "skirts & dresses",
                                        "shoes",
                                    ],
                                },
                            },
                            "colors": {
                                "description": "colors that could be a match, empty array if N/A",
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "enum": [
                                        "black",
                                        "white",
                                        "brown",
                                        "red",
                                        "blue",
                                        "green",
                                        "orange",
                                        "yellow",
                                        "pink",
                                        "gold",
                                        "silver",
                                    ],
                                },
                            },
                            "keywords": {
                                "description": "keywords that should be present in the item title or description",
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "price_range": {
                                "type": "object",
                                "properties": {
                                    "min": {"type": "number"},
                                    "max": {"type": "number"},
                                },
                                "required": ["min", "max"],
                                "additionalProperties": False,
                            },
                            "limit": {
                                "type": "integer",
                                "description": "The maximum number of products to return, use 5 by default if nothing is specified by the user",
                            },
                        },
                        "required": [
                            "categories",
                            "colors",
                            "keywords",
                            "price_range",
                            "limit",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-product-recommendations-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_product_details",
                    "description": "Fetches more details about a product",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "product_id": {
                                "type": "string",
                                "description": "The ID of the product to fetch details for",
                            }
                        },
                        "required": ["product_id"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-product-details-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "add_to_cart",
                    "description": "Add items to cart when the user has confirmed their interest.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "product_id": {
                                            "type": "string",
                                            "description": "ID of the product to add to the cart",
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "description": "Quantity of the product to add to the cart",
                                        },
                                    },
                                    "required": ["product_id", "quantity"],
                                    "additionalProperties": False,
                                },
                            }
                        },
                        "required": ["items"],
                        "additionalProperties": False,
                    },
                },
            },
            id="add-to-cart-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_order_details",
                    "description": "Fetches details about a specific order",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "The ID of the order to fetch details for",
                            }
                        },
                        "required": ["order_id"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-order-details-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_user_orders",
                    "description": "Fetches the last orders for a given user",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "The ID of the user to fetch orders for",
                            },
                            "limit": {
                                "type": "integer",
                                "description": "The maximum number of orders to return, use 5 by default and increase the number if the relevant order is not found.",
                            },
                        },
                        "required": ["user_id", "limit"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-user-orders-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "search_faq",
                    "description": "Searches the FAQ for an answer to the user's question",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The question to search the FAQ for",
                            }
                        },
                        "required": ["query"],
                        "additionalProperties": False,
                    },
                },
            },
            id="search-faq-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "process_return",
                    "description": "Processes a return and creates a return label",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "The ID of the order to process a return for",
                            },
                            "items": {
                                "type": "array",
                                "description": "The items to return",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "product_id": {
                                            "type": "string",
                                            "description": "The ID of the product to return",
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "description": "The quantity of the product to return",
                                        },
                                    },
                                    "required": ["product_id", "quantity"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["order_id", "items"],
                        "additionalProperties": False,
                    },
                },
            },
            id="process-return-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_return_status",
                    "description": "Finds the status of a return",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "order_id": {
                                "type": "string",
                                "description": "The ID of the order to fetch the return status for",
                            }
                        },
                        "required": ["order_id"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-return-status-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_recommendations",
                    "description": "Fetches recommendations based on the user's preferences",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "description": "The type of place to search recommendations for",
                                "enum": ["restaurant", "hotel"],
                            },
                            "keywords": {
                                "type": "array",
                                "description": "Keywords that should be present in the recommendations",
                                "items": {"type": "string"},
                            },
                            "location": {
                                "type": "string",
                                "description": "The location to search recommendations for",
                            },
                        },
                        "required": ["type", "keywords", "location"],
                        "additionalProperties": False,
                    },
                },
            },
            id="get-recommendations-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "show_on_map",
                    "description": "Places pins on the map for relevant locations",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "pins": {
                                "type": "array",
                                "description": "The pins to place on the map",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {
                                            "type": "string",
                                            "description": "The name of the place",
                                        },
                                        "coordinates": {
                                            "type": "object",
                                            "properties": {
                                                "latitude": {"type": "number"},
                                                "longitude": {"type": "number"},
                                            },
                                            "required": ["latitude", "longitude"],
                                            "additionalProperties": False,
                                        },
                                    },
                                    "required": ["name", "coordinates"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["pins"],
                        "additionalProperties": False,
                    },
                },
            },
            id="show-on-map-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "fetch_availability",
                    "description": "Fetches the availability for a given place",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "place_id": {
                                "type": "string",
                                "description": "The ID of the place to fetch availability for",
                            }
                        },
                    },
                },
            },
            id="fetch-availability-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "create_booking",
                    "description": "Creates a booking on the user's behalf",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "place_id": {
                                "type": "string",
                                "description": "The ID of the place to create a booking for",
                            },
                            "booking_details": {
                                "anyOf": [
                                    {
                                        "type": "object",
                                        "description": "Restaurant booking with specific date and time",
                                        "properties": {
                                            "date": {
                                                "type": "string",
                                                "description": "The date of the booking, in format YYYY-MM-DD",
                                            },
                                            "time": {
                                                "type": "string",
                                                "description": "The time of the booking, in format HH:MM",
                                            },
                                        },
                                        "required": ["date", "time"],
                                    },
                                    {
                                        "type": "object",
                                        "description": "Hotel booking with specific check-in and check-out dates",
                                        "properties": {
                                            "check_in": {
                                                "type": "string",
                                                "description": "The check-in date of the booking, in format YYYY-MM-DD",
                                            },
                                            "check_out": {
                                                "type": "string",
                                                "description": "The check-out date of the booking, in format YYYY-MM-DD",
                                            },
                                        },
                                        "required": ["check_in", "check_out"],
                                    },
                                ],
                            },
                        },
                        "required": ["place_id", "booking_details"],
                        "additionalProperties": False,
                    },
                },
            },
            id="create-booking-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "pick_tshirt_size",
                    "description": "Call this if the user specifies which size t-shirt they want",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "size": {
                                "type": "string",
                                "enum": ["s", "m", "l"],
                                "description": "The size of the t-shirt that the user would like to order",
                            }
                        },
                        "required": ["size"],
                        "additionalProperties": False,
                    },
                },
            },
            id="pick-tshirt-size-function",
        ),
    ],
)
def test_valid_openai_tool_schemas_can_be_normalized_and_denormalized_without_data_loss(
    tool_schema: dict[str, Any],
) -> None:
    normalized_tools = normalize_tools([tool_schema], ModelProvider.OPENAI)
    denormalized_tools, _ = denormalize_tools(normalized_tools, ModelProvider.OPENAI)
    assert len(denormalized_tools) == 1
    assert denormalized_tools[0] == tool_schema


@pytest.mark.parametrize(
    "tool_schema",
    [
        pytest.param(
            {
                "name": "get_weather",
                "description": "Get the current weather in a given location",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA",
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                            "description": 'The unit of temperature, either "celsius" or "fahrenheit"',
                        },
                    },
                    "required": ["location"],
                },
            },
            id="get-weather-function",
        ),
        pytest.param(
            {
                "name": "get_time",
                "description": "Get the current time in a given time zone",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "The IANA time zone name, e.g. America/Los_Angeles",
                        }
                    },
                    "required": ["timezone"],
                },
            },
            id="get-time-function",
        ),
        pytest.param(
            {
                "name": "get_location",
                "description": "Get the current user location based on their IP address. This tool has no parameters or arguments.",
                "input_schema": {"type": "object", "properties": {}},
            },
            id="get-location-function",
        ),
        pytest.param(
            {
                "name": "record_summary",
                "description": "Record summary of an image using well-structured JSON.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "key_colors": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "r": {
                                        "type": "number",
                                        "description": "red value [0.0, 1.0]",
                                    },
                                    "g": {
                                        "type": "number",
                                        "description": "green value [0.0, 1.0]",
                                    },
                                    "b": {
                                        "type": "number",
                                        "description": "blue value [0.0, 1.0]",
                                    },
                                    "name": {
                                        "type": "string",
                                        "description": 'Human-readable color name in snake_case, e.g., "olive_green" or "turquoise"',
                                    },
                                },
                                "required": ["r", "g", "b", "name"],
                            },
                            "description": "Key colors in the image. Limit to less then four.",
                        },
                        "description": {
                            "type": "string",
                            "description": "Image description. One to two sentences max.",
                        },
                        "estimated_year": {
                            "type": "integer",
                            "description": "Estimated year that the images was taken, if is it a photo. Only set this if the image appears to be non-fictional. Rough estimates are okay!",
                        },
                    },
                    "required": ["key_colors", "description"],
                },
            },
            id="record-image-summary",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "input_schema": {
                    "type": "object",
                    "properties": {"location": {"type": "string"}},
                },
            },
            id="get-weather-function-cache-control-ephemeral",
        ),
        pytest.param(
            {
                "name": "get_weather",
                "input_schema": {
                    "type": "object",
                    "properties": {"location": {"type": "string"}},
                },
            },
            id="get-weather-function-cache-control-none",
        ),
    ],
)
def test_valid_anthropic_tool_schemas_can_be_normalized_and_denormalized_without_data_loss(
    tool_schema: dict[str, Any],
) -> None:
    normalized_tools = normalize_tools([tool_schema], ModelProvider.ANTHROPIC)
    denormalized_tools, _ = denormalize_tools(normalized_tools, ModelProvider.ANTHROPIC)
    assert len(denormalized_tools) == 1
    assert denormalized_tools[0] == tool_schema


@pytest.mark.parametrize(
    "params,expectation",
    [
        pytest.param(
            {
                "max_tokens": 1025,
                "thinking": {"type": "enabled", "budget_tokens": 1024},
            },
            nullcontext(),
            id="max-tokens-gt-budget-tokens-gt-1024",
        ),
        pytest.param(
            {"max_tokens": 128, "thinking": {"type": "disabled"}},
            nullcontext(),
            id="disabled",
        ),
        pytest.param(
            {
                "max_tokens": 1025,
                "thinking": {"type": "enabled", "budget_tokens": 1023},
            },
            pytest.raises(ValueError),
            id="budget-tokens-lt-1024",
        ),
        pytest.param(
            {
                "max_tokens": 1024,
                "thinking": {"type": "enabled", "budget_tokens": 1024},
            },
            pytest.raises(ValueError),
            id="budget-tokens-eq-max-tokens",
        ),
        pytest.param(
            {
                "max_tokens": 1024,
                "thinking": {"type": "enabled", "budget_tokens": 1025},
            },
            pytest.raises(ValueError),
            id="budget-tokens-gt-max-tokens",
        ),
    ],
)
def test_validation_of_anthropic_thinking_budget_tokens(
    params: dict[str, Any],
    expectation: AbstractContextManager[Optional[Exception]],
) -> None:
    with expectation:
        PromptAnthropicInvocationParametersContent.model_validate(params)
