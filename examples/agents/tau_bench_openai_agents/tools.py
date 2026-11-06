# mypy: ignore-errors
"""
Retail tools as OpenAI Agents SDK @function_tool functions.

Each function wraps the corresponding tau-bench Tool class, delegating
to its invoke() method. The shared `data` dict is captured via a module-level
reference that gets set before each task run.

The function signatures and docstrings are derived from tau-bench's
get_info() schemas so the LLM sees the same tool definitions.
"""

from __future__ import annotations

import os
import sys
from typing import Any

from agents import function_tool

# Add vendor path so we can import tau-bench tools
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.envs.retail.tools.calculate import Calculate
from tau_bench.envs.retail.tools.cancel_pending_order import CancelPendingOrder
from tau_bench.envs.retail.tools.exchange_delivered_order_items import (
    ExchangeDeliveredOrderItems,
)
from tau_bench.envs.retail.tools.find_user_id_by_email import FindUserIdByEmail
from tau_bench.envs.retail.tools.find_user_id_by_name_zip import FindUserIdByNameZip
from tau_bench.envs.retail.tools.get_order_details import GetOrderDetails
from tau_bench.envs.retail.tools.get_product_details import GetProductDetails
from tau_bench.envs.retail.tools.get_user_details import GetUserDetails
from tau_bench.envs.retail.tools.list_all_product_types import ListAllProductTypes
from tau_bench.envs.retail.tools.modify_pending_order_address import (
    ModifyPendingOrderAddress,
)
from tau_bench.envs.retail.tools.modify_pending_order_items import (
    ModifyPendingOrderItems,
)
from tau_bench.envs.retail.tools.modify_pending_order_payment import (
    ModifyPendingOrderPayment,
)
from tau_bench.envs.retail.tools.modify_user_address import ModifyUserAddress
from tau_bench.envs.retail.tools.return_delivered_order_items import (
    ReturnDeliveredOrderItems,
)
from tau_bench.envs.retail.tools.think import Think
from tau_bench.envs.retail.tools.transfer_to_human_agents import TransferToHumanAgents

# Module-level mutable data reference. Set this before running a task.
_data: dict[str, Any] = {}


def set_data(data: dict[str, Any]) -> None:
    """Set the shared database reference that all tools read/write."""
    global _data
    _data = data


def get_data() -> dict[str, Any]:
    """Get the current shared database reference."""
    return _data


# --- Tool definitions ---
# Each @function_tool function delegates to the tau-bench Tool.invoke() method.
# The OpenAI Agents SDK uses the function name, docstring, and type hints
# to generate the tool schema presented to the LLM.


@function_tool
def find_user_id_by_email(email: str) -> str:
    """Find user id by email. If the user is not found, the function will return an error message."""
    return FindUserIdByEmail.invoke(data=_data, email=email)


@function_tool
def find_user_id_by_name_zip(first_name: str, last_name: str, zip: str) -> str:
    """Find user id by first name, last name, and zip code. If the user is not found, the function will return an error message. By default, find user id by email, and only call this function if the user is not found by email or cannot remember email."""
    return FindUserIdByNameZip.invoke(
        data=_data, first_name=first_name, last_name=last_name, zip=zip
    )


@function_tool
def get_user_details(user_id: str) -> str:
    """Get the details of a user, including their orders."""
    return GetUserDetails.invoke(data=_data, user_id=user_id)


@function_tool
def modify_user_address(
    user_id: str,
    address1: str,
    address2: str,
    city: str,
    state: str,
    country: str,
    zip: str,
) -> str:
    """Modify the default address of a user. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed."""
    return ModifyUserAddress.invoke(
        data=_data,
        user_id=user_id,
        address1=address1,
        address2=address2,
        city=city,
        state=state,
        country=country,
        zip=zip,
    )


@function_tool
def get_order_details(order_id: str) -> str:
    """Get the status and details of an order."""
    return GetOrderDetails.invoke(data=_data, order_id=order_id)


@function_tool
def cancel_pending_order(order_id: str, reason: str) -> str:
    """Cancel a pending order. If the order is already processed or delivered, it cannot be cancelled. The agent needs to explain the cancellation detail and ask for explicit user confirmation (yes/no) to proceed. If the user confirms, the order status will be changed to 'cancelled' and the payment will be refunded. The refund will be added to the user's gift card balance immediately if the payment was made using a gift card, otherwise the refund would take 5-7 business days to process. The function returns the order details after the cancellation."""
    return CancelPendingOrder.invoke(data=_data, order_id=order_id, reason=reason)


@function_tool
def modify_pending_order_address(
    order_id: str,
    address1: str,
    address2: str,
    city: str,
    state: str,
    country: str,
    zip: str,
) -> str:
    """Modify the shipping address of a pending order. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed."""
    return ModifyPendingOrderAddress.invoke(
        data=_data,
        order_id=order_id,
        address1=address1,
        address2=address2,
        city=city,
        state=state,
        country=country,
        zip=zip,
    )


@function_tool
def modify_pending_order_items(
    order_id: str,
    item_ids: list[str],
    new_item_ids: list[str],
    payment_method_id: str,
) -> str:
    """Modify items in a pending order to new items of the same product type. For a pending order, this function can only be called once. The agent needs to explain the exchange detail and ask for explicit user confirmation (yes/no) to proceed."""
    return ModifyPendingOrderItems.invoke(
        data=_data,
        order_id=order_id,
        item_ids=item_ids,
        new_item_ids=new_item_ids,
        payment_method_id=payment_method_id,
    )


@function_tool
def modify_pending_order_payment(order_id: str, payment_method_id: str) -> str:
    """Modify the payment method of a pending order. The agent needs to explain the modification detail and ask for explicit user confirmation (yes/no) to proceed."""
    return ModifyPendingOrderPayment.invoke(
        data=_data, order_id=order_id, payment_method_id=payment_method_id
    )


@function_tool
def return_delivered_order_items(order_id: str, item_ids: list[str], payment_method_id: str) -> str:
    """Return some items of a delivered order. The order status will be changed to 'return requested'. The agent needs to explain the return detail and ask for explicit user confirmation (yes/no) to proceed. The user will receive follow-up email for how and where to return the item."""
    return ReturnDeliveredOrderItems.invoke(
        data=_data,
        order_id=order_id,
        item_ids=item_ids,
        payment_method_id=payment_method_id,
    )


@function_tool
def exchange_delivered_order_items(
    order_id: str,
    item_ids: list[str],
    new_item_ids: list[str],
    payment_method_id: str,
) -> str:
    """Exchange items in a delivered order to new items of the same product type. For a delivered order, return or exchange can be only done once by the agent. The agent needs to explain the exchange detail and ask for explicit user confirmation (yes/no) to proceed."""
    return ExchangeDeliveredOrderItems.invoke(
        data=_data,
        order_id=order_id,
        item_ids=item_ids,
        new_item_ids=new_item_ids,
        payment_method_id=payment_method_id,
    )


@function_tool
def get_product_details(product_id: str) -> str:
    """Get the inventory details of a product."""
    return GetProductDetails.invoke(data=_data, product_id=product_id)


@function_tool
def list_all_product_types() -> str:
    """List the name and product id of all product types. Each product type has a variety of different items with unique item ids and options. There are only 50 product types in the store."""
    return ListAllProductTypes.invoke(data=_data)


@function_tool
def transfer_to_human_agents(summary: str) -> str:
    """Transfer the user to a human agent, with a summary of the user's issue. Only transfer if the user explicitly asks for a human agent, or if the user's issue cannot be resolved by the agent with the available tools."""
    return TransferToHumanAgents.invoke(data=_data, summary=summary)


@function_tool
def calculate(expression: str) -> str:
    """Calculate the result of a mathematical expression."""
    # Caution: in production, sanitize or sandbox LLM-generated expressions
    # to prevent LLM-controlled code execution.
    return Calculate.invoke(data=_data, expression=expression)


@function_tool
def think(thought: str) -> str:
    """Use the tool to think about something. It will not obtain new information or change the database, but just append the thought to the log. Use it when complex reasoning or some cache memory is needed."""
    return Think.invoke(data=_data, thought=thought)


# All tools list for registering with the agent
ALL_TOOLS = [
    find_user_id_by_email,
    find_user_id_by_name_zip,
    get_user_details,
    modify_user_address,
    get_order_details,
    cancel_pending_order,
    modify_pending_order_address,
    modify_pending_order_items,
    modify_pending_order_payment,
    return_delivered_order_items,
    exchange_delivered_order_items,
    get_product_details,
    list_all_product_types,
    transfer_to_human_agents,
    calculate,
    think,
]

# Tools that terminate the conversation when called
TERMINATE_TOOLS = {"transfer_to_human_agents"}
