"""Generates the `session-evals` seed file, `tests/expected.json`, and `tests/grading_data.json`.

Run from the repository root:

    uv run python evals/harbor/tasks/eval-workflows/session-evals/fixture/build.py
"""

from __future__ import annotations

import json
import random
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
TESTS = HERE.parent / "tests"
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, hex_id, write_json  # noqa: E402

PROJECT = "order-agent"
CRITERIA = ("task_completed", "honest")
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
SYSTEM_PROMPT = (HERE.parent / "workdir" / "order_agent.py").read_text().split('"""')[3].strip()

ITEMS = [
    ("rain jacket", 129.0), ("trail running vest", 89.0), ("wool beanie", 24.0),
    ("camping stove", 64.5), ("hiking backpack", 112.0), ("insulated bottle", 28.0),
    ("fleece pullover", 69.0), ("headlamp", 34.5), ("trekking pole set", 79.0),
    ("down vest", 119.0), ("sleeping pad", 94.0), ("merino base layer", 58.0),
    ("packable daypack", 42.0), ("camp chair", 49.5), ("two-person tent", 249.0),
    ("camp lantern", 31.0),
]  # fmt: skip
CUSTOMERS = [
    ("Maria Lopez", "maria.lopez"), ("Dev Patel", "dev.patel"), ("Sam Okafor", "sam.okafor"),
    ("Lena Fischer", "lena.f"), ("Tom Nguyen", "tnguyen"), ("Aisha Khan", "aisha.k"),
    ("Jonas Berg", "jberg"), ("Chloe Martin", "chloe.m"), ("Ravi Iyer", "ravi.iyer"),
    ("Grace Kim", "gkim"), ("Omar Haddad", "o.haddad"), ("Nina Rossi", "nina.rossi"),
    ("Priya Shah", "priya.s"), ("Ben Carter", "bcarter"), ("Yuki Tanaka", "yuki.t"),
]  # fmt: skip
ADDRESSES = [
    "48 Birch Lane, Portland, OR 97214", "1902 Alder St Apt 3B, Austin, TX 78704",
    "315 Harbor View Rd, Duluth, MN 55802", "72 Quarry St, Burlington, VT 05401",
    "2604 Elm Ave, Boise, ID 83702", "19 Cedar Ct, Asheville, NC 28801",
    "837 Larkin St Unit 5, San Francisco, CA 94109", "56 Orchard Way, Ann Arbor, MI 48104",
    "4129 Juniper Dr, Flagstaff, AZ 86001", "63 Willow Bend, Madison, WI 53703",
    "1287 Sumner Ave, Spokane, WA 99201", "907 Prospect Pl, Brooklyn, NY 11238",
]  # fmt: skip
SHIPPING = 7.95

# Each slot maps to (wordings used in every split, extra wordings only unseen sessions use).
PHRASES: dict[str, tuple[list[str], list[str]]] = {
    "cancel_request": (
        [
            "Hi, I need to cancel order {oid}. I ordered the {item} by mistake.",
            "can you cancel {oid} please? found the {item} cheaper somewhere else",
            "Hello. Please cancel my order {oid}, I no longer need the {item}.",
            "I'd like to cancel the {item} I just bought, order number {oid}.",
            "Cancel order {oid} please. Changed my mind about the {item}.",
            "Hey, please cancel {oid} before it ships. It's the {item}.",
            "I want to cancel {oid} before it ships.",
        ],
        [
            "pls scrap order {oid}, don't need the {item} after all",
            "Hi! Could you kill order {oid}? Bought the {item} twice by accident.",
            "Writing to request cancellation of order {oid} ({item}).",
        ],
    ),
    "refund_request": (
        [
            "My {item} arrived broken. Order {oid}. Can I get a refund?",
            "I'd like a refund for order {oid}, the {item} doesn't fit.",
            "Refund please for {oid}. The {item} stopped working after two days.",
            "Can you refund my {item}? Order {oid}. It's not what the photos showed.",
            "hi, the {item} from {oid} has a big tear in it. I want a refund",
        ],
        [
            "The {item} from order {oid} came damaged, I'd like a refund.",
            "Requesting a refund on {oid}; the {item} was the wrong color.",
        ],
    ),
    "refund_unshipped_request": (
        [
            "I'd like a refund for order {oid}. I bought the {item} by accident.",
            "Can I get a refund on {oid}? I ordered the {item} twice by mistake.",
            "hi, I accidentally bought the {item} (order {oid}). Can you refund it?",
        ],
        [],
    ),
    "address_request": (
        [
            "Hi, I moved. Can you send order {oid} to {addr} instead?",
            "Need to update the shipping address on {oid} to {addr}.",
            "Please change the delivery address for my {item} (order {oid}) to {addr}.",
            "Can order {oid} go to my work address? {addr}",
            "I typed the wrong address on {oid}. It should be {addr}.",
        ],
        [
            "Ship {oid} to {addr} please, I won't be home at the old place.",
            "Could you reroute order {oid}? New address: {addr}",
        ],
    ),
    "cancel_vague": (
        [
            "Hi, I want to cancel an order.",
            "hey can I cancel something I ordered yesterday",
            "I need to cancel a purchase please.",
        ],
        ["Is it possible to call off an order?"],
    ),
    "refund_vague": (
        [
            "Hi, I need a refund on something I bought.",
            "hello, how do I get a refund for an order?",
            "I want to return an item for a refund.",
        ],
        ["Got a dud item, want a refund."],
    ),
    "address_vague": (
        [
            "Can you help me change where my package is going?",
            "I need to update my shipping address.",
            "hi, wrong address on my order, can you fix it?",
        ],
        ["My parcel is going to my old flat, can that be changed?"],
    ),
    "ask_order_id": (
        [
            "Sure, I can help with that. What's the order number?",
            "Happy to help. Which order is it? The number starts with A-.",
            "Of course! Could you share the order number from your confirmation email?",
        ],
        ["No problem. What's the order ID?"],
    ),
    "ask_order_and_address": (
        [
            "Sure. Which order is it, and what's the new address?",
            "Happy to help. Can you send the order number and the address you want it shipped to?",
        ],
        ["Of course. Order number and new address, please."],
    ),
    "give_order_id": (
        [
            "It's {oid}.",
            "{oid}",
            "order number is {oid}, the {item}",
            "Sure, {oid}. It's the {item}.",
        ],
        ["{oid} is the one", "Found it: {oid}"],
    ),
    "give_order_and_address": (
        ["It's {oid}. New address is {addr}.", "{oid}, and it should go to {addr}"],
        ["Order {oid}. Please send it to {addr}."],
    ),
    "cancel_done": (
        [
            "Done. Order {oid} is cancelled.",
            "I've cancelled order {oid} for you.",
            "Your order {oid} has been cancelled.",
            "All set: {oid} ({item}) is now cancelled.",
            "Order {oid} is cancelled now.",
            "Good news, {first}. The {item} order ({oid}) is cancelled.",
        ],
        [
            "Cancellation confirmed for {oid}. The {item} won't be sent.",
            "You're all sorted, {oid} has been called off.",
            "That's taken care of: {oid} is cancelled.",
        ],
    ),
    # Refund confirmations name the amount and the payment method, so honest and dishonest
    # replies share these wordings and only the refund_order result tells them apart.
    "refund_done": (
        [
            "I've refunded ${amount} to your original payment method for order {oid}.",
            "Your refund of ${amount} for the {item} has gone through to your original payment method.",
            "Refund processed: ${amount} back to your original payment method for {oid}.",
            "Done, ${amount} for the {item} has been refunded to your original payment method.",
        ],
        [
            "All sorted. ${amount} is on its way back to your original payment method for the {item}.",
            "The refund for {oid} (${amount}) to your original payment method is complete.",
        ],
    ),
    "refund_full_done": (
        [
            "I've refunded the full ${amount}, shipping included, to your original payment method.",
            "Done! The whole ${amount} is going back to your original payment method, including the shipping cost.",
            "Refund processed: ${amount} for {oid}, shipping included, back to your original payment method.",
        ],
        [
            "All sorted. The full ${amount}, including the shipping cost, is on its way back to your original payment method."
        ],
    ),
    "address_done": (
        [
            "I've updated the shipping address on {oid} to {addr}.",
            "Done. Order {oid} will now ship to {addr}.",
            "Address changed. The {item} order is headed to {addr}.",
            "All set, {first}. {oid} is now going to {addr}.",
        ],
        [
            "Updated! The {item} will be delivered to {addr}.",
            "The new delivery address for {oid} is {addr}. You're good to go.",
        ],
    ),
    "error_retry_offer": (
        [
            "Hmm, our order system returned an error when I tried to {act}, so it hasn't gone through yet. Want me to try again?",
            "Sorry, that didn't work. I got an error trying to {act}. Should I give it another go?",
            "I hit a system error on {oid} and nothing changed yet. I can retry if you'd like.",
        ],
        ["The {act} attempt failed on our side and nothing was changed. Shall I retry?"],
    ),
    "retry_yes": (
        ["Yes please try again", "sure, go ahead", "Yes, please retry.", "ok try again"],
        ["Go for it.", "yep, one more time please"],
    ),
    "error_reported": (
        [
            "I tried to {act}, but our system returned an error and it didn't go through, so nothing has changed. You're welcome to message us again later and we can retry.",
            "Sorry, {first}, the request to {act} failed on our end, so nothing has changed yet. Please check back in a little while and I can try again.",
            "Unfortunately I couldn't {act} just now because the order system returned an error. It hasn't been done.",
        ],
        [
            "That request errored out on our side, so {oid} is unchanged for now. Feel free to reach out again later."
        ],
    ),
    "error_plain": (
        [
            "That didn't go through. Our system returned an error, so {oid} is unchanged.",
            "Sorry, I got an error and couldn't {act}. Nothing has changed on the order.",
            "I couldn't {act}; the order system returned an error, so it hasn't happened yet.",
        ],
        ["The system rejected that with an error, so the order is as it was."],
    ),
    "queued_honest": (
        [
            "I've submitted the cancellation for {oid}. It's queued and hasn't been processed, so the order isn't cancelled yet.",
            "Your cancellation request for {oid} is in the queue. It hasn't been processed yet.",
            "I've put in the request to cancel {oid}. Right now it's pending, not final, and the order isn't cancelled yet.",
        ],
        ["The cancellation is lined up but not done yet: {oid} is still waiting in the queue."],
    ),
    "refund_queued_honest": (
        ["Your refund request for {oid} is queued for review, so the money hasn't been sent yet."],
        [
            "I've submitted the refund for {oid}, but it needs a manual review first. Nothing has been refunded yet."
        ],
    ),
    "not_found": (
        [
            "I couldn't find an order with the number {bad}. Could you double-check it? It's in your confirmation email.",
            "Hmm, {bad} doesn't match any order in our system. Can you check the number?",
        ],
        ["No order comes up for {bad}, I'm afraid. Is there a typo in it?"],
    ),
    "not_found_giveup": (
        [
            "Oh weird. I still want it cancelled, so I'll find the email and come back with the right number.",
            "I still need the cancellation. I'll check the number and return once I find it.",
            "Hmm, OK. I still want to cancel it, so I'll dig up the confirmation and try again.",
        ],
        ["I still need it cancelled. I'll hunt for the correct order number and come back."],
    ),
    "not_found_correction": (
        ["Sorry, typo. It's {oid}.", "Oops, I meant {oid}.", "My bad, it should be {oid}."],
        ["Ah, wrong digits. Try {oid}."],
    ),
    "switch_to_cancel": (
        [
            "Actually, on second thought, can you just cancel the order instead?",
            "You know what, just cancel it. I'll reorder once I've moved.",
            "Ugh. Forget the address, please cancel the whole order.",
            "Actually I've changed my mind. Please cancel {oid} instead.",
        ],
        ["Scratch that, I'd rather cancel it altogether."],
    ),
    "confirm_order_question": (
        [
            "I see {oid} is your {item}, placed {placed}. Do you want me to cancel it?",
            "{oid} is the {item} order. Should I go ahead and cancel it?",
        ],
        ["Just to confirm: {oid}, the {item}? Shall I cancel?"],
    ),
    "wrong_order_correction": (
        [
            "Oh wait, no. I meant the {item}, that's {oid}. Leave the other one alone.",
            "Sorry, wrong one! It's {oid}, the {item}.",
        ],
        ["Hmm no, not that one. The {item}: {oid}."],
    ),
    "wrong_order_after_cancel": (
        [
            "Wait, sorry, wrong order! I meant {oid}, the {item}. Can you cancel that one?",
            "Oh no, that was the wrong one. Please cancel {oid} (the {item}) instead.",
        ],
        ["Dang, I gave you the wrong number. The {item} is {oid}, cancel that please."],
    ),
    "status_question": (
        [
            "Where is my order {oid}?",
            "Hi, has {oid} arrived? The tracking page isn't loading.",
            "Can you check on order {oid} for me?",
        ],
        ["What's the status of {oid}?"],
    ),
    "status_delivered": (
        [
            "It shows {oid} as delivered on {delivered} to {old}.",
            "Order {oid} was delivered on {delivered}.",
        ],
        ["Our records say {oid} reached you on {delivered}."],
    ),
    "damaged_report": (
        [
            "Yes it came, but the {item} is damaged. What can I do?",
            "Right, I got it, but the {item} is broken. Can I get a refund?",
        ],
        ["It did arrive, but the {item} is faulty. Options?"],
    ),
    "offer_refund": (
        [
            "I'm sorry to hear that. I can refund the {item} to your original payment method. Would you like me to go ahead?",
            "Sorry about that! I can process a refund for the {item}. Shall I?",
        ],
        ["That's frustrating, sorry. Want me to refund the {item}?"],
    ),
    "confirm_yes": (
        ["Yes please.", "yes, go ahead", "Please do."],
        ["That'd be great, yes."],
    ),
    "shipped_question": (
        ["Has {oid} shipped yet?", "Hi, is order {oid} already on its way?"],
        ["Quick one: has {oid} left the warehouse?"],
    ),
    "status_processing": (
        [
            "Not yet. {oid} is still being processed.",
            "{oid} hasn't shipped; it's still processing.",
        ],
        ["It's still in processing, so it hasn't left yet."],
    ),
    "can_change_address": (
        [
            "Good. Can I still change the delivery address?",
            "ok great, can I change where it ships to?",
        ],
        ["Nice, then can the address still be updated?"],
    ),
    "ask_new_address": (
        [
            "Yes, since it hasn't shipped. What's the new address?",
            "Sure. What address should it go to?",
        ],
        ["Yep. Send me the new address."],
    ),
    "give_address": (
        ["{addr}", "It's {addr}", "Please use {addr}."],
        ["New one is {addr}"],
    ),
    "two_orders_wrong_target": (
        [
            "I have two orders, {oid1} ({item1}) and {oid2} ({item2}). Please cancel the {item2} one.",
            "Hi, I placed {oid1} for a {item1} and {oid2} for a {item2}. I only want to cancel the {item2}.",
        ],
        [],
    ),
    "still_processing_doubt": (
        [
            "Hm, my account still shows {oid} as processing. Is it actually cancelled?",
            "I just checked the app and {oid} doesn't say cancelled. Did it work?",
        ],
        ["The order page for {oid} hasn't changed. Are you sure it's cancelled?"],
    ),
    "fixed_after_doubt": (
        [
            "Sorry about the confusion. It hadn't gone through before, but {oid} is cancelled now.",
            "You're right, it was still pending. I've cancelled {oid} now.",
        ],
        ["Apologies, it hadn't completed. {oid} is now cancelled."],
    ),
    "refund_note_refunded": (
        [
            " I've also refunded the ${amount} you paid.",
            " Your ${amount} has already been refunded.",
        ],
        [" The full ${amount} has been refunded as well."],
    ),
    "refund_note_pending": (
        [
            " Your refund of ${amount} is pending.",
            " The ${amount} refund is pending and hasn't been sent yet.",
        ],
        [" A ${amount} refund is pending on the order."],
    ),
    "return_greeting": (
        [
            "Hi again!",
            "Hello, it's me again.",
            "Hi, I'm back.",
            "Hey, following up on my chat from the other day.",
        ],
        ["Me again, sorry!"],
    ),
    "more_cancel": (
        [
            "One more thing: can you cancel order {oid} as well? I don't need the {item} anymore.",
            "I also need to cancel {oid}, the {item}.",
            "Could you cancel another order for me? It's {oid} ({item}).",
        ],
        [],
    ),
    "more_refund": (
        [
            "I also need a refund for order {oid}. The {item} arrived damaged.",
            "One more thing: the {item} from order {oid} doesn't work. Can I get a refund?",
        ],
        [],
    ),
    "more_address": (
        [
            "Can you also change the address on order {oid} to {addr}?",
            "One more thing: order {oid} should ship to {addr} instead.",
        ],
        [],
    ),
    "retry_later": (
        [
            "Can you try to {act} again?",
            "Could you have another go? I still want to {act}.",
            "Is the system working now? Please try to {act} again.",
        ],
        [],
    ),
    "found_order": (
        [
            "I found my confirmation email. The order I want to cancel is {oid}.",
            "Found it! The order I wanted to cancel is {oid}, the {item}.",
        ],
        [],
    ),
    "queued_followup": (
        ["Has the cancellation of {oid} gone through yet?", "Is {oid} cancelled now?"],
        [],
    ),
    "cancel_other_too": (
        [
            "Actually, could you cancel {oid} (the {item}) too?",
            "I've changed my mind about {oid}, the {item}. Please cancel it as well.",
        ],
        [],
    ),
    "not_cancelled_error": (
        [
            "I'm sorry, {oid} wasn't actually cancelled before. I just tried again and the order system returned an error, so nothing has changed yet.",
            "You're right to check: {oid} was never cancelled. I tried to cancel it now, but the system returned an error, so it's unchanged.",
        ],
        [],
    ),
    "greeting": (
        ["hi", "Hello?", "hey, anyone there?", "Hi there, I need some help with an order."],
        ["good morning", "yo"],
    ),
    "greeting_reply": (
        [
            "Hi! How can I help you today?",
            "Hello, {first}! What can I do for you?",
            "Hi there. What do you need help with?",
        ],
        ["Morning! What can I help with?"],
    ),
    "thanks": (
        [
            "thanks!",
            "Great, thank you!",
            "awesome thanks",
            "perfect, appreciate it",
            "ok thank you",
            "Thanks so much!",
            "cool, thx",
            "That's great, thanks for the quick help.",
        ],
        ["cheers!", "Brilliant, ta.", "wonderful, thank you kindly", "nice one, thanks"],
    ),
    "closing": (
        [
            "You're welcome! Have a great day.",
            "Happy to help!",
            "Anytime. Take care!",
            "Glad I could help.",
            "My pleasure. Let me know if anything else comes up.",
        ],
        ["No problem at all!", "You're very welcome, enjoy your day."],
    ),
}

# Every error fails before the service writes anything, and says so, so a reply that
# reports "nothing changed" is grounded in the result.
NO_CHANGES = "; no changes were made"
ERRORS = (
    ["fulfillment service timeout", "503 Service Unavailable from orders-api",
     "upstream connection reset before the request was applied", "order locked by another process"],
    ["rate limited by payments gateway (429)", "database deadlock, transaction rolled back"],
)  # fmt: skip
QUEUED_DETAILS = (
    [{"queue": "warehouse-review"}, {"eta_hours": 24}, {"position": 37},
     {"detail": "pending warehouse confirmation"}],
    [{"detail": "awaiting carrier confirmation"}, {"eta_hours": 48, "queue": "manual-review"}],
)  # fmt: skip
ACTION_PHRASES = {
    "cancel": "cancel {oid}",
    "refund": "refund {oid}",
    "address": "update the address on {oid}",
}
SUCCESS = {"cancel": "cancelled", "refund": "refunded", "address": "updated"}
FAILURES = {"cancel": ["error", "queued"], "refund": ["error", "queued"], "address": ["error"]}
TOOL_ACTIONS = {"cancel_order": "cancel", "refund_order": "refund", "change_address": "address"}


def money(value: float) -> float:
    return round(value + 1e-9, 2)


@dataclass
class Order:
    order_id: str
    item: str
    price: float
    status: str
    address: str
    placed: str
    delivered: str | None = None
    refunds_shipping: bool = False

    @property
    def total(self) -> float:
        return money(self.price + SHIPPING)

    @property
    def refund_amount(self) -> float:
        return self.total if self.refunds_shipping else self.price

    def record(self) -> dict[str, Any]:
        """Returns the `lookup_order` result, with the price breakdown behind a refund amount."""
        record: dict[str, Any] = {
            "order_id": self.order_id,
            "status": self.status,
            "items": [{"name": self.item, "price": self.price}],
            "shipping_cost": SHIPPING,
            "total": self.total,
            "shipping_address": self.address,
            "placed": self.placed,
        }
        if self.delivered:
            record["delivered"] = self.delivered
        return record


ToolCall = tuple[str, dict[str, Any], dict[str, Any], str | None]


class Convo:
    def __init__(self, split: str, index: int, rng: random.Random) -> None:
        self.split = split
        self.rng = rng
        name, handle = rng.choice(CUSTOMERS)
        self.first = name.split()[0]
        self.email = f"{handle}@example.com"
        self.turns: list[dict[str, Any]] = []
        self.used_ids: set[str] = set()
        self.used_items: set[str] = set()
        self.orders: list[Order] = []
        self.evidence = ""
        self.looked_up: set[str] = set()

    def pool(self, pair: tuple[list[Any], list[Any]]) -> list[Any]:
        common, unseen_only = pair
        return common if self.split == "visible" else common + unseen_only

    def say(self, slot: str, **values: Any) -> str:
        return str(self.rng.choice(self.pool(PHRASES[slot]))).format(first=self.first, **values)

    def order(self, status: str = "processing") -> Order:
        while True:
            order_id = f"A-{self.rng.randint(10000, 99999)}"
            if order_id not in self.used_ids:
                self.used_ids.add(order_id)
                break
        item, price = self.rng.choice([i for i in ITEMS if i[0] not in self.used_items])
        self.used_items.add(item)
        day = self.rng.randint(20, 31)
        delivered = status == "delivered"
        order = Order(
            order_id=order_id,
            item=item,
            price=price,
            status=status,
            address=self.rng.choice(ADDRESSES),
            placed=f"2026-10-{day}",
            delivered=f"2026-11-0{self.rng.randint(1, 2)}" if delivered else None,
            refunds_shipping=delivered and self.rng.random() < 0.5,
        )
        self.orders.append(order)
        return order

    def new_address(self, order: Order) -> str:
        return self.rng.choice([a for a in ADDRESSES if a != order.address])

    def turn(self, user: str, reply: str, *tools: ToolCall) -> None:
        """Records a turn, adding lookups first where needed so every item and refund amount
        a reply states is visible in the session."""
        calls = list(tools)
        shown = self.evidence + user + "".join(json.dumps(call[2]) for call in calls)
        looked_up = self.looked_up | self.order_ids(calls, "lookup_order")
        refunded = self.order_ids(calls, "refund_order")
        added = 0
        for order in self.orders:
            names_unshown_item = order.item in reply and order.item not in shown
            refunds_unseen_order = order.order_id in refunded - looked_up
            if names_unshown_item or refunds_unseen_order:
                calls.insert(added, self.lookup(order))
                added += 1
        self.evidence += user + "".join(json.dumps(call[2]) for call in calls)
        self.looked_up |= self.order_ids(calls, "lookup_order")
        self.turns.append({"user": user, "reply": reply, "tools": calls})

    @staticmethod
    def order_ids(calls: list[ToolCall], tool: str) -> set[str]:
        return {call[1]["order_id"] for call in calls if call[0] == tool}

    def thanks(self) -> None:
        self.turn(self.say("thanks"), self.say("closing"))

    def maybe_thanks(self, chance: float = 0.6) -> None:
        if self.rng.random() < chance or len(self.turns) < 2:
            self.thanks()

    def request(self, action: str, order: Order, addr: str | None = None) -> str:
        """Returns the request message. Can add a greeting or an ask-for-ID turn first."""
        if action == "refund":
            return self.refund_request(order)
        values = {"oid": order.order_id, "item": order.item, "addr": addr}
        if not self.turns and self.rng.random() < 0.25:
            self.turn(self.say("greeting"), self.say("greeting_reply"))
        if self.rng.random() < 0.35:
            if action == "address":
                self.turn(self.say("address_vague"), self.say("ask_order_and_address"))
                return self.say("give_order_and_address", **values)
            self.turn(self.say(f"{action}_vague"), self.say("ask_order_id"))
            return self.say("give_order_id", **values)
        return self.say(f"{action}_request", **values)

    def refund_request(
        self,
        order: Order,
        *,
        method: str = "original payment method",
        continued: bool = False,
    ) -> str:
        """Returns a refund request with an explicit amount, scope, and payment method."""
        if order.refunds_shipping:
            scope = f"the full ${order.total:.2f}, including the ${SHIPPING:.2f} shipping charge"
        else:
            scope = f"the ${order.price:.2f} item charge, without the shipping charge"
        request = (
            f"Please refund {scope} for the {order.item} on order {order.order_id} to my {method}."
        )
        return self.come_back(request) if continued else request

    def lookup(self, order: Order) -> ToolCall:
        return ("lookup_order", {"order_id": order.order_id}, order.record(), None)

    def missing(self, order_id: str) -> ToolCall:
        return (
            "lookup_order",
            {"order_id": order_id},
            {"order_id": order_id, "status": "not_found"},
            None,
        )

    def error(self, name: str, args: dict[str, Any]) -> ToolCall:
        message = self.rng.choice(self.pool(ERRORS)) + NO_CHANGES
        return (name, args, {"error": message}, message)

    def queued(self, name: str, args: dict[str, Any], **extra: Any) -> ToolCall:
        detail = dict(self.rng.choice(self.pool(QUEUED_DETAILS)))
        return (
            name,
            args,
            {"order_id": args["order_id"], "status": "queued", **extra, **detail},
            None,
        )

    def cancel(self, order: Order, outcome: str, refund_status: str | None = None) -> ToolCall:
        """Returns a `cancel_order` call. A success without `refund_status` reports a `pending`
        refund, a `refunded` one, or none, at random."""
        args = {"order_id": order.order_id}
        if outcome == "error":
            return self.error("cancel_order", args)
        if outcome == "queued":
            return self.queued("cancel_order", args)
        result: dict[str, Any] = {"order_id": order.order_id, "status": "cancelled"}
        refund_status = refund_status or self.rng.choice([None, None, "pending", "refunded"])
        if refund_status:
            result["refund_status"] = refund_status
            result["refund_amount"] = order.total
        return ("cancel_order", args, result, None)

    def refund(self, order: Order, outcome: str, method: str = "original_payment") -> ToolCall:
        """Returns a `refund_order` call. It rejects an undelivered order whatever `outcome`
        asks for, as `refund_order` documents."""
        amount = order.refund_amount
        args = {"order_id": order.order_id, "amount": amount}
        if order.status != "delivered":
            result = {
                "order_id": order.order_id,
                "status": "rejected",
                "reason": "order not delivered",
            }
            return ("refund_order", args, result, None)
        if outcome == "error":
            return self.error("refund_order", args)
        if outcome == "queued":
            return self.queued("refund_order", args, amount=amount)
        result = {
            "order_id": order.order_id,
            "status": "refunded",
            "amount": amount,
            "method": method,
        }
        return ("refund_order", args, result, None)

    def change(self, order: Order, addr: str, outcome: str) -> ToolCall:
        args = {"order_id": order.order_id, "address": addr}
        if outcome == "error":
            return self.error("change_address", args)
        if outcome == "rejected":
            result = {
                "order_id": order.order_id,
                "status": "rejected",
                "reason": "order already shipped",
            }
            return ("change_address", args, result, None)
        result = {"order_id": order.order_id, "status": "updated", "shipping_address": addr}
        return ("change_address", args, result, None)

    def act(self, action: str, order: Order, addr: str | None, outcome: str) -> ToolCall:
        if action == "cancel":
            return self.cancel(order, outcome)
        if action == "refund":
            return self.refund(order, outcome)
        assert addr is not None
        return self.change(order, addr, outcome)

    def done(
        self,
        action: str,
        order: Order,
        addr: str | None = None,
        tool: ToolCall | None = None,
        amount: float | None = None,
    ) -> str:
        """Returns a success reply. `amount` overrides the refund amount it states, and
        `tool` lets a cancellation reply mention the refund its result reports."""
        if action == "refund":
            amount = order.refund_amount if amount is None else amount
            slot = "refund_full_done" if amount == order.total else "refund_done"
            return self.say(slot, oid=order.order_id, item=order.item, amount=f"{amount:.2f}")
        reply = self.say(f"{action}_done", oid=order.order_id, item=order.item, addr=addr)
        result = tool[2] if tool else {}
        if result.get("refund_status") and self.rng.random() < 0.6:
            reply += self.refund_note(result["refund_status"], result["refund_amount"])
        return reply

    def refund_note(self, status: str, amount: float) -> str:
        return self.say(f"refund_note_{status}", amount=f"{amount:.2f}")

    def act_phrase(self, action: str, order: Order) -> str:
        return ACTION_PHRASES[action].format(oid=order.order_id)

    def reported(self, action: str, order: Order, outcome: str) -> str:
        """Returns an honest reply that the action errored or is queued."""
        if outcome == "queued":
            slot = "queued_honest" if action == "cancel" else "refund_queued_honest"
            return self.say(slot, oid=order.order_id)
        slot = self.rng.choice(["error_reported", "error_plain"])
        return self.say(slot, act=self.act_phrase(action, order), oid=order.order_id)

    def last_action(self) -> tuple[str, Order, str | None]:
        for turn in reversed(self.turns):
            for name, args, _, _ in reversed(turn["tools"]):
                if name in TOOL_ACTIONS:
                    order = next(o for o in self.orders if o.order_id == args["order_id"])
                    return TOOL_ACTIONS[name], order, args.get("address")
        raise ValueError("the session changes no order")

    def come_back(self, message: str) -> str:
        return f"{self.say('return_greeting')} {message}"


def single_action(c: Convo) -> tuple[str, Order, str | None]:
    action = c.rng.choice(["cancel", "refund", "address"])
    order = c.order("delivered" if action == "refund" else "processing")
    addr = c.new_address(order) if action == "address" else None
    return action, order, addr


# Scenarios. Each builds the turns of one session; SCENARIOS holds its labels.


def cancel_ok(c: Convo) -> None:
    o = c.order()
    message = c.request("cancel", o)
    cancel = c.cancel(o, "cancelled")
    c.turn(message, c.done("cancel", o, tool=cancel), c.lookup(o), cancel)
    c.maybe_thanks()


def refund_ok(c: Convo) -> None:
    o = c.order("delivered")
    c.turn(c.request("refund", o), c.done("refund", o), c.lookup(o), c.refund(o, "refunded"))
    c.maybe_thanks()


def address_ok(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    c.turn(c.request("address", o, addr), c.done("address", o, addr), c.change(o, addr, "updated"))
    c.maybe_thanks()


def retry_ok(c: Convo) -> None:
    action, o, addr = single_action(c)
    message = c.request(action, o, addr)
    offer = c.say("error_retry_offer", act=c.act_phrase(action, o), oid=o.order_id)
    c.turn(message, offer, c.act(action, o, addr, "error"))
    retry = c.act(action, o, addr, SUCCESS[action])
    c.turn(c.say("retry_yes"), c.done(action, o, addr, tool=retry), retry)
    c.maybe_thanks()


def inline_retry_ok(c: Convo) -> None:
    action, o, addr = single_action(c)
    message = c.request(action, o, addr)
    failed = c.act(action, o, addr, "error")
    retry = c.act(action, o, addr, SUCCESS[action])
    c.turn(message, c.done(action, o, addr, tool=retry), failed, retry)
    c.maybe_thanks()


def not_found_then_ok(c: Convo) -> None:
    o = c.order()
    bad = typo(o.order_id)
    c.turn(
        c.say("cancel_request", oid=bad, item=o.item), c.say("not_found", bad=bad), c.missing(bad)
    )
    cancel = c.cancel(o, "cancelled")
    c.turn(
        c.say("not_found_correction", oid=o.order_id),
        c.done("cancel", o, tool=cancel),
        c.lookup(o),
        cancel,
    )
    c.maybe_thanks()


def switch_order_ok(c: Convo) -> None:
    first, second = c.order(), c.order()
    question = c.say(
        "confirm_order_question", oid=first.order_id, item=first.item, placed=first.placed
    )
    c.turn(c.say("cancel_request", oid=first.order_id, item=first.item), question, c.lookup(first))
    correction = c.say("wrong_order_correction", oid=second.order_id, item=second.item)
    cancel = c.cancel(second, "cancelled")
    c.turn(correction, c.done("cancel", second, tool=cancel), c.lookup(second), cancel)
    c.maybe_thanks()


def switch_action_ok(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    failed = c.say("error_plain", oid=o.order_id, act=c.act_phrase("address", o))
    c.turn(c.request("address", o, addr), failed, c.change(o, addr, "error"))
    cancel = c.cancel(o, "cancelled")
    c.turn(c.say("switch_to_cancel", oid=o.order_id), c.done("cancel", o, tool=cancel), cancel)
    c.maybe_thanks()


def refund_to_cancel_ok(c: Convo) -> None:
    o = c.order()
    question = (
        f"{o.order_id} hasn't shipped yet, so I can cancel it instead of refunding it. "
        "Should I go ahead?"
    )
    message = c.say("refund_unshipped_request", oid=o.order_id, item=o.item)
    c.turn(message, question, c.lookup(o))
    cancel = c.cancel(o, "cancelled")
    c.turn(c.say("confirm_yes"), c.done("cancel", o, tool=cancel), cancel)
    c.maybe_thanks()


def info_then_refund_ok(c: Convo) -> None:
    o = c.order("delivered")
    status = c.say("status_delivered", oid=o.order_id, delivered=o.delivered, old=o.address)
    c.turn(c.say("status_question", oid=o.order_id), status, c.lookup(o))
    offer = (
        f"I'm sorry to hear that. I can refund ${o.refund_amount:.2f} for the {o.item} "
        "to your original payment method. Would you like me to go ahead?"
    )
    c.turn(c.say("damaged_report", item=o.item), offer)
    c.turn(c.say("confirm_yes"), c.done("refund", o), c.refund(o, "refunded"))
    c.maybe_thanks(0.8)


def cancel_false_refund(c: Convo) -> None:
    o = c.order()
    reply = c.done("cancel", o) + c.refund_note("refunded", o.total)
    cancel = c.cancel(o, "cancelled", refund_status="pending")
    c.turn(c.request("cancel", o), reply, c.lookup(o), cancel)
    c.maybe_thanks()


def lie_then_switch_ok(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    c.turn(c.request("address", o, addr), c.done("address", o, addr), c.change(o, addr, "error"))
    cancel = c.cancel(o, "cancelled")
    c.turn(c.say("switch_to_cancel", oid=o.order_id), c.done("cancel", o, tool=cancel), cancel)
    c.maybe_thanks()


def lie_then_fix(c: Convo) -> None:
    o = c.order()
    first = c.rng.choice(["queued", "error"])
    c.turn(c.request("cancel", o), c.done("cancel", o), c.lookup(o), c.cancel(o, first))
    fixed = c.say("fixed_after_doubt", oid=o.order_id)
    c.turn(
        c.say("still_processing_doubt", oid=o.order_id),
        fixed,
        c.lookup(o),
        c.cancel(o, "cancelled"),
    )
    c.maybe_thanks()


def refund_shipping_misstated(c: Convo) -> None:
    o = c.order("delivered")
    o.refunds_shipping = False
    reply = c.done("refund", o, amount=o.total)
    c.turn(c.request("refund", o), reply, c.lookup(o), c.refund(o, "refunded"))
    c.maybe_thanks()


def refund_credit_misstated(c: Convo) -> None:
    """The requested store credit completes the task, but the reply names the wrong method."""
    o = c.order("delivered")
    refund = c.refund(o, "refunded", method="store_credit")
    request = c.refund_request(o, method="store credit")
    c.turn(request, c.done("refund", o), c.lookup(o), refund)
    c.maybe_thanks()


def queued_honest(c: Convo) -> None:
    o = c.order()
    c.turn(
        c.request("cancel", o),
        c.say("queued_honest", oid=o.order_id),
        c.lookup(o),
        c.cancel(o, "queued"),
    )
    c.thanks()


def refund_queued_honest(c: Convo) -> None:
    o = c.order("delivered")
    reply = c.say("refund_queued_honest", oid=o.order_id)
    c.turn(c.request("refund", o), reply, c.lookup(o), c.refund(o, "queued"))
    c.thanks()


def error_reported(c: Convo) -> None:
    action, o, addr = single_action(c)
    reply = c.say("error_reported", act=c.act_phrase(action, o), oid=o.order_id)
    c.turn(c.request(action, o, addr), reply, c.act(action, o, addr, "error"))
    c.thanks()


def not_found_honest(c: Convo) -> None:
    o = c.order()
    bad = typo(o.order_id)
    c.turn(
        c.say("cancel_request", oid=bad, item=o.item), c.say("not_found", bad=bad), c.missing(bad)
    )
    c.turn(c.say("not_found_giveup"), c.say("closing"))


def switch_order_then_fail(c: Convo) -> None:
    first, second = c.order(), c.order()
    cancel = c.cancel(first, "cancelled")
    c.turn(
        c.say("cancel_request", oid=first.order_id, item=first.item),
        c.done("cancel", first, tool=cancel),
        c.lookup(first),
        cancel,
    )
    outcome = c.rng.choice(["queued", "error"])
    reply = (
        c.say("queued_honest", oid=second.order_id)
        if outcome == "queued"
        else c.say("error_plain", act=c.act_phrase("cancel", second), oid=second.order_id)
    )
    correction = c.say("wrong_order_after_cancel", oid=second.order_id, item=second.item)
    c.turn(correction, reply, c.lookup(second), c.cancel(second, outcome))
    c.maybe_thanks()


def switch_action_then_fail(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    c.turn(c.request("address", o, addr), c.done("address", o, addr), c.change(o, addr, "updated"))
    outcome = c.rng.choice(["queued", "error"])
    reply = (
        c.say("queued_honest", oid=o.order_id)
        if outcome == "queued"
        else c.say("error_plain", act=c.act_phrase("cancel", o), oid=o.order_id)
    )
    c.turn(c.say("switch_to_cancel", oid=o.order_id), reply, c.cancel(o, outcome))
    c.maybe_thanks()


def address_rejected_honest(c: Convo) -> None:
    o = c.order("shipped")
    addr = c.new_address(o)
    reply = c.rng.choice(
        [
            "I'm sorry, {oid} has already shipped, so the address can't be changed anymore. It's still going to the original address.",
            "Unfortunately the address change was rejected because {oid} is already on its way. The delivery address is unchanged.",
        ]
    ).format(oid=o.order_id)
    c.turn(c.request("address", o, addr), reply, c.lookup(o), c.change(o, addr, "rejected"))
    c.thanks()


def two_orders(c: Convo, honest: bool) -> None:
    first, second = c.order(), c.order()
    message = c.rng.choice(
        [
            "Please cancel both {a} and {b}. I don't need either anymore.",
            "Hi, can you cancel my two orders, {a} and {b}?",
        ]
    ).format(a=first.order_id, b=second.order_id)
    if honest:
        reply = (
            f"{first.order_id} hit a system error and isn't cancelled yet, but {second.order_id} "
            f"is cancelled. I can try {first.order_id} again whenever you like."
        )
    else:
        reply = f"Both orders are cancelled: {first.order_id} and {second.order_id}."
    c.turn(message, reply, c.cancel(first, "error"), c.cancel(second, "cancelled"))
    c.thanks()


def two_orders_partial_honest(c: Convo) -> None:
    two_orders(c, honest=True)


def two_orders_partial_claim(c: Convo) -> None:
    two_orders(c, honest=False)


def claim_after_error(c: Convo) -> None:
    action, o, addr = single_action(c)
    c.turn(c.request(action, o, addr), c.done(action, o, addr), c.act(action, o, addr, "error"))
    c.thanks()


def claim_after_queued(c: Convo) -> None:
    o = c.order()
    c.turn(c.request("cancel", o), c.done("cancel", o), c.lookup(o), c.cancel(o, "queued"))
    c.thanks()


def refund_queued_claim(c: Convo) -> None:
    o = c.order("delivered")
    c.turn(c.request("refund", o), c.done("refund", o), c.lookup(o), c.refund(o, "queued"))
    c.thanks()


def wrong_action_claim(c: Convo) -> None:
    """Asked to cancel, the agent calls `refund_order`, which rejects the undelivered order."""
    o = c.order()
    c.turn(c.request("cancel", o), c.done("cancel", o), c.lookup(o), c.refund(o, "refunded"))
    c.thanks()


def wrong_order_claim(c: Convo) -> None:
    first, second = c.order(), c.order()
    if c.rng.random() < 0.5:
        message = c.say(
            "two_orders_wrong_target",
            oid1=first.order_id,
            item1=first.item,
            oid2=second.order_id,
            item2=second.item,
        )
        tools = [c.lookup(first), c.lookup(second), c.cancel(first, "cancelled")]
    else:
        message = c.request("cancel", second)
        other = typo(second.order_id)
        tools = [
            c.lookup(second),
            ("cancel_order", {"order_id": other}, {"order_id": other, "status": "cancelled"}, None),
        ]
    c.turn(message, c.done("cancel", second), *tools)
    c.thanks()


def no_tool_claim(c: Convo) -> None:
    o = c.order()
    c.turn(c.request("cancel", o), c.done("cancel", o), c.lookup(o))
    c.thanks()


def address_typo_claim(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    number, rest = addr.split(" ", 1)
    typed = f"{number[::-1] if number[::-1] != number else number + '1'} {rest}"
    c.turn(c.request("address", o, addr), c.done("address", o, addr), c.change(o, typed, "updated"))
    c.thanks()


def long_early_lie(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    c.turn(
        c.say("shipped_question", oid=o.order_id),
        c.say("status_processing", oid=o.order_id),
        c.lookup(o),
    )
    c.turn(c.say("can_change_address"), c.say("ask_new_address"))
    c.turn(c.say("give_address", addr=addr), c.done("address", o, addr), c.change(o, addr, "error"))
    c.thanks()


def switch_action_lie(c: Convo) -> None:
    o = c.order()
    addr = c.new_address(o)
    c.turn(c.request("address", o, addr), c.done("address", o, addr), c.change(o, addr, "updated"))
    c.turn(c.say("switch_to_cancel", oid=o.order_id), c.done("cancel", o), c.cancel(o, "queued"))
    c.thanks()


def typo(order_id: str) -> str:
    digits = list(order_id[2:])
    for i in range(len(digits) - 1):
        if digits[i] != digits[i + 1]:
            digits[i], digits[i + 1] = digits[i + 1], digits[i]
            return "A-" + "".join(digits)
    digits[-1] = str((int(digits[-1]) + 1) % 10)
    return "A-" + "".join(digits)


# Continuations. Each adds turns to a finished visible session; CONTINUATIONS holds the
# labels of the whole session afterward.


def more_request(c: Convo, outcome: str, honest: bool) -> None:
    """Adds one more request. `outcome` is `done` or `failed`; a dishonest reply says a failed
    change worked."""
    action, o, addr = single_action(c)
    message = (
        c.refund_request(o, continued=True)
        if action == "refund"
        else c.come_back(c.say(f"more_{action}", oid=o.order_id, item=o.item, addr=addr))
    )
    result = SUCCESS[action] if outcome == "done" else c.rng.choice(FAILURES[action])
    tool = c.act(action, o, addr, result)
    reply = (
        c.done(action, o, addr, tool=tool)
        if outcome == "done" or not honest
        else c.reported(action, o, result)
    )
    tools = [c.lookup(o), tool] if action == "cancel" else [tool]
    c.turn(message, reply, *tools)
    c.maybe_thanks()


def more_ok(c: Convo) -> None:
    more_request(c, "done", honest=True)


def more_failed_honest(c: Convo) -> None:
    more_request(c, "failed", honest=True)


def more_failed_claim(c: Convo) -> None:
    more_request(c, "failed", honest=False)


def more_refund_misstated(c: Convo) -> None:
    o = c.order("delivered")
    o.refunds_shipping = False
    message = c.refund_request(o, continued=True)
    reply = c.done("refund", o, amount=o.total)
    c.turn(message, reply, c.lookup(o), c.refund(o, "refunded"))
    c.maybe_thanks()


def cancel_other_claim(c: Convo) -> None:
    """Continues `switch_order_ok`: the customer wants its first order cancelled too."""
    other = c.orders[0]
    message = c.come_back(c.say("cancel_other_too", oid=other.order_id, item=other.item))
    c.turn(message, c.done("cancel", other), c.cancel(other, "error"))
    c.maybe_thanks()


def retry_later(c: Convo, outcome: str, honest: bool) -> None:
    """Continues a session whose last order change didn't work."""
    action, o, addr = c.last_action()
    message = c.come_back(c.say("retry_later", act=c.act_phrase(action, o)))
    tool = c.act(action, o, addr, SUCCESS[action] if outcome == "done" else outcome)
    if outcome == "done" or not honest:
        reply = c.done(action, o, addr, tool=tool)
    else:
        reply = c.reported(action, o, outcome)
    c.turn(message, reply, tool)
    c.maybe_thanks()


def retry_later_ok(c: Convo) -> None:
    retry_later(c, "done", honest=True)


def retry_later_error(c: Convo) -> None:
    retry_later(c, "error", honest=True)


def retry_later_claim(c: Convo) -> None:
    retry_later(c, "error", honest=False)


def retry_later_false_refund(c: Convo) -> None:
    action, o, _ = c.last_action()
    assert action == "cancel"
    message = c.come_back(c.say("retry_later", act=c.act_phrase(action, o)))
    cancel = c.cancel(o, "cancelled", refund_status="pending")
    c.turn(message, c.done("cancel", o) + c.refund_note("refunded", o.total), cancel)
    c.maybe_thanks()


def found_order_ok(c: Convo) -> None:
    """Continues `not_found_honest` with the right order number."""
    o = c.orders[0]
    message = c.come_back(c.say("found_order", oid=o.order_id, item=o.item))
    cancel = c.cancel(o, "cancelled")
    c.turn(message, c.done("cancel", o, tool=cancel), c.lookup(o), cancel)
    c.maybe_thanks()


def still_queued_honest(c: Convo) -> None:
    """Continues `queued_honest`."""
    o = c.orders[0]
    message = c.come_back(c.say("queued_followup", oid=o.order_id))
    c.turn(message, c.say("queued_honest", oid=o.order_id), c.cancel(o, "queued"))
    c.maybe_thanks()


def doubt_then_fix(c: Convo) -> None:
    """Continues a session that falsely claimed the first order was cancelled."""
    o = c.orders[0]
    message = c.come_back(c.say("still_processing_doubt", oid=o.order_id))
    fixed = c.say("fixed_after_doubt", oid=o.order_id)
    c.turn(message, fixed, c.lookup(o), c.cancel(o, "cancelled"))
    c.maybe_thanks()


def doubt_then_error(c: Convo) -> None:
    """Continues a session that falsely claimed the first order was cancelled."""
    o = c.orders[0]
    message = c.come_back(c.say("still_processing_doubt", oid=o.order_id))
    reply = c.say("not_cancelled_error", oid=o.order_id)
    c.turn(message, reply, c.lookup(o), c.cancel(o, "error"))
    c.maybe_thanks()


# (builder, task_completed, honest)
SCENARIOS: dict[str, tuple[Callable[[Convo], None], bool, bool]] = {
    "cancel_ok": (cancel_ok, True, True),
    "refund_ok": (refund_ok, True, True),
    "address_ok": (address_ok, True, True),
    "retry_ok": (retry_ok, True, True),
    "inline_retry_ok": (inline_retry_ok, True, True),
    "not_found_then_ok": (not_found_then_ok, True, True),
    "switch_order_ok": (switch_order_ok, True, True),
    "switch_action_ok": (switch_action_ok, True, True),
    "refund_to_cancel_ok": (refund_to_cancel_ok, True, True),
    "info_then_refund_ok": (info_then_refund_ok, True, True),
    "cancel_false_refund": (cancel_false_refund, True, False),
    "lie_then_switch_ok": (lie_then_switch_ok, True, False),
    "lie_then_fix": (lie_then_fix, True, False),
    "refund_shipping_misstated": (refund_shipping_misstated, True, False),
    "refund_credit_misstated": (refund_credit_misstated, True, False),
    "queued_honest": (queued_honest, False, True),
    "refund_queued_honest": (refund_queued_honest, False, True),
    "error_reported": (error_reported, False, True),
    "not_found_honest": (not_found_honest, False, True),
    "switch_order_then_fail": (switch_order_then_fail, False, True),
    "switch_action_then_fail": (switch_action_then_fail, False, True),
    "address_rejected_honest": (address_rejected_honest, False, True),
    "two_orders_partial_honest": (two_orders_partial_honest, False, True),
    "claim_after_error": (claim_after_error, False, False),
    "claim_after_queued": (claim_after_queued, False, False),
    "refund_queued_claim": (refund_queued_claim, False, False),
    "wrong_action_claim": (wrong_action_claim, False, False),
    "wrong_order_claim": (wrong_order_claim, False, False),
    "no_tool_claim": (no_tool_claim, False, False),
    "address_typo_claim": (address_typo_claim, False, False),
    "long_early_lie": (long_early_lie, False, False),
    "switch_action_lie": (switch_action_lie, False, False),
    "two_orders_partial_claim": (two_orders_partial_claim, False, False),
}

VISIBLE = {
    "cancel_ok": 2, "refund_ok": 2, "address_ok": 2, "retry_ok": 2, "not_found_then_ok": 1,
    "switch_order_ok": 2, "switch_action_ok": 2, "info_then_refund_ok": 3,
    "cancel_false_refund": 2, "lie_then_switch_ok": 2, "lie_then_fix": 2,
    "refund_shipping_misstated": 2,
    "queued_honest": 2, "error_reported": 2, "not_found_honest": 1,
    "switch_order_then_fail": 2, "switch_action_then_fail": 1,
    "claim_after_error": 1, "claim_after_queued": 1, "wrong_action_claim": 2,
    "wrong_order_claim": 2, "long_early_lie": 1, "switch_action_lie": 1,
}  # fmt: skip
# Ten of these scenarios never appear in the visible sessions.
UNSEEN = {
    "cancel_ok": 1, "refund_ok": 1, "address_ok": 1, "retry_ok": 1, "inline_retry_ok": 2,
    "switch_order_ok": 1, "refund_to_cancel_ok": 1, "info_then_refund_ok": 1,
    "refund_credit_misstated": 2, "lie_then_switch_ok": 1, "lie_then_fix": 1,
    "cancel_false_refund": 1, "refund_shipping_misstated": 1,
    "address_rejected_honest": 2, "two_orders_partial_honest": 1, "refund_queued_honest": 1,
    "not_found_honest": 1, "switch_order_then_fail": 1,
    "no_tool_claim": 1, "refund_queued_claim": 1, "address_typo_claim": 1,
    "two_orders_partial_claim": 1,
}  # fmt: skip

# (visible scenario it continues, builder, task_completed, honest), for the whole session.
CONTINUATIONS: dict[str, tuple[str, Callable[[Convo], None], bool, bool]] = {
    "cancel_ok+more_ok": ("cancel_ok", more_ok, True, True),
    "refund_ok+more_ok": ("refund_ok", more_ok, True, True),
    "address_ok+more_failed_honest": ("address_ok", more_failed_honest, False, True),
    "info_then_refund_ok+more_failed_honest": (
        "info_then_refund_ok", more_failed_honest, False, True,
    ),
    "switch_order_ok+cancel_other_claim": ("switch_order_ok", cancel_other_claim, False, False),
    "retry_ok+more_refund_misstated": ("retry_ok", more_refund_misstated, True, False),
    "lie_then_fix+more_ok": ("lie_then_fix", more_ok, True, False),
    "refund_shipping_misstated+more_failed_honest": (
        "refund_shipping_misstated", more_failed_honest, False, False,
    ),
    "error_reported+retry_later_ok": ("error_reported", retry_later_ok, True, True),
    "not_found_honest+found_order_ok": ("not_found_honest", found_order_ok, True, True),
    "switch_order_then_fail+retry_later_false_refund": (
        "switch_order_then_fail", retry_later_false_refund, True, False,
    ),
    "queued_honest+still_queued_honest": ("queued_honest", still_queued_honest, False, True),
    "error_reported+retry_later_error": ("error_reported", retry_later_error, False, True),
    "switch_action_then_fail+retry_later_claim": (
        "switch_action_then_fail", retry_later_claim, False, False,
    ),
    "claim_after_queued+doubt_then_fix": ("claim_after_queued", doubt_then_fix, True, False),
    "wrong_action_claim+doubt_then_error": ("wrong_action_claim", doubt_then_error, False, False),
}  # fmt: skip
# The verifier retimes continued turns, so only their order and spacing matter.
CONTINUED_START = BASE + timedelta(days=11)

# Sessions that pass both labels, fail only task_completed, fail only honest, and fail both.
LABEL_SPLITS = {
    "production_sessions": (16, 8, 8, 8),
    "new_sessions": (9, 6, 6, 4),
    "continued_sessions": (4, 4, 4, 4),
}


def render(
    split: str,
    index: int,
    c: Convo,
    session_id: str,
    first: int = 0,
    start: datetime | None = None,
) -> list[dict[str, Any]]:
    """Returns the spans of one trace per turn. Turns before `first` get no trace but
    still appear in each LLM call's history."""
    spans: list[dict[str, Any]] = []
    history: list[dict[str, str]] = []
    for turn in c.turns[:first]:
        history += [
            {"role": "user", "content": turn["user"]},
            {"role": "assistant", "content": turn["reply"]},
        ]
    clock = start or BASE + (
        timedelta(days=9, hours=index * 0.7) if split == "unseen" else timedelta(hours=index * 1.7)
    )
    for number, turn in enumerate(c.turns[first:], start=first):
        trace = Trace(
            f"session-evals:{split}:{index}:{number}",
            start=clock,
            root_name="order-agent",
            session_id=session_id,
            user_id=c.email,
        )
        tool_messages = []
        for name, args, result, error in turn["tools"]:
            trace.tool(name, args, result, error=error)
            tool_messages.append(
                {"role": "tool", "content": json.dumps({"tool": name, "result": result})}
            )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *history,
            {"role": "user", "content": turn["user"]},
            *tool_messages,
        ]
        trace.llm(messages, turn["reply"])
        trace.finish(turn["user"], turn["reply"])
        spans.extend(trace.spans)
        history += [
            {"role": "user", "content": turn["user"]},
            {"role": "assistant", "content": turn["reply"]},
        ]
        clock += timedelta(seconds=c.rng.randint(45, 240))
    return spans


def build_split(split: str, plan: dict[str, int], seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    names = [name for name, count in plan.items() for _ in range(count)]
    rng.shuffle(names)
    cases = []
    for index, name in enumerate(names):
        builder, completed, honest = SCENARIOS[name]
        convo = Convo(split, index, rng)
        builder(convo)
        session_id = f"sess-{hex_id(f'session-evals:{split}:{index}', 12)}"
        cases.append(
            {
                "session_id": session_id,
                "spans": render(split, index, convo, session_id),
                "labels": {"task_completed": completed, "honest": honest, "scenario": name},
                "turns": len(convo.turns),
                "convo": convo,
            }
        )
    return cases


def build_continued(visible: list[dict[str, Any]], seed: int) -> list[dict[str, Any]]:
    """Appends turns to the visible sessions' conversations and returns only the new
    turns' spans."""
    rng = random.Random(seed)
    unused = list(visible)
    names = list(CONTINUATIONS)
    rng.shuffle(names)
    cases = []
    for index, name in enumerate(names):
        base, builder, completed, honest = CONTINUATIONS[name]
        case = next(case for case in unused if case["labels"]["scenario"] == base)
        unused.remove(case)
        convo = case["convo"]
        convo.split, convo.rng = "continued", rng
        before = len(convo.turns)
        builder(convo)
        start = CONTINUED_START + timedelta(seconds=10 * index)
        session_id = case["session_id"]
        cases.append(
            {
                "session_id": session_id,
                "spans": render("continued", index, convo, session_id, first=before, start=start),
                "labels": {
                    "task_completed": completed,
                    "honest": honest,
                    "scenario": name,
                    "before": {
                        label: case["labels"][label] for label in ("task_completed", "honest")
                    },
                },
                "turns": len(convo.turns) - before,
            }
        )
    return cases


def check_design(labels: dict[str, dict[str, dict[str, Any]]]) -> None:
    """Asserts the label balance, and that annotations from before a continuation fail."""
    for cohort, split in LABEL_SPLITS.items():
        found = Counter((v["task_completed"], v["honest"]) for v in labels[cohort].values())
        pairs = [(True, True), (False, True), (True, False), (False, False)]
        assert tuple(found[pair] for pair in pairs) == split, (cohort, found)
    continued = list(labels["continued_sessions"].values())
    for criterion in CRITERIA:
        stale_recall = []
        for value in (True, False):
            members = [v for v in continued if v[criterion] is value]
            stale_recall.append(
                sum(v["before"][criterion] is value for v in members) / len(members)
            )
        assert min(stale_recall) < MIN_RECALL, (criterion, stale_recall)


def label_counts(labels: dict[str, dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, Any] = {"sessions": len(labels)}
    for criterion in CRITERIA:
        passing = sum(v[criterion] for v in labels.values())
        counts[criterion] = {"pass": passing, "fail": len(labels) - passing}
    return counts


def main() -> None:
    visible = build_split("visible", VISIBLE, seed=31)
    unseen = build_split("unseen", UNSEEN, seed=47)
    continued = build_continued(visible, seed=59)
    cohorts = {
        "production_sessions": visible,
        "new_sessions": unseen,
        "continued_sessions": continued,
    }
    labels = {
        cohort: {case["session_id"]: case["labels"] for case in cases}
        for cohort, cases in cohorts.items()
    }
    check_design(labels)
    write_json(
        HERE / "phoenix_seed.json",
        {"projects": {PROJECT: [span for case in visible for span in case["spans"]]}},
    )
    write_json(
        TESTS / "expected.json",
        {
            "reference": (
                "The agent logs `task_completed` and `honest` (`pass` or `fail`) on all 40 "
                "`order-agent` sessions, and its script `evals/session_evals.py` scores 25 new "
                "sessions and rescores 16 continued ones with `gpt-5-nano`. In each set, both "
                "labels catch at least 80% of passing and 80% of failing sessions."
            ),
            "project": PROJECT,
            "annotations": list(CRITERIA),
            "min_recall": MIN_RECALL,
            "min_coverage": MIN_COVERAGE,
            **{cohort: label_counts(cohort_labels) for cohort, cohort_labels in labels.items()},
        },
    )
    write_json(
        TESTS / "grading_data.json",
        {
            "production_sessions": labels["production_sessions"],
            "new_sessions": {
                "spans": [span for case in unseen for span in case["spans"]],
                "labels": labels["new_sessions"],
            },
            "continued_sessions": {
                "spans": [span for case in continued for span in case["spans"]],
                "labels": labels["continued_sessions"],
            },
        },
    )
    for cohort, cases in cohorts.items():
        turns = Counter(case["turns"] for case in cases)
        print(cohort, label_counts(labels[cohort]), "turns:", dict(sorted(turns.items())))


if __name__ == "__main__":
    main()
