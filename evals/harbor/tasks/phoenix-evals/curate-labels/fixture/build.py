"""Build the reviewed support-bot traces for `curate-labels`.

Writes `fixture/spec.json` (90 support-bot traces and their `review` annotations, which
the agent sees in Phoenix) and `tests/truth.json` (which traces belong in the dataset,
their verdicts, and the text the verifier looks for). Run from the repository root:

    uv run python evals/harbor/tasks/phoenix-evals/curate-labels/fixture/build.py

Each trace gets one review history, chosen by category. The seeder writes annotations in
list order, so a review written in a later round is newer. Every eligible trace's latest
human verdict matches its reply by construction: a `supported` reply restates only the
help article and workspace record, and an `unsupported` reply adds or contradicts a fact.
Earlier reviews and pre-labels that disagree are the wrong ones.
"""

from __future__ import annotations

import json
import random
import re
import sys
from collections import Counter
from datetime import timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "support-bot-reviews"
DATASET = "grounding-golden"
REVIEW = "review"
HUMANS = ("alice", "bob", "carmen", "dmitri")
PRELABELER = "prelabel-bot"
SUPPORTED, UNSUPPORTED, NEEDS_REVIEW = "supported", "unsupported", "needs_review"

SYSTEM_PROMPT = (
    "You are Tasklane's support assistant. Answer the customer's question using only the "
    "help center articles and the workspace record provided. Be brief and friendly."
)

# Each topic: the help article the reply should rest on, the workspace fields the reply
# relies on, customer questions, replies that use only that context, and replies that
# add or contradict a fact.
TOPICS: list[dict[str, Any]] = [
    {
        "key": "csv-export",
        "title": "Exporting a board",
        "article": (
            "You can export any board to CSV from the board menu (Export > CSV). Exports "
            "are available on every plan. CSV files include task titles, assignees, due "
            "dates, and custom fields, but not attachments or comments."
        ),
        "workspace": {"plan": "Starter"},
        "questions": [
            "How do I export my board to a spreadsheet?",
            "Can I get my tasks out as a CSV on the Starter plan?",
            "Is there a way to download everything on a board, attachments included?",
        ],
        "good": [
            "Open the board menu and choose Export > CSV. It's available on your Starter "
            "plan. The file includes titles, assignees, due dates, and custom fields; "
            "attachments and comments aren't included.",
            "From the board menu, pick Export, then CSV. Every plan can export, and the CSV "
            "covers task titles, assignees, due dates, and custom fields, but not "
            "attachments or comments.",
        ],
        "bad": [
            "Open the board menu and choose Export > CSV. The export bundles every "
            "attachment into a ZIP file alongside the spreadsheet.",
            "CSV export is a Pro feature, so you'll need to upgrade from Starter first. "
            "After that, use the board menu and choose Export > CSV.",
        ],
    },
    {
        "key": "guests",
        "title": "Inviting guests",
        "article": (
            "Guests can view and comment on the boards they're invited to. Pro workspaces "
            "include 10 free guest seats and Business workspaces include 50. Starter "
            "workspaces can't invite guests. Guests beyond the free seats are billed as "
            "members."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "How many outside collaborators can we invite without paying?",
            "Do guests count against our seats on Pro?",
            "We want to add a few clients to one board. What does that cost?",
        ],
        "good": [
            "On Pro you get 10 free guest seats. Guests can view and comment on the boards "
            "you invite them to, and any guests past those 10 are billed as members.",
            "Your Pro workspace includes 10 guest seats at no cost. Guests can view and "
            "comment on boards they're invited to; beyond 10, extra guests are billed "
            "like members.",
        ],
        "bad": [
            "On Pro you get 10 free guest seats, and guests can also create and edit tasks "
            "on any board in the workspace.",
            "Pro workspaces get unlimited free guests, so you can invite as many clients "
            "as you like.",
        ],
    },
    {
        "key": "two-factor",
        "title": "Two-factor authentication",
        "article": (
            "Turn on two-factor authentication under Settings > Security. You can use an "
            "authenticator app or SMS codes. On the Business plan, workspace admins can "
            "require two-factor authentication for every member."
        ),
        "workspace": {"plan": "Business"},
        "questions": [
            "How do I turn on 2FA for my account?",
            "Can I make two-factor mandatory for my whole team?",
            "Does Tasklane have two-step login?",
        ],
        "good": [
            "Go to Settings > Security to turn on two-factor authentication with an "
            "authenticator app or SMS codes. Since you're on Business, admins can also "
            "require it for every member.",
            "Two-factor authentication is under Settings > Security, with an authenticator "
            "app or SMS. Your Business plan also lets workspace admins make it mandatory "
            "for all members.",
        ],
        "bad": [
            "Go to Settings > Security to turn on two-factor authentication. Hardware "
            "security keys like YubiKey also work there.",
            "Two-factor authentication is under Settings > Security. Once an admin requires "
            "it, members who don't enroll within 7 days are locked out automatically.",
        ],
    },
    {
        "key": "downgrade",
        "title": "Changing your plan",
        "article": (
            "When you downgrade, the change takes effect at the end of your current billing "
            "period. Boards and data that exceed the new plan's limits become read-only; "
            "nothing is deleted."
        ),
        "workspace": {"plan": "Pro", "billing_cycle": "annual"},
        "questions": [
            "If I downgrade to Starter today, when does it kick in?",
            "What happens to my boards if we drop from Pro to Starter?",
            "Will downgrading delete any of our data?",
        ],
        "good": [
            "A downgrade takes effect at the end of your current billing period. Anything "
            "over the Starter limits becomes read-only, and nothing gets deleted.",
            "You'll keep Pro until the current billing period ends, then the downgrade "
            "applies. Boards over the Starter limits turn read-only rather than being "
            "deleted.",
        ],
        "bad": [
            "A downgrade takes effect right away, and we refund the unused part of your "
            "annual Pro plan.",
            "The downgrade applies at the end of your billing period. Boards over the "
            "Starter limit are archived and deleted after 90 days.",
        ],
    },
    {
        "key": "annual-refund",
        "title": "Refunds",
        "article": (
            "Annual plans can be refunded on a pro-rata basis if you cancel within 30 days "
            "of purchase. After 30 days, annual plans aren't refundable. Monthly plans "
            "aren't refundable."
        ),
        "workspace": {"plan": "Business", "billing_cycle": "annual", "subscription_age_days": 12},
        "questions": [
            "We bought the annual plan by mistake. Can we get our money back?",
            "Is the annual subscription refundable?",
            "How do refunds work if we cancel our yearly plan?",
        ],
        "good": [
            "Annual plans get a pro-rata refund if you cancel within 30 days of purchase. "
            "Your subscription started 12 days ago, so you're still inside that window.",
            "You can cancel for a pro-rata refund because you're within 30 days of buying "
            "the annual plan; your subscription began 12 days ago. After day 30, annual "
            "plans aren't refundable.",
        ],
        "bad": [
            "Annual plans are fully refundable within 60 days, so you'll get the whole "
            "amount back.",
            "You're within the 30-day window, so you'll get a pro-rata refund. We'll also "
            "add a month of credit for the trouble.",
        ],
    },
    {
        "key": "trash",
        "title": "Restoring deleted boards",
        "article": (
            "Deleted boards stay in Trash for 30 days. Workspace admins can restore them "
            "from Settings > Trash. After 30 days, boards are permanently deleted and can't "
            "be recovered."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "I accidentally deleted a board yesterday. Can I get it back?",
            "How long do deleted boards stick around?",
            "Someone on my team removed our roadmap board. Is it gone for good?",
        ],
        "good": [
            "Deleted boards stay in Trash for 30 days. A workspace admin can restore one "
            "from Settings > Trash; after 30 days it's permanently deleted.",
            "A workspace admin can bring it back from Settings > Trash, as long as it's "
            "been less than 30 days. After that, the board can't be recovered.",
        ],
        "bad": [
            "Deleted boards stay in Trash for 30 days, and any member can restore them "
            "from the board list.",
            "Deleted boards stay in Trash for 30 days. After that, our team can still "
            "recover them from backups for up to a year.",
        ],
    },
    {
        "key": "calendar",
        "title": "Calendar sync",
        "article": (
            "Sync due dates to Google Calendar or Outlook from Settings > Integrations. "
            "Calendar sync is available on the Pro and Business plans. Changes sync every "
            "15 minutes."
        ),
        "workspace": {"plan": "Starter"},
        "questions": [
            "Can I see my task due dates in Google Calendar?",
            "Does Tasklane sync with Outlook?",
            "Why aren't my due dates showing up in my calendar?",
        ],
        "good": [
            "Calendar sync with Google Calendar and Outlook is available on Pro and "
            "Business. Your workspace is on Starter, so you'd need to upgrade to turn it "
            "on in Settings > Integrations.",
            "Due dates can sync to Google Calendar or Outlook from Settings > Integrations, "
            "but it's a Pro and Business feature. Your Starter plan doesn't include it.",
        ],
        "bad": [
            "Calendar sync works on every plan, including Starter. Turn it on in Settings > "
            "Integrations and changes appear within 15 minutes.",
            "Calendar sync is a Pro and Business feature. Apple Calendar is also available "
            "on the same settings page.",
        ],
    },
    {
        "key": "upload-limit",
        "title": "File size limits",
        "article": (
            "The maximum size for a single attachment is 10 MB on Starter, 250 MB on Pro, "
            "and 1 GB on Business."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "What's the biggest file I can attach to a task?",
            "I'm getting an error uploading a 300 MB video. What's the limit?",
            "Is there a file size cap on attachments?",
        ],
        "good": [
            "On your Pro plan, each attachment can be up to 250 MB. Business raises that "
            "to 1 GB per file.",
            "The limit for a single attachment on Pro is 250 MB, so larger files won't "
            "upload. Business workspaces can attach files up to 1 GB.",
        ],
        "bad": [
            "On your Pro plan, each attachment can be up to 2 GB.",
            "Pro allows 250 MB per attachment, and you can raise it by linking a Google "
            "Drive account in Settings.",
        ],
    },
    {
        "key": "sso",
        "title": "Single sign-on",
        "article": (
            "SAML single sign-on is available on the Business plan. Tasklane works with "
            "Okta, Microsoft Entra ID, and Google Workspace as identity providers. Admins "
            "configure it under Settings > Security > SSO."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "Can we log in with Okta?",
            "Do you offer SAML SSO on our current plan?",
            "How do we set up single sign-on for our company?",
        ],
        "good": [
            "SAML single sign-on, including Okta, is part of the Business plan. You're on "
            "Pro, so you'd need to upgrade before an admin can set it up under Settings > "
            "Security > SSO.",
            "Single sign-on works with Okta, Microsoft Entra ID, and Google Workspace, but "
            "it's only on Business. Your workspace is on Pro right now.",
        ],
        "bad": [
            "SAML single sign-on is included on Pro, so an admin can set up Okta under "
            "Settings > Security > SSO today.",
            "SSO is a Business feature and works with Okta, Microsoft Entra ID, Google "
            "Workspace, and OneLogin.",
        ],
    },
    {
        "key": "api-limits",
        "title": "API rate limits",
        "article": (
            "The REST API allows 100 requests per minute per token on Pro and 500 per "
            "minute on Business. Starter workspaces don't have API access. Requests over "
            "the limit return HTTP 429."
        ),
        "workspace": {"plan": "Business"},
        "questions": [
            "What's the API rate limit for our workspace?",
            "We keep getting 429 errors from the API. Why?",
            "How many API calls can we make per minute?",
        ],
        "good": [
            "Your Business workspace can make 500 API requests per minute per token. "
            "Requests above that return HTTP 429.",
            "On Business the limit is 500 requests per minute for each token; going over "
            "it returns a 429 error.",
        ],
        "bad": [
            "Your Business workspace has a limit of 5,000 API requests per minute per token.",
            "Business allows 500 requests per minute per token, and the limit resets every "
            "hour if you go over.",
        ],
    },
    {
        "key": "ownership",
        "title": "Transferring ownership",
        "article": (
            "Only the current workspace owner can transfer ownership, from Settings > "
            "Members. The new owner must already be an admin of the workspace."
        ),
        "workspace": {"plan": "Business"},
        "questions": [
            "Our workspace owner left the company. How do we change the owner?",
            "How do I make someone else the owner of our workspace?",
            "Can an admin take over ownership of the workspace?",
        ],
        "good": [
            "Ownership can only be transferred by the current owner, from Settings > "
            "Members, and the new owner has to be an admin already.",
            "The current owner transfers ownership in Settings > Members. Whoever takes "
            "over needs to be a workspace admin first.",
        ],
        "bad": [
            "Any admin can make themselves the owner from Settings > Members.",
            "The current owner transfers ownership in Settings > Members. If the owner has "
            "left, our team can reassign it within one business day.",
        ],
    },
    {
        "key": "recurring",
        "title": "Recurring tasks",
        "article": (
            "Recurring tasks are available on every plan. Open a task's menu and choose "
            "Repeat to set a daily, weekly, or monthly schedule. A new copy is created when "
            "the previous one is completed."
        ),
        "workspace": {"plan": "Starter"},
        "questions": [
            "Can I make a task repeat every week?",
            "Is there a way to set up recurring tasks on Starter?",
            "How do repeating tasks work?",
        ],
        "good": [
            "Recurring tasks work on every plan, including Starter. Open the task menu, "
            "choose Repeat, and pick daily, weekly, or monthly; the next copy appears when "
            "you complete the current one.",
            "Open the task's menu and pick Repeat, then choose a daily, weekly, or monthly "
            "schedule. A fresh copy is created each time the previous one is completed.",
        ],
        "bad": [
            "Open the task menu and choose Repeat. You can also set custom schedules, like "
            "every second Tuesday.",
            "Recurring tasks are a Pro feature, so they aren't available on Starter.",
        ],
    },
    {
        "key": "offline",
        "title": "Using the mobile apps offline",
        "article": (
            "The iOS and Android apps keep the boards you opened in the last 7 days "
            "available offline. Edits you make offline sync when you reconnect. "
            "Attachments can't be opened offline."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "Does the mobile app work without internet?",
            "Can I edit tasks on a plane and have them sync later?",
            "What can I do in the app when I'm offline?",
        ],
        "good": [
            "The iOS and Android apps keep boards you've opened in the last 7 days "
            "available offline. Edits you make offline sync when you reconnect, but "
            "attachments won't open until you're back online.",
            "You can edit offline, and changes sync when you reconnect. The apps keep the "
            "boards you've opened in the past 7 days; attachments aren't available "
            "offline.",
        ],
        "bad": [
            "The apps keep all of your boards available offline indefinitely, and edits "
            "sync when you reconnect.",
            "Edits you make offline sync when you reconnect. Attachments under 50 MB are "
            "also cached for offline viewing.",
        ],
    },
    {
        "key": "invoice-details",
        "title": "Updating invoice details",
        "article": (
            "Billing admins can change the company name, address, and tax ID on invoices "
            "under Billing > Invoice details. Changes apply to future invoices only; past "
            "invoices can't be reissued."
        ),
        "workspace": {"plan": "Business"},
        "questions": [
            "Our company moved. How do I update the address on our invoices?",
            "Can you fix the company name on last month's invoice?",
            "Where do I add our VAT number to invoices?",
        ],
        "good": [
            "A billing admin can update the company name, address, and tax ID under "
            "Billing > Invoice details. The change applies to future invoices; past "
            "invoices can't be reissued.",
            "Head to Billing > Invoice details (you'll need to be a billing admin). Updates "
            "show up on future invoices only, and earlier invoices can't be reissued.",
        ],
        "bad": [
            "Update it under Billing > Invoice details, and we'll automatically reissue "
            "your past invoices with the new details.",
            "Any member can change the company name and address under Billing > Invoice details.",
        ],
    },
    {
        "key": "seat-billing",
        "title": "How seat changes are billed",
        "article": (
            "Adding a member partway through a billing cycle is charged pro rata on your "
            "next invoice. Removing a member credits the unused days to your account "
            "balance; credits aren't paid out as refunds."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "If I add three people mid-month, how are we billed?",
            "Do we get money back when we remove a member?",
            "How does billing work when our team size changes?",
        ],
        "good": [
            "New members added mid-cycle are charged pro rata on your next invoice. When "
            "you remove someone, the unused days go to your account balance as credit "
            "rather than a refund.",
            "Adding members partway through the cycle shows up as a pro-rata charge on the "
            "next invoice. Removing members credits the unused days to your balance; "
            "credits aren't paid out.",
        ],
        "bad": [
            "Members added mid-cycle are free until your next renewal, and you're only "
            "charged from then on.",
            "Removing a member refunds the unused days to your card within 5 business days.",
        ],
    },
    {
        "key": "data-residency",
        "title": "Data residency",
        "article": (
            "Business workspaces can choose EU or US data residency when the workspace is "
            "created. Existing workspaces can't be moved to another region."
        ),
        "workspace": {"plan": "Business", "data_region": "US"},
        "questions": [
            "Can we store our data in the EU?",
            "Is it possible to move our workspace to European servers?",
            "Where is our workspace data hosted?",
        ],
        "good": [
            "Business workspaces pick EU or US data residency when they're created. Your "
            "workspace is in the US region, and existing workspaces can't be moved to "
            "another region.",
            "Your workspace data is hosted in the US. Data residency is chosen when a "
            "workspace is created, and an existing workspace can't be moved to the EU.",
        ],
        "bad": [
            "Your workspace is in the US region, but an admin can switch it to EU hosting "
            "from Settings > Data at any time.",
            "Your data is in the US region. We can migrate it to the EU for a one-time fee.",
        ],
    },
    {
        "key": "trial",
        "title": "Pro trial",
        "article": (
            "The Pro trial lasts 14 days and doesn't need a credit card. When it ends, the "
            "workspace moves to Starter unless someone upgrades."
        ),
        "workspace": {"plan": "Pro trial", "trial_days_left": 5},
        "questions": [
            "What happens when my trial ends?",
            "Do I need to enter a card for the Pro trial?",
            "How long is the free trial?",
        ],
        "good": [
            "The Pro trial lasts 14 days and doesn't need a credit card. You have 5 days "
            "left; after that the workspace moves to Starter unless you upgrade.",
            "No card is needed for the 14-day Pro trial. When it ends, in 5 days for you, "
            "your workspace switches to Starter unless someone upgrades.",
        ],
        "bad": [
            "The Pro trial lasts 30 days, and you have 5 days left.",
            "When the trial ends, we'll charge the card on file and move you to Pro automatically.",
        ],
    },
    {
        "key": "slack",
        "title": "Slack integration",
        "article": (
            "Connect Slack under Settings > Integrations > Slack to post task updates to a "
            "channel. Each board can post to one Slack channel."
        ),
        "workspace": {"plan": "Pro"},
        "questions": [
            "Can Tasklane post updates to Slack?",
            "How do I send board notifications to two Slack channels?",
            "Where do I set up the Slack integration?",
        ],
        "good": [
            "Connect Slack under Settings > Integrations > Slack, and task updates will "
            "post to a channel. Each board can post to one channel.",
            "Set it up in Settings > Integrations > Slack; each board posts its task "
            "updates to a single Slack channel.",
        ],
        "bad": [
            "Connect Slack under Settings > Integrations > Slack. Each board can post to "
            "as many channels as you like.",
            "Connect Slack under Settings > Integrations > Slack, and you can also create "
            "tasks by reacting to messages with an emoji.",
        ],
    },
]

CUSTOMERS = [
    ("Maria", "Lopez"), ("Dev", "Patel"), ("Sam", "Okafor"), ("Lena", "Fischer"),
    ("Tom", "Nguyen"), ("Aisha", "Khan"), ("Jonas", "Berg"), ("Chloe", "Martin"),
    ("Ravi", "Iyer"), ("Grace", "Kim"), ("Omar", "Haddad"), ("Nina", "Rossi"),
    ("Pablo", "Reyes"), ("Hana", "Sato"), ("Felix", "Wagner"), ("Zoe", "Adams"),
]  # fmt: skip
COMPANIES = [
    "Brightpath Studio", "Northwind Labs", "Cobalt Logistics", "Juniper Health",
    "Atlas Robotics", "Fernwood Events", "Kestrel Media", "Orchid Analytics",
    "Pinecrest Legal", "Summit Outfitters", "Tidewater Foods", "Willow Architecture",
]  # fmt: skip
OPENERS = ["Hi {first}! ", "Hi {first}, thanks for reaching out. ", "Thanks for asking, {first}. "]
CLOSERS = ["", " Let me know if anything else comes up.", " Happy to help with anything else."]

NOTES = {
    SUPPORTED: [
        "Matches the help article.",
        "Checked against the docs; all correct.",
        "Everything here is in the retrieved article.",
        "Plan details line up with the workspace record.",
        "Accurate per the KB.",
        "Correct steps and limits.",
    ],
    UNSUPPORTED: [
        "Adds a detail the help article doesn't mention.",
        "Contradicts the KB article.",
        "Made-up policy, not in the docs.",
        "One claim isn't backed by anything retrieved.",
        "Wrong limit compared with the article.",
        "Promises something we don't offer.",
    ],
    NEEDS_REVIEW: [
        "Not sure about this one, flagging for a second look.",
        "Need to check with billing before signing off.",
        "Docs are ambiguous here; second opinion please.",
        "Couldn't verify the plan details, leaving open.",
    ],
}
PRELABEL_NOTES = {
    SUPPORTED: "Auto-label: claims match the retrieved context.",
    UNSUPPORTED: "Auto-label: reply makes claims not found in the context.",
}

# Review rounds, written in this order. Human reviews in round 1 come before those in
# round 2, with other annotations written between them (see `other_annotations`).
EARLY_PRELABEL, FIRST_REVIEW, SECOND_REVIEW, LATE_PRELABEL = 0, 1, 2, 3

# Category: (count, included in the dataset). Each category's review history is built
# in `review_history`.
CATEGORIES: dict[str, tuple[int, bool]] = {
    "single_review": (23, True),
    "reviewers_agree": (3, True),
    "reviewers_disagree": (6, True),
    "needs_review_then_verdict": (4, True),
    "prelabel_disagrees_before_review": (4, True),
    "prelabel_disagrees_after_review": (4, True),
    "prelabel_agrees": (4, True),
    "duplicate_text": (4, True),
    "verdict_then_needs_review": (4, False),
    "needs_review_only": (3, False),
    "prelabel_only": (13, False),
    "prelabel_then_needs_review": (3, False),
    "unreviewed": (15, False),
}
FORBIDDEN_IN_TEXT = re.compile(r"supported|needs.?review|grounded", re.IGNORECASE)


def flip(label: str) -> str:
    return UNSUPPORTED if label == SUPPORTED else SUPPORTED


def review_history(category: str, truth: str, rng: random.Random) -> list[tuple[int, str, str]]:
    """Returns (round, reviewer, label) for each `review` annotation on one trace."""
    first, second = rng.sample(HUMANS, 2)
    early_or_late = rng.choice([EARLY_PRELABEL, LATE_PRELABEL])
    histories = {
        "single_review": [(FIRST_REVIEW, first, truth)],
        "duplicate_text": [(FIRST_REVIEW, first, truth)],
        "reviewers_agree": [(FIRST_REVIEW, first, truth), (SECOND_REVIEW, second, truth)],
        "reviewers_disagree": [
            (FIRST_REVIEW, first, flip(truth)),
            (SECOND_REVIEW, second, truth),
        ],
        "needs_review_then_verdict": [
            (FIRST_REVIEW, first, NEEDS_REVIEW),
            (SECOND_REVIEW, second, truth),
        ],
        "prelabel_disagrees_before_review": [
            (EARLY_PRELABEL, PRELABELER, flip(truth)),
            (FIRST_REVIEW, first, truth),
        ],
        "prelabel_disagrees_after_review": [
            (FIRST_REVIEW, first, truth),
            (LATE_PRELABEL, PRELABELER, flip(truth)),
        ],
        "prelabel_agrees": [(early_or_late, PRELABELER, truth), (FIRST_REVIEW, first, truth)],
        "verdict_then_needs_review": [
            (FIRST_REVIEW, first, truth),
            (SECOND_REVIEW, second, NEEDS_REVIEW),
        ],
        "needs_review_only": [(FIRST_REVIEW, first, NEEDS_REVIEW)],
        "prelabel_only": [(early_or_late, PRELABELER, truth)],
        "prelabel_then_needs_review": [
            (early_or_late, PRELABELER, truth),
            (FIRST_REVIEW, first, NEEDS_REVIEW),
        ],
        "unreviewed": [],
    }
    return histories[category]


def plan_cases(rng: random.Random) -> list[dict[str, Any]]:
    """Returns one case per trace, in time order, with category and true verdict."""
    cases: list[dict[str, Any]] = []
    for category, (count, included) in CATEGORIES.items():
        for index in range(count):
            # Duplicate pairs share a verdict: indexes 0 and 1 are one pair, 2 and 3 another.
            pair = index // 2 if category == "duplicate_text" else None
            position = pair if pair is not None else index
            truth = SUPPORTED if position % 2 == 0 else UNSUPPORTED
            cases.append({"category": category, "included": included, "truth": truth, "pair": pair})
    rng.shuffle(cases)
    return cases


def context_for(topic: dict[str, Any], company: str, rng: random.Random) -> dict[str, Any]:
    others = rng.sample([t for t in TOPICS if t is not topic], 2)
    documents = [
        {"id": f"kb-{t['key']}", "content": f"{t['title']}: {t['article']}", "score": score}
        for t, score in zip([topic, *others], (0.91, 0.62, 0.55))
    ]
    workspace = {
        "workspace": company,
        "plan": "Pro",
        "billing_cycle": "monthly",
        "seats_used": rng.randint(4, 60),
        **topic["workspace"],
    }
    return {"documents": documents, "workspace": workspace}


def build_trace(
    index: int, case: dict[str, Any], text: dict[str, Any], rng: random.Random
) -> dict[str, Any]:
    first, last = text["customer"]
    company = text["company"]
    context = context_for(text["topic"], company, rng)
    email = f"{first.lower()}.{last.lower()}@{company.split()[0].lower()}.example.com"
    start = BASE + timedelta(hours=index * 1.3 + rng.random())
    trace = Trace(f"curate-labels:{index}", start=start, root_name="support-bot", user_id=email)
    trace.tool("get_workspace", {"user_email": email}, context["workspace"])
    trace.retrieve(text["question"], context["documents"], name="search_help_center")
    articles = "\n\n".join(d["content"] for d in context["documents"])
    trace.llm(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Workspace record: {json.dumps(context['workspace'])}\n\n"
                    f"Help center articles:\n{articles}\n\n"
                    f"Customer question: {text['question']}"
                ),
            },
        ],
        text["reply"],
    )
    trace.finish(text["question"], text["reply"])
    return {"trace": trace, "context": context}


def other_annotations(trace: Trace, rng: random.Random) -> list[dict[str, Any]]:
    """Returns end-user feedback and nightly evals on a trace, none of which are reviews.

    They also put about 430 writes between the two human review rounds. Phoenix stores
    annotation timestamps to the second, so the gap keeps a second review from sharing a
    timestamp with the first.
    """
    tool, retriever, llm = (span["context"]["span_id"] for span in trace.children)
    found: list[dict[str, Any]] = []
    if rng.random() < 0.8:
        up = rng.random() < 0.7
        found.append(
            {
                "name": "user_feedback",
                "span_id": trace.root_id,
                "annotator_kind": "HUMAN",
                "result": {"label": "thumbs_up" if up else "thumbs_down", "score": float(up)},
            }
        )
    for span_id, kind, name, good, bad, rate in (
        (llm, "LLM", "helpfulness", "helpful", "unhelpful", 0.75),
        (llm, "LLM", "tone", "friendly", "curt", 0.9),
        (tool, "CODE", "tool_ok", "ok", "error", 1.0),
        (retriever, "CODE", "retrieval_hit", "hit", "miss", 1.0),
    ):
        ok = rng.random() < rate
        found.append(
            {
                "name": name,
                "span_id": span_id,
                "annotator_kind": kind,
                "identifier": "nightly-evals",
                "result": {"label": good if ok else bad, "score": float(ok)},
            }
        )
    return found


def write_texts(cases: list[dict[str, Any]], rng: random.Random) -> list[dict[str, Any]]:
    """Picks a topic, question, and reply per case. Only duplicate pairs share text."""
    seen: set[tuple[str, str]] = set()
    pair_texts: dict[int, dict[str, Any]] = {}
    texts = []
    for index, case in enumerate(cases):
        customer = CUSTOMERS[index % len(CUSTOMERS)]
        company = COMPANIES[(index * 5) % len(COMPANIES)]
        if case["pair"] is not None and case["pair"] in pair_texts:
            texts.append({**pair_texts[case["pair"]], "customer": customer, "company": company})
            continue
        while True:
            topic = TOPICS[rng.randrange(len(TOPICS))]
            question = rng.choice(topic["questions"])
            body = rng.choice(topic["good" if case["truth"] == SUPPORTED else "bad"])
            if case["pair"] is not None:
                reply = body  # A templated answer two customers can both receive.
            else:
                opener = rng.choice(OPENERS).format(first=customer[0])
                reply = opener + body + rng.choice(CLOSERS)
            if (question, reply) not in seen:
                break
        seen.add((question, reply))
        text = {"topic": topic, "question": question, "reply": reply}
        if case["pair"] is not None:
            pair_texts[case["pair"]] = text
        texts.append({**text, "customer": customer, "company": company})
    return texts


def main() -> None:
    rng = random.Random(41)
    cases = plan_cases(rng)
    texts = write_texts(cases, rng)
    spans: list[dict[str, Any]] = []
    rounds: dict[int, list[dict[str, Any]]] = {r: [] for r in range(4)}
    between_rounds: list[dict[str, Any]] = []
    truth_traces: dict[str, dict[str, Any]] = {}
    eligible: dict[str, str] = {}
    for index, (case, text) in enumerate(zip(cases, texts)):
        built = build_trace(index, case, text, rng)
        trace = built["trace"]
        spans.extend(trace.spans)
        notes = []
        for round_, reviewer, label in review_history(case["category"], case["truth"], rng):
            human = reviewer != PRELABELER
            note = rng.choice(NOTES[label]) if human else PRELABEL_NOTES[label]
            notes.append(note)
            result: dict[str, Any] = {"label": label, "explanation": note}
            annotation: dict[str, Any] = {
                "name": REVIEW,
                "span_id": trace.root_id,
                "annotator_kind": "HUMAN" if human else "LLM",
                "identifier": reviewer,
                "result": result,
                "metadata": {} if human else {"model": "gpt-5.6-mini", "prompt": "grounding-v3"},
            }
            if not human:
                result["score"] = 1.0 if label == SUPPORTED else 0.0
            rounds[round_].append(annotation)
        between_rounds.extend(other_annotations(trace, rng))
        if case["included"]:
            eligible[trace.trace_id] = case["truth"]
        truth_traces[trace.trace_id] = {
            "category": case["category"],
            "root_span_id": trace.root_id,
            "question": text["question"],
            "reply": text["reply"],
            "notes": notes,
        }
        checked = json.dumps([SYSTEM_PROMPT, text["question"], text["reply"], built["context"]])
        if FORBIDDEN_IN_TEXT.search(checked) or any(n.lower() in checked.lower() for n in notes):
            raise ValueError(f"case {index}: trace text contains a label word or a note")

    for written_together in rounds.values():
        rng.shuffle(written_together)
    ordered = (
        rounds[EARLY_PRELABEL] + rounds[FIRST_REVIEW] + between_rounds
        + rounds[SECOND_REVIEW] + rounds[LATE_PRELABEL]
    )  # fmt: skip
    write_json(HERE / "spec.json", {"projects": {PROJECT: spans}, "span_annotations": ordered})
    write_json(
        HERE.parent / "tests" / "truth.json",
        {"project": PROJECT, "dataset": DATASET, "eligible": eligible, "traces": truth_traces},
    )

    pairs = Counter((t["question"], t["reply"]) for t in truth_traces.values())
    print(f"{len(truth_traces)} traces, {len(ordered)} annotations")
    print("eligible:", len(eligible), dict(Counter(eligible.values())))
    print("excluded:", len(truth_traces) - len(eligible))
    print("categories:", dict(Counter(c["category"] for c in cases)))
    print("traces sharing question and reply text:", sum(n for n in pairs.values() if n > 1))


if __name__ == "__main__":
    main()
