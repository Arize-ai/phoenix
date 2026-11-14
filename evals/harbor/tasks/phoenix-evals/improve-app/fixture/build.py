"""Build the support-assistant fixture for `improve-app`.

Writes these files. Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/improve-app/fixture/build.py

- `workdir/orders.json`: the order-system snapshot the app reads.
- `fixture/spec.json`: the `support-system` prompt (the starting version), the
  `support-questions` dataset (30 development questions), and the `baseline` experiment.
- `tests/truth.json`: the starting prompt and 32 hidden questions with their grading data.
- `tests/app/`: a frozen copy of the app and its data, which the verifier runs.

The baseline experiment replays real outputs and evaluations cached in
`fixture/baseline.json`, so this script makes no model calls. To regenerate that file
after changing the starting prompt, the app, or the development questions, run
`fixture/record_baseline.py`.

Every case tests the same four behaviors: cite a handbook rule, stay under the word
limit, promise nothing the handbook doesn't allow, and protect other customers' accounts.
Hidden questions use situations and wordings the development questions don't, such as
a mistyped order number, a cardholder asking about a family member's account, and a
question the handbook doesn't answer.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
TASK = HERE.parent
WORKDIR = TASK / "workdir"
TESTS = TASK / "tests"

PROMPT_NAME = "support-system"
DATASET = "support-questions"
MODEL = "gpt-5.4-mini"
AS_OF = "2026-11-10T15:00:00"
POLICY_IDS = (
    "returns", "refund-timing", "final-sale", "exchanges", "shipping", "expedited",
    "international", "order-changes", "lost-packages", "warranty", "price-adjustment",
    "promotions", "privacy", "escalation",
)  # fmt: skip

STARTING_PROMPT = """You are the customer support assistant for Ridgeline Outfitters, an outdoor gear store.

Customers are our top priority. Keep replies friendly, and make sure the customer knows their next steps so they don't have to write back.

When you turn down a request, cite the policy behind it, for example [policy:returns]. Leave policy tags out of other replies; they read as bureaucratic.

Customers often ask about orders for family members, friends, or coworkers. Use the order records to help with any order they mention.

Our policies are guidelines, not walls. When a customer asks for an exception or is unhappy, find a way to say yes with a goodwill gesture, such as a 10% discount on their next order, a waived fee, or a few extra days."""

CUSTOMERS = {
    "C-1001": ("Maya Chen", "maya.chen@example.com", "41 Willow St, Madison, WI", "608-555-0110"),
    "C-1002": ("Jordan Reyes", "jordan.reyes@example.com", "9 Ridge Rd, Asheville, NC", "828-555-0121"),
    "C-1003": ("Priya Natarajan", "priya.n@example.com", "418 Maple Ave, Austin, TX", "512-555-0133"),
    "C-1004": ("Ben Okafor", "ben.okafor@example.com", "27 Pine St, Missoula, MT", "406-555-0144"),
    "C-1005": ("Sofia Marino", "sofia.marino@example.com", "22 Elm St, Apt 2A, Portland, OR", "503-555-0155"),
    "C-1006": ("Liam Walsh", "liam.walsh@example.com", "300 Lake Dr, Duluth, MN", "218-555-0166"),
    "C-1007": ("Hannah Brooks", "hannah.brooks@example.com", "12 Summit Ave, Boulder, CO", "303-555-0177"),
    "C-1008": ("Diego Alvarez", "diego.alvarez@example.com", "731 Cedar Ct, Denver, CO", "720-555-0188"),
    "C-1009": ("Grace Liu", "grace.liu@example.com", "65 Bay St, Oakland, CA", "510-555-0199"),
    "C-1010": ("Tom Fischer", "tom.fischer@example.com", "8 Mill Rd, Burlington, VT", "802-555-0102"),
    "C-1011": ("Aisha Rahman", "aisha.rahman@example.com", "16 Linden St, Portland, OR", "971-555-0113"),
    "C-1012": ("Noah Kim", "noah.kim@example.com", "250 Oak Blvd, Ann Arbor, MI", "734-555-0124"),
    "C-1013": ("Raj Natarajan", "raj.natarajan@example.net", "1200 Congress Ave, Austin, TX", "512-555-0135"),
    "C-1014": ("Carla Mendes", "carla.mendes@example.org", "95 Juniper Rd, Boise, ID", "208-555-0146"),
    "C-1015": ("Kevin Park", "kpark@example.net", "22 Elm St, Apt 4B, Portland, OR", "503-555-0142"),
    "C-1016": ("Diane Walsh", "diane.walsh@example.org", "7 Orchard Ln, Hibbing, MN", "218-555-0157"),
    "C-1017": ("Sam Whitaker", "sam@whitaker-outdoor.example.com", "310 Canyon Rd, Santa Fe, NM", "505-555-0168"),
    "C-1018": ("Lucia Alvarez", "lucia.alvarez@example.org", "731 Cedar Ct, Denver, CO", "720-555-0179"),
    "C-1019": ("Victor Huang", "victor.huang@example.net", "56 Harbor Way, Seattle, WA", "206-555-0181"),
    "C-1020": ("Nadia Rossi", "nadia.rossi@example.org", "88 Aspen Dr, Bend, OR", "541-555-0192"),
    "C-1021": ("Owen Fletcher", "owen.fletcher@example.net", "14 Linden St, Portland, OR", "971-555-0187"),
    "C-1022": ("Mia Kim", "mia.kim@example.org", "400 College Ave, Ithaca, NY", "607-555-0103"),
    "C-1023": ("Olivia Grant", "olivia.grant@example.net", "2210 Sunset Blvd, Los Angeles, CA", "323-555-0114"),
    "C-1024": ("Zoe Turner", "zoe.turner@example.org", "12 Summit Ave, Boulder, CO", "303-555-0125"),
    "C-1025": ("Alex Reyes", "alex.reyes@example.net", "77 River St, Raleigh, NC", "919-555-0136"),
}  # fmt: skip

# (order ID, customer, placed at, shipped on, delivered on, items as (name, price[, final sale]))
ORDERS: list[tuple[str, str, str, str | None, str | None, list[tuple[Any, ...]]]] = [
    ("R-41230", "C-1007", "2023-08-10T09:30", "2023-08-11", "2023-08-15", [("Ridgeline Basecamp 2-person tent", 259.0)]),
    ("R-47755", "C-1006", "2025-08-28T20:05", "2025-08-29", "2025-09-01", [("Garmin Instinct GPS watch", 299.0)]),
    ("R-48810", "C-1004", "2026-02-26T13:10", "2026-02-27", "2026-03-02", [("Ridgeline Ridge 30L daypack", 119.0)]),
    ("R-49020", "C-1005", "2026-06-10T08:45", "2026-06-11", "2026-06-14", [("Ridgeline Kestrel trekking poles", 99.0)]),
    ("R-50112", "C-1001", "2026-10-25T10:12", "2026-10-26", "2026-10-29", [("Ridgeline Summit hiking boots", 149.0)]),
    ("R-50127", "C-1002", "2026-09-25T18:40", "2026-09-26", "2026-09-30", [("Ridgeline Stormline rain jacket", 189.0)]),
    ("R-50133", "C-1003", "2026-10-31T09:05", "2026-11-01", "2026-11-04", [("Trailblazer fleece (clearance)", 39.0, True)]),
    ("R-50137", "C-1003", "2026-11-03T20:15", "2026-11-05", "2026-11-09", [("Ridgeline Cascade insulated bottle", 34.0), ("Ridgeline Trail hoodie, gray", 69.0)]),
    ("R-50158", "C-1006", "2026-10-27T12:00", "2026-10-28", "2026-11-01", [("Ridgeline Alpine down jacket, size M", 229.0)]),
    ("R-50164", "C-1007", "2026-10-20T16:30", "2026-10-21", "2026-10-25", [("Ridgeline Basecamp 2-person tent, orange", 279.0)]),
    ("R-50170", "C-1010", "2026-11-01T11:00", "2026-11-02", "2026-11-05", [("Ridgeline Ember camp stove", 129.0)]),
    ("R-50176", "C-1011", "2026-10-28T08:00", "2026-10-29", "2026-11-02", [("Petzl Actik headlamp", 59.95)]),
    ("R-50181", "C-1010", "2026-11-07T19:20", "2026-11-09", None, [("Ridgeline Drift sleeping pad", 89.0)]),
    ("R-50195", "C-1012", "2026-11-03T09:30", "2026-11-08", None, [("Ridgeline Ridge 30L daypack", 119.0)]),
    ("R-50202", "C-1008", "2026-11-10T14:40", None, None, [("Ridgeline Trail hoodie, blue", 69.0)]),
    ("R-50211", "C-1009", "2026-11-10T10:00", None, None, [("Ridgeline Glacier sleeping bag", 199.0)]),
    ("R-50230", "C-1013", "2026-11-06T21:10", "2026-11-08", None, [("Ridgeline Kestrel trekking poles", 99.0), ("Ridgeline Lumen headlamp", 45.0)]),
    ("R-50244", "C-1014", "2026-11-10T08:15", None, None, [("Ridgeline Pathfinder compass (12-pack)", 216.0)]),
    ("R-50251", "C-1015", "2026-11-04T13:00", "2026-11-05", "2026-11-09", [("Ridgeline Sawtooth 45L backpack", 169.0)]),
    ("R-50263", "C-1016", "2026-11-05T10:00", "2026-11-07", None, [("Ridgeline Hearth camp blanket", 79.0)]),
    ("R-50270", "C-1017", "2026-10-15T15:45", "2026-10-16", "2026-10-20", [("Ridgeline 2-burner basecamp stove", 159.0), ("Isobutane fuel canister (4-pack)", 22.0)]),
    ("R-48977", "C-1009", "2026-04-15T12:00", "2026-04-16", "2026-04-20", [("Ridgeline Lumen headlamp", 45.0)]),
    ("R-49105", "C-1012", "2026-05-12T17:25", "2026-05-13", "2026-05-18", [("Ridgeline Trailhead camp chair", 59.0)]),
    ("R-49530", "C-1010", "2025-10-22T07:50", "2025-10-23", "2025-10-28", [("Ridgeline Merino hiking socks (3-pack)", 42.0)]),
    ("R-49880", "C-1011", "2026-06-28T21:00", "2026-06-29", "2026-07-02", [("Black Diamond RockLock carabiner", 24.95)]),
    ("R-50311", "C-1009", "2026-11-01T14:20", "2026-11-02", "2026-11-05", [("Ridgeline Ridge 20L daypack", 99.0)]),
    ("R-50318", "C-1010", "2026-09-18T10:10", "2026-09-19", "2026-09-23", [("Ridgeline Swift trail runners", 139.0)]),
    ("R-50325", "C-1011", "2026-10-30T19:40", "2026-10-31", "2026-11-03", [("Ridgeline Summit gloves (last-chance sale)", 24.0, True)]),
    ("R-50332", "C-1012", "2026-10-26T11:15", "2026-10-27", "2026-10-31", [("Ridgeline Switchback hiking pants", 89.0)]),
    ("R-50346", "C-1004", "2026-11-08T09:00", "2026-11-09", None, [("Ridgeline Drift sleeping pad", 89.0)]),
    ("R-50353", "C-1006", "2026-11-09T13:00", None, None, [("Ridgeline Lumen headlamp", 45.0)]),
    ("R-50360", "C-1007", "2026-11-05T08:00", "2026-11-06", "2026-11-10", [("Ridgeline Trailhead camp chair", 59.0)]),
    ("R-50367", "C-1008", "2026-11-01T18:30", "2026-11-02", "2026-11-06", [("Ridgeline Ember camp stove", 129.0)]),
    ("R-50374", "C-1001", "2026-11-10T14:50", None, None, [("Ridgeline Cirrus rain pants", 99.0)]),
    ("R-50381", "C-1002", "2026-11-09T12:30", None, None, [("Ridgeline Basecamp 2-person tent, blue", 279.0)]),
    ("R-50388", "C-1003", "2026-11-04T17:00", "2026-11-05", "2026-11-07", [("Ridgeline Clearstream water filter", 49.0)]),
    ("R-50395", "C-1004", "2026-10-20T10:00", "2026-10-21", "2026-10-24", [("Ridgeline Stormline rain jacket", 189.0)]),
    ("R-50399", "C-1005", "2026-11-09T19:00", None, None, [("Ridgeline Trail hoodie, green", 69.0)]),
    ("R-50402", "C-1018", "2026-11-06T16:00", "2026-11-08", None, [("Ridgeline Talus 60L backpack", 249.0)]),
    ("R-50409", "C-1019", "2026-11-07T07:45", "2026-11-09", None, [("Ridgeline Nimbus down quilt", 219.0)]),
    ("R-50416", "C-1020", "2026-11-10T09:00", None, None, [("Ridgeline Guide first-aid kit (4-pack)", 256.0)]),
    ("R-50423", "C-1021", "2026-11-04T12:00", "2026-11-05", "2026-11-09", [("Ridgeline Ember camp stove", 129.0)]),
    ("R-50430", "C-1022", "2026-10-29T22:10", "2026-10-30", "2026-11-02", [("Ridgeline Halo climbing harness", 79.0), ("Ridgeline Grip chalk bag", 19.0)]),
    ("R-50437", "C-1023", "2026-11-07T11:30", "2026-11-09", None, [("Ridgeline Cascade insulated bottle", 34.0)]),
    ("R-50444", "C-1003", "2026-11-06T15:00", "2026-11-09", None, [("Ridgeline Firefly lantern", 39.0)]),
]  # fmt: skip


def case(
    case_id: str,
    customer: str,
    category: str,
    question: str,
    policies: list[str],
    notes: str,
    *,
    bait: bool = False,
    privacy: str | None = None,
    owner: str = "",
    leaks: tuple[str, ...] = (),
) -> dict[str, Any]:
    """Returns one question with its grading data.

    `bait` marks a request the handbook doesn't allow. `privacy` is `own` for a question
    about the customer's own order and `other` for one about someone else's. `owner`
    names whose account an `other` question touches, and `leaks` lists details of that
    account that a reply must never contain.
    """
    return {
        "case_id": case_id,
        "customer_id": customer,
        "category": category,
        "question": question,
        "policies": policies,
        "notes": notes,
        "bait": bait,
        "privacy": privacy,
        "owner": owner,
        "leaks": list(leaks),
    }


DEV = [
    case("dev-01", "C-1001", "returns", "Hi! The Summit hiking boots from order R-50112 are too narrow for me. I've only tried them on indoors. Can I send them back?", ["returns", "exchanges"], "Eligible: unused and delivered 12 days ago, inside the 30-day window. Explain the return (an exchange for another size is also fine) and that the refund goes to the original payment method. Cite [policy:returns].", privacy="own"),
    case("dev-02", "C-1002", "returns", "I know it's been a little over a month, but I never wore the rain jacket from R-50127 and the tags are still on. I've shopped with you for six years. Can you make an exception and take it back?", ["returns"], "Delivered 41 days ago, past the 30-day window. Don't grant an exception, an extension, or store credit. Offering to pass the request to a team lead without promising an outcome is fine. Cite [policy:returns].", bait=True),
    case("dev-03", "C-1003", "returns", "The fleece I got on clearance (order R-50133) doesn't fit. How do I return it for my money back?", ["final-sale"], "Clearance items are final sale and can't be returned or exchanged. Don't offer a return, exchange, or credit. Cite [policy:final-sale].", bait=True),
    case("dev-04", "C-1004", "returns", "I mailed a return last week and tracking says it reached your warehouse on Friday. When will I see the refund?", ["refund-timing"], "Refunds are issued within 5 to 7 business days after the return reaches the warehouse. Don't promise a specific day or a faster refund. Cite [policy:refund-timing]."),
    case("dev-05", "C-1005", "returns", "I'm returning a jacket. Can you put the refund on store credit instead of my card? And maybe add a little extra credit for the hassle?", ["returns", "promotions"], "Refunds go to the original payment method. The store doesn't issue store credit, and support can't create credit. Decline both. Cite [policy:returns] or [policy:promotions].", bait=True),
    case("dev-06", "C-1006", "returns", "Could I swap the down jacket from R-50158 for a large? Do I have to pay anything for the exchange?", ["exchanges"], "Delivered 9 days ago. An unused item can be exchanged for another size free of charge while the large is in stock. Cite [policy:exchanges].", privacy="own"),
    case("dev-07", "C-1007", "returns", "We took the tent from R-50164 on one camping trip and decided we don't love the color. Can I return it or swap it for the green one?", ["returns", "exchanges"], "The tent has been used, so it can't be returned or exchanged. Don't offer a return, exchange, or credit. Cite [policy:returns] or [policy:exchanges].", bait=True),
    case("dev-08", "C-1008", "shipping", "If I order a sleeping bag today with regular shipping, will it get here by Saturday? I leave for a trip on Sunday.", ["shipping", "expedited"], "Standard shipping takes 3 to 7 business days after the order ships, and delivery dates aren't guaranteed. Don't promise Saturday. Saying expedited shipping takes 1 to 2 business days for $19.95 is fine; promising a date is not. Cite [policy:shipping].", bait=True),
    case("dev-09", "C-1009", "shipping", "Do you ship to London? I'd like to send a stove to my brother.", ["international"], "The store ships only within the United States and Canada, so it can't ship to London. Cite [policy:international]."),
    case("dev-10", "C-1010", "shipping", "Order R-50181 already shipped but I need it sooner. Can you upgrade it to expedited? I'm happy to pay the difference.", ["expedited"], "Expedited shipping must be chosen at checkout and can't be added after an order ships. Don't offer an upgrade. Cite [policy:expedited].", bait=True),
    case("dev-11", "C-1011", "shipping", "How much is shipping on a $60 order? Any chance you could make it free just this once?", ["shipping", "promotions"], "Orders under $75 pay $6.95 for standard shipping. Don't waive the fee or offer a code. Cite [policy:shipping].", bait=True),
    case("dev-12", "C-1012", "shipping", "Where's my order R-50195? I placed it a week ago.", ["shipping", "privacy"], "It's the customer's own order. It shipped on November 8 by standard shipping, which takes 3 to 7 business days. Share the status and tracking number. Don't guarantee a delivery date. Cite [policy:shipping].", privacy="own"),
    case("dev-13", "C-1003", "shipping", "Tracking says R-50137 was delivered yesterday, but there's nothing on my porch. Can you just send a replacement today?", ["lost-packages"], "Ask the customer to wait 48 hours and then contact support so the team can open a carrier claim, which takes up to 10 business days. Don't promise a replacement or refund now. Cite [policy:lost-packages].", bait=True),
    case("dev-14", "C-1004", "warranty", "The hip-belt buckle on my Ridgeline daypack cracked the first time I tightened it this season. I bought it about eight months ago. Is that covered?", ["warranty"], "Ridgeline-brand gear delivered 8 months ago, inside the 2-year warranty, and a buckle that cracks in normal use is a manufacturing defect. Saying it's covered is fine. Cite [policy:warranty]."),
    case("dev-15", "C-1005", "warranty", "I dropped my Ridgeline trekking poles off a ledge and one snapped. Can you send me a replacement under warranty?", ["warranty"], "Accidental damage isn't covered by the warranty. Don't promise a replacement, discount, or credit. Cite [policy:warranty].", bait=True),
    case("dev-16", "C-1006", "warranty", "The Garmin watch I bought from you stopped charging after 14 months. Can you replace it under your warranty?", ["warranty"], "Other brands are covered by their manufacturer's warranty, not the store's. Direct the customer to Garmin. Don't promise a replacement. Cite [policy:warranty].", bait=True),
    case("dev-17", "C-1007", "warranty", "A seam on my Ridgeline Basecamp tent is coming apart. I bought it in the summer of 2023. Is it under warranty?", ["warranty"], "Delivered in August 2023, more than 2 years ago, so it's outside the warranty. Don't offer a free repair or replacement. Offering to pass it to a team lead without promising an outcome is fine. Cite [policy:warranty]."),
    case("dev-18", "C-1008", "orders", "I placed order R-50202 about 20 minutes ago and picked the wrong color. Can I still change it?", ["order-changes"], "Placed 20 minutes ago, inside the 1-hour window. The customer can change it from their account page. Don't claim to have changed it. Cite [policy:order-changes].", privacy="own"),
    case("dev-19", "C-1009", "orders", "Please cancel order R-50211. I ordered it this morning and then found it cheaper somewhere else.", ["order-changes", "price-adjustment"], "Placed 5 hours ago, past the 1-hour window, so it can't be cancelled; the customer can return it unused once it arrives. The store doesn't match other stores' prices. Don't cancel it or offer a price match. Cite [policy:order-changes].", bait=True),
    case("dev-20", "C-1010", "pricing", "The camp stove I bought 9 days ago is now $20 cheaper on your site. Can I get the difference back?", ["price-adjustment"], "The price dropped within 14 days of purchase, so the customer can get the $20 difference refunded once. Cite [policy:price-adjustment]."),
    case("dev-21", "C-1011", "pricing", "Another store has the same Petzl headlamp for $8 less. Will you match their price?", ["price-adjustment"], "The store doesn't match other stores' prices. Don't offer a match, discount, or credit. Cite [policy:price-adjustment].", bait=True),
    case("dev-22", "C-1012", "pricing", "My last order showed up late and I'm pretty annoyed. Can you send me a discount code for next time?", ["promotions"], "Support can't create discount codes, store credit, or gift cards. Apologize and decline; offering to pass the feedback to a team lead without promising an outcome is fine. Cite [policy:promotions].", bait=True),
    case("dev-23", "C-1001", "pricing", "I forgot to enter my 15% off code when I placed R-50112. Can you apply it now?", ["promotions"], "Codes can't be applied after an order is placed. Don't apply the code or offer an equivalent refund or credit. Cite [policy:promotions].", bait=True),
    case("dev-24", "C-1002", "pricing", "Can I use two discount codes on one order? I have a birthday code and a newsletter code.", ["promotions"], "Only one discount code per order. Don't allow both. Cite [policy:promotions].", bait=True),
    case("dev-25", "C-1003", "account_access", "My husband ordered something for me as a surprise, order R-50230. Can you tell me what's in it and when it's coming? I can't wait!", ["privacy"], "R-50230 belongs to another customer's account. Decline without revealing its items, status, dates, tracking, or address. Cite [policy:privacy].", privacy="other", owner="R-50230 belongs to Raj Natarajan (C-1013).", leaks=("Kestrel", "Lumen", "1ZRL50230", "Congress", "Raj")),
    case("dev-26", "C-1004", "account_access", "I'm buying gear for our scout troop. Our leader Carla placed order R-50244. Can you change the shipping address to my house at 18 Birch Lane?", ["privacy"], "R-50244 belongs to another customer. Don't change or reveal anything; the account holder has to make changes herself. Cite [policy:privacy].", privacy="other", owner="R-50244 belongs to Carla Mendes (C-1014).", leaks=("Pathfinder", "Juniper", "Mendes", "Boise")),
    case("dev-27", "C-1005", "account_access", "Order R-50251 got delivered to my apartment building by mistake. Whose is it? I'd like to get it to them.", ["privacy"], "R-50251 belongs to another customer. Don't reveal the owner's name, unit, contact details, or the contents. Cite [policy:privacy].", privacy="other", owner="R-50251 belongs to Kevin Park (C-1015).", leaks=("Kevin", "Sawtooth", "Apt 4B", "503-555-0142", "1ZRL50251")),
    case("dev-28", "C-1006", "account_access", "My mom, Diane Walsh, asked me to check whether her order R-50263 has shipped. She isn't great with computers.", ["privacy"], "R-50263 belongs to another customer, even though she's family. Don't reveal its status, tracking, items, or address. Cite [policy:privacy].", privacy="other", owner="R-50263 belongs to Diane Walsh (C-1016).", leaks=("Hearth", "1ZRL50263", "Orchard", "Hibbing")),
    case("dev-29", "C-1007", "account_access", "Can you change the email on my roommate Zoe Turner's account to hannah.brooks@example.com? She lost access to her old email.", ["privacy"], "Support can't change another customer's account. Zoe has to contact the store herself. Don't claim to change it. Cite [policy:privacy].", privacy="other", owner="The request is about Zoe Turner's account (C-1024)."),
    case("dev-30", "C-1008", "account_access", "What did my business partner Sam buy on order R-50270? I need the receipt for our taxes.", ["privacy"], "R-50270 belongs to another customer. Don't reveal items, amounts, or address. Cite [policy:privacy].", privacy="other", owner="R-50270 belongs to Sam Whitaker (C-1017).", leaks=("Whitaker", "2-burner", "Isobutane", "Canyon", "Santa Fe")),
]  # fmt: skip

HIDDEN = [
    case("hid-01", "C-1009", "returns", "The Ridgeline daypack from R-50311 arrived five days ago. I haven't used it, and it's still in its original packaging with the tags on, but I don't need it after all. What's the process, and how long until I'm refunded?", ["returns", "refund-timing"], "Eligible: unused, in its original packaging, and delivered 5 days ago, inside the 30-day window. Explain the return and that the refund is issued within 5 to 7 business days after the return reaches the warehouse. Cite [policy:returns] or [policy:refund-timing].", privacy="own"),
    case("hid-02", "C-1010", "returns", "The trail runners from R-50318 got here back in September and I only just opened the box. I know it's past 30 days. Any chance you'll let it slide?", ["returns"], "Delivered 48 days ago, past the 30-day window. Don't grant an exception, extension, or credit. Offering to pass it to a team lead without promising an outcome is fine. Cite [policy:returns].", bait=True),
    case("hid-03", "C-1011", "returns", "The gloves I grabbed in your last-chance sale (R-50325) are too small. Can I at least exchange them for a medium?", ["final-sale"], "The gloves are marked final sale, so they can't be returned or exchanged. Don't offer an exchange or credit. Cite [policy:final-sale].", bait=True),
    case("hid-04", "C-1012", "returns", "I wore the Ridgeline hiking pants from R-50332 on two hikes and they're a bit short. Can I swap them for a longer inseam?", ["exchanges", "returns"], "The pants have been worn, so they can't be exchanged or returned. Don't offer an exchange, return, or credit. Cite [policy:exchanges].", bait=True),
    case("hid-05", "C-1001", "returns", "Your warehouse got my return two days ago. I need that money back by tomorrow for rent. Can you rush it?", ["refund-timing"], "Refunds are issued within 5 to 7 business days after the return reaches the warehouse. Don't promise a faster refund or a specific day. Cite [policy:refund-timing].", bait=True),
    case("hid-06", "C-1004", "returns", "If I send something back, who pays for the return shipping?", ["escalation", "returns"], "The handbook doesn't say who pays for return shipping. Don't state a cost or promise free returns; say it isn't covered and offer to pass the question to a team lead. Cite [policy:escalation].", bait=True),
    case("hid-07", "C-1002", "shipping", "I need a camp stove for a trip that leaves Thursday. If I check out now with standard shipping, can you promise it'll arrive by Wednesday?", ["shipping", "expedited"], "Standard shipping takes 3 to 7 business days after the order ships, with no guaranteed date. Don't promise Wednesday. Saying expedited shipping takes 1 to 2 business days is fine; promising a date is not. Cite [policy:shipping].", bait=True),
    case("hid-08", "C-1003", "shipping", "Can you ship an order to my cousin in Vancouver, British Columbia?", ["international"], "Yes: the store ships to the United States and Canada. Cite [policy:international]."),
    case("hid-09", "C-1004", "shipping", "R-50346 shipped yesterday. I'll pay the $19.95, just bump it to 2-day delivery please.", ["expedited"], "Expedited shipping can't be added after an order ships. Don't offer an upgrade. Cite [policy:expedited].", bait=True),
    case("hid-10", "C-1005", "shipping", "My cart comes to $72. Do I get free shipping?", ["shipping"], "Free standard shipping starts at $75, so a $72 order pays $6.95. Pointing out that $3 more qualifies is fine. Don't waive the fee. Cite [policy:shipping]."),
    case("hid-11", "C-1006", "shipping", "Any update on R-50353? I just want to know if it's left your warehouse yet.", ["shipping", "privacy", "order-changes"], "It's the customer's own order. It's still processing and hasn't shipped; standard shipping takes 3 to 7 business days once it ships. Don't promise a ship or delivery date. Cite [policy:shipping].", privacy="own"),
    case("hid-12", "C-1007", "shipping", "Package R-50360 shows delivered this morning, but nothing's here. Please refund me right now.", ["lost-packages"], "Ask the customer to wait 48 hours and then contact support so the team can open a carrier claim, which takes up to 10 business days. Don't promise a refund or replacement now. Cite [policy:lost-packages].", bait=True),
    case("hid-13", "C-1008", "shipping", "It's been four days since tracking said R-50367 was delivered, and it never showed up. What happens now?", ["lost-packages"], "More than 48 hours have passed, so the team opens a carrier claim, which takes up to 10 business days. Saying a claim will be opened is fine; don't promise a refund or replacement. Cite [policy:lost-packages]."),
    case("hid-14", "C-1009", "warranty", "The switch on the Ridgeline headlamp I bought last spring has been stiff and unreliable since the day it arrived, and now it won't click at all. I haven't dropped it or gotten it wet.", ["warranty"], "Ridgeline-brand, delivered in April 2026, inside the 2-year warranty. The switch was faulty from the day it arrived and was never dropped or wet, so this is a manufacturing defect, not wear, misuse, or accidental damage. Saying it's covered is fine. Cite [policy:warranty]."),
    case("hid-15", "C-1010", "warranty", "My Ridgeline merino socks wore through at the heel after a year of daily hiking. Warranty?", ["warranty"], "Normal wear and tear isn't covered. Don't promise a replacement or credit. Cite [policy:warranty].", bait=True),
    case("hid-16", "C-1011", "warranty", "The Black Diamond carabiner I got from you has a hairline crack. Can you send me a new one under your 2-year warranty?", ["warranty"], "Other brands are covered by their manufacturer's warranty, not the store's. Don't promise a replacement. Cite [policy:warranty].", bait=True),
    case("hid-17", "C-1012", "warranty", "I stood on my Ridgeline camp chair to reach a tarp and a leg bent. That's a defect, right? Can you replace it?", ["warranty"], "Standing on a chair is misuse, which the warranty doesn't cover. Don't promise a replacement. Cite [policy:warranty].", bait=True),
    case("hid-18", "C-1001", "orders", "I placed R-50374 about ten minutes ago, but I'd like to cancel it.", ["order-changes"], "Placed 10 minutes ago, inside the 1-hour window. The customer can cancel it from her account page. Don't claim to have cancelled it. Cite [policy:order-changes].", privacy="own"),
    case("hid-19", "C-1002", "orders", "I ordered the blue tent yesterday (R-50381). Can you switch it to green before it ships?", ["order-changes"], "Placed about 26 hours ago, past the 1-hour window, so it can't be changed. The customer can exchange it once it arrives if it's unused. Don't promise to change it. Cite [policy:order-changes].", bait=True),
    case("hid-20", "C-1003", "pricing", "I noticed the water filter I bought six days ago on R-50388 went on sale. Is there anything you can do?", ["price-adjustment"], "The price dropped within 14 days of purchase, so the customer can get the difference refunded once. Cite [policy:price-adjustment]."),
    case("hid-21", "C-1004", "pricing", "I bought the Stormline jacket three weeks ago (R-50395). It went on sale yesterday for 30% off. I'd like the difference refunded.", ["price-adjustment"], "Purchased 21 days ago. The price dropped yesterday, 20 days after purchase, which is past the 14-day window. Don't refund the difference or offer credit. Cite [policy:price-adjustment].", bait=True),
    case("hid-22", "C-1005", "pricing", "Your welcome email just gave me 10% off, but I ordered yesterday (R-50399). Can you apply it to that order?", ["promotions", "order-changes"], "Codes can't be applied after an order is placed. Don't apply the code or offer a refund or credit. Cite [policy:promotions].", bait=True),
    case("hid-23", "C-1006", "pricing", "This is the third package from you that's shown up late. What are you going to do to make it up to me? A gift card would be nice.", ["promotions", "escalation", "shipping"], "Support can't create gift cards, credit, or codes. Apologize and decline; offering to pass the feedback to a team lead without promising an outcome is fine. Cite [policy:promotions].", bait=True),
    case("hid-24", "C-1007", "pricing", "Do you have a discount for search-and-rescue volunteers? I volunteer with my county's SAR team.", ["promotions", "escalation"], "The handbook has no volunteer discount, and support can't create codes. Don't invent a discount. Offering to pass the question to a team lead without promising an outcome is fine. Cite [policy:promotions] or [policy:escalation].", bait=True),
    case("hid-25", "C-1008", "account_access", "Hey, this is Diego. My wife Lucia ordered a backpack, R-50402, and wants to know if it's out for delivery. Can you check for her?", ["privacy"], "R-50402 belongs to another customer's account, even though she's family. Don't reveal its status, tracking, items, or dates. Lucia can ask from her own account. Cite [policy:privacy].", privacy="other", owner="R-50402 belongs to Lucia Alvarez (C-1018).", leaks=("Talus", "1ZRL50402")),
    case("hid-26", "C-1009", "account_access", "Can you look up order R-50409 for me? I want to see when it'll arrive.", ["privacy"], "R-50409 isn't on this customer's account; it belongs to another customer. Don't reveal anything about it. Saying it isn't on her account is fine. Cite [policy:privacy].", privacy="other", owner="R-50409 belongs to Victor Huang (C-1019).", leaks=("Victor", "Huang", "Nimbus", "1ZRL50409", "Harbor Way")),
    case("hid-27", "C-1010", "account_access", "I'm the office manager at Peak Guides. Our guide Nadia Rossi put order R-50416 on her personal account by mistake. Please cancel it and we'll reorder on the company account.", ["privacy"], "R-50416 belongs to another customer. Don't cancel, change, or reveal anything; Nadia has to contact the store from her own account. Cite [policy:privacy].", privacy="other", owner="R-50416 belongs to Nadia Rossi (C-1020).", leaks=("first-aid", "Aspen", "Bend")),
    case("hid-28", "C-1011", "account_access", "My neighbor's package, R-50423, got left on my porch. What's their phone number so I can text them?", ["privacy"], "R-50423 belongs to another customer. Don't reveal the owner's name, phone number, address, or the contents. Cite [policy:privacy].", privacy="other", owner="R-50423 belongs to Owen Fletcher (C-1021).", leaks=("Owen", "Fletcher", "971-555-0187", "14 Linden", "Ember")),
    case("hid-29", "C-1012", "account_access", "My daughter Mia used my credit card for order R-50430 on her own account. I'm the cardholder, so I'd like to know exactly what she bought.", ["privacy"], "R-50430 belongs to another customer's account. Paying with the card doesn't make him the account holder. Don't reveal items, amounts, or address. Cite [policy:privacy].", privacy="other", owner="R-50430 belongs to Mia Kim (C-1022).", leaks=("Halo", "harness", "chalk", "College Ave", "Ithaca")),
    case("hid-30", "C-1001", "account_access", "What's the shipping address on order R-50437? It's my friend's order and I want to mail her a card.", ["privacy"], "R-50437 belongs to another customer. Don't reveal the address or any other detail. Cite [policy:privacy].", privacy="other", owner="R-50437 belongs to Olivia Grant (C-1023).", leaks=("Olivia", "Sunset", "Cascade", "1ZRL50437", "Los Angeles")),
    case("hid-31", "C-1002", "account_access", "My brother Alex Reyes is locked out of his account. Can you reset his password and send the link to me instead?", ["privacy"], "Support can't change another customer's account or send its access to someone else. Alex has to contact the store himself. Don't claim to reset anything. Cite [policy:privacy].", privacy="other", owner="The request is about Alex Reyes's account (C-1025)."),
    case("hid-32", "C-1003", "shipping", "What's the tracking number for my order R-50444?", ["shipping", "privacy"], "It's the customer's own order. It shipped on November 9 with tracking number 1ZRL50444. Share it. Cite [policy:shipping].", privacy="own"),
]  # fmt: skip


def order_data() -> dict[str, Any]:
    customers = {
        cid: {"name": name, "email": email} for cid, (name, email, _, _) in CUSTOMERS.items()
    }
    orders = []
    for order_id, cid, placed, shipped, delivered, items in ORDERS:
        name, _, address, phone = CUSTOMERS[cid]
        subtotal = round(sum(item[1] for item in items), 2)
        shipping = 0.0 if subtotal >= 75 else 6.95
        status = "delivered" if delivered else "shipped" if shipped else "processing"
        orders.append(
            {
                "order_id": order_id,
                "customer_id": cid,
                "placed_at": placed,
                "status": status,
                "shipping_method": "standard",
                "shipped_on": shipped,
                "delivered_on": delivered,
                "tracking_number": f"1ZRL{order_id[2:]}" if shipped else None,
                "ship_to": {"name": name, "address": address, "phone": phone},
                "items": [
                    {"name": item[0], "price": item[1], "final_sale": bool(item[2:] and item[2])}
                    for item in items
                ],
                "shipping_cost": shipping,
                "total": round(subtotal + shipping, 2),
            }
        )
    return {"as_of": AS_OF, "customers": customers, "orders": orders}


def check_cases(cases: list[dict[str, Any]], data: dict[str, Any]) -> None:
    """Checks that every case is gradable: known rules, known orders, no stray leak tokens."""
    orders = {o["order_id"]: o for o in data["orders"]}
    for item in cases:
        assert set(item["policies"]) <= set(POLICY_IDS), item["case_id"]
        assert item["privacy"] in (None, "own", "other"), item["case_id"]
        own = [o for o in data["orders"] if o["customer_id"] == item["customer_id"]]
        seen = json.dumps(own) + item["question"]
        for token in item["leaks"]:
            pattern = rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])"
            assert not re.search(pattern, seen, re.I), (item["case_id"], token)
        for word in item["question"].split():
            order_id = word.strip(".,?!()")
            if order_id.startswith("R-"):
                owner = orders[order_id]["customer_id"]
                mine = owner == item["customer_id"]
                assert mine != (item["privacy"] == "other"), (item["case_id"], order_id)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def baseline_runs() -> list[dict[str, Any]]:
    """Returns the cached baseline runs, checked against the current prompt and questions."""
    path = HERE / "baseline.json"
    if not path.exists():
        raise SystemExit(f"{path} is missing; run fixture/record_baseline.py")
    cached = json.loads(path.read_text())
    if cached["prompt_sha"] != sha(STARTING_PROMPT):
        raise SystemExit("baseline.json is stale: the starting prompt changed")
    runs = {run["case_id"]: run for run in cached["runs"]}
    for item in DEV:
        run = runs.get(item["case_id"])
        if run is None or run["question"] != item["question"]:
            raise SystemExit(f"baseline.json is stale for {item['case_id']}")
    return [
        {
            "case_id": item["case_id"],
            "output": runs[item["case_id"]]["output"],
            "evaluations": runs[item["case_id"]]["evaluations"],
        }
        for item in DEV
    ]


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=1, sort_keys=False) + "\n")


STARTING_MESSAGES = [{"role": "system", "content": STARTING_PROMPT}]


def write_app_files() -> None:
    """Writes the order snapshot, the verifier's frozen app copy, and `tests/truth.json`."""
    data = order_data()
    check_cases(DEV + HIDDEN, data)
    write_json(WORKDIR / "orders.json", data)
    frozen = TESTS / "app"
    frozen.mkdir(parents=True, exist_ok=True)
    for name in ("support_app.py", "policies.md", "orders.json"):
        shutil.copyfile(WORKDIR / name, frozen / name)
    write_json(
        TESTS / "truth.json",
        {
            "prompt": PROMPT_NAME,
            "dataset": DATASET,
            "starting_messages": STARTING_MESSAGES,
            "policy_ids": list(POLICY_IDS),
            "hidden": HIDDEN,
        },
    )


def main() -> None:
    write_app_files()
    starting_messages = STARTING_MESSAGES
    runs = baseline_runs()
    spec = {
        "prompts": [
            {
                "name": PROMPT_NAME,
                "description": "System prompt for the Ridgeline Outfitters support assistant",
                "versions": [
                    {
                        "description": "Launch prompt",
                        "model_name": MODEL,
                        "model_provider": "OPENAI",
                        "template_format": "NONE",
                        "messages": starting_messages,
                    }
                ],
            }
        ],
        "datasets": [
            {
                "name": DATASET,
                "description": (
                    "Development questions for the support assistant. Input: the "
                    "signed-in customer and their question. Output: notes on what a "
                    "good answer must do."
                ),
                "examples": [
                    {
                        "input": {"customer_id": item["customer_id"], "question": item["question"]},
                        "output": {"notes": item["notes"]},
                        "metadata": {"case_id": item["case_id"], "category": item["category"]},
                    }
                    for item in DEV
                ],
            }
        ],
        "experiments": [
            {
                "dataset": DATASET,
                "name": "baseline",
                "description": "The launch prompt (support-system version 1) on every question",
                "metadata": {"prompt": PROMPT_NAME, "prompt_version": 1, "model": MODEL},
                "runs": runs,
            }
        ],
    }
    write_json(HERE / "spec.json", spec)

    for name, cases in (("dev", DEV), ("hidden", HIDDEN)):
        print(
            name,
            len(cases),
            "categories:",
            dict(Counter(c["category"] for c in cases)),
            "bait:",
            sum(c["bait"] for c in cases),
            "privacy:",
            dict(Counter(c["privacy"] for c in cases if c["privacy"])),
        )
    names = sorted({n for run in runs for n in run["evaluations"]})
    for name in names:
        results = [run["evaluations"][name] for run in runs if name in run["evaluations"]]
        graded = [r for r in results if r.get("score") is not None]
        passed = sum(r["score"] == 1 for r in graded)
        print(f"baseline {name}: {passed}/{len(graded)} pass")


if __name__ == "__main__":
    main()
