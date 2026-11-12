"""Build the support-bot traces for `repair-evals`.

Writes `fixture/spec.json` (the 60 traces the agent sees) and `tests/truth.json` (their
`grounded` labels, plus 28 unseen traces and labels that the verifier adds before
rerunning the nightly script). Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/repair-evals/fixture/build.py

About a third of replies make exactly one claim that no tool result or help center
article supports: an action the bot never took, a policy no article states, or a date,
scan, or status that contradicts the tracking data. About a third of messages arrive by
email, whose payload has `subject` and `body` instead of `message`; the shipped script
crashes on those and records `pass`. Email and defects are assigned independently.

In two visible traces, `track_shipment` times out and the bot sends a canned apology
with a root span status of `ERROR`. They aren't graded. One of them falls inside the 100
newest spans, the only ones the shipped script scores, and that script marks errored
traces `fail`, so it reports 20 of 21 replies grounded (95%).

Unseen traces use claim wordings and claim types that the visible traces never show.
"""

from __future__ import annotations

import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "support-bot"
SYSTEM_PROMPT = (HERE.parent / "workdir" / "support_bot.py").read_text().split('"""')[3].strip()
SCENARIOS = (
    "where",
    "eta",
    "address_processing",
    "address_shipped",
    "stalled",
    "not_shipped",
    "delivered_missing",
)
# The shipped script fetches spans with the client's default limit of 100.
DEFAULT_SPAN_LIMIT = 100

NAMES = [
    "Ana Ruiz", "Ben Carter", "Priya Shah", "Marcus Lee", "Hannah Weiss", "Diego Morales",
    "Fatima Noor", "Owen Brooks", "Mei Chen", "Lucas Silva", "Zoe Adams", "Kwame Mensah",
    "Ingrid Larsen", "Rafael Costa",
]  # fmt: skip
ITEMS = [
    "linen duvet cover", "cast iron skillet", "ceramic table lamp", "wool throw blanket",
    "walnut cutting board", "stoneware dinner set", "rattan floor mirror", "copper kettle",
    "bamboo bath mat", "velvet throw pillows",
]  # fmt: skip
HUBS = [
    "Louisville, KY", "Memphis, TN", "Indianapolis, IN", "Reno, NV", "Columbus, OH",
    "Allentown, PA", "Kansas City, MO", "Salt Lake City, UT", "Atlanta, GA", "Denver, CO",
]  # fmt: skip
DESTINATIONS = [
    ("Portland", "OR", "97214"), ("Austin", "TX", "78704"), ("Madison", "WI", "53703"),
    ("Raleigh", "NC", "27601"), ("Boise", "ID", "83702"), ("Tucson", "AZ", "85719"),
    ("Burlington", "VT", "05401"), ("Omaha", "NE", "68102"),
]  # fmt: skip
STREETS = ["Alder St", "Birch Ave", "Cedar Ln", "Dogwood Dr", "Elm Ct", "Fir Way"]
EVENTS = ["Departed facility", "Arrived at facility", "In transit", "Processed at hub"]
NOTES = ["Left at front door", "Left in mailroom", "Left at side door", "Handed to resident"]

ARTICLES = {
    "delivery-estimates": (
        "Delivery estimates come from the carrier and can change while a package is in "
        "transit. Standard shipping usually takes 3 to 5 business days after an order "
        "ships, and expedited shipping takes 1 to 2 business days."
    ),
    "tracking-paused": (
        "Tracking can pause for a few days while a package moves between carrier "
        "facilities. If tracking hasn't updated in 5 business days, reply to your support "
        "conversation and we'll open a trace with the carrier."
    ),
    "change-address": (
        "You can change the shipping address while an order is still processing: go to "
        "Orders, select the order, and choose Edit address. Once an order has shipped, we "
        "can't change its address."
    ),
    "carrier-redirect": (
        "After an order ships, you can ask the carrier to redirect it to a different address "
        "from the carrier's tracking page. Carriers may charge a fee for redirects."
    ),
    "processing-time": (
        "Orders usually ship within 2 business days of being placed. When an order ships, "
        "we email you its tracking number."
    ),
    "delivered-not-found": (
        "If tracking says your package was delivered but you can't find it, check around "
        "your entrance and with neighbors, and allow 24 hours, since carriers sometimes "
        "mark packages delivered early. If it still hasn't arrived, reply to your support "
        "conversation and we'll help."
    ),
    "cancel-order": (
        "You can cancel an order from the Orders page while it's still processing. Orders "
        "that have shipped can't be canceled, but you can return them after delivery."
    ),
    "returns": "Most items can be returned within 30 days of delivery for a full refund.",
    "gift-wrap": "Gift wrap can be added at checkout for $5 per item.",
}
RELEVANT_ARTICLES = {
    "where": ["delivery-estimates", "tracking-paused"],
    "eta": ["delivery-estimates", "processing-time"],
    "address_processing": ["change-address", "processing-time"],
    "address_shipped": ["change-address", "carrier-redirect"],
    "stalled": ["tracking-paused", "delivery-estimates"],
    "not_shipped": ["processing-time", "cancel-order"],
    "delivered_missing": ["delivered-not-found", "returns"],
}
DISTRACTORS = ["returns", "gift-wrap", "cancel-order"]

# One unsupported claim per defective reply. ("insert", text) adds a sentence;
# ("replace", slot, text) swaps the sentence in that slot for a contradicting one.
CLAIMS: dict[str, dict[str, list[tuple[str, ...]]]] = {
    "visible": {
        "where": [
            ("insert", "It's already out for delivery, so it should reach you this evening."),
            ("insert", "I've asked {carrier} to give it priority handling so it arrives sooner."),
            ("replace", "eta", "{carrier} expects to deliver it on {early_eta}."),
        ],
        "eta": [
            ("insert", "If it isn't there by {eta}, we'll refund your shipping automatically."),
            ("insert", "We guarantee delivery within 3 business days of shipping."),
            ("replace", "eta", "{carrier} currently estimates that order {oid} will arrive on {early_eta}."),
        ],
        "address_processing": [
            ("insert", "I've gone ahead and updated the address to {new_street} for you."),
            ("insert", "I've also upgraded the order to expedited shipping at no extra cost."),
        ],
        "address_shipped": [
            ("replace", "fee", "Redirects are free within 24 hours of shipping, so there's no charge."),
            ("insert", "I've already sent the redirect request to {carrier} for you."),
        ],
        "stalled": [
            ("replace", "next", "I've already opened a trace with {carrier}, and they'll email you within 24 hours."),
            ("insert", "Packages that stall like this almost always turn up within 2 days."),
        ],
        "not_shipped": [
            ("insert", "It's packed and the carrier will pick it up tonight."),
            ("insert", "I've moved your order to the front of the packing queue."),
        ],
        "delivered_missing": [
            ("insert", "I've already sent a replacement, and it ships tomorrow."),
            ("insert", "The driver's delivery photo shows it at your side door."),
        ],
    },
    "unseen": {
        "where": [
            ("insert", "The package is insured for its full value, so you're covered if anything happens to it."),
            ("replace", "scan", "It was last scanned in {wrong_hub} on {scan_date}."),
        ],
        "eta": [
            ("insert", "You'll get a text from {carrier} about 30 minutes before the driver arrives."),
            ("insert", "Orders placed before noon ship the same day, and yours made the cutoff."),
        ],
        "address_processing": [
            ("insert", "Address changes can take up to 48 hours to show on your order."),
            ("insert", "I've emailed you a link to confirm the new address."),
        ],
        "address_shipped": [
            ("insert", "If the redirect doesn't work, we'll reship it to your new address for free."),
            ("insert", "{carrier} will hold it at your nearest pickup point for 7 days in the meantime."),
        ],
        "stalled": [
            ("insert", "If it turns out to be lost, we'll send a replacement right away."),
            ("replace", "scan", "It was scanned at your local delivery station this morning, so it's nearly there."),
        ],
        "not_shipped": [
            ("insert", "Processing is taking about a week right now because of high demand."),
            ("insert", "We'll send you a 10% discount code for the wait."),
        ],
        "delivered_missing": [
            ("insert", "{carrier} confirmed that a neighbor signed for it."),
            ("insert", "We've filed a claim with {carrier}, so your refund will arrive within 3 days."),
        ],
    },
}  # fmt: skip

QUESTIONS = {
    "where": [
        "Where's my order {oid}?",
        "hi, can you tell me where order {oid} is? it's been a few days",
        "Any update on order {oid}? I haven't gotten it yet.",
    ],
    "eta": [
        "When will order {oid} arrive?",
        "What's the delivery date for order {oid}?",
        "hey, when should I expect my {item}? order {oid}",
    ],
    "address": [
        "I just moved. Can you change the address on order {oid} to {new_address}?",
        "Oops, I put my old address on order {oid}. Can it go to {new_address} instead?",
    ],
    "stalled": [
        "Tracking for order {oid} hasn't changed in over a week. What's going on?",
        "My package for order {oid} seems stuck. Tracking hasn't moved in days.",
    ],
    "not_shipped": [
        "Has order {oid} shipped yet?",
        "I ordered a {item} a few days ago (order {oid}). When does it ship?",
    ],
    "delivered_missing": [
        "Tracking says order {oid} was delivered but there's nothing here.",
        "My {item} shows as delivered but I never got it. Order {oid}.",
    ],
}
SUBJECTS = {
    "where": ["Where is my order?", "Order {oid} status"],
    "eta": ["Delivery date for {oid}", "When will my order arrive?"],
    "address": ["Address change for order {oid}", "Wrong shipping address"],
    "stalled": ["Package stuck in transit", "Tracking not updating"],
    "not_shipped": ["Has my order shipped?", "Order {oid}"],
    "delivered_missing": ["Package marked delivered but missing", "Missing package"],
}


def day(value: date) -> str:
    return f"{value:%B} {value.day}"


def clock(value: datetime) -> str:
    return value.strftime("%I:%M %p").lstrip("0")


def tracking_number(carrier: str, rng: random.Random) -> str:
    if carrier == "UPS":
        return "1Z" + "".join(rng.choice("0123456789ABCDEFGHJKLMNPRTVWXY") for _ in range(16))
    if carrier == "FedEx":
        return "".join(rng.choice("0123456789") for _ in range(12))
    return "9400" + "".join(rng.choice("0123456789") for _ in range(18))


def grounded_sentences(scenario: str, f: dict[str, Any], variant: int) -> list[tuple[str, str]]:
    """Returns (slot, sentence) pairs that only restate what the bot looked up."""
    first = f["first"]
    if scenario == "where" and variant == 0:
        return [
            ("greet", f"Hi {first}!"),
            ("shipped", f"Your order {f['oid']} shipped on {f['shipped']} with {f['carrier']}."),
            ("scan", f"It was last scanned in {f['hub']} on {f['scan_date']}."),
            ("eta", f"{f['carrier']} estimates delivery on {f['eta']}."),
            ("tn", f"You can follow it with tracking number {f['tn']}."),
        ]
    if scenario == "where":
        return [
            ("greet", f"Hi {first}, order {f['oid']} is on its way."),
            (
                "scan",
                f"It shipped with {f['carrier']} on {f['shipped']}, and the latest tracking "
                f'update is "{f["event"]}" in {f["hub"]} on {f["scan_date"]}.',
            ),
            ("eta", f"The current delivery estimate is {f['eta']}."),
            ("tn", f"Your tracking number is {f['tn']}."),
        ]
    if scenario == "eta":
        return [
            ("greet", f"Hi {first}!" if variant == 0 else f"Thanks for checking in, {first}."),
            ("eta", f"{f['carrier']} currently estimates that order {f['oid']} will arrive on {f['eta']}."),
            ("scan", f"The package was last scanned in {f['hub']} on {f['scan_date']}."),
            ("caveat", "Delivery estimates come from the carrier and can change while a package is in transit."),
        ]  # fmt: skip
    if scenario == "address_processing":
        return [
            ("greet", f"Hi {first}, happy to help with the address."),
            ("status", f"Order {f['oid']} is still processing, so you can change the address yourself."),
            ("how", f"Go to Orders, select {f['oid']}, and choose Edit address."),
            ("limit", "Once the order ships, we won't be able to change its address."),
        ]  # fmt: skip
    if scenario == "address_shipped":
        return [
            ("greet", f"Hi {first}, thanks for the heads-up."),
            ("status", f"Order {f['oid']} already shipped with {f['carrier']} on {f['shipped']}, so we can't change its address."),
            ("how", f"You can ask {f['carrier']} to redirect it from their tracking page using tracking number {f['tn']}."),
            ("fee", f"{f['carrier']} may charge a fee for the redirect."),
        ]  # fmt: skip
    if scenario == "stalled":
        return [
            ("greet", f"Hi {first}, I'm sorry for the wait."),
            ("scan", f'The last update for order {f["oid"]} was "{f["event"]}" in {f["hub"]} on {f["scan_date"]}.'),
            ("gap", f"{f['carrier']} isn't showing a delivery estimate right now, and tracking hasn't updated in {f['stale_days']} business days."),
            ("next", f"Please reply to this conversation and we'll open a trace with {f['carrier']}."),
        ]  # fmt: skip
    if scenario == "not_shipped":
        return [
            ("greet", f"Hi {first}!"),
            ("status", f"Order {f['oid']} was placed on {f['placed']} and is still processing, so it hasn't shipped yet."),
            ("timing", "Orders usually ship within 2 business days of being placed."),
            ("email", "We'll email you the tracking number as soon as it ships."),
        ]  # fmt: skip
    return [
        ("greet", f"Hi {first}, I'm sorry it hasn't turned up."),
        ("status", f'{f["carrier"]} marked order {f["oid"]} as delivered on {f["delivered_date"]} at {f["delivered_time"]}, with the note "{f["note"]}".'),
        ("check", "Please check around your entrance and with neighbors, and give it 24 hours, since carriers sometimes mark packages delivered early."),
        ("next", "If it still hasn't arrived after that, reply to this conversation and we'll help."),
    ]  # fmt: skip


def make_case(
    index: int,
    split: str,
    rng: random.Random,
    scenario: str,
    channel: str,
    claim: tuple[str, ...] | None,
    errored: bool,
) -> dict[str, Any]:
    start = BASE + timedelta(hours=index * 1.1 + (24 * 9 if split == "unseen" else 0))
    today = start.date()
    name = NAMES[(index * 5 + len(split)) % len(NAMES)]
    first = name.split()[0]
    item = ITEMS[(index * 3 + len(split)) % len(ITEMS)]
    oid = f"LH-{30117 + index * 41 + (5000 if split == 'unseen' else 0)}"
    carrier = rng.choice(["UPS", "FedEx", "USPS"])
    tn = tracking_number(carrier, rng)
    city, state, postal = DESTINATIONS[index % len(DESTINATIONS)]
    hub = rng.choice(HUBS)
    shipped = scenario not in ("address_processing", "not_shipped")
    placed = today - timedelta(days=rng.randint(1, 2) if not shipped else rng.randint(4, 7))
    if scenario == "stalled":
        placed = today - timedelta(days=rng.randint(13, 16))
    shipped_on = placed + timedelta(days=1)
    scan_time = start.replace(tzinfo=None) - timedelta(
        hours=rng.randint(3, 30), minutes=rng.randint(0, 59)
    )
    if scenario == "stalled":
        scan_time = datetime.combine(shipped_on + timedelta(days=1), scan_time.time())
    eta = today + timedelta(days=rng.randint(2, 4))
    delivered_at = datetime.combine(today - timedelta(days=1), datetime.min.time()) + timedelta(
        hours=rng.randint(10, 18), minutes=rng.randint(0, 59)
    )
    new_address = f"{rng.randint(12, 980)} {rng.choice(STREETS)}, {city}, {state} {postal}"
    facts = {
        "first": first,
        "oid": oid,
        "carrier": carrier,
        "tn": tn,
        "hub": hub,
        "wrong_hub": rng.choice([h for h in HUBS if h != hub]),
        "event": rng.choice(EVENTS),
        "shipped": day(shipped_on),
        "placed": day(placed),
        "scan_date": day(scan_time.date()),
        "eta": day(eta),
        "early_eta": day(eta - timedelta(days=2)),
        "stale_days": 0,
        "delivered_date": day(delivered_at.date()),
        "delivered_time": clock(delivered_at),
        "note": rng.choice(NOTES),
        "new_street": new_address.split(",")[0],
        "item": item,
        "new_address": new_address,
    }
    if scenario == "stalled":
        stale = sum(
            (scan_time.date() + timedelta(days=k)).weekday() < 5
            for k in range(1, (today - scan_time.date()).days + 1)
        )
        facts["stale_days"] = stale

    order = {
        "order_id": oid,
        "customer_name": name,
        "status": "processing"
        if not shipped
        else ("delivered" if scenario == "delivered_missing" else "shipped"),
        "placed_on": placed.isoformat(),
        "items": [{"name": item, "quantity": 1}],
        "shipping_method": "standard",
        "ship_to": {"city": city, "state": state, "postal_code": postal},
        "carrier": carrier if shipped else None,
        "tracking_number": tn if shipped else None,
        "shipped_on": shipped_on.isoformat() if shipped else None,
    }
    tracking: dict[str, Any] | None = None
    if shipped and scenario == "delivered_missing":
        tracking = {
            "tracking_number": tn,
            "carrier": carrier,
            "status": "delivered",
            "delivered_at": delivered_at.isoformat(),
            "delivery_note": facts["note"],
        }
    elif shipped:
        tracking = {
            "tracking_number": tn,
            "carrier": carrier,
            "status": "in_transit",
            "estimated_delivery": None if scenario == "stalled" else eta.isoformat(),
            "last_event": {
                "description": facts["event"],
                "location": hub,
                "time": scan_time.isoformat(),
            },
        }
        if scenario == "stalled":
            tracking["business_days_since_last_event"] = facts["stale_days"]

    topic = "address" if scenario.startswith("address") else scenario
    question = rng.choice(QUESTIONS[topic]).format(**facts)
    if channel == "email":
        subject = rng.choice(SUBJECTS[topic]).format(**facts)
        body = f"Hi,\n\n{question}\n\nThanks,\n{first}"
        payload: dict[str, Any] = {"channel": "email", "subject": subject, "body": body}
        question_text = f"Subject: {subject}\n\n{body}"
    else:
        payload = {"channel": "chat", "message": question}
        question_text = question

    trace = Trace(
        f"repair-evals:{split}:{index}",
        start=start,
        root_name="handle_message",
        metadata={"channel": channel},
    )
    trace.tool("lookup_order", {"order_id": oid}, order)
    if errored:
        trace.tool(
            "track_shipment",
            {"tracking_number": tn},
            "CarrierTimeout: tracking service did not respond within 10s",
            seconds=10.0,
            error="CarrierTimeout: tracking service did not respond within 10s",
        )
        reply = (
            f"Sorry, I couldn't load the tracking details for order {oid} just now. "
            "Please try again in a few minutes."
        )
        trace.finish(payload, reply, error="track_shipment failed: CarrierTimeout")
        return {"trace_id": trace.trace_id, "spans": trace.spans, "label": None, "kind": "error"}
    if tracking is not None:
        trace.tool("track_shipment", {"tracking_number": tn}, tracking)
    article_ids = RELEVANT_ARTICLES[scenario] + [
        rng.choice([a for a in DISTRACTORS if a not in RELEVANT_ARTICLES[scenario]])
    ]
    documents = [
        {"id": key, "content": ARTICLES[key], "score": round(0.89 - 0.09 * k, 2)}
        for k, key in enumerate(article_ids)
    ]
    trace.retrieve(question_text.splitlines()[0][:120], documents, name="search_help_center")

    sentences = grounded_sentences(scenario, facts, rng.randrange(2))
    if claim is not None:
        text = claim[-1].format(**facts)
        if claim[0] == "replace":
            sentences = [(slot, text if slot == claim[1] else s) for slot, s in sentences]
        else:
            sentences.insert(rng.randint(2, len(sentences)), ("claim", text))
    greeting, rest = sentences[0][1], " ".join(s for _, s in sentences[1:])
    if channel == "email":
        opening = greeting if greeting.endswith((",", ".")) else greeting.rstrip("!") + ","
        reply = f"{opening}\n\n{rest}\n\nBest,\nLarkspur Home Support"
    else:
        reply = f"{greeting} {rest}"

    context = json.dumps(
        {"order": order, "tracking": tracking, "articles": [d["content"] for d in documents]}
    )
    trace.llm(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question_text},
            {"role": "user", "content": f"Context: {context}"},
        ],
        reply,
    )
    trace.finish(payload, reply)
    return {
        "trace_id": trace.trace_id,
        "spans": trace.spans,
        "label": claim is None,
        "kind": "claim" if claim else "clean",
    }


def build_split(
    split: str, count: int, bad: int, email_bad: int, email_good: int, errored: set[int], seed: int
) -> list[dict[str, Any]]:
    """Assigns scenario, channel, and defect to each case so their counts are balanced."""
    rng = random.Random(seed)
    graded = [i for i in range(count) if i not in errored]
    bad_ids = set(rng.sample(graded, bad))
    good_ids = [i for i in graded if i not in bad_ids]
    email = set(rng.sample(sorted(bad_ids), email_bad)) | set(rng.sample(good_ids, email_good))
    scenarios: dict[int, str] = {}
    for group in (sorted(bad_ids), good_ids):
        order = rng.sample(group, len(group))
        offset = rng.randrange(len(SCENARIOS))
        for k, i in enumerate(order):
            scenarios[i] = SCENARIOS[(k + offset) % len(SCENARIOS)]
    used = {scenario: 0 for scenario in SCENARIOS}
    cases = []
    for i in range(count):
        if i in errored:
            cases.append(make_case(i, split, rng, "where", "chat", None, True))
            continue
        scenario = scenarios[i]
        claim = None
        if i in bad_ids:
            options = CLAIMS[split][scenario]
            claim = options[used[scenario] % len(options)]
            used[scenario] += 1
        channel = "email" if i in email else "chat"
        cases.append(make_case(i, split, rng, scenario, channel, claim, False))
    return cases


def shipped_script_window(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Returns the cases whose root span is among the newest spans the client returns."""
    spans = [span for case in cases for span in case["spans"]][-DEFAULT_SPAN_LIMIT:]
    roots = {s["context"]["span_id"] for s in spans if not s.get("parent_id")}
    return [case for case in cases if case["spans"][0]["context"]["span_id"] in roots]


def main() -> None:
    visible = build_split(
        "visible", 60, bad=21, email_bad=7, email_good=12, errored={13, 57}, seed=41
    )
    unseen = build_split("unseen", 28, bad=11, email_bad=4, email_good=6, errored=set(), seed=59)
    write_json(
        HERE / "spec.json",
        {"projects": {PROJECT: [span for case in visible for span in case["spans"]]}},
    )
    write_json(
        HERE.parent / "tests" / "truth.json",
        {
            "project": PROJECT,
            "visible": {c["trace_id"]: c["label"] for c in visible if c["label"] is not None},
            "unseen": {
                "spans": [span for case in unseen for span in case["spans"]],
                "labels": {c["trace_id"]: c["label"] for c in unseen},
            },
        },
    )
    for split, cases in (("visible", visible), ("unseen", unseen)):
        graded = [c for c in cases if c["label"] is not None]
        email = sum(
            json.loads(c["spans"][0]["attributes"]["input.value"])["channel"] == "email"
            for c in graded
        )
        print(
            f"{split}: {len(cases)} traces, {len(graded)} graded, "
            f"{sum(not c['label'] for c in graded)} ungrounded, {email} by email, "
            f"{sum(len(c['spans']) for c in cases)} spans"
        )
    window = shipped_script_window(visible)
    errors = sum(c["kind"] == "error" for c in window)
    print(
        f"shipped script scores {len(window)} visible replies, {errors} errored: "
        f"reports {(len(window) - errors) / len(window):.0%} grounded"
    )
    print(f"shipped script scores {len(shipped_script_window(unseen))} of {len(unseen)} unseen")


if __name__ == "__main__":
    main()
