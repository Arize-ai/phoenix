"""Helpdesk API wrappers the refund bot calls. Each is traced as a TOOL or RETRIEVER span."""

from __future__ import annotations

from typing import Any


def get_order(order_id: str) -> dict[str, Any]:
    """Returns the order record, including `refundable_amount` computed by billing."""
    raise NotImplementedError("Calls the helpdesk orders API in production.")


def search_policies(query: str) -> list[dict[str, Any]]:
    """Returns the top policy passages for the request."""
    raise NotImplementedError("Calls the policy search index in production.")


def find_similar_tickets(order_id: str, limit: int = 2) -> list[dict[str, Any]]:
    """Returns recent tickets about the same product, with the reporting customer's contact."""
    raise NotImplementedError("Calls the helpdesk tickets API in production.")
