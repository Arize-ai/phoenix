"""Builds the refund-bot traces and hidden answers for `response-evals`.

Run from the repository root:

    uv run python evals/harbor/datasets/eval-workflows/tasks/response-evals/fixture/build.py
"""

from __future__ import annotations

import json
import random
import re
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "refund-bot"
CRITERIA = ("valid_format", "correct_amount", "no_pii_leak", "grounded")
FAIL_RATES = {"valid_format": 0.25, "correct_amount": 0.3, "no_pii_leak": 0.25, "grounded": 0.35}
MIN_RECALL = {"valid_format": 0.9, "correct_amount": 0.9, "no_pii_leak": 0.9, "grounded": 0.8}
MIN_COVERAGE = 0.95
SYSTEM_PROMPT = (HERE.parent / "workdir" / "refund_bot.py").read_text().split('"""')[3].strip()

POLICIES = {
    "window": "Unused items can be returned for a full refund within 30 days of delivery.",
    "final_sale": "Items marked final sale can't be returned or refunded.",
    "damaged": (
        "Items that arrive damaged are refunded in full, including original shipping, "
        "if reported within 14 days of delivery."
    ),
    "processing": (
        "Approved refunds go back to the original payment method within 5 to 7 business days."
    ),
    "restocking": "Opened electronics are refunded minus a 15% restocking fee.",
    "shipping": (
        "Original shipping costs are refunded only when the item arrived damaged or was "
        "the wrong item."
    ),
}
ITEMS = [
    ("trail running shoes", 89.0, False),
    ("rain jacket", 129.0, False),
    ("wireless earbuds", 79.0, True),
    ("camping stove", 64.5, False),
    ("smart watch", 199.0, True),
    ("wool sweater", 74.0, False),
    ("bluetooth speaker", 59.99, True),
    ("hiking backpack", 112.0, False),
    ("headlamp", 34.5, True),
    ("insulated bottle", 28.0, False),
]
NAMES = [
    ("Maria Lopez", "maria.lopez"), ("Dev Patel", "dev.patel"), ("Sam Okafor", "sam.okafor"),
    ("Lena Fischer", "lena.f"), ("Tom Nguyen", "tnguyen"), ("Aisha Khan", "aisha.k"),
    ("Jonas Berg", "jberg"), ("Chloe Martin", "chloe.m"), ("Ravi Iyer", "ravi.iyer"),
    ("Grace Kim", "gkim"), ("Omar Haddad", "o.haddad"), ("Nina Rossi", "nina.rossi"),
]  # fmt: skip
DOMAINS = ["example.com", "example.org", "example.net", "mail.example.com"]

UNSUPPORTED_CLAIMS = {
    "visible": [
        ("timeline", "You'll see the money back within 2 business days."),
        ("approval", "We've also emailed you a prepaid return label."),
        ("delivery", "As a loyalty member, you can return items for up to 90 days."),
        ("fee", "We've waived the restocking fee as a courtesy."),
        ("delivery", "Your replacement has already shipped."),
    ],
    "unseen": [
        ("delivery", "Our policy gives you 60 days to send items back."),
        ("approval", "We've added a $10 store credit to your account for the trouble."),
        ("approval", "You don't need to send the item back."),
        ("timeline", "Refunds for this item are instant once approved."),
        ("shipping", "We've upgraded your next order to free express shipping."),
    ],
}
# Passing and leaking replies share these wordings, so only whose contact it is decides
# the label.
TICKET_CONTACTS = {
    "visible": [
        "For reference, a similar ticket came from {contact}.",
        "Our records show a similar ticket from {contact}.",
    ],
    "unseen": [
        "One of the similar tickets lists {contact} as the contact.",
        "A similar ticket lists {contact} in its customer contact field.",
    ],
}
UNSEEN_PHONE_LEAK_RATE = 0.5
OWN_TICKET_RATE = 0.5
QUOTE_OWN_TICKET_RATE = 0.8
ORDER_EMAIL_RATE = 0.4
BROKEN_FORMATS = {
    "visible": ["fence", "trailing_text", "string_amount"],
    "unseen": ["preamble", "plain_fence", "string_amount"],
}
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"\b\d{3}-\d{3}-\d{4}\b")
UNSUPPORTED = [claim for claims in UNSUPPORTED_CLAIMS.values() for _, claim in claims]


def money(value: float) -> float:
    return round(value + 1e-9, 2)


def supported_claims(
    split: str,
    scenario: str,
    item: str,
    order_id: str,
    days: int,
    documents: list[dict[str, Any]],
) -> dict[str, str]:
    """Returns claims the order record and retrieved policies back, keyed by topic."""
    if scenario == "damaged" and split == "visible":
        delivery = (
            "Damaged items are covered if reported within 14 days of delivery, and yours was "
            f"delivered {days} days ago."
        )
    elif scenario == "damaged":
        delivery = f"You reported the damage within 14 days; the order arrived {days} days ago."
    elif split == "visible":
        delivery = f"Our records show your {item} was delivered {days} days ago."
    else:
        delivery = f"The order record dates delivery of your {item} to {days} days ago."
    claims = (
        {
            "timeline": (
                "You'll see the refund on your original payment method within 5 to 7 business days."
            ),
            "approval": f"We've approved the refund for order {order_id}.",
            "delivery": delivery,
        }
        if split == "visible"
        else {
            "timeline": (
                "Approved refunds return to the payment method used for the order in 5 to 7 business days."
            ),
            "approval": f"Order {order_id} has an approved refund.",
            "delivery": delivery,
        }
    )
    if any(document["id"] == "shipping" for document in documents):
        claims["shipping"] = (
            "Original shipping is refunded only when an item arrives damaged or is the wrong item."
            if split == "visible"
            else "The original delivery charge is returned only for damage or a wrong item."
        )
    return claims


def supported_reason(split: str, scenario: str) -> str:
    """Returns the policy-backed reason for the approved amount."""
    reasons = {
        "damaged": {
            "visible": (
                "Since it arrived damaged, we're refunding the item and the original shipping."
            ),
            "unseen": (
                "This damaged-item refund includes both the purchase price and the original "
                "delivery charge."
            ),
        },
        "opened": {
            "visible": ("Because the item was opened, the refund is minus our 15% restocking fee."),
            "unseen": (
                "For this opened electronics return, the approved amount includes the 15% "
                "deduction."
            ),
        },
        "unused": {
            "visible": (
                "Unused items can be returned within 30 days of delivery, so you're covered."
            ),
            "unseen": (
                "An unused return inside the 30-day window qualifies for its purchase-price refund."
            ),
        },
    }
    return reasons[scenario][split]


def write_message(
    *,
    split: str,
    rng: random.Random,
    defects: set[str],
    greeting: str,
    core: str,
    claims: dict[str, str],
    own_email: str,
    own_ticket: dict[str, Any] | None,
    other_ticket: dict[str, Any],
) -> str:
    """Returns the reply message, with one supported claim swapped for an unsupported one
    when `grounded` fails, so sentence count and position don't reveal the label."""
    topics = rng.sample(sorted(claims), rng.choice((1, 2, 3)))
    body = [claims[topic] for topic in topics]
    if "grounded" in defects:
        slot = rng.randrange(len(topics))
        kept = set(topics) - {topics[slot]}
        body[slot] = rng.choice([c for t, c in UNSUPPORTED_CLAIMS[split] if t not in kept])
    body.append(core)
    rng.shuffle(body)

    contacts = []
    if rng.random() < ORDER_EMAIL_RATE:
        contacts.append(f"We have {own_email} as the email on this order.")
    template = rng.choice(TICKET_CONTACTS[split])
    if "no_pii_leak" in defects:
        phone = split == "unseen" and rng.random() < UNSEEN_PHONE_LEAK_RATE
        field = "customer_phone" if phone else "customer_email"
        contacts.append(template.format(contact=other_ticket[field]))
    elif own_ticket is not None and rng.random() < QUOTE_OWN_TICKET_RATE:
        contacts.append(template.format(contact=own_ticket["customer_email"]))
    rng.shuffle(contacts)
    return " ".join([greeting, *body, *contacts])


def make_case(index: int, split: str, rng: random.Random, defects: set[str]) -> dict[str, Any]:
    name, handle = NAMES[index % len(NAMES)]
    email = f"{handle}@{DOMAINS[index % len(DOMAINS)]}"
    item, price, electronics = ITEMS[(index * 7 + len(split)) % len(ITEMS)]
    shipping = 7.95
    scenario = rng.choice(["unused", "damaged", "opened"] if electronics else ["unused", "damaged"])
    delivered_days_ago = rng.randint(2, 12)
    if scenario == "damaged":
        refundable = money(price + shipping)
        reason = "It arrived damaged"
        policy_keys = ["damaged", "processing"]
    elif scenario == "opened":
        refundable = money(price * 0.85)
        reason = "I opened it but it isn't what I wanted"
        policy_keys = ["restocking", "processing"]
    else:
        refundable = money(price)
        reason = "I never used it and changed my mind"
        policy_keys = ["window", "processing"]
    # What the customer asks for doesn't depend on what they're owed.
    requested = rng.choice([money(price), money(price + shipping)])
    order_id = f"A-{4100 + index * 13 + (500 if split == 'unseen' else 0)}"
    order = {
        "order_id": order_id,
        "customer_name": name,
        "customer_email": email,
        "item": item,
        "category": "electronics" if electronics else "general merchandise",
        "item_price": price,
        "shipping_paid": shipping,
        "status": "delivered",
        "delivered_days_ago": delivered_days_ago,
        "condition_reported": scenario,
        "refundable_amount": refundable,
        "refund_status": "approved",
    }
    others = [
        (NAMES[(index + 3) % len(NAMES)], DOMAINS[(index + 1) % len(DOMAINS)], "555-201-88"),
        (NAMES[(index + 5) % len(NAMES)], DOMAINS[(index + 2) % len(DOMAINS)], "555-417-30"),
    ]
    similar = [
        {
            "ticket_id": f"T-{9000 + index * 2 + k}",
            "customer_email": f"{other[1]}@{domain}",
            "customer_phone": f"{phone}{10 + index % 80:02d}",
            "summary": f"Refund request for {item}, resolved",
        }
        for k, (other, domain, phone) in enumerate(others)
    ]
    own_ticket = None
    if rng.random() < OWN_TICKET_RATE:
        slot = rng.randrange(2)
        own_ticket = {
            **similar[slot],
            "customer_email": email,
            "customer_phone": f"555-630-{1000 + index * 37 % 9000:04d}",
        }
        similar[slot] = own_ticket
    others_tickets = [ticket for ticket in similar if ticket is not own_ticket]
    documents = [
        {"id": key, "content": POLICIES[key], "score": round(0.92 - 0.11 * k, 2)}
        for k, key in enumerate(policy_keys + [rng.choice(["final_sale", "shipping"])])
    ]

    message = write_message(
        split=split,
        rng=rng,
        defects=defects,
        greeting=f"Hi {name.split()[0]}, thanks for reaching out about your {item}.",
        core=supported_reason(split, scenario),
        claims=supported_claims(split, scenario, item, order_id, delivered_days_ago, documents),
        own_email=email,
        own_ticket=own_ticket,
        other_ticket=rng.choice(others_tickets),
    )
    if "correct_amount" in defects:
        # Chosen without looking at what the customer asked for.
        miscalculations = [money(price), money(price + shipping), money(price * 0.85)]
        amount = rng.choice([value for value in miscalculations if value != refundable])
    else:
        amount = refundable
    reply_object: dict[str, Any] = {"refund_amount": amount, "message": message}
    reply = json.dumps(reply_object)
    if "valid_format" in defects:
        style = rng.choice(BROKEN_FORMATS[split])
        if style == "fence":
            reply = f"```json\n{reply}\n```"
        elif style == "trailing_text":
            reply = reply + "\nLet me know if you need anything else!"
        elif style == "preamble":
            reply = "Here is the reply to send:\n" + reply
        elif style == "plain_fence":
            reply = f"```\n{reply}\n```"
        else:
            reply = json.dumps({"refund_amount": f"${amount:.2f}", "message": message})

    customer_message = (
        f"Hi, I'd like a refund for my {item} (order {order_id}). {reason}. "
        f"Can I get ${requested:.2f} back?"
    )
    start = BASE + timedelta(hours=index * 2.7 + (24 * 9 if split == "unseen" else 0))
    trace = Trace(f"response-evals:{split}:{index}", start=start, user_id=email)
    trace.tool("get_order", {"order_id": order_id}, order)
    trace.retrieve(f"refund policy {scenario} {item}", documents)
    trace.tool("find_similar_tickets", {"order_id": order_id, "limit": 2}, similar)
    context = json.dumps(
        {"order": order, "policies": [d["content"] for d in documents], "similar": similar}
    )
    trace.llm(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": customer_message},
            {"role": "user", "content": f"Context: {context}"},
        ],
        reply,
    )
    trace.finish(customer_message, reply)
    labels = {criterion: criterion not in defects for criterion in CRITERIA}
    check_labels(labels, reply, message, order)
    return {"trace_id": trace.trace_id, "spans": trace.spans, "labels": labels}


def check_labels(labels: dict[str, bool], reply: str, message: str, order: dict[str, Any]) -> None:
    """Asserts that each label follows from the reply, the order record, and the list of
    unsupported claims."""
    try:
        strict = json.loads(reply)
    except ValueError:
        strict = None
    assert labels["valid_format"] == (
        isinstance(strict, dict)
        and type(strict["refund_amount"]) in (int, float)
        and isinstance(strict["message"], str)
    )
    stated = json.loads(reply[reply.index("{") : reply.rindex("}") + 1])["refund_amount"]
    amount = float(str(stated).lstrip("$"))
    assert labels["correct_amount"] == (abs(amount - order["refundable_amount"]) < 0.005)
    others = set(EMAIL.findall(message)) - {order["customer_email"]}
    assert labels["no_pii_leak"] == (not others and not PHONE.search(message))
    assert sum(claim in message for claim in UNSUPPORTED) == (0 if labels["grounded"] else 1)


def build_split(split: str, count: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    bad = {c: set(rng.sample(range(count), round(count * r))) for c, r in FAIL_RATES.items()}
    return [make_case(i, split, rng, {c for c in CRITERIA if i in bad[c]}) for i in range(count)]


def failing(cases: list[dict[str, Any]]) -> dict[str, int]:
    return {c: sum(not case["labels"][c] for case in cases) for c in CRITERIA}


def main() -> None:
    sample_documents = [{"id": "shipping"}]
    for scenario in ("damaged", "opened", "unused"):
        visible = set(
            supported_claims("visible", scenario, "item", "A-1", 3, sample_documents).values()
        ) | {supported_reason("visible", scenario)}
        unseen = set(
            supported_claims("unseen", scenario, "item", "A-1", 3, sample_documents).values()
        ) | {supported_reason("unseen", scenario)}
        assert visible.isdisjoint(unseen), scenario
    visible = build_split("visible", 60, seed=11)
    unseen = build_split("unseen", 40, seed=23)
    write_json(
        HERE / "phoenix_seed.json",
        {"projects": {PROJECT: [span for case in visible for span in case["spans"]]}},
    )
    production, new = failing(visible), failing(unseen)
    most, *rest = sorted(CRITERIA, key=lambda c: -production[c])
    write_json(
        HERE.parent / "tests" / "expected.json",
        {
            "reference": (
                "The pass or fail annotations for the four requirements agree with the hidden "
                f"labels, within the recall bars below, on the {len(visible)} production traces "
                f"and on the {len(unseen)} new traces the nightly script scores. On the "
                f"production traces, {most} fails most often ({production[most]} of "
                f"{len(visible)}), then "
                + ", ".join(f"{c} ({production[c]})" for c in rest[:-1])
                + f", and {rest[-1]} ({production[rest[-1]]})."
            ),
            "min_coverage": MIN_COVERAGE,
            "min_recall": MIN_RECALL,
            "production_traces": {"traces": len(visible), "failing": production},
            "new_traces": {"traces": len(unseen), "failing": new},
        },
    )
    write_json(
        HERE.parent / "tests" / "grading_data.json",
        {
            "production_traces": {"labels": {case["trace_id"]: case["labels"] for case in visible}},
            "new_traces": {
                "spans": [span for case in unseen for span in case["spans"]],
                "labels": {case["trace_id"]: case["labels"] for case in unseen},
            },
        },
    )
    print("Failing per requirement:", {"production": production, "new": new})


if __name__ == "__main__":
    main()
