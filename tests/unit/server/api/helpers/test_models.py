from typing import Any

import pytest
from pydantic import ValidationError

from phoenix.server.api.helpers.prompts.models import OpenAIToolDefinition


@pytest.mark.parametrize(
    "tool_definition",
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
                    "description": "Get the delivery date for a customer's order. Call this whenever you need to know the delivery date, for example when a customer asks 'Where is my package'",  # noqa: E501
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
                    "description": "Searches for products matching certain criteria in the database",  # noqa: E501
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
                                "description": "keywords that should be present in the item title or description",  # noqa: E501
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
                                "description": "The maximum number of products to return, use 5 by default if nothing is specified by the user",  # noqa: E501
                            },
                        },
                        "required": ["categories", "colors", "keywords", "price_range", "limit"],
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
                                            "description": "Quantity of the product to add to the cart",  # noqa: E501
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
                                "description": "The maximum number of orders to return, use 5 by default and increase the number if the relevant order is not found.",  # noqa: E501
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
                                "description": "Keywords that should be present in the recommendations",  # noqa: E501
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
                                        "description": "Restaurant booking with specific date and time",  # noqa: E501
                                        "properties": {
                                            "date": {
                                                "type": "string",
                                                "description": "The date of the booking, in format YYYY-MM-DD",  # noqa: E501
                                            },
                                            "time": {
                                                "type": "string",
                                                "description": "The time of the booking, in format HH:MM",  # noqa: E501
                                            },
                                        },
                                        "required": ["date", "time"],
                                    },
                                    {
                                        "type": "object",
                                        "description": "Hotel booking with specific check-in and check-out dates",  # noqa: E501
                                        "properties": {
                                            "check_in": {
                                                "type": "string",
                                                "description": "The check-in date of the booking, in format YYYY-MM-DD",  # noqa: E501
                                            },
                                            "check_out": {
                                                "type": "string",
                                                "description": "The check-out date of the booking, in format YYYY-MM-DD",  # noqa: E501
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
                                "description": "The size of the t-shirt that the user would like to order",  # noqa: E501
                            }
                        },
                        "required": ["size"],
                        "additionalProperties": False,
                    },
                },
            },
            id="pick-tshirt-size-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "test_primitives",
                    "description": "Test all primitive types",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "string_field": {"type": "string", "description": "A string field"},
                            "number_field": {"type": "number", "description": "A number field"},
                            "integer_field": {"type": "integer", "description": "An integer field"},
                            "boolean_field": {"type": "boolean", "description": "A boolean field"},
                            "null_field": {"type": "null", "description": "A null field"},
                        },
                        "required": [
                            "string_field",
                            "number_field",
                            "integer_field",
                            "boolean_field",
                            "null_field",
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            id="primitive-types-function",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "update_user_profile",
                    "description": "Updates a user's profile information",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "The ID of the user to update",
                            },
                            "nickname": {
                                "description": "Optional nickname that can be null or a string",
                                "anyOf": [{"type": "string"}, {"type": "null"}],
                            },
                        },
                        "required": ["user_id"],
                        "additionalProperties": False,
                    },
                },
            },
            id="optional-anyof-parameter",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "categorize_colors",
                    "description": "Categorize colors into warm, cool, or neutral tones, with null for uncertain cases",  # noqa: E501
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "colors": {
                                "type": "array",
                                "description": "List of color categories, with null for uncertain colors",  # noqa: E501
                                "items": {
                                    "anyOf": [
                                        {
                                            "type": "string",
                                            "enum": ["warm", "cool", "neutral"],
                                            "description": "Color category",
                                        },
                                        {"type": "null"},
                                    ]
                                },
                            }
                        },
                        "required": ["colors"],
                        "additionalProperties": False,
                    },
                },
            },
            id="array-of-optional-enums",
        ),
    ],
)
def test_openai_tool_definition_passes_valid_tool_schemas(tool_definition: dict[str, Any]) -> None:
    OpenAIToolDefinition.model_validate(tool_definition)


@pytest.mark.parametrize(
    "tool_definition",
    [
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
                                "type": "invalid_type",
                                "enum": ["s", "m", "l"],
                                "description": "The size of the t-shirt that the user would like to order",  # noqa: E501
                            }
                        },
                        "required": ["size"],
                        "additionalProperties": False,
                    },
                },
            },
            id="invalid-data-type",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "set_temperature",
                    "description": "Sets the temperature for the thermostat",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "temp": {
                                "type": "number",
                                "enum": ["70", "72", "74"],  # only string properties can have enums
                                "description": "The temperature to set in Fahrenheit",
                            }
                        },
                        "required": ["temp"],
                        "additionalProperties": False,
                    },
                },
            },
            id="number-property-with-invalid-enum",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"location": {"type": "string"}},
                        "extra": "extra",  # extra properties are not allowed
                    },
                },
            },
            id="extra-properties",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "update_user",
                    "description": "Updates user information",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                        },
                        "required": [
                            "name",
                            "email",  # email is not in properties
                        ],
                        "additionalProperties": False,
                    },
                },
            },
            id="required-field-not-in-properties",
        ),
        pytest.param(
            {
                "type": "function",
                "function": {
                    "name": "set_preferences",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "priority": {
                                "type": "string",
                                "enum": [
                                    0,  # integer enum values not allowed
                                    "low",
                                    "medium",
                                    "high",
                                ],
                                "description": "The priority level to set",
                            }
                        },
                        "required": ["priority"],
                        "additionalProperties": False,
                    },
                },
            },
            id="string-property-with-priority-enum",
        ),
    ],
)
def test_openai_tool_definition_fails_invalid_tool_schemas(tool_definition: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        OpenAIToolDefinition.model_validate(tool_definition)
