"""Build the refund-bot traces for `response-evals`.

Writes `fixture/spec.json` (the 60 production traces the agent sees) and
`tests/truth.json` (their labels, plus 40 unseen traces and labels that the verifier
adds before rerunning the agent's eval script). Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/response-evals/fixture/build.py

Each requirement fails independently on a fixed share of cases, so no requirement can
stand in for another. Unseen traces use some failure wordings the visible ones never
show, so an evaluator tuned to the visible text fails them.
"""

from __future__ import annotations

import json
import random
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "refund-bot"
CRITERIA = ("valid_format", "correct_amount", "no_pii_leak", "grounded")
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

# Claims a reply can make that no policy, order record, or tool result supports.
UNSUPPORTED = {
    "visible": [
        "You'll see the money back within 2 business days.",
        "We've also emailed you a prepaid return label.",
        "As a loyalty member, you can return items for up to 90 days.",
        "We've waived the restocking fee as a courtesy.",
        "Your replacement has already shipped.",
    ],
    "unseen": [
        "Our policy gives you 60 days to send items back.",
        "We've added a $10 store credit to your account for the trouble.",
        "You don't need to send the item back.",
        "Refunds for this item are instant once approved.",
        "We've upgraded your next order to free express shipping.",
    ],
}
LEAKS = {
    "visible": [
        "For reference, a similar ticket came from {email}.",
        "Our records show a similar ticket from {email}.",
    ],
    "unseen": [
        "One of the similar tickets lists the contact number {phone}.",
        "Similar tickets on file: {email}.",
    ],
}
BROKEN_FORMATS = {
    "visible": ["fence", "trailing_text", "string_amount"],
    "unseen": ["preamble", "plain_fence", "string_amount"],
}


def money(value: float) -> float:
    return round(value + 1e-9, 2)


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
        support = "Since it arrived damaged, we're refunding the item and the original shipping."
    elif scenario == "opened":
        refundable = money(price * 0.85)
        reason = "I opened it but it isn't what I wanted"
        policy_keys = ["restocking", "processing"]
        support = "Because the item was opened, the refund is minus our 15% restocking fee."
    else:
        refundable = money(price)
        reason = "I never used it and changed my mind"
        policy_keys = ["window", "processing"]
        support = "Unused items can be returned within 30 days of delivery, so you're covered."
    requested = money(price + shipping)
    order_id = f"A-{4100 + index * 13 + (500 if split == 'unseen' else 0)}"
    order = {
        "order_id": order_id,
        "customer_name": name,
        "customer_email": email,
        "item": item,
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
    documents = [
        {"id": key, "content": POLICIES[key], "score": round(0.92 - 0.11 * k, 2)}
        for k, key in enumerate(policy_keys + [rng.choice(["final_sale", "shipping"])])
    ]

    sentences = [
        f"Hi {name.split()[0]}, thanks for reaching out about your {item}.",
        support,
        "You'll see the refund on your original payment method within 5 to 7 business days.",
    ]
    if rng.random() < 0.4:
        sentences.append(f"We have {email} as the email on this order.")
    if "grounded" in defects:
        sentences.insert(2, rng.choice(UNSUPPORTED[split]))
    if "no_pii_leak" in defects:
        leak = rng.choice(LEAKS[split])
        target = similar[rng.randrange(2)]
        sentences.append(
            leak.format(
                email=target["customer_email"],
                phone=target["customer_phone"],
                name=target["customer_email"].split("@")[0],
            )
        )
    message = " ".join(sentences)
    if "correct_amount" in defects:
        amount = requested if requested != refundable else money(price)
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
    return {"trace_id": trace.trace_id, "spans": trace.spans, "labels": labels}


def build_split(split: str, count: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    rates = {"valid_format": 0.25, "correct_amount": 0.3, "no_pii_leak": 0.25, "grounded": 0.35}
    bad = {c: set(rng.sample(range(count), round(count * rate))) for c, rate in rates.items()}
    return [make_case(i, split, rng, {c for c in CRITERIA if i in bad[c]}) for i in range(count)]


def main() -> None:
    visible = build_split("visible", 60, seed=11)
    unseen = build_split("unseen", 40, seed=23)
    write_json(
        HERE / "spec.json",
        {"projects": {PROJECT: [span for case in visible for span in case["spans"]]}},
    )
    write_json(
        HERE.parent / "tests" / "truth.json",
        {
            "project": PROJECT,
            "visible": {case["trace_id"]: case["labels"] for case in visible},
            "unseen": {
                "spans": [span for case in unseen for span in case["spans"]],
                "labels": {case["trace_id"]: case["labels"] for case in unseen},
            },
        },
    )
    for name, cases in (("visible", visible), ("unseen", unseen)):
        counts = {c: sum(not case["labels"][c] for case in cases) for c in CRITERIA}
        print(name, len(cases), "failing per requirement:", counts)


if __name__ == "__main__":
    main()
