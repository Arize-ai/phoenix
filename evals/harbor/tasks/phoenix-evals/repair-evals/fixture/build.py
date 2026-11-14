"""Build the support-bot traces for `repair-evals`.

Writes `fixture/spec.json` (the 60 traces the agent sees) and `tests/truth.json` (their
`grounded` labels, plus 28 unseen traces and labels that the verifier adds before
rerunning the nightly script). Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/repair-evals/fixture/build.py

About a third of replies make exactly one claim that no tool result or help center
article supports: an action the bot never took, a policy no article states, or a date,
scan, or order detail that contradicts the order record or tracking data. About 40% of
those defects change one fact inside a normal reply, so the reply reads exactly like a
grounded one; the rest add or replace a sentence. Grounded replies add sentences too,
including "I've ..." statements about what the bot looked up, so neither an added
sentence nor its wording predicts the label. About a third of messages arrive by email,
whose payload has `subject` and `body` instead of `message`; the shipped script crashes
on those and records `pass`. Email and defects are assigned independently.

In two visible traces, `track_shipment` times out and the bot sends a canned apology
with a root span status of `ERROR`. They aren't graded. One of them falls inside the 100
newest spans, the only ones the shipped script scores, and that script marks errored
traces `fail`, so it reports 20 of 21 replies grounded (95%).

Unseen traces use claim wordings and claim types that the visible traces never show, and
their grounded replies can add supported sentences that visible replies never use.
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
# Transit times from the `delivery-estimates` article. Orders that haven't shipped use
# either method; shipped orders are standard, which fits their tracking dates.
WINDOWS = {"standard": "3 to 5 business days", "expedited": "1 to 2 business days"}

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
    "not_shipped": ["processing-time", "delivery-estimates"],
    "delivered_missing": ["delivered-not-found", "returns"],
}
DISTRACTORS = ["returns", "gift-wrap", "cancel-order"]

# One unsupported claim per defective reply, cycled in order within each scenario:
# - ("swap", fact) states a wrong value for one fact inside the normal reply, so the
#   reply reads exactly like a grounded one.
# - ("insert", text) adds a sentence where grounded replies may add one from EXTRAS.
# - ("replace", slot, text) swaps the sentence in that slot for a contradicting one.
CLAIMS: dict[str, dict[str, list[tuple[str, ...]]]] = {
    "visible": {
        "where": [
            ("swap", "eta"),
            ("insert", "I've asked {carrier} to give it priority handling so it arrives sooner."),
            ("swap", "scan_date"),
        ],
        "eta": [
            ("swap", "eta"),
            ("insert", "If it isn't there by {eta}, we'll refund your shipping automatically."),
            ("insert", "Standard shipping usually takes 1 to 2 business days after an order ships."),
        ],
        "address_processing": [
            ("insert", "I've gone ahead and updated the address to {new_street} for you."),
            ("swap", "placed"),
            ("replace", "limit", "You can still change the address for up to 24 hours after the order ships."),
        ],
        "address_shipped": [
            ("replace", "fee", "Redirects are free within 24 hours of shipping, so there's no charge."),
            ("swap", "shipped"),
            ("insert", "I've already sent the redirect request to {carrier} for you."),
        ],
        "stalled": [
            ("swap", "stale_days"),
            ("replace", "next", "I've already opened a trace with {carrier}, and they'll email you within 24 hours."),
            ("insert", "Packages that stall like this almost always turn up within 2 days."),
        ],
        "not_shipped": [
            ("swap", "method"),
            ("insert", "It's packed and the carrier will pick it up tonight."),
            ("swap", "placed"),
        ],
        "delivered_missing": [
            ("insert", "I've already sent a replacement, and it ships tomorrow."),
            ("swap", "note"),
            ("insert", "The driver's delivery photo shows it at your side door."),
        ],
    },
    "unseen": {
        "where": [
            ("swap", "hub"),
            ("insert", "The package is insured for its full value, so you're covered if anything happens to it."),
        ],
        "eta": [
            ("insert", "You'll get a text from {carrier} about 30 minutes before the driver arrives."),
            ("insert", "Orders placed before noon ship the same day, and yours made the cutoff."),
        ],
        "address_processing": [
            ("swap", "item"),
            ("insert", "I've emailed you a link to confirm the new address."),
        ],
        "address_shipped": [
            ("insert", "If the redirect doesn't work, we'll reship it to your new address for free."),
            ("insert", "{carrier} will hold it at your nearest pickup point for 7 days in the meantime."),
        ],
        "stalled": [
            ("swap", "event"),
            ("insert", "If it turns out to be lost, we'll send a replacement right away."),
        ],
        "not_shipped": [
            ("insert", "Processing is taking about a week right now because of high demand."),
            ("insert", "We'll send you a 10% discount code for the wait."),
        ],
        "delivered_missing": [
            ("swap", "delivered_time"),
            ("insert", "{carrier} confirmed that a neighbor signed for it."),
        ],
    },
}  # fmt: skip

# Supported sentences that replies may add, in the same places defective replies add
# claims. Each one restates a lookup the bot made, a fact from its tool results, or a
# retrieved article, or makes no claim. Unseen replies can also use the "unseen" ones.
EXTRAS: dict[str, dict[str, list[str]]] = {
    "visible": {
        "where": [
            "I've checked the latest tracking from {carrier} for you.",
            "Delivery estimates come from the carrier and can change while a package is in transit.",
        ],
        "eta": [
            "I've checked the latest tracking from {carrier} for you.",
            "Standard shipping usually takes 3 to 5 business days after an order ships.",
        ],
        "address_processing": [
            "I've looked up order {oid} for you.",
            "Orders usually ship within 2 business days of being placed, so it's best to make the change soon.",
        ],
        "address_shipped": [
            "I've checked the tracking, and it's still in transit with {carrier}.",
            "I'm sorry for the hassle.",
        ],
        "stalled": [
            "I've checked the latest tracking from {carrier} for you.",
            "Tracking can pause for a few days while a package moves between carrier facilities.",
        ],
        "not_shipped": [
            "I've looked up order {oid} for you.",
            "I know waiting is no fun.",
        ],
        "delivered_missing": [
            "I've checked the tracking for order {oid}.",
            "I know that's frustrating.",
        ],
    },
    "unseen": {
        "where": ["Tracking can pause for a few days while a package moves between carrier facilities."],
        "eta": ["It went out by standard shipping on {shipped}."],
        "address_processing": ["Once it ships, we'll email you its tracking number."],
        "address_shipped": ["Its current delivery estimate is {eta}."],
        "stalled": ["Your tracking number is {tn}."],
        "not_shipped": ["Since it hasn't shipped, there's no tracking number yet."],
        "delivered_missing": ["Your tracking number is {tn}."],
    },
}  # fmt: skip
# Share of replies that add a sentence from EXTRAS. Defective replies that insert a
# claim never add one, so grounded replies add one more often to keep the share of
# longer replies about the same in both classes.
EXTRA_RATE = {"grounded": 0.6, "defective": 0.4}

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
            ("status", f"Order {f['oid']} for your {f['item']} was placed on {f['placed']} and is still processing, so you can change the address yourself."),
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
            ("method", f"You chose {f['method']} shipping, which usually takes {f['window']} after the order ships."),
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
    method = "standard" if shipped else rng.choice(sorted(WINDOWS))
    facts = {
        "first": first,
        "oid": oid,
        "carrier": carrier,
        "tn": tn,
        "hub": hub,
        "event": rng.choice(EVENTS),
        "shipped": day(shipped_on),
        "placed": day(placed),
        "scan_date": day(scan_time.date()),
        "eta": day(eta),
        "stale_days": 0,
        "delivered_date": day(delivered_at.date()),
        "delivered_time": clock(delivered_at),
        "note": rng.choice(NOTES),
        "new_street": new_address.split(",")[0],
        "item": item,
        "new_address": new_address,
        "method": method,
        "window": WINDOWS[method],
    }
    if scenario == "stalled":
        stale = sum(
            (scan_time.date() + timedelta(days=k)).weekday() < 5
            for k in range(1, (today - scan_time.date()).days + 1)
        )
        facts["stale_days"] = stale
    # What the reply says. A "swap" defect changes one fact here and nowhere else. A
    # swapped date never matches another date in the order record or tracking data, so
    # no other field seems to support it.
    said = dict(facts)
    if claim is not None and claim[0] == "swap":
        fact = claim[1]
        dates = {"eta": eta, "scan_date": scan_time.date(), "placed": placed, "shipped": shipped_on}
        looked_up = {placed}
        if shipped and scenario == "delivered_missing":
            looked_up |= {shipped_on, delivered_at.date()}
        elif shipped:
            looked_up |= {shipped_on, scan_time.date()} | (
                {eta} if scenario != "stalled" else set()
            )
        if fact in dates:
            offsets = {"eta": [-1, 1, 2], "scan_date": [-1, -2, -3], "placed": [-1, 1]}
            candidates = [
                dates[fact] + timedelta(days=k)
                for k in offsets.get(fact, [-1, 1, 2])
                if dates[fact] + timedelta(days=k) not in looked_up
            ]
            said[fact] = day(rng.choice(candidates))
        elif fact == "stale_days":
            said["stale_days"] = facts["stale_days"] + rng.choice([-2, -1, 1, 2])
        elif fact == "method":
            said["method"] = next(m for m in WINDOWS if m != method)
            said["window"] = WINDOWS[said["method"]]
        elif fact == "delivered_time":
            shift = timedelta(hours=rng.choice([-3, -2, 2, 3]), minutes=rng.choice([-25, 20, 35]))
            said["delivered_time"] = clock(delivered_at + shift)
        else:
            pool = {"hub": HUBS, "event": EVENTS, "note": NOTES, "item": ITEMS}[fact]
            said[fact] = rng.choice([value for value in pool if value != facts[fact]])
        if said[fact] == facts[fact]:
            raise ValueError(f"{split}:{index}: swapping {fact} kept its value")

    order = {
        "order_id": oid,
        "customer_name": name,
        "status": "processing"
        if not shipped
        else ("delivered" if scenario == "delivered_missing" else "shipped"),
        "placed_on": placed.isoformat(),
        "items": [{"name": item, "quantity": 1}],
        "shipping_method": method,
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

    variant = rng.randrange(2)
    sentences = grounded_sentences(scenario, said, variant)
    kind, *spec = claim or ("clean",)
    if kind == "swap" and sentences == grounded_sentences(scenario, facts, variant):
        raise ValueError(f"{split}:{index}: the reply doesn't state the swapped {spec[0]}")
    if kind == "replace":
        text = spec[1].format(**facts)
        sentences = [(slot, text if slot == spec[0] else s) for slot, s in sentences]
    if kind == "insert":
        sentences.insert(rng.randint(1, len(sentences)), ("claim", spec[0].format(**facts)))
    elif rng.random() < EXTRA_RATE["grounded" if claim is None else "defective"]:
        extras = EXTRAS["visible"][scenario] + (
            EXTRAS["unseen"][scenario] if split == "unseen" else []
        )
        extra = rng.choice(extras).format(**facts)
        sentences.insert(rng.randint(1, len(sentences)), ("extra", extra))
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
        "kind": kind,
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
        kinds = {
            kind: sum(c["kind"] == kind for c in graded) for kind in ("swap", "insert", "replace")
        }
        print(
            f"{split}: {len(cases)} traces, {len(graded)} graded, "
            f"{sum(not c['label'] for c in graded)} ungrounded "
            f"({kinds['swap']} change a fact, {kinds['insert']} add a claim, "
            f"{kinds['replace']} replace a sentence), {email} by email, "
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
