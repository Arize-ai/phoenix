# ruff: noqa: E501
"""
Input Format Sensitivity Benchmark
===================================

Measures how input formatting affects LLM-as-a-judge alignment with
human labels when evaluating agent tool calls.

Two conditions:
  1. Raw JSON: Tool schemas and invocations presented as raw JSON dumps
  2. Human-Readable: Same data formatted in structured, natural-language
     style

Same judge prompt template, same model, same examples — only the
formatting differs.

Usage:
    source ~/Projects/phoenix/.env
    python scripts/benchmarks/input_format_sensitivity_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Union

import anthropic
import openai
import pandas as pd
from sklearn.metrics import (
    cohen_kappa_score,
    f1_score,
    precision_score,
    recall_score,
)

# ---------------------------------------------------------------------------
# 1. BENCHMARK DATASET — 50 tool-call scenarios with ground-truth labels
# ---------------------------------------------------------------------------
# Each example has:
#   - query: the user's request (conversation context)
#   - tools: list of available tool definitions (structured data)
#   - invocation: the LLM's tool call (what we're judging)
#   - ground_truth: "correct" or "incorrect"
#   - error_type: None or description of the error for incorrect examples

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "book_flight",
        "description": "Book a flight between two cities on a specific date",
        "parameters": {
            "type": "object",
            "properties": {
                "origin": {
                    "type": "string",
                    "description": "Departure city IATA code (e.g., 'SFO')",
                },
                "destination": {
                    "type": "string",
                    "description": "Arrival city IATA code (e.g., 'JFK')",
                },
                "date": {
                    "type": "string",
                    "description": "Travel date in YYYY-MM-DD format",
                },
                "passengers": {
                    "type": "integer",
                    "description": "Number of passengers (1-9)",
                },
                "cabin_class": {
                    "type": "string",
                    "enum": ["economy", "business", "first"],
                    "description": "Cabin class preference",
                },
            },
            "required": ["origin", "destination", "date", "passengers"],
        },
    },
    {
        "name": "get_weather",
        "description": "Get current weather conditions for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name or coordinates",
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature units",
                },
            },
            "required": ["location"],
        },
    },
    {
        "name": "search_hotels",
        "description": ("Search for hotels in a city with check-in/check-out dates"),
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "City to search in",
                },
                "check_in": {
                    "type": "string",
                    "description": "Check-in date (YYYY-MM-DD)",
                },
                "check_out": {
                    "type": "string",
                    "description": "Check-out date (YYYY-MM-DD)",
                },
                "guests": {
                    "type": "integer",
                    "description": "Number of guests",
                },
                "max_price": {
                    "type": "number",
                    "description": "Maximum price per night in USD",
                },
                "star_rating": {
                    "type": "integer",
                    "description": "Minimum star rating (1-5)",
                },
            },
            "required": ["city", "check_in", "check_out", "guests"],
        },
    },
    {
        "name": "send_email",
        "description": "Send an email to one or more recipients",
        "parameters": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of recipient email addresses",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line",
                },
                "body": {
                    "type": "string",
                    "description": "Email body content",
                },
                "cc": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "CC recipients",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "normal", "high"],
                    "description": "Email priority",
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "create_calendar_event",
        "description": ("Create a calendar event with title, time, and optional attendees"),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Event title",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in ISO 8601 format",
                },
                "end_time": {
                    "type": "string",
                    "description": "End time in ISO 8601 format",
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee email addresses",
                },
                "location": {
                    "type": "string",
                    "description": "Event location or meeting link",
                },
                "description": {
                    "type": "string",
                    "description": "Event description",
                },
            },
            "required": ["title", "start_time", "end_time"],
        },
    },
    {
        "name": "transfer_funds",
        "description": "Transfer money between bank accounts",
        "parameters": {
            "type": "object",
            "properties": {
                "from_account": {
                    "type": "string",
                    "description": "Source account number",
                },
                "to_account": {
                    "type": "string",
                    "description": "Destination account number",
                },
                "amount": {
                    "type": "number",
                    "description": "Amount to transfer in USD",
                },
                "memo": {
                    "type": "string",
                    "description": "Transfer memo/note",
                },
            },
            "required": ["from_account", "to_account", "amount"],
        },
    },
    {
        "name": "query_database",
        "description": ("Execute a read-only SQL query against the analytics database"),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "SQL SELECT query",
                },
                "database": {
                    "type": "string",
                    "enum": ["analytics", "users", "transactions"],
                    "description": "Target database",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum rows to return (default 100)",
                },
            },
            "required": ["query", "database"],
        },
    },
    {
        "name": "translate_text",
        "description": "Translate text between languages",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to translate",
                },
                "source_language": {
                    "type": "string",
                    "description": "Source language code (e.g., 'en')",
                },
                "target_language": {
                    "type": "string",
                    "description": "Target language code (e.g., 'es')",
                },
            },
            "required": ["text", "target_language"],
        },
    },
]


@dataclass
class BenchmarkExample:
    id: int
    query: str
    tools: list[dict[str, Any]]
    invocation: dict[str, Any]
    ground_truth: str  # "correct" or "incorrect"
    error_type: str | None = None
    difficulty: str = "medium"  # easy, medium, hard


def _q(text: str) -> str:
    """Helper to keep long query strings within line limits."""
    return text


def build_dataset() -> list[BenchmarkExample]:
    """Build 50 benchmark examples with balanced correct/incorrect."""
    examples: list[BenchmarkExample] = []
    eid = 0

    # ---- CORRECT EXAMPLES (25) ----

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Book me a flight from San Francisco to New York on March 25th for 2 passengers."
            ),
            tools=[TOOL_DEFINITIONS[0], TOOL_DEFINITIONS[1]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "SFO",
                    "destination": "JFK",
                    "date": "2026-03-25",
                    "passengers": 2,
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="What's the weather like in Tokyo right now?",
            tools=[TOOL_DEFINITIONS[1], TOOL_DEFINITIONS[2]],
            invocation={
                "name": "get_weather",
                "arguments": {"location": "Tokyo"},
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="Tell me the temperature in Berlin in Celsius.",
            tools=[TOOL_DEFINITIONS[1]],
            invocation={
                "name": "get_weather",
                "arguments": {
                    "location": "Berlin",
                    "units": "celsius",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Find me hotels in Paris from April 1 to April 5 for 2 guests, under $200/night."
            ),
            tools=[TOOL_DEFINITIONS[2], TOOL_DEFINITIONS[0]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Paris",
                    "check_in": "2026-04-01",
                    "check_out": "2026-04-05",
                    "guests": 2,
                    "max_price": 200,
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Send an email to alice@company.com with subject "
                "'Q1 Report' and body 'Please find the Q1 report "
                "attached.'"
            ),
            tools=[TOOL_DEFINITIONS[3], TOOL_DEFINITIONS[4]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["alice@company.com"],
                    "subject": "Q1 Report",
                    "body": "Please find the Q1 report attached.",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Schedule a meeting called 'Sprint Planning' "
                "tomorrow from 2pm to 3pm with bob@company.com."
            ),
            tools=[TOOL_DEFINITIONS[4], TOOL_DEFINITIONS[3]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Sprint Planning",
                    "start_time": "2026-03-18T14:00:00",
                    "end_time": "2026-03-18T15:00:00",
                    "attendees": ["bob@company.com"],
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("I need a business class flight from LAX to ORD on June 15 for 1 person."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "LAX",
                    "destination": "ORD",
                    "date": "2026-06-15",
                    "passengers": 1,
                    "cabin_class": "business",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Show me the top 10 users by total spend from the analytics database."),
            tools=[TOOL_DEFINITIONS[6]],
            invocation={
                "name": "query_database",
                "arguments": {
                    "query": (
                        "SELECT user_id, SUM(amount) as total_spend "
                        "FROM purchases GROUP BY user_id "
                        "ORDER BY total_spend DESC LIMIT 10"
                    ),
                    "database": "analytics",
                    "limit": 10,
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Translate 'Good morning, how are you?' to Spanish."),
            tools=[TOOL_DEFINITIONS[7]],
            invocation={
                "name": "translate_text",
                "arguments": {
                    "text": "Good morning, how are you?",
                    "source_language": "en",
                    "target_language": "es",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Transfer $500 from account 1234567890 to account "
                "0987654321 with memo 'Rent payment'."
            ),
            tools=[TOOL_DEFINITIONS[5]],
            invocation={
                "name": "transfer_funds",
                "arguments": {
                    "from_account": "1234567890",
                    "to_account": "0987654321",
                    "amount": 500,
                    "memo": "Rent payment",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: I want to fly to London.\n"
                "Assistant: Where are you flying from and when?\n"
                "User: From Boston, next Friday March 20th. Just me."
            ),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "BOS",
                    "destination": "LHR",
                    "date": "2026-03-20",
                    "passengers": 1,
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Find 4-star hotels in Rome from May 10-14 for 3 guests."),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Rome",
                    "check_in": "2026-05-10",
                    "check_out": "2026-05-14",
                    "guests": 3,
                    "star_rating": 4,
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Send a high priority email to team@co.com, "
                "CC manager@co.com. Subject: 'Urgent: Server Down'. "
                "Body: 'The production server is unresponsive "
                "since 3am.'"
            ),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["team@co.com"],
                    "subject": "Urgent: Server Down",
                    "body": ("The production server is unresponsive since 3am."),
                    "cc": ["manager@co.com"],
                    "priority": "high",
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Translate this French text to English: 'Bonjour le monde'"),
            tools=[TOOL_DEFINITIONS[7]],
            invocation={
                "name": "translate_text",
                "arguments": {
                    "text": "Bonjour le monde",
                    "source_language": "fr",
                    "target_language": "en",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Create a calendar event: 'Team Lunch' on March 22 "
                "from 12pm to 1pm at 'Cafe Milano'."
            ),
            tools=[TOOL_DEFINITIONS[4]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Team Lunch",
                    "start_time": "2026-03-22T12:00:00",
                    "end_time": "2026-03-22T13:00:00",
                    "location": "Cafe Milano",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="How many users signed up last month?",
            tools=[TOOL_DEFINITIONS[6]],
            invocation={
                "name": "query_database",
                "arguments": {
                    "query": (
                        "SELECT COUNT(*) FROM users "
                        "WHERE signup_date >= '2026-02-01' "
                        "AND signup_date < '2026-03-01'"
                    ),
                    "database": "users",
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: I'm traveling to Miami this weekend.\n"
                "Assistant: Would you like me to check the weather "
                "or find hotels?\n"
                "User: Check the weather please, in Fahrenheit."
            ),
            tools=[TOOL_DEFINITIONS[1], TOOL_DEFINITIONS[2]],
            invocation={
                "name": "get_weather",
                "arguments": {
                    "location": "Miami",
                    "units": "fahrenheit",
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: My wife and I are planning a trip.\n"
                "Assistant: Great! Where to?\n"
                "User: Seattle to Denver, April 3rd. Economy is fine."
            ),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "SEA",
                    "destination": "DEN",
                    "date": "2026-04-03",
                    "passengers": 2,
                    "cabin_class": "economy",
                },
            },
            ground_truth="correct",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="Move $1,250.50 from 5551234567 to 5559876543.",
            tools=[TOOL_DEFINITIONS[5]],
            invocation={
                "name": "transfer_funds",
                "arguments": {
                    "from_account": "5551234567",
                    "to_account": "5559876543",
                    "amount": 1250.50,
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Email alice@co.com and bob@co.com about the "
                "'Meeting Reschedule' — tell them it's moved "
                "to Thursday."
            ),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["alice@co.com", "bob@co.com"],
                    "subject": "Meeting Reschedule",
                    "body": ("The meeting has been moved to Thursday."),
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="What's 'Thank you very much' in Japanese?",
            tools=[TOOL_DEFINITIONS[7]],
            invocation={
                "name": "translate_text",
                "arguments": {
                    "text": "Thank you very much",
                    "source_language": "en",
                    "target_language": "ja",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: I need to query our transaction data.\n"
                "Assistant: What would you like to know?\n"
                "User: Total revenue by month for 2025. "
                "Limit to 12 rows."
            ),
            tools=[TOOL_DEFINITIONS[6]],
            invocation={
                "name": "query_database",
                "arguments": {
                    "query": (
                        "SELECT DATE_TRUNC('month', transaction_date)"
                        " as month, SUM(amount) as revenue "
                        "FROM transactions "
                        "WHERE transaction_date >= '2025-01-01' "
                        "AND transaction_date < '2026-01-01' "
                        "GROUP BY month ORDER BY month"
                    ),
                    "database": "transactions",
                    "limit": 12,
                },
            },
            ground_truth="correct",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Search for hotels in Barcelona, checking in June 1 "
                "and out June 7, for 2 guests. Budget is $150/night, "
                "at least 3 stars."
            ),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Barcelona",
                    "check_in": "2026-06-01",
                    "check_out": "2026-06-07",
                    "guests": 2,
                    "max_price": 150,
                    "star_rating": 3,
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "Set up a meeting 'Quarterly Review' on April 15 "
                "from 10am to 11:30am with the whole team: "
                "alice@co.com, bob@co.com, carol@co.com. "
                "Location: Conference Room B. Note: Bring laptops."
            ),
            tools=[TOOL_DEFINITIONS[4]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Quarterly Review",
                    "start_time": "2026-04-15T10:00:00",
                    "end_time": "2026-04-15T11:30:00",
                    "attendees": [
                        "alice@co.com",
                        "bob@co.com",
                        "carol@co.com",
                    ],
                    "location": "Conference Room B",
                    "description": "Bring laptops.",
                },
            },
            ground_truth="correct",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Book a first class flight from JFK to NRT on December 20 for 1 passenger."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "JFK",
                    "destination": "NRT",
                    "date": "2026-12-20",
                    "passengers": 1,
                    "cabin_class": "first",
                },
            },
            ground_truth="correct",
            difficulty="easy",
        )
    )

    # ---- INCORRECT EXAMPLES (25) ----

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Book a flight from SFO to LAX on April 10."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "SFO",
                    "destination": "LAX",
                    "date": "2026-04-10",
                    # missing: passengers (required)
                },
            },
            ground_truth="incorrect",
            error_type="missing_required_param",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="What's the weather in London?",
            tools=[TOOL_DEFINITIONS[1]],
            invocation={
                "name": "get_weather",
                "arguments": {
                    "location": "London",
                    "units": "celsius",
                    "forecast_days": 7,  # doesn't exist
                },
            },
            ground_truth="incorrect",
            error_type="hallucinated_param",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Find hotels in Tokyo from March 15 to March 20 for 2 guests."),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Tokyo",
                    "check_in": "2026-03-15",
                    "check_out": "2026-03-20",
                    "guests": "two",  # should be integer
                },
            },
            ground_truth="incorrect",
            error_type="wrong_type",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Book a flight from Chicago to Miami on May 5 for 3 passengers."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "ORD",
                    "destination": "MIA",
                    "date": "2026-05-05",
                    "passengers": 1,  # user said 3
                },
            },
            ground_truth="incorrect",
            error_type="wrong_value",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("I want a premium economy flight from SFO to LHR on July 1 for 2."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "SFO",
                    "destination": "LHR",
                    "date": "2026-07-01",
                    "passengers": 2,
                    "cabin_class": "premium_economy",  # not in enum
                },
            },
            ground_truth="incorrect",
            error_type="invalid_enum",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Send an email to hr@company.com about my tax documents."),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["hr@company.com"],
                    "subject": "Tax Documents",
                    "body": ("Here are my details: SSN 123-45-6789, please process my W-2."),
                },
            },
            ground_truth="incorrect",
            error_type="unsafe_pii",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("I need to fly from Denver to Seattle next Tuesday March 24th, just me."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "SEA",  # swapped
                    "destination": "DEN",  # swapped
                    "date": "2026-03-24",
                    "passengers": 1,
                },
            },
            ground_truth="incorrect",
            error_type="swapped_values",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Search hotels in Amsterdam from 15th April to 20th April for 1 guest."),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Amsterdam",
                    "check_in": "15/04/2026",  # wrong format
                    "check_out": "20/04/2026",  # wrong format
                    "guests": 1,
                },
            },
            ground_truth="incorrect",
            error_type="wrong_format",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Transfer $200 from account A to account B."),
            tools=[TOOL_DEFINITIONS[5]],
            invocation={
                "name": "transfer_funds",
                "arguments": {
                    "from_account": "A",
                    "to_account": "B",
                    "amount": 200,
                    "currency": "USD",  # doesn't exist
                    "transfer_type": "instant",  # doesn't exist
                },
            },
            ground_truth="incorrect",
            error_type="hallucinated_param",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Book a hotel in London for next week for 2 guests."),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "London",
                    "guests": 2,
                    # missing: check_in, check_out (required)
                },
            },
            ground_truth="incorrect",
            error_type="missing_required_param",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: I want to book a flight for my family of 4.\n"
                "Assistant: Where and when?\n"
                "User: Austin to Portland on March 30."
            ),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "AUS",
                    "destination": "PDX",
                    "date": "2026-03-30",
                    "passengers": 2,  # user said family of 4
                },
            },
            ground_truth="incorrect",
            error_type="wrong_value_multi_turn",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="Show me all user records.",
            tools=[TOOL_DEFINITIONS[6]],
            invocation={
                "name": "query_database",
                "arguments": {
                    "query": ("SELECT * FROM users; DROP TABLE users;--"),
                    "database": "users",
                },
            },
            ground_truth="incorrect",
            error_type="unsafe_query",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Email john@company.com about the project update."),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": "john@company.com",  # should be array
                    "subject": "Project Update",
                    "body": "Here is the latest project update.",
                },
            },
            ground_truth="incorrect",
            error_type="wrong_type",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Create a recurring weekly meeting 'Standup' on Mondays at 9am-9:15am."),
            tools=[TOOL_DEFINITIONS[4]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Standup",
                    "start_time": "2026-03-23T09:00:00",
                    "end_time": "2026-03-23T09:15:00",
                    "recurrence": "weekly",  # doesn't exist
                },
            },
            ground_truth="incorrect",
            error_type="hallucinated_param",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Send a quick message to alice@co.com saying 'The deploy is done.'"),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["alice@co.com"],
                    # missing: subject (required)
                    "body": "The deploy is done.",
                },
            },
            ground_truth="incorrect",
            error_type="missing_required_param",
            difficulty="easy",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Find hotels in Madrid from April 10 to April 7 for 1 guest."),
            tools=[TOOL_DEFINITIONS[2]],
            invocation={
                "name": "search_hotels",
                "arguments": {
                    "city": "Madrid",
                    "check_in": "2026-04-10",
                    "check_out": "2026-04-07",  # before check-in
                    "guests": 1,
                },
            },
            ground_truth="incorrect",
            error_type="illogical_values",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Transfer $300 from my savings to checking."),
            tools=[TOOL_DEFINITIONS[5]],
            invocation={
                "name": "transfer_funds",
                "arguments": {
                    "from_account": "SAVINGS001",
                    "to_account": "CHECKING001",
                    "amount": -300,  # negative
                },
            },
            ground_truth="incorrect",
            error_type="wrong_value",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Email billing@vendor.com with my payment info for the invoice."),
            tools=[TOOL_DEFINITIONS[3]],
            invocation={
                "name": "send_email",
                "arguments": {
                    "to": ["billing@vendor.com"],
                    "subject": "Payment Information",
                    "body": ("Please charge card 4532-1234-5678-9012, exp 12/27, CVV 456."),
                },
            },
            ground_truth="incorrect",
            error_type="unsafe_pii",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Query the logs database for error counts."),
            tools=[TOOL_DEFINITIONS[6]],
            invocation={
                "name": "query_database",
                "arguments": {
                    "query": ("SELECT COUNT(*) FROM logs WHERE level = 'ERROR'"),
                    "database": "logs",  # not in enum
                },
            },
            ground_truth="incorrect",
            error_type="invalid_enum",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q(
                "User: I'm going to a conference in San Diego.\n"
                "Assistant: Would you like me to book a flight?\n"
                "User: Yes, from Phoenix on May 1. One ticket."
            ),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "PHX",
                    "destination": "SFO",  # should be SAN
                    "date": "2026-05-01",
                    "passengers": 1,
                },
            },
            ground_truth="incorrect",
            error_type="wrong_value_multi_turn",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Create a meeting 'Design Review' on March 25 from 3pm to 4pm."),
            tools=[TOOL_DEFINITIONS[4]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Design Review",
                    "start_time": "March 25, 2026 3:00 PM",
                    "end_time": "March 25, 2026 4:00 PM",
                },
            },
            ground_truth="incorrect",
            error_type="wrong_format",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="Translate 'Hello world' to German.",
            tools=[TOOL_DEFINITIONS[7]],
            invocation={
                "name": "translate_text",
                "arguments": {
                    "text": "Hello world",
                    "target_language": "de",
                    "formality": "formal",  # doesn't exist
                    "preserve_formatting": True,  # doesn't exist
                },
            },
            ground_truth="incorrect",
            error_type="hallucinated_param",
            difficulty="medium",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("My partner and I want to fly from ATL to DFW on June 1."),
            tools=[TOOL_DEFINITIONS[0]],
            invocation={
                "name": "book_flight",
                "arguments": {
                    "origin": "ATL",
                    "destination": "DFW",
                    "date": "2026-06-01",
                    "passengers": 1,  # should be 2
                },
            },
            ground_truth="incorrect",
            error_type="wrong_value",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query=_q("Schedule 'Retrospective' on April 2 from 4pm to 5pm."),
            tools=[TOOL_DEFINITIONS[4]],
            invocation={
                "name": "create_calendar_event",
                "arguments": {
                    "title": "Retrospective",
                    "start_time": "2026-04-02T17:00:00",  # swapped
                    "end_time": "2026-04-02T16:00:00",  # swapped
                },
            },
            ground_truth="incorrect",
            error_type="swapped_values",
            difficulty="hard",
        )
    )

    examples.append(
        BenchmarkExample(
            id=(eid := eid + 1),
            query="Translate something to Portuguese.",
            tools=[TOOL_DEFINITIONS[7]],
            invocation={
                "name": "translate_text",
                "arguments": {
                    "target_language": "pt",
                    # missing: text (required)
                },
            },
            ground_truth="incorrect",
            error_type="missing_required_param",
            difficulty="easy",
        )
    )

    return examples


# ---------------------------------------------------------------------------
# 2. FORMATTING FUNCTIONS — the core experimental variable
# ---------------------------------------------------------------------------


def format_tools_raw_json(tools: list[dict[str, Any]]) -> str:
    """Condition A: Dump tools as raw JSON — no transformation."""
    return json.dumps(tools)


def format_invocation_raw_json(invocation: dict[str, Any]) -> str:
    """Condition A: Dump invocation as raw JSON."""
    return json.dumps(invocation)


def format_tools_human_readable(
    tools: list[dict[str, Any]],
) -> str:
    """Condition B: Transform tool schemas into readable text."""
    parts = []
    for tool in tools:
        lines = [f"{tool['name']}:"]
        lines.append(f"  Description: {tool['description']}")
        params = tool.get("parameters", {}).get("properties", {})
        required = set(tool.get("parameters", {}).get("required", []))
        if params:
            lines.append("  Parameters:")
            for pname, pdef in params.items():
                req = "required" if pname in required else "optional"
                ptype = pdef.get("type", "any")
                desc = pdef.get("description", "")
                enum = pdef.get("enum")
                line = f"    - {pname} ({req}, {ptype}): {desc}"
                if enum:
                    allowed = ", ".join(str(e) for e in enum)
                    line += f" [allowed: {allowed}]"
                lines.append(line)
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def format_invocation_human_readable(
    invocation: dict[str, Any],
) -> str:
    """Condition B: Readable function-call style."""
    name = invocation["name"]
    args = invocation.get("arguments", {})
    arg_parts = []
    for k, v in args.items():
        if isinstance(v, str):
            arg_parts.append(f'{k}="{v}"')
        elif isinstance(v, list):
            items = ", ".join(f'"{i}"' if isinstance(i, str) else str(i) for i in v)
            arg_parts.append(f"{k}=[{items}]")
        else:
            arg_parts.append(f"{k}={v}")
    return f"{name}({', '.join(arg_parts)})"


# ---------------------------------------------------------------------------
# 3. JUDGE PROMPT — identical across conditions
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = (
    "You are an impartial judge evaluating an LLM's tool-calling "
    "behavior, specifically whether the LLM invoked a tool correctly "
    "with valid arguments and proper formatting.\n\n"
    "Your task: Determine whether the LLM's tool invocation was "
    "correct or incorrect based on:\n"
    "- The full conversation context (including all previous turns, "
    "not just the most recent message)\n"
    "- The available tool schemas\n"
    "- The LLM's tool invocation with arguments\n\n"
    'Criteria — return "correct" only when ALL are true:\n'
    "- All required fields/parameters are present.\n"
    "- No hallucinated or nonexistent fields "
    "(all fields exist in the tool schema).\n"
    "- Argument values match the user's intent from the conversation "
    "context (correct types, realistic values).\n"
    "- Date/time formats match what the schema specifies.\n"
    "- No unsafe content (e.g., PII like SSNs, credit card numbers, "
    "passwords) in arguments.\n"
    "- Values are logically consistent (e.g., check-out after "
    "check-in, end time after start time).\n\n"
    'Return "incorrect" if ANY of the following are true:\n'
    "- Required fields/parameters are missing.\n"
    "- The invocation contains hallucinated fields not in schema.\n"
    "- Argument values are incorrect, hallucinated, or do not match "
    "user intent.\n"
    "- Arguments contain unsafe content (e.g., PII, sensitive data).\n"
    "- Date/time formats don't match schema specifications.\n"
    "- Values are logically inconsistent.\n\n"
    'Respond with ONLY "correct" or "incorrect" — no explanation.'
)

JUDGE_USER_TEMPLATE = """<input>
{query}
</input>

<available_tools>
{tools}
</available_tools>

<tool_invocation>
{invocation}
</tool_invocation>

Is this tool invocation correct or incorrect?"""


# ---------------------------------------------------------------------------
# 4. ASYNC JUDGE EXECUTION
# ---------------------------------------------------------------------------


@dataclass
class JudgeResult:
    example_id: int
    condition: str  # "raw_json" or "human_readable"
    prediction: str  # "correct" or "incorrect"
    ground_truth: str
    latency_ms: float
    raw_response: str


async def judge_example_openai(
    client: openai.AsyncOpenAI,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge on a single example using OpenAI API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        invocation_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        invocation_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=invocation_str,
    )

    async with semaphore:
        t0 = time.monotonic()
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.0,
                max_tokens=10,
            )
            content = resp.choices[0].message.content
            raw = content.strip().lower() if content else "ERROR"
        except Exception as e:
            raw = f"ERROR: {e}"
        latency = (time.monotonic() - t0) * 1000

    if "incorrect" in raw:
        prediction = "incorrect"
    elif "correct" in raw:
        prediction = "correct"
    else:
        prediction = "unknown"

    return JudgeResult(
        example_id=example.id,
        condition=condition,
        prediction=prediction,
        ground_truth=example.ground_truth,
        latency_ms=latency,
        raw_response=raw,
    )


async def judge_example_anthropic(
    client: anthropic.AsyncAnthropic,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge on a single example using Anthropic API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        invocation_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        invocation_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=invocation_str,
    )

    async with semaphore:
        t0 = time.monotonic()
        try:
            resp = await client.messages.create(
                model=model,
                system=JUDGE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
                temperature=0.0,
                max_tokens=10,
            )
            block = resp.content[0]
            raw = getattr(block, "text", "ERROR").strip().lower()
        except Exception as e:
            raw = f"ERROR: {e}"
        latency = (time.monotonic() - t0) * 1000

    if "incorrect" in raw:
        prediction = "incorrect"
    elif "correct" in raw:
        prediction = "correct"
    else:
        prediction = "unknown"

    return JudgeResult(
        example_id=example.id,
        condition=condition,
        prediction=prediction,
        ground_truth=example.ground_truth,
        latency_ms=latency,
        raw_response=raw,
    )


# ---------------------------------------------------------------------------
# 5. METRICS COMPUTATION
# ---------------------------------------------------------------------------


def compute_metrics(
    results: list[JudgeResult],
) -> dict[str, Any]:
    """Compute precision, recall, F1, accuracy, and Cohen's kappa."""
    valid = [r for r in results if r.prediction != "unknown"]
    if not valid:
        return {"error": "No valid predictions"}

    y_true = [1 if r.ground_truth == "correct" else 0 for r in valid]
    y_pred = [1 if r.prediction == "correct" else 0 for r in valid]

    n_correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)

    return {
        "n": len(valid),
        "n_unknown": len(results) - len(valid),
        "accuracy": n_correct / len(valid),
        "precision_correct": precision_score(y_true, y_pred, zero_division=0),
        "recall_correct": recall_score(y_true, y_pred, zero_division=0),
        "f1_correct": f1_score(y_true, y_pred, zero_division=0),
        "precision_incorrect": precision_score(y_true, y_pred, pos_label=0, zero_division=0),
        "recall_incorrect": recall_score(y_true, y_pred, pos_label=0, zero_division=0),
        "f1_incorrect": f1_score(y_true, y_pred, pos_label=0, zero_division=0),
        "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "cohens_kappa": cohen_kappa_score(y_true, y_pred),
        "mean_latency_ms": (sum(r.latency_ms for r in valid) / len(valid)),
    }


# ---------------------------------------------------------------------------
# 6. MAIN — Run the full experiment
# ---------------------------------------------------------------------------

JudgeClient = Union[openai.AsyncOpenAI, anthropic.AsyncAnthropic]


async def run_experiment_for_model(
    model_name: str,
    examples: list[BenchmarkExample],
    provider: str = "openai",
) -> dict[str, Any]:
    """Run both formatting conditions for a single judge model."""
    concurrency = 10
    semaphore = asyncio.Semaphore(concurrency)

    if provider == "openai":
        oai_client = openai.AsyncOpenAI()

        async def run_judge(
            ex: BenchmarkExample,
            cond: str,
        ) -> JudgeResult:
            return await judge_example_openai(
                oai_client,
                model_name,
                ex,
                cond,
                semaphore,
            )
    else:
        ant_client = anthropic.AsyncAnthropic()

        async def run_judge(
            ex: BenchmarkExample,
            cond: str,
        ) -> JudgeResult:
            return await judge_example_anthropic(
                ant_client,
                model_name,
                ex,
                cond,
                semaphore,
            )

    print(f"\n{'=' * 60}")
    print(f"  Model: {model_name} ({provider})")
    print(f"  Examples: {len(examples)} | Concurrency: {concurrency}")
    print(f"{'=' * 60}")

    # Run both conditions
    all_results: dict[str, list[JudgeResult]] = {}
    for condition in ["raw_json", "human_readable"]:
        print(f"\n  Running condition: {condition}...")
        tasks = [run_judge(ex, condition) for ex in examples]
        results = await asyncio.gather(*tasks)
        all_results[condition] = list(results)

        correct_preds = sum(1 for r in results if r.prediction == r.ground_truth)
        print(f"  -> {correct_preds}/{len(results)} correct")

    metrics: dict[str, Any] = {}
    for condition, results in all_results.items():
        metrics[condition] = compute_metrics(results)

    return {
        "model": model_name,
        "provider": provider,
        "results": {k: [vars(r) for r in v] for k, v in all_results.items()},
        "metrics": metrics,
    }


def print_comparison_table(
    experiment_results: list[dict[str, Any]],
) -> None:
    """Print a formatted comparison table."""
    print("\n" + "=" * 80)
    print("  INPUT FORMAT SENSITIVITY BENCHMARK — RESULTS")
    print("=" * 80)

    rows = []
    for exp in experiment_results:
        model = exp["model"]
        for condition in ["raw_json", "human_readable"]:
            m = exp["metrics"][condition]
            rows.append(
                {
                    "Model": model,
                    "Format": condition,
                    "Accuracy": f"{m['accuracy']:.1%}",
                    "Macro F1": f"{m['macro_f1']:.3f}",
                    "P(correct)": f"{m['precision_correct']:.3f}",
                    "R(correct)": f"{m['recall_correct']:.3f}",
                    "P(incorrect)": (f"{m['precision_incorrect']:.3f}"),
                    "R(incorrect)": (f"{m['recall_incorrect']:.3f}"),
                    "kappa": f"{m['cohens_kappa']:.3f}",
                    "Latency(ms)": (f"{m['mean_latency_ms']:.0f}"),
                }
            )

    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    print("\n" + "-" * 80)
    print("  FORMAT EFFECT (Human-Readable minus Raw JSON)")
    print("-" * 80)
    for exp in experiment_results:
        raw = exp["metrics"]["raw_json"]
        hr = exp["metrics"]["human_readable"]
        delta_acc = hr["accuracy"] - raw["accuracy"]
        delta_f1 = hr["macro_f1"] - raw["macro_f1"]
        delta_kappa = hr["cohens_kappa"] - raw["cohens_kappa"]
        print(f"  {exp['model']}:")
        print(f"    Accuracy:      {delta_acc:+.1%}")
        print(f"    Macro F1:      {delta_f1:+.3f}")
        print(f"    Cohen's kappa: {delta_kappa:+.3f}")


def save_results(
    experiment_results: list[dict[str, Any]],
    output_dir: str,
) -> None:
    """Save detailed results to files."""
    os.makedirs(output_dir, exist_ok=True)

    with open(os.path.join(output_dir, "results.json"), "w") as f:
        json.dump(experiment_results, f, indent=2, default=str)

    all_rows = []
    for exp in experiment_results:
        for condition, results in exp["results"].items():
            for r in results:
                all_rows.append(
                    {
                        "model": exp["model"],
                        "condition": condition,
                        "example_id": r["example_id"],
                        "prediction": r["prediction"],
                        "ground_truth": r["ground_truth"],
                        "correct": (r["prediction"] == r["ground_truth"]),
                        "latency_ms": r["latency_ms"],
                    }
                )
    df = pd.DataFrame(all_rows)
    df.to_csv(
        os.path.join(output_dir, "per_example_results.csv"),
        index=False,
    )

    summary_rows = []
    for exp in experiment_results:
        for condition, m in exp["metrics"].items():
            summary_rows.append(
                {
                    "model": exp["model"],
                    "condition": condition,
                    **m,
                }
            )
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(
        os.path.join(output_dir, "summary_metrics.csv"),
        index=False,
    )

    print(f"\n  Results saved to {output_dir}/")


async def main() -> None:
    """Run the full input format sensitivity experiment."""
    examples = build_dataset()
    print(f"Built dataset: {len(examples)} examples")
    n_correct = sum(1 for e in examples if e.ground_truth == "correct")
    n_incorrect = sum(1 for e in examples if e.ground_truth == "incorrect")
    print(f"  Correct: {n_correct}")
    print(f"  Incorrect: {n_incorrect}")

    models = [
        ("gpt-4o", "openai"),
        ("gpt-4o-mini", "openai"),
        ("claude-sonnet-4-20250514", "anthropic"),
    ]

    experiment_results = []
    for model_name, provider in models:
        try:
            result = await run_experiment_for_model(
                model_name,
                examples,
                provider,
            )
            experiment_results.append(result)
        except Exception as e:
            print(f"\n  ERROR with {model_name}: {e}")

    print_comparison_table(experiment_results)

    output_dir = os.path.join(
        os.path.dirname(__file__),
        "input_format_sensitivity_results",
    )
    save_results(experiment_results, output_dir)

    # Print format examples for the writeup
    print("\n" + "=" * 80)
    print("  FORMAT EXAMPLES (for documentation)")
    print("=" * 80)
    ex = examples[0]
    print("\n--- RAW JSON ---")
    raw_tools = format_tools_raw_json(ex.tools)
    print(f"Tools: {raw_tools[:300]}...")
    raw_inv = format_invocation_raw_json(ex.invocation)
    print(f"Invocation: {raw_inv}")
    print("\n--- HUMAN READABLE ---")
    hr_tools = format_tools_human_readable(ex.tools)
    print(f"Tools:\n{hr_tools}")
    hr_inv = format_invocation_human_readable(ex.invocation)
    print(f"Invocation: {hr_inv}")


if __name__ == "__main__":
    asyncio.run(main())
