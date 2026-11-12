"""Build the policy-assistant traces for `rag-evals`.

Writes `fixture/spec.json` (the 54 production traces the agent sees) and
`tests/truth.json` (their document and answer labels, plus 24 unseen traces and labels
that the verifier adds before rerunning the agent's eval script). Run from the
repository root:

    uv run python evals/harbor/tasks/phoenix-evals/rag-evals/fixture/build.py

Each question has exactly one passage in the knowledge base that answers it. Each case
gets a retrieval outcome and an answer type, assigned independently:

- Retrieval: the answering passage comes back first (`top`), comes back at position 1
  to 3 (`lower`), or doesn't come back (`miss`). The other passages come from a
  hand-picked list of near topics that share words with the question but don't answer it.
- Answer: restates the answering passage (`faithful`), contradicts it (`contradicts`),
  adds a claim no passage states (`adds_claim`), states a made-up policy (`made_up`),
  states the true policy that wasn't retrieved (`unretrieved_truth`), or says it can't
  find the answer (`declines`). Only `faithful` and `declines` are grounded.

Retrieval misses outnumber ungrounded answers, so retrieval is the bigger problem.
Unseen traces use questions, answer wordings, refusals, and unsupported claims that the
visible traces never show.
"""

from __future__ import annotations

import random
import sys
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "environments" / "fixtures"))
from support_traces import BASE, Trace, write_json  # noqa: E402

PROJECT = "policy-rag"
SYSTEM_PROMPT = (HERE.parent / "workdir" / "policy_assistant.py").read_text().split('"""')[3]


@dataclass(frozen=True)
class Policy:
    """One knowledge-base passage and the questions and answers built around it.

    `answer`, `wrong`, and `extra` hold a visible wording and an unseen wording.
    """

    key: str
    topic: str
    text: str
    questions: tuple[str, ...]
    unseen_questions: tuple[str, ...]
    answer: tuple[str, str]
    wrong: tuple[str, str]
    extra: tuple[str, str]


POLICIES = [
    Policy(
        key="returns-window",
        topic="the return window",
        text=(
            "Unused items in their original packaging can be returned within 30 days of "
            "delivery. We can't accept returns after day 30."
        ),
        questions=(
            "It's been three weeks since my boots were delivered and I never wore them. Is that too long to send them back?",
            "What's the cutoff for returning something I ordered online?",
            "How many days after delivery do I have to return an item?",
        ),
        unseen_questions=(
            "My tent showed up on the 2nd and it's still sealed in the box. Today is the 24th. Can I still return it?",
            "Quick question about returns: is there a time limit, and when does it start counting?",
        ),
        answer=(
            "Unused items in their original packaging can be returned within 30 days of delivery. After day 30, we can't accept the return.",
            "You can return an unused item in its original packaging up to 30 days after it's delivered. After that, returns aren't accepted.",
        ),
        wrong=(
            "You can return items for up to 60 days after delivery, even if you've used them.",
            "Returns are accepted for 90 days from the purchase date as long as you have the receipt.",
        ),
        extra=(
            "Returns started on a weekend get two extra days.",
            "Holiday purchases can be returned until January 31.",
        ),
    ),
    Policy(
        key="returns-final-sale",
        topic="final sale items",
        text="Items marked Final Sale on the product page can't be returned or exchanged for any reason.",
        questions=(
            "I bought a fleece that was marked Final Sale and it doesn't fit. Can I send it back?",
            "Can I exchange a clearance item that said final sale when I ordered it?",
        ),
        unseen_questions=(
            "The sleeping bag I got was one of those final sale deals. Am I stuck with it?",
        ),
        answer=(
            "Items marked Final Sale can't be returned or exchanged for any reason.",
            "Final Sale items aren't eligible for a return or an exchange, whatever the reason.",
        ),
        wrong=(
            "Final Sale items can be exchanged for a different size within 14 days, but they can't be refunded.",
            "Final Sale items can be returned for store credit within 30 days.",
        ),
        extra=(
            "Final Sale items also don't qualify for price adjustments.",
            "Final Sale items are marked in red at checkout.",
        ),
    ),
    Policy(
        key="returns-label-fee",
        topic="return label fees",
        text=(
            "Return labels are free when you exchange an item. If you return an item for a "
            "refund, we deduct a $6.95 label fee from the refund."
        ),
        questions=(
            "Do I have to pay for the shipping label if I send something back for a refund?",
            "Is there a charge for return shipping if I just want a different size?",
        ),
        unseen_questions=("What does it cost me to mail back a jacket I don't want anymore?",),
        answer=(
            "Return labels are free for exchanges. If you return an item for a refund, a $6.95 label fee is deducted from your refund.",
            "Exchanges come with a free return label, while refunds have a $6.95 label fee taken out of the amount we send back.",
        ),
        wrong=(
            "Return shipping is always free, whether you want a refund or an exchange.",
            "We charge a $12 return label fee, and it applies to exchanges too.",
        ),
        extra=(
            "The label fee is waived for orders over $100.",
            "You can print the label at home or show a QR code at the post office.",
        ),
    ),
    Policy(
        key="returns-restocking",
        topic="restocking fees",
        text=(
            "Opened electronics, such as headphones, speakers, and smart watches, are "
            "refunded minus a 15% restocking fee."
        ),
        questions=(
            "Is there a restocking fee if I return headphones I've already opened?",
            "What percentage do you keep when someone returns an opened smart watch?",
        ),
        unseen_questions=(
            "I unboxed a bluetooth speaker and tried it once. If I send it back, is anything taken off my refund for that?",
        ),
        answer=(
            "Opened electronics like headphones, speakers, and smart watches are refunded minus a 15% restocking fee.",
            "Because it's opened electronics, the refund is the price minus a 15% restocking fee.",
        ),
        wrong=(
            "There's no restocking fee on opened electronics as long as you return them within 30 days.",
            "Opened electronics have a 25% restocking fee.",
        ),
        extra=(
            "The restocking fee is waived if the item is defective.",
            "Rewards members don't pay the restocking fee.",
        ),
    ),
    Policy(
        key="returns-in-store",
        topic="in-store returns",
        text=(
            "Online orders can be returned at any of our retail stores. Bring the packing "
            "slip or the order confirmation email."
        ),
        questions=(
            "Can I drop off something I bought on the website at one of your shops?",
            "What do I need to bring if I return my online order in person?",
            "Is it possible to take a web order back to a physical store instead of mailing it?",
        ),
        unseen_questions=(
            "There's a branch of yours near my office. Will they take back an order I placed through the app?",
        ),
        answer=(
            "Online orders can be returned at any of our retail stores. Bring the packing slip or your order confirmation email.",
            "Any of our retail stores can take back an online order, as long as you bring the packing slip or the confirmation email.",
        ),
        wrong=(
            "Online orders can only be returned by mail; our stores can't process them.",
            "Stores accept online returns only with a printed receipt and a photo ID.",
        ),
        extra=(
            "In-store returns are refunded on the spot.",
            "Store returns are processed faster than mailed ones.",
        ),
    ),
    Policy(
        key="refund-timing",
        topic="refund timing",
        text=(
            "After the warehouse receives a return, the refund reaches your original payment "
            "method within 5 to 7 business days."
        ),
        questions=(
            "I mailed my return last week. When will the money be back on my card?",
            "How long do refunds take once you get the item back?",
            "When should I expect to see my refund after you've received the return?",
        ),
        unseen_questions=(
            "Tracking says you got my returned boots on Monday. Roughly when does the credit hit my account?",
        ),
        answer=(
            "Once the warehouse receives your return, the refund reaches your original payment method within 5 to 7 business days.",
            "Refunds land on your original payment method 5 to 7 business days after the warehouse receives the return.",
        ),
        wrong=(
            "Refunds are issued within 24 hours of receiving your return.",
            "Refunds take 2 to 3 weeks and are issued as store credit.",
        ),
        extra=(
            "You'll get an email with a refund confirmation number when it's issued.",
            "Your bank may take another day or two to show it on your statement.",
        ),
    ),
    Policy(
        key="billing-duplicate-charge",
        topic="duplicate charges",
        text=(
            "Seeing two charges for one order? The second is a temporary card authorization, "
            "and it disappears on its own within 3 business days."
        ),
        questions=(
            "My bank statement shows I was charged twice for the same order. What happened?",
            "Why is there an extra pending charge on my credit card from you?",
        ),
        unseen_questions=(
            "I see the same amount from you two times on my card. Should I dispute one of them?",
        ),
        answer=(
            "The second charge is a temporary card authorization. It disappears on its own within 3 business days.",
            "The extra charge is a temporary authorization hold, and it drops off by itself within 3 business days.",
        ),
        wrong=(
            "That's a billing error on our side. We'll refund the duplicate charge within 10 business days.",
            "The second charge is a membership fee that's billed with your first order.",
        ),
        extra=(
            "This only happens with Visa and Mastercard.",
            "Your bank can release the hold sooner if you call them.",
        ),
    ),
    Policy(
        key="billing-payment-methods",
        topic="payment methods",
        text=(
            "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. We don't "
            "accept checks, money orders, or cryptocurrency."
        ),
        questions=("Can I pay with PayPal?", "Do you take Bitcoin or other crypto?"),
        unseen_questions=("Is Amex okay, or only Visa and Mastercard?",),
        answer=(
            "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. We don't accept checks, money orders, or cryptocurrency.",
            "You can pay with Visa, Mastercard, American Express, PayPal, or Apple Pay, but not with checks, money orders, or crypto.",
        ),
        wrong=(
            "We accept all major cards and Bitcoin, but not PayPal.",
            "We accept Visa and Mastercard only.",
        ),
        extra=(
            "Google Pay works too.",
            "Cards are charged when the order ships, not when you place it.",
        ),
    ),
    Policy(
        key="billing-price-adjustment",
        topic="price adjustments",
        text=(
            "If an item you bought goes on sale within 14 days of purchase, contact us and "
            "we'll refund the difference. Price adjustments are limited to one per item."
        ),
        questions=(
            "I bought a rain jacket last week and now it's 20% off. Can I get the difference back?",
            "Do you do anything if something I just bought drops in price?",
            "The stove I ordered 5 days ago is cheaper today. Is there anything you can do?",
        ),
        unseen_questions=(
            "Ugh, the backpack I paid full price for 10 days ago is on sale now. Any chance of a partial refund?",
        ),
        answer=(
            "If an item goes on sale within 14 days of your purchase, contact us and we'll refund the difference. That's limited to one price adjustment per item.",
            "If the price dropped within 14 days of your purchase, contact us and we'll refund the difference, once per item.",
        ),
        wrong=(
            "We don't offer price adjustments once an order has been placed.",
            "We'll match any lower price within 60 days, including competitors' prices.",
        ),
        extra=(
            "The difference is refunded as store credit.",
            "We also match prices from other retailers.",
        ),
    ),
    Policy(
        key="billing-installments",
        topic="installment payments",
        text=(
            "Orders over $150 can be split into 4 interest-free payments made every two "
            "weeks. Choose Pay in 4 at checkout."
        ),
        questions=(
            "Can I spread the cost of a $300 tent over a few payments?",
            "Do you have any kind of buy now, pay later option?",
        ),
        unseen_questions=("Is there a way to avoid paying for my whole order up front?",),
        answer=(
            "Orders over $150 can be split into 4 interest-free payments every two weeks. Choose Pay in 4 at checkout.",
            "If your order is over $150, you can pick Pay in 4 at checkout and pay in 4 interest-free installments, one every two weeks.",
        ),
        wrong=(
            "You can split any order into 6 monthly payments with 5% interest.",
            "We don't offer installment plans; the full amount is charged at checkout.",
        ),
        extra=(
            "Using Pay in 4 doesn't affect your credit score.",
            "There's a $2 fee for each installment.",
        ),
    ),
    Policy(
        key="shipping-standard",
        topic="standard shipping",
        text=(
            "Standard shipping is free on orders over $50 and arrives 3 to 5 business days "
            "after the order ships."
        ),
        questions=(
            "How much do I have to spend to get free shipping?",
            "If I go with regular shipping, how long until my order arrives?",
            "What's the delivery time for the normal, non-express option?",
        ),
        unseen_questions=("My cart is at $42. Will I pay for standard delivery?",),
        answer=(
            "Standard shipping is free on orders over $50 and arrives 3 to 5 business days after your order ships.",
            "Orders over $50 ship free with standard shipping, which arrives 3 to 5 business days after the order ships.",
        ),
        wrong=(
            "Standard shipping is free on every order and arrives in 2 business days.",
            "You need to spend $100 for free shipping, and standard delivery takes about 10 business days.",
        ),
        extra=(
            "Standard orders ship from our warehouse in Denver.",
            "Carriers don't deliver standard orders on Sundays.",
        ),
    ),
    Policy(
        key="shipping-express",
        topic="express shipping",
        text=(
            "Express shipping costs $14.95 and delivers in 1 to 2 business days for orders "
            "placed before 1 p.m. Eastern."
        ),
        questions=(
            "How much does it cost to get my order faster?",
            "If I order before lunch, how quickly can express get it to me?",
        ),
        unseen_questions=(
            "I need these boots by Friday. What's your fastest delivery and what does it cost?",
        ),
        answer=(
            "Express shipping costs $14.95 and delivers in 1 to 2 business days for orders placed before 1 p.m. Eastern.",
            "Our fastest option is express shipping: $14.95, with delivery in 1 to 2 business days if you order before 1 p.m. Eastern.",
        ),
        wrong=(
            "Express shipping is $9.99 and arrives the next day no matter when you order.",
            "Overnight shipping costs $29 and is guaranteed by 10 a.m.",
        ),
        extra=(
            "Express orders include Saturday delivery at no extra charge.",
            "Express shipping is free for rewards members.",
        ),
    ),
    Policy(
        key="shipping-international",
        topic="shipping outside the US",
        text=(
            "We ship only within the US and to Canada. Canadian orders take 7 to 14 business "
            "days, and the recipient pays any customs duties."
        ),
        questions=(
            "Do you deliver to Australia?",
            "How long does an order take to get to Toronto?",
            "If I order to Vancouver, who pays the import fees?",
        ),
        unseen_questions=("I'm in the UK. Can I order from you?",),
        answer=(
            "We ship only within the US and to Canada. Canadian orders take 7 to 14 business days, and the recipient pays any customs duties.",
            "We only ship within the US and to Canada. Orders to Canada arrive in 7 to 14 business days, and the recipient pays any customs duties.",
        ),
        wrong=(
            "We ship worldwide, and international orders arrive within 5 business days.",
            "We ship to the US, Canada, and the UK, and we cover all customs duties.",
        ),
        extra=(
            "Canadian orders over $200 ship free.",
            "Prices are shown in Canadian dollars for Canadian orders.",
        ),
    ),
    Policy(
        key="orders-address-change",
        topic="address changes",
        text=(
            "You can edit the shipping address from the Orders page for 1 hour after "
            "checkout. After that, the order has gone to the warehouse and the address is "
            "locked."
        ),
        questions=(
            "I typed the wrong street on my order 20 minutes ago. Can I fix it?",
            "How do I change where my package is being shipped?",
        ),
        unseen_questions=(
            "I just moved and the order I placed yesterday has my old address. Is it too late to update it?",
        ),
        answer=(
            "You can edit the shipping address from the Orders page for 1 hour after checkout. After that, the order has gone to the warehouse and the address is locked.",
            "Addresses can be changed on the Orders page only within 1 hour of checkout. Once that hour passes, the order is at the warehouse and the address can't be changed.",
        ),
        wrong=(
            "You can change the address any time before the order is delivered by calling us.",
            "Address changes are allowed for 24 hours after checkout.",
        ),
        extra=(
            "If the address is wrong, the carrier forwards the package for free.",
            "You can also ask the carrier to redirect the package for a small fee.",
        ),
    ),
    Policy(
        key="orders-cancel",
        topic="order cancellations",
        text="You can cancel an order from your account until it ships. Most orders ship within 24 hours.",
        questions=(
            "I want to cancel the order I placed this morning. Is that possible?",
            "How long do I have to cancel an order?",
        ),
        unseen_questions=("Changed my mind about yesterday's purchase. Can I still call it off?",),
        answer=(
            "You can cancel an order from your account until it ships. Most orders ship within 24 hours.",
            "Orders can be canceled from your account up until they ship, which usually happens within 24 hours.",
        ),
        wrong=(
            "Orders can't be canceled once they're placed; you'll need to return the items instead.",
            "You can cancel within 7 days of placing an order, even if it has shipped.",
        ),
        extra=("Canceled orders are refunded instantly.", "There's a $5 fee to cancel an order."),
    ),
    Policy(
        key="shipping-lost-package",
        topic="missing packages",
        text=(
            "If tracking says delivered but you never got the package, report it within 7 "
            "days and we'll ship a replacement at no cost."
        ),
        questions=(
            "Tracking says my package was delivered yesterday, but there's nothing at my door. What now?",
            "The carrier marked my order delivered but I never got it. Can you help?",
        ),
        unseen_questions=(
            "My order shows as delivered but it was never in my mailbox. How long do I have to let you know?",
        ),
        answer=(
            "If tracking says delivered but you never got the package, report it within 7 days and we'll ship a replacement at no cost.",
            "Report it within 7 days and we'll send you a replacement at no cost.",
        ),
        wrong=(
            "Once the carrier marks a package delivered, we can't replace it; you'll need to file a claim with the carrier.",
            "You have 30 days to report a missing package, and we'll refund you once the carrier's investigation is done.",
        ),
        extra=(
            "We'll also refund your original shipping cost.",
            "Missing packages usually turn up with a neighbor within a day or two.",
        ),
    ),
    Policy(
        key="warranty-coverage",
        topic="warranty coverage",
        text=(
            "Our gear has a 1-year limited warranty against defects in materials and "
            "workmanship. Normal wear and tear, accidents, and misuse aren't covered."
        ),
        questions=(
            "How long is the warranty on your gear?",
            "I dropped my headlamp off a cliff and it broke. Does the warranty cover that?",
            "What kinds of problems does your warranty cover?",
        ),
        unseen_questions=(
            "The seam on my 10-month-old jacket split open on its own. Is that something the warranty handles?",
        ),
        answer=(
            "Our gear has a 1-year limited warranty against defects in materials and workmanship. Normal wear and tear, accidents, and misuse aren't covered.",
            "The warranty lasts 1 year and covers defects in materials or workmanship, but not normal wear, accidents, or misuse.",
        ),
        wrong=(
            "Everything we sell has a lifetime warranty that covers any damage, including accidents.",
            "Our warranty lasts 3 years and covers accidental damage.",
        ),
        extra=(
            "Electronics get an extra year of coverage.",
            "The warranty transfers to anyone you give the item to.",
        ),
    ),
    Policy(
        key="warranty-claim",
        topic="warranty claims",
        text=(
            "To start a warranty claim, upload a photo of the defect with your order number "
            "on the Warranty page. Approved claims get a replacement within 10 business days."
        ),
        questions=(
            "What's the process for filing a warranty claim?",
            "What happens after I submit a warranty request?",
        ),
        unseen_questions=(
            "I need to make a warranty claim on my stove. What do I have to send you, and where?",
        ),
        answer=(
            "Upload a photo of the defect with your order number on the Warranty page. Approved claims get a replacement within 10 business days.",
            "Go to the Warranty page and upload a photo of the defect with your order number. If the claim is approved, you'll get a replacement within 10 business days.",
        ),
        wrong=(
            "Mail the item back to us with a note, and we'll refund you in full once we inspect it.",
            "Warranty claims have to be made in person at a retail store.",
        ),
        extra=(
            "You'll hear back about approval within 48 hours.",
            "Most claims are approved within 2 business days.",
        ),
    ),
    Policy(
        key="account-password",
        topic="password resets",
        text=(
            "To reset your password, choose Forgot password on the sign-in page. The reset "
            "link we email you expires after 1 hour."
        ),
        questions=(
            "I forgot my password. How do I get back into my account?",
            "The reset link you sent me yesterday doesn't work anymore. Why?",
        ),
        unseen_questions=(
            "I'm locked out of my account. What are the steps to set a new password?",
        ),
        answer=(
            "Choose Forgot password on the sign-in page and we'll email you a reset link. The link expires after 1 hour.",
            "Select Forgot password on the sign-in page. We'll email you a link to set a new password, and it's valid for 1 hour.",
        ),
        wrong=(
            "Call customer support and we'll reset your password over the phone; reset links never expire.",
            "Reset links are valid for 7 days, so you can use the one we already sent.",
        ),
        extra=(
            "Each reset link can only be used once.",
            "Resetting your password signs you out on all your devices.",
        ),
    ),
    Policy(
        key="account-delete",
        topic="account deletion",
        text=(
            "You can delete your account under Settings > Privacy. Deletion is permanent, and "
            "your order history is erased after 30 days."
        ),
        questions=(
            "How do I close my account for good?",
            "If I delete my account, what happens to my past orders?",
        ),
        unseen_questions=("I'd like to remove my profile and all my data. How do I do that?",),
        answer=(
            "You can delete your account under Settings > Privacy. Deletion is permanent, and your order history is erased after 30 days.",
            "Go to Settings > Privacy to delete your account. It can't be undone, and your order history is erased 30 days later.",
        ),
        wrong=(
            "Email us and we'll deactivate your account; you can reactivate it any time within a year.",
            "Deleted accounts keep their order history for 7 years.",
        ),
        extra=(
            "Any unused rewards points are paid out as a gift card when you delete your account.",
            "You'll get a confirmation email once the deletion is complete.",
        ),
    ),
    Policy(
        key="loyalty-points",
        topic="rewards points",
        text=(
            "Rewards members earn 1 point per dollar. Every 100 points becomes a $5 reward, "
            "and points expire after 12 months without a purchase."
        ),
        questions=(
            "How many points do I need before I get a reward?",
            "Do my rewards points ever expire?",
        ),
        unseen_questions=("I haven't shopped in a while. Will I lose the points I've built up?",),
        answer=(
            "Members earn 1 point per dollar, and every 100 points becomes a $5 reward. Points expire after 12 months without a purchase.",
            "You earn 1 point per dollar, 100 points turn into a $5 reward, and your points expire if you go 12 months without a purchase.",
        ),
        wrong=(
            "Points never expire, and every 50 points is worth $10.",
            "Points expire 90 days after you earn them, whether or not you shop.",
        ),
        extra=(
            "You earn double points during your birthday month.",
            "Rewards can't be used on sale items.",
        ),
    ),
    Policy(
        key="promo-codes",
        topic="promo codes",
        text=(
            "Only one promo code can be applied per order, and promo codes don't work on "
            "items that are already on sale."
        ),
        questions=(
            "Can I use two discount codes on one order?",
            "My promo code got rejected on a sale item. Is that normal?",
            "Is there a limit on how many coupon codes I can stack?",
        ),
        unseen_questions=(
            "I have a 10% off code and a free-gift code. Can I enter both at checkout?",
        ),
        answer=(
            "Only one promo code can be applied per order, and promo codes don't work on items that are already on sale.",
            "You can use one promo code per order, and it won't apply to items that are already on sale.",
        ),
        wrong=(
            "You can combine up to three promo codes on one order, including on sale items.",
            "Promo codes can be stacked as long as your order is over $100.",
        ),
        extra=(
            "Promo codes expire 30 days after they're issued.",
            "Codes are case-sensitive, so type them exactly as shown.",
        ),
    ),
    Policy(
        key="gift-cards",
        topic="gift cards",
        text=(
            "Gift cards never expire and can't be exchanged for cash. A lost gift card can be "
            "replaced only with the original receipt."
        ),
        questions=(
            "Does the gift card my aunt gave me have an expiration date?",
            "Can I cash out the balance on a gift card?",
        ),
        unseen_questions=("I lost a gift card I got for my birthday. Can you replace it?",),
        answer=(
            "Gift cards never expire and can't be exchanged for cash. A lost gift card can be replaced only with the original receipt.",
            "We can replace a lost gift card only if you have the original receipt. Gift cards don't expire, but they can't be turned into cash.",
        ),
        wrong=(
            "Gift cards expire 2 years after purchase, and balances under $10 can be paid out in cash.",
            "We can replace a lost gift card if you know the card number, no receipt needed.",
        ),
        extra=(
            "Gift cards can also be used in our retail stores.",
            "You can check your balance by calling the number on the back of the card.",
        ),
    ),
]
BY_KEY = {policy.key: policy for policy in POLICIES}
# Passages that share a topic or wording with a policy's questions but don't answer them.
NEAR = {
    "returns-window": "returns-final-sale returns-label-fee returns-in-store refund-timing gift-cards account-delete",
    "returns-final-sale": "returns-label-fee returns-in-store billing-price-adjustment promo-codes refund-timing gift-cards",
    "returns-label-fee": "returns-window returns-final-sale refund-timing shipping-express shipping-standard warranty-claim",
    "returns-restocking": "returns-window returns-final-sale returns-in-store warranty-coverage refund-timing billing-price-adjustment",
    "returns-in-store": "returns-window returns-label-fee returns-final-sale orders-cancel shipping-lost-package gift-cards",
    "refund-timing": "billing-duplicate-charge returns-label-fee billing-price-adjustment returns-window shipping-standard loyalty-points",
    "billing-duplicate-charge": "refund-timing billing-payment-methods billing-price-adjustment orders-cancel promo-codes loyalty-points",
    "billing-payment-methods": "gift-cards billing-duplicate-charge promo-codes loyalty-points refund-timing shipping-international",
    "billing-price-adjustment": "promo-codes returns-final-sale refund-timing loyalty-points billing-duplicate-charge returns-window",
    "billing-installments": "billing-payment-methods billing-duplicate-charge gift-cards promo-codes shipping-standard loyalty-points",
    "shipping-standard": "shipping-international shipping-lost-package returns-label-fee billing-installments orders-address-change promo-codes",
    "shipping-express": "shipping-international shipping-lost-package orders-address-change returns-label-fee billing-installments account-password",
    "shipping-international": "shipping-lost-package orders-address-change returns-label-fee billing-payment-methods gift-cards orders-cancel",
    "orders-address-change": "shipping-lost-package account-delete shipping-international account-password shipping-express returns-in-store",
    "orders-cancel": "returns-window returns-final-sale account-delete shipping-lost-package billing-duplicate-charge promo-codes",
    "shipping-lost-package": "shipping-standard shipping-express shipping-international orders-address-change returns-in-store warranty-claim",
    "warranty-coverage": "warranty-claim returns-window returns-restocking shipping-lost-package gift-cards account-delete",
    "warranty-claim": "warranty-coverage returns-in-store shipping-lost-package returns-label-fee account-password refund-timing",
    "account-password": "account-delete orders-address-change loyalty-points gift-cards orders-cancel billing-payment-methods",
    "account-delete": "account-password orders-cancel loyalty-points gift-cards orders-address-change promo-codes",
    "loyalty-points": "gift-cards promo-codes billing-price-adjustment account-delete billing-installments account-password",
    "promo-codes": "loyalty-points billing-price-adjustment gift-cards returns-final-sale billing-installments shipping-standard",
    "gift-cards": "loyalty-points promo-codes billing-payment-methods refund-timing returns-final-sale account-delete",
}
DOC_ID = {policy.key: f"kb-{4100 + 13 * index}" for index, policy in enumerate(POLICIES)}

DECLINES = {
    "visible": [
        "I couldn't find anything in our policies about that, so I can't give you a reliable answer.",
        "Sorry, the policy passages I have don't cover this, and I don't want to guess.",
        "I don't have policy information on that. Could you tell me a bit more about your order?",
    ],
    "unseen": [
        "None of the policies I found address this, so I'd rather not give you a wrong answer.",
        "I found our policies on {a} and {b}, but neither one answers your question, so I can't say for sure.",
        "I'm afraid that isn't covered by the policy information available to me.",
    ],
}

# (retrieval, answer type): number of cases.
MIX = {
    "visible": {
        ("top", "faithful"): 16,
        ("top", "contradicts"): 2,
        ("top", "adds_claim"): 1,
        ("lower", "faithful"): 11,
        ("lower", "contradicts"): 1,
        ("lower", "adds_claim"): 1,
        ("miss", "declines"): 12,
        ("miss", "made_up"): 6,
        ("miss", "unretrieved_truth"): 4,
    },
    "unseen": {
        ("top", "faithful"): 6,
        ("top", "contradicts"): 2,
        ("top", "adds_claim"): 1,
        ("lower", "faithful"): 4,
        ("lower", "contradicts"): 1,
        ("lower", "adds_claim"): 1,
        ("miss", "declines"): 3,
        ("miss", "made_up"): 3,
        ("miss", "unretrieved_truth"): 3,
    },
}
GROUNDED = {"faithful", "declines"}


def check_corpus() -> None:
    assert len(POLICIES) == len(BY_KEY)
    for policy in POLICIES:
        near = NEAR[policy.key].split()
        assert policy.key not in near and len(set(near)) == len(near) >= 4, policy.key
        assert set(near) <= set(BY_KEY), policy.key


def answer_text(
    policy: Policy, kind: str, split: str, passages: list[Policy], rng: random.Random
) -> str:
    wording = 0 if split == "visible" else 1
    if kind in ("faithful", "unretrieved_truth"):
        return policy.answer[wording]
    if kind in ("contradicts", "made_up"):
        return policy.wrong[wording]
    if kind == "adds_claim":
        if split == "visible":
            return f"{policy.answer[wording]} {policy.extra[wording]}"
        first, _, rest = policy.answer[wording].partition(". ")
        if not rest:
            return f"{policy.extra[wording]} {policy.answer[wording]}"
        return f"{first}. {policy.extra[wording]} {rest}"
    template = rng.choice(DECLINES[split])
    return template.format(a=passages[0].topic, b=passages[1].topic)


def make_case(
    index: int,
    split: str,
    rng: random.Random,
    policy: Policy,
    question: str,
    retrieval: str,
    kind: str,
    position: int,
) -> dict[str, Any]:
    passages = [
        BY_KEY[key] for key in rng.sample(NEAR[policy.key].split(), 4 if retrieval == "miss" else 3)
    ]
    if retrieval != "miss":
        passages.insert(position, policy)
    score = rng.uniform(0.74, 0.9)
    documents = []
    for passage in passages:
        documents.append(
            {"id": DOC_ID[passage.key], "content": passage.text, "score": round(score, 3)}
        )
        score -= rng.uniform(0.015, 0.06)
    answer = answer_text(policy, kind, split, passages, rng)

    start = BASE + timedelta(hours=index * 2.9 + (24 * 9 if split == "unseen" else 0))
    trace = Trace(
        f"rag-evals:{split}:{index}", start=start, root_name="rag-query", root_kind="CHAIN"
    )
    retriever = trace.retrieve(question, documents, name="retrieve_policies")
    context = "\n".join(f"[{i}] {p.text}" for i, p in enumerate(passages, start=1))
    trace.llm(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Policy passages:\n{context}\n\nCustomer question: {question}",
            },
        ],
        answer,
    )
    trace.finish(question, answer)
    span_id = retriever["context"]["span_id"]
    return {
        "trace_id": trace.trace_id,
        "spans": trace.spans,
        "relevant": {f"{span_id}:{k}": p.key == policy.key for k, p in enumerate(passages)},
        "grounded": kind in GROUNDED,
        "case": {"policy": policy.key, "retrieval": retrieval, "answer": kind},
    }


def build_split(split: str, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    attribute = "questions" if split == "visible" else "unseen_questions"
    questions = [(p, q) for p in POLICIES for q in getattr(p, attribute)]
    plan = [case for case, count in MIX[split].items() for _ in range(count)]
    assert len(plan) == len(questions), (split, len(plan), len(questions))
    rng.shuffle(questions)
    rng.shuffle(plan)
    cases = []
    lower = 0
    for index, ((policy, question), (retrieval, kind)) in enumerate(zip(questions, plan)):
        position = 0
        if retrieval == "lower":
            position, lower = 1 + lower % 3, lower + 1
        cases.append(make_case(index, split, rng, policy, question, retrieval, kind, position))
    return cases


def labels(cases: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "relevant": {key: value for case in cases for key, value in case["relevant"].items()},
        "grounded": {case["trace_id"]: case["grounded"] for case in cases},
        "cases": {case["trace_id"]: case["case"] for case in cases},
    }


def summarize(name: str, cases: list[dict[str, Any]]) -> dict[str, int]:
    documents = [v for case in cases for v in case["relevant"].values()]
    counts = {
        "traces": len(cases),
        "relevant_documents": sum(documents),
        "irrelevant_documents": len(documents) - sum(documents),
        "retrieval_misses": sum(case["case"]["retrieval"] == "miss" for case in cases),
        "ungrounded": sum(not case["grounded"] for case in cases),
        "ungrounded_with_relevant": sum(
            not case["grounded"] and case["case"]["retrieval"] != "miss" for case in cases
        ),
    }
    print(name, counts)
    return counts


def main() -> None:
    check_corpus()
    visible = build_split("visible", seed=31)
    unseen = build_split("unseen", seed=47)
    counts = summarize("visible", visible)
    summarize("unseen", unseen)
    assert counts["retrieval_misses"] > counts["ungrounded"] > counts["ungrounded_with_relevant"]
    write_json(
        HERE / "spec.json",
        {"projects": {PROJECT: [span for case in visible for span in case["spans"]]}},
    )
    write_json(
        HERE.parent / "tests" / "truth.json",
        {
            "project": PROJECT,
            "bigger_problem": "retrieval",
            "visible": labels(visible),
            "unseen": {"spans": [s for case in unseen for s in case["spans"]], **labels(unseen)},
        },
    )


if __name__ == "__main__":
    main()
