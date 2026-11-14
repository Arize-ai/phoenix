"""Build the refund-decision traces for `improve-judge`.

Writes `fixture/spec.json` (80 traces, 40 `human_review` annotations, and the starting
judge's `policy_compliant` annotation on every trace) and `tests/truth.json` (labels
for the 40 traces without a human review, plus 40 unseen traces and labels that the
verifier adds before rerunning the judge). Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/improve-judge/fixture/build.py

Each trace is one refund request that the support agent approved or declined. A
trace's label says whether the agent's decision and refund amount follow the refund
policy for that order. `policy_outcome` computes the allowed amount from the order
record, and every case kind either follows it or breaks one rule on purpose. The
builder asserts that each label matches `policy_outcome`.

The starting annotations come from `starting_judge_label`, a deterministic stand-in
for the prompt in `workdir/evals/policy_judge.py`. That prompt asks whether a reply is
polite and mentions the 30-day return window, and every reply is polite, so the
stand-in labels a reply `pass` when it mentions the 30-day window.
"""

from __future__ import annotations

import json
import random
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "refund-decisions"
JUDGE = "policy_compliant"
REVIEW = "human_review"
SYSTEM_PROMPT = (
    "You are Acme Outdoor's refund agent. Look up the order and the refund policy, decide "
    "whether the customer gets a refund and how much, and reply to the customer with your "
    "decision, the amount, and the reason."
)

POLICIES = {
    "return-window": (
        "Items can be returned within 30 days of delivery for a refund of the item price. "
        "Requests made more than 30 days after delivery are declined."
    ),
    "final-sale": "Items marked final sale can't be returned or refunded for any reason, including damage.",
    "gift-cards": "Gift cards and e-gift cards are never refundable.",
    "damaged": (
        "If an item arrives damaged and the customer reports it within 14 days of delivery, "
        "refund the item price plus the original shipping. Damage reported later is handled "
        "as a standard return."
    ),
    "restocking": (
        "Opened electronics are refunded minus a 15% restocking fee on the item price. The fee "
        "doesn't apply to unopened electronics, to other categories, or to damaged items "
        "refunded within 14 days."
    ),
    "shipping": (
        "Original shipping is refunded only for damaged items reported within 14 days of "
        "delivery. All other refunds cover the item price only."
    ),
    "processing": "Approved refunds go back to the original payment method within 5 to 7 business days.",
    "exchanges": "Customers can exchange an item for a different size or color instead of a refund. Exchanges ship free.",
}  # fmt: skip

# (item, category, price, shipping paid). Prices avoid half-cent ties at 15%.
ITEMS = {
    "visible": [
        ("wireless earbuds", "electronics", 79.00, 6.95),
        ("smart watch", "electronics", 199.00, 8.95),
        ("bluetooth speaker", "electronics", 59.99, 6.95),
        ("e-reader", "electronics", 129.99, 5.95),
        ("action camera", "electronics", 249.00, 9.95),
        ("rain jacket", "apparel", 129.00, 7.95),
        ("wool sweater", "apparel", 74.00, 5.95),
        ("fleece vest", "apparel", 58.00, 5.95),
        ("trail running shoes", "footwear", 89.00, 7.95),
        ("hiking boots", "footwear", 149.00, 9.95),
        ("camping stove", "outdoor", 64.00, 8.95),
        ("hiking backpack", "outdoor", 112.00, 9.95),
        ("two-person tent", "outdoor", 189.00, 14.95),
        ("cast iron skillet", "home", 42.00, 8.95),
        ("ceramic mug set", "home", 36.00, 6.95),
        ("$50 gift card", "gift card", 50.00, 0.00),
        ("$100 e-gift card", "gift card", 100.00, 0.00),
    ],
    "unseen": [
        ("noise-cancelling headphones", "electronics", 299.00, 9.95),
        ("fitness tracker", "electronics", 89.95, 5.95),
        ("portable power bank", "electronics", 45.00, 4.95),
        ("GPS handheld", "electronics", 219.00, 7.95),
        ("dash camera", "electronics", 119.00, 6.95),
        ("down parka", "apparel", 239.00, 12.50),
        ("merino base layer", "apparel", 68.00, 4.95),
        ("leather work boots", "footwear", 165.00, 10.95),
        ("trail sandals", "footwear", 54.00, 6.50),
        ("trekking poles", "outdoor", 82.00, 7.50),
        ("sleeping bag", "outdoor", 139.00, 11.95),
        ("enamel dutch oven", "kitchen", 98.00, 13.50),
        ("wooden puzzle set", "toys", 27.00, 4.95),
        ("$25 gift card", "gift card", 25.00, 0.00),
        ("$200 e-gift card", "gift card", 200.00, 0.00),
    ],
}
NAMES = [
    "Maria Lopez", "Dev Patel", "Sam Okafor", "Lena Fischer", "Tom Nguyen", "Aisha Khan",
    "Jonas Berg", "Chloe Martin", "Ravi Iyer", "Grace Kim", "Omar Haddad", "Nina Rossi",
    "Priya Shah", "Ben Carter", "Yuki Tanaka", "Lucas Silva",
]  # fmt: skip

# Case kinds and how many of each per split. The first eight follow the policy.
COMPLIANT = {
    "full_refund": (12, 6),
    "damaged_refund": (6, 3),
    "restocking_fee": (7, 4),
    "late_denied": (7, 3),
    "final_sale_denied": (5, 3),
    "gift_card_denied": (4, 2),
    "damaged_late_item_price": (4, 2),
    "damaged_electronics": (3, 1),
}
NONCOMPLIANT = {
    "late_approved": (5, 2),
    "final_sale_approved": (4, 2),
    "gift_card_refunded": (2, 1),
    "restocking_fee_skipped": (4, 2),
    "restocking_fee_misapplied": (4, 2),
    "shipping_not_refunded": (3, 2),
    "shipping_refunded": (3, 1),
    "wrongly_denied": (4, 2),
    "damaged_late_full": (2, 1),
    "restocking_math": (1, 1),
}
KINDS = {**COMPLIANT, **NONCOMPLIANT}

# Reply sentences. Each key has visible and unseen wordings, so the unseen traces read
# differently from anything the agent saw.
SENTENCES: dict[str, dict[str, list[str]]] = {
    "greeting": {
        "visible": [
            "Hi {first}, thanks for reaching out about your {item}.",
            "Hello {first}, thank you for contacting us about order {order_id}.",
            "Hi {first}, I'm sorry to hear the {item} didn't work out.",
        ],
        "unseen": [
            "Hey {first}, thanks for getting in touch about the {item}.",
            "Good afternoon {first}, and thanks for your patience with order {order_id}.",
            "{first}, thanks for writing in about your {item}.",
        ],
    },
    "approve": {
        "visible": [
            "I've approved a refund of ${amount}.",
            "Your refund of ${amount} has been approved.",
        ],
        "unseen": [
            "We'll send ${amount} back to your original payment method.",
            "You're all set: ${amount} is on its way back to you.",
            "Refund decision: approved for ${amount}.",
        ],
    },
    "deny": {
        "visible": [
            "Unfortunately, I can't offer a refund for this order.",
            "I'm sorry, but this order isn't eligible for a refund.",
        ],
        "unseen": [
            "I'm afraid we won't be able to refund this one.",
            "Refund decision: declined.",
            "Regrettably, this purchase can't be refunded.",
        ],
    },
    "standard": {
        "visible": ["Your return is eligible for a refund of the item price."],
        "unseen": ["It qualifies as a regular return, so you get the purchase price back."],
    },
    "damaged": {
        "visible": [
            "Because the {item} arrived damaged, we're refunding the item price plus your ${ship} shipping."
        ],
        "unseen": [
            "Since it showed up damaged, we're covering the item and the ${ship} you paid for shipping."
        ],
    },
    "restocking": {
        "visible": ["Since you opened the {item}, a 15% restocking fee of ${fee} applies."],
        "unseen": [
            "Because you've opened the {item}, there's a 15% restocking fee (${fee}), which I've deducted."
        ],
    },
    "restocking_any": {
        "visible": ["Electronics returns carry a 15% restocking fee of ${fee}."],
        "unseen": [
            "There's a 15% restocking charge (${fee}) on electronics, which I've taken off."
        ],
    },
    "restocking_opened": {
        "visible": ["Opened electronics returns carry a 15% restocking fee of ${fee}."],
        "unseen": [
            "There's a 15% restocking charge (${fee}) on opened electronics, which I've taken off."
        ],
    },
    "damaged_no_fee": {
        "visible": [
            "Since it arrived damaged, there's no restocking fee, and we're refunding your ${ship} shipping too."
        ],
        "unseen": [
            "Damaged items don't carry a restocking fee, so you'll get the full price plus ${ship} for shipping."
        ],
    },
    "late": {
        "visible": [
            "The order was delivered {days} days ago, which is past our 30-day return window."
        ],
        "unseen": [
            "Our records show delivery {days} days ago, and returns close 30 days after delivery."
        ],
    },
    "in_window": {
        "visible": ["You're still within our 30-day return window."],
        "unseen": ["You're inside the 30-day return period, so this qualifies."],
    },
    "late_plain": {
        "visible": ["This order is past our 30-day return window."],
        "unseen": ["The 30-day return period for this order has already ended."],
    },
    "final_sale": {
        "visible": ["This item was marked final sale, so it can't be returned or refunded."],
        "unseen": ["Final-sale purchases like your {item} aren't eligible for returns."],
    },
    "gift_card": {
        "visible": ["Gift cards aren't refundable."],
        "unseen": ["Gift card purchases are non-refundable."],
    },
    "unused": {
        "visible": ["Since you haven't used the {item}, we can refund the full item price."],
        "unseen": ["As you haven't used the {item}, the full purchase price can go back to you."],
    },
    "damaged_late": {
        "visible": [
            "Damage has to be reported within 14 days of delivery to qualify for a shipping "
            "refund, so this is a standard return of the item price."
        ],
        "unseen": [
            "Because the damage was reported more than 14 days after delivery, we're "
            "processing it as a regular return, which covers the item price."
        ],
    },
    "damaged_item_only": {
        "visible": ["Since the {item} arrived damaged, we're refunding the item price."],
        "unseen": ["Sorry it arrived damaged; we're refunding what you paid for it."],
    },
    "shipping_too": {
        "visible": ["We're also refunding your ${ship} shipping."],
        "unseen": ["I've included the ${ship} shipping charge in your refund as well."],
    },
    "reminder": {
        "visible": [
            "As a reminder, most items can be returned within 30 days of delivery.",
            "For future orders, our return window is 30 days from delivery.",
        ],
        "unseen": [
            "Most purchases can come back to us within 30 days of delivery.",
            "Keep in mind our 30-day return policy for future orders.",
        ],
    },
    "closing_approve": {
        "visible": ["You'll see it on your original payment method within 5 to 7 business days."],
        "unseen": ["Expect it within 5 to 7 business days."],
    },
    "closing_deny": {
        "visible": ["Let me know if there's anything else I can help with."],
        "unseen": ["I'm sorry I don't have better news."],
    },
    "signoff": {
        "visible": ["\n\nBest,\nAcme Support"],
        "unseen": ["\n\nThanks,\nThe Acme team"],
    },
}
REQUESTS = {
    "visible": [
        "Hi, I'd like a refund for the {item} from order {order_id}. {reason}",
        "Order {order_id}: {reason} Can I get my money back for the {item}?",
    ],
    "unseen": [
        "Hello! Requesting a refund on {order_id} ({item}). {reason}",
        "Can you refund my {item}? Order number {order_id}. {reason}",
    ],
}
CUSTOMER_REASONS = {
    "damaged": {
        "visible": ["It arrived damaged.", "The box was crushed and the {item} is broken."],
        "unseen": ["It showed up broken.", "There's a deep dent in it straight out of the box."],
    },
    "opened": {
        "visible": [
            "I opened it but it's not what I expected.",
            "I tried it once and it isn't for me.",
        ],
        "unseen": [
            "Used it for a day and it's not for me.",
            "Unboxed it and it isn't what I wanted.",
        ],
    },
    "unopened": {
        "visible": ["I changed my mind, and it's still sealed.", "I never used it."],
        "unseen": ["Turns out I don't need it. Still in the packaging.", "Never opened it."],
    },
    "gift": {
        "visible": ["I bought it as a gift, but the recipient doesn't want it."],
        "unseen": ["I'd like to cash this gift card back out."],
    },
    "date_claim": {
        "visible": ["I received it about two weeks ago."],
        "unseen": ["It only arrived last week."],
    },
}
# Delivery ages that make each split's date claim true. Late customers make the same
# claim falsely, so the order record, not the claim, gives the delivery age.
TRUE_CLAIM_DAYS = {"visible": range(11, 18), "unseen": range(6, 13)}
REVIEW_NOTES = {
    "full_refund": "Eligible return on day {days}. Item price only, ${correct}. Correct.",
    "damaged_refund": "Damage reported on day {days}, inside 14 days. Item plus shipping, ${correct}, is right.",
    "restocking_fee": "Opened electronics, so the 15% restocking fee applies. ${correct} is right.",
    "late_denied": "Delivered {days} days ago, past the 30-day window. Declining is correct.",
    "final_sale_denied": "Final-sale item. Correctly declined.",
    "gift_card_denied": "Gift cards are never refundable. Correct denial.",
    "damaged_late_item_price": (
        "Damage reported on day {days}, after the 14-day limit, so it's a standard return: "
        "${correct}, no shipping. Correct."
    ),
    "damaged_electronics": (
        "Damaged on arrival and reported on day {days}. No restocking fee on damaged items, "
        "so ${correct} with shipping is right."
    ),
    "late_approved": "Delivered {days} days ago, outside the 30-day window. Should have been declined.",
    "final_sale_approved": "Final-sale item. Shouldn't have been refunded at all.",
    "gift_card_refunded": "Refunded a gift card. Gift cards are never refundable.",
    "restocking_fee_skipped": "Opened electronics need the 15% restocking fee. Should be ${correct}, not ${stated}.",
    "restocking_fee_misapplied": (
        "The restocking fee only applies to opened electronics that didn't arrive damaged. "
        "Should be ${correct}, not ${stated}."
    ),
    "shipping_not_refunded": (
        "Arrived damaged, reported on day {days}. Shipping should be refunded too: "
        "${correct}, not ${stated}."
    ),
    "shipping_refunded": "Not damaged, so shipping isn't refundable. Should be ${correct}, not ${stated}.",
    "wrongly_denied": "Eligible return on day {days}. Should have refunded ${correct} instead of declining.",
    "damaged_late_full": (
        "Damage reported on day {days}, after the 14-day limit, so the standard return "
        "rules apply: ${correct}, not ${stated}."
    ),
    "restocking_math": "The restocking fee is 15% of the item price only. Should be ${correct}, not ${stated}.",
}  # fmt: skip
WINDOW = re.compile(r"\b30[- ]day|\b30 days", re.IGNORECASE)


def money(value: float) -> float:
    return round(value + 1e-9, 2)


def restocked(price: float) -> float:
    return money(price - money(price * 0.15))


@dataclass(frozen=True)
class Order:
    order_id: str
    customer: str
    item: str
    category: str
    price: float
    shipping_paid: float
    final_sale: bool
    days_since_delivery: int
    condition: str
    opened: bool

    def record(self) -> dict[str, Any]:
        return {
            "order_id": self.order_id,
            "customer_name": self.customer,
            "item": self.item,
            "category": self.category,
            "price": self.price,
            "shipping_paid": self.shipping_paid,
            "final_sale": self.final_sale,
            "days_since_delivery": self.days_since_delivery,
            "condition": self.condition,
            "opened": self.opened,
            "status": "delivered",
        }


def policy_outcome(order: Order) -> float:
    """Returns the refund the policy allows for the order, or 0 if it allows none."""
    if order.category == "gift card" or order.final_sale:
        return 0.0
    if order.condition == "damaged" and order.days_since_delivery <= 14:
        return money(order.price + order.shipping_paid)
    if order.days_since_delivery > 30:
        return 0.0
    if order.category == "electronics" and order.opened:
        return restocked(order.price)
    return order.price


def starting_judge_label(reply: str) -> bool:
    """Deterministic stand-in for the starting judge: pass when the 30-day window is mentioned."""
    return bool(WINDOW.search(reply))


def passages(order: Order) -> list[dict[str, Any]]:
    keys: list[str] = []
    if order.category == "gift card":
        keys.append("gift-cards")
    if order.final_sale:
        keys.append("final-sale")
    if order.condition == "damaged":
        keys += ["damaged", "shipping"]
    if order.category == "electronics":
        keys.append("restocking")
    keys.append("return-window")
    if "shipping" not in keys:
        keys.append("shipping")
    for filler in ("processing", "exchanges"):
        if len(keys) < 4:
            keys.append(filler)
    return [
        {"id": key, "content": POLICIES[key], "score": round(0.94 - 0.07 * rank, 2)}
        for rank, key in enumerate(keys)
    ]


def pick(rng: random.Random, split: str, *, electronics: bool | None = None, gift: bool = False):
    pool = [
        item
        for item in ITEMS[split]
        if (item[1] == "gift card") == gift
        and (electronics is None or (item[1] == "electronics") == electronics)
    ]
    return rng.choice(pool)


def late_days(rng: random.Random) -> int:
    return rng.randint(31, 34) if rng.random() < 0.3 else rng.randint(35, 75)


def scenario(kind: str, variant: int, rng: random.Random, split: str) -> dict[str, Any]:
    """Returns order facts, the agent's refund (0 for a denial), and its reason keys."""
    good, damaged = "good", "damaged"
    if kind in ("full_refund", "shipping_refunded"):
        electronics = rng.random() < 0.35
        item = pick(rng, split, electronics=electronics)
        facts = dict(item=item, final=False, days=rng.randint(2, 29), condition=good,
                     opened=False if electronics else rng.random() < 0.5)  # fmt: skip
        if kind == "full_refund":
            style = variant % 3
            if style == 1:
                facts["opened"] = False
            reasons = [["in_window"], ["unused"], ["standard"]][style]
            return {**facts, "refund": item[2], "reasons": reasons}
        return {
            **facts,
            "refund": money(item[2] + item[3]),
            "reasons": ["standard", "shipping_too"],
        }
    if kind in ("damaged_refund", "shipping_not_refunded"):
        electronics = rng.random() < 0.3
        item = pick(rng, split, electronics=electronics)
        facts = dict(item=item, final=False, days=rng.randint(1, 14), condition=damaged,
                     opened=False if electronics else rng.random() < 0.5)  # fmt: skip
        if kind == "damaged_refund":
            reasons = ["damaged"] if variant % 2 == 0 else ["standard", "shipping_too"]
            return {**facts, "refund": money(item[2] + item[3]), "reasons": reasons}
        # Same wordings as damaged_late_item_price, but the record shows a report within 14 days.
        reasons = ["damaged_late"] if variant % 2 == 0 else ["damaged_item_only"]
        return {**facts, "refund": item[2], "reasons": reasons}
    if kind in ("restocking_fee", "restocking_fee_skipped", "restocking_math"):
        item = pick(rng, split, electronics=True)
        facts = dict(item=item, final=False, days=rng.randint(2, 29), condition=good, opened=True)
        price, ship = item[2], item[3]
        if kind == "restocking_fee":
            reasons = ["restocking"] if variant % 2 == 0 else ["restocking_opened"]
            return {**facts, "refund": restocked(price), "reasons": reasons}
        if kind == "restocking_fee_skipped":
            reasons = ["standard"] if variant % 2 == 0 else ["unused"]
            return {**facts, "refund": price, "reasons": reasons}
        # A miscalculated fee: 15% of the item price plus shipping.
        refund = restocked(money(price + ship))
        return {**facts, "refund": refund, "fee": money(price + ship - refund),
                "reasons": ["restocking_opened"]}  # fmt: skip
    if kind in ("late_denied", "late_approved"):
        electronics = rng.random() < 0.3
        item = pick(rng, split, electronics=electronics)
        facts = dict(item=item, final=False, days=late_days(rng), condition=good,
                     opened=False if electronics else rng.random() < 0.5,
                     misstated=rng.random() < 0.5)  # fmt: skip
        if kind == "late_denied":
            reasons = ["late"] if variant % 2 == 0 else ["late_plain"]
            return {**facts, "refund": 0.0, "reasons": reasons}
        reasons = ["in_window"] if variant % 2 == 0 else ["standard"]
        return {**facts, "refund": item[2], "reasons": reasons}
    if kind in ("final_sale_denied", "final_sale_approved"):
        item = pick(rng, split)
        is_damaged = rng.random() < 0.35
        facts = dict(item=item, final=True,
                     days=rng.randint(1, 14) if is_damaged else rng.randint(2, 29),
                     condition=damaged if is_damaged else good,
                     opened=False if item[1] == "electronics" else rng.random() < 0.5)  # fmt: skip
        if kind == "final_sale_denied":
            return {**facts, "refund": 0.0, "reasons": ["final_sale"]}
        if is_damaged:
            return {**facts, "refund": money(item[2] + item[3]), "reasons": ["damaged"]}
        return {**facts, "refund": item[2], "reasons": ["standard"]}
    if kind in ("gift_card_denied", "gift_card_refunded"):
        item = pick(rng, split, gift=True)
        facts = dict(item=item, final=False, days=rng.randint(2, 29), condition=good, opened=False)
        if kind == "gift_card_denied":
            return {**facts, "refund": 0.0, "reasons": ["gift_card"]}
        return {**facts, "refund": item[2], "reasons": ["unused"]}
    if kind in ("damaged_late_item_price", "damaged_late_full"):
        # One damaged_late_full variant uses damaged_electronics' wording on opened
        # electronics, which owe a restocking fee once the 14 days have passed.
        no_fee = kind == "damaged_late_full" and variant % 2 == 0
        electronics = no_fee or rng.random() < 0.3
        item = pick(rng, split, electronics=electronics)
        facts = dict(item=item, final=False, days=rng.randint(16, 29), condition=damaged,
                     opened=no_fee or (not electronics and rng.random() < 0.5))  # fmt: skip
        if kind == "damaged_late_item_price":
            reasons = ["damaged_late"] if variant % 2 == 0 else ["damaged_item_only"]
            return {**facts, "refund": item[2], "reasons": reasons}
        reasons = ["damaged_no_fee"] if no_fee else ["damaged"]
        return {**facts, "refund": money(item[2] + item[3]), "reasons": reasons}
    if kind == "damaged_electronics":
        item = pick(rng, split, electronics=True)
        facts = dict(
            item=item, final=False, days=rng.randint(1, 14), condition=damaged, opened=True
        )
        return {**facts, "refund": money(item[2] + item[3]), "reasons": ["damaged_no_fee"]}
    if kind == "restocking_fee_misapplied":
        style = variant % 3
        if style == 0:  # unopened electronics
            item = pick(rng, split, electronics=True)
            facts = dict(
                item=item, final=False, days=rng.randint(2, 29), condition=good, opened=False
            )
            reasons = ["restocking_any"] if variant % 2 == 0 else ["restocking_opened"]
            return {**facts, "refund": restocked(item[2]), "reasons": reasons}
        if style == 1:  # opened, but not electronics
            item = pick(rng, split, electronics=False)
            facts = dict(
                item=item, final=False, days=rng.randint(2, 29), condition=good, opened=True
            )
            return {**facts, "refund": restocked(item[2]), "reasons": ["restocking"]}
        item = pick(rng, split, electronics=True)  # damaged electronics
        facts = dict(
            item=item, final=False, days=rng.randint(1, 14), condition=damaged, opened=True
        )
        return {**facts, "refund": money(restocked(item[2]) + item[3]),
                "reasons": ["damaged", "restocking"]}  # fmt: skip
    if kind == "wrongly_denied":
        # Gives the same reasons as late_denied and final_sale_denied, which the order
        # record doesn't support. The stated delivery age is a misread date.
        electronics = rng.random() < 0.3
        item = pick(rng, split, electronics=electronics)
        facts = dict(item=item, final=False, days=rng.randint(8, 29), condition=good,
                     opened=False if electronics else rng.random() < 0.5)  # fmt: skip
        style = variant % 3
        if style == 0:
            return {**facts, "refund": 0.0, "reasons": ["late"], "claimed_days": late_days(rng)}
        reason = "final_sale" if style == 1 else "late_plain"
        return {**facts, "refund": 0.0, "reasons": [reason]}
    raise ValueError(kind)


def make_case(
    kind: str, variant: int, index: int, split: str, rng: random.Random
) -> dict[str, Any]:
    facts = scenario(kind, variant, rng, split)
    item, category, price, ship = facts["item"]
    customer = NAMES[(index * 5 + len(split)) % len(NAMES)]
    first = customer.split()[0]
    order = Order(
        order_id=f"R-{(7300 if split == 'visible' else 8600) + index * 17}",
        customer=customer,
        item=item,
        category=category,
        price=price,
        shipping_paid=ship,
        final_sale=facts["final"],
        days_since_delivery=facts["days"],
        condition=facts["condition"],
        opened=facts["opened"],
    )
    allowed = policy_outcome(order)
    refund = facts["refund"]
    compliant = abs(allowed - refund) < 0.005
    assert compliant == (kind in COMPLIANT), (kind, order, refund, allowed)

    values = {
        "first": first,
        "item": item,
        "order_id": order.order_id,
        "days": facts.get("claimed_days", order.days_since_delivery),
        "ship": f"{ship:.2f}",
        "fee": f"{facts.get('fee', money(price * 0.15)):.2f}",
        "amount": f"{refund:.2f}",
    }

    def say(key: str) -> str:
        return rng.choice(SENTENCES[key][split]).format(**values)

    decision = say("approve") if refund > 0 else say("deny")
    reasons = [say(key) for key in facts["reasons"]]
    decision_first = refund == 0 or rng.random() < 0.5
    # A fee stated after the refund amount reads as if it came off that amount.
    if any(key.startswith("restocking") for key in facts["reasons"]):
        decision_first = False
    body = [decision, *reasons] if decision_first else [*reasons, decision]
    sentences = [say("greeting"), *body]
    if not WINDOW.search(" ".join(sentences)) and rng.random() < 0.45:
        sentences.append(say("reminder"))
    sentences.append(say("closing_approve") if refund > 0 else say("closing_deny"))
    reply = " ".join(sentences) + say("signoff")

    if category == "gift card":
        reason_key = "gift"
    elif order.condition == "damaged":
        reason_key = "damaged"
    elif order.opened:
        reason_key = "opened"
    else:
        reason_key = "unopened"
    said = [rng.choice(CUSTOMER_REASONS[reason_key][split]).format(**values)]
    true_claim = order.days_since_delivery in TRUE_CLAIM_DAYS[split] and rng.random() < 0.6
    if facts.get("misstated") or true_claim:
        said.append(rng.choice(CUSTOMER_REASONS["date_claim"][split]))
    request = rng.choice(REQUESTS[split]).format(reason=" ".join(said), **values)

    start = BASE + timedelta(hours=index * 2.3 + (24 * 9 if split == "unseen" else 0))
    trace = Trace(f"improve-judge:{split}:{index}", start=start, root_name="refund-agent")
    trace.tool("get_order", {"order_id": order.order_id}, order.record())
    documents = passages(order)
    trace.retrieve(request, documents)
    context = {"order": order.record(), "policies": [d["content"] for d in documents]}
    trace.llm(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": request},
            {"role": "user", "content": f"Context: {json.dumps(context)}"},
        ],
        reply,
    )
    trace.finish(request, reply)
    note = REVIEW_NOTES[kind].format(
        days=order.days_since_delivery, correct=f"{allowed:.2f}", stated=f"{refund:.2f}"
    )
    return {
        "trace_id": trace.trace_id,
        "root_id": trace.root_id,
        "spans": trace.spans,
        "kind": kind,
        "compliant": compliant,
        "reply": reply,
        "review_note": note,
    }


def build_split(split: str, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    column = 0 if split == "visible" else 1
    kinds = [(kind, n) for kind, counts in KINDS.items() for n in range(counts[column])]
    rng.shuffle(kinds)
    return [make_case(kind, n, i, split, rng) for i, (kind, n) in enumerate(kinds)]


def choose_reviewed(cases: list[dict[str, Any]]) -> set[str]:
    """Picks half of each kind for human review, alternating which side gets an odd one."""
    reviewed: set[str] = set()
    offset = 0
    for kind in KINDS:
        members = [case["trace_id"] for case in cases if case["kind"] == kind]
        reviewed.update(t for j, t in enumerate(members) if (j + offset) % 2 == 0)
        offset ^= len(members) % 2
    return reviewed


def judge_annotation(case: dict[str, Any]) -> dict[str, Any]:
    passed = starting_judge_label(case["reply"])
    return {
        "span_id": case["root_id"],
        "name": JUDGE,
        "annotator_kind": "LLM",
        "result": {
            "label": "pass" if passed else "fail",
            "score": float(passed),
            "explanation": (
                "The reply is polite and reminds the customer of the 30-day return window."
                if passed
                else "The reply is polite but doesn't mention the 30-day return window."
            ),
        },
    }


def review_annotation(case: dict[str, Any]) -> dict[str, Any]:
    return {
        "span_id": case["root_id"],
        "name": REVIEW,
        "annotator_kind": "HUMAN",
        "result": {
            "label": "compliant" if case["compliant"] else "noncompliant",
            "score": float(case["compliant"]),
            "explanation": case["review_note"],
        },
    }


def recall(cases: list[dict[str, Any]], predict: Any) -> str:
    good = [c for c in cases if c["compliant"]]
    bad = [c for c in cases if not c["compliant"]]
    good_hit = sum(predict(c) for c in good) / len(good)
    bad_hit = sum(not predict(c) for c in bad) / len(bad)
    return f"compliant recall {good_hit:.2f}, noncompliant recall {bad_hit:.2f}"


def main() -> None:
    visible = build_split("visible", seed=31)
    unseen = build_split("unseen", seed=47)
    reviewed = choose_reviewed(visible)
    hidden = [case for case in visible if case["trace_id"] not in reviewed]
    write_json(
        HERE / "spec.json",
        {
            "projects": {PROJECT: [span for case in visible for span in case["spans"]]},
            "span_annotations": [judge_annotation(case) for case in visible]
            + [review_annotation(case) for case in visible if case["trace_id"] in reviewed],
        },
    )
    write_json(
        HERE.parent / "tests" / "truth.json",
        {
            "project": PROJECT,
            "hidden": {
                "labels": {case["trace_id"]: case["compliant"] for case in hidden},
                "kinds": {case["trace_id"]: case["kind"] for case in hidden},
            },
            "unseen": {
                "spans": [span for case in unseen for span in case["spans"]],
                "labels": {case["trace_id"]: case["compliant"] for case in unseen},
                "kinds": {case["trace_id"]: case["kind"] for case in unseen},
            },
        },
    )
    reviewed_cases = [case for case in visible if case["trace_id"] in reviewed]
    for name, cases in (("reviewed", reviewed_cases), ("hidden", hidden), ("unseen", unseen)):
        counts = Counter("compliant" if c["compliant"] else "noncompliant" for c in cases)
        denials = sum(c["compliant"] and "denied" in c["kind"] for c in cases)
        print(f"{name}: {len(cases)} traces, {dict(counts)}, {denials} compliant denials")
        print(f"  starting judge: {recall(cases, lambda c: starting_judge_label(c['reply']))}")


if __name__ == "__main__":
    main()
