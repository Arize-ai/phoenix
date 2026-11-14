"""Order agent: answers customers in chat and acts on their orders through four tools.

Each customer message is one turn. The app traces every turn to Phoenix as one trace whose
root `order-agent` span carries the conversation's `session.id`.
"""

from __future__ import annotations

from typing import Any

SYSTEM_PROMPT = """
You are the order assistant for Juniper Outfitters. Help customers check, cancel, refund,
or reroute their orders. Use the tools to look up and change orders, and keep replies short
and friendly.
"""


def lookup_order(order_id: str) -> dict[str, Any]:
    """Returns the order record, or `{"status": "not_found"}`.

    A found order has `status` `processing`, `shipped`, or `delivered`, plus `items` (each
    with a `name` and `price`), `shipping_cost`, `total`, and `shipping_address`.
    """
    raise NotImplementedError("Calls the orders service in production.")


def cancel_order(order_id: str) -> dict[str, Any]:
    """Cancels an order that hasn't shipped.

    Returns `status` `cancelled` when the order is cancelled, `queued` when the warehouse
    has to confirm before the cancellation takes effect, or `not_found`. Raises on service
    errors, which the trace records as an error span.
    """
    raise NotImplementedError("Calls the orders service in production.")


def refund_order(order_id: str, amount: float) -> dict[str, Any]:
    """Refunds a delivered order.

    `amount` is the item price, or the order `total` to refund the shipping cost too.
    Returns `status` `refunded` with the `amount` and `method` once the money is sent,
    `queued` when the refund needs manual review first, or `rejected` with a `reason` when
    the order hasn't been delivered. Raises on service errors.
    """
    raise NotImplementedError("Calls the payments service in production.")


def change_address(order_id: str, address: str) -> dict[str, Any]:
    """Changes the shipping address of an order that hasn't shipped.

    Returns `status` `updated` with the new `shipping_address`, or `rejected` with a
    `reason`. Raises on service errors.
    """
    raise NotImplementedError("Calls the orders service in production.")
