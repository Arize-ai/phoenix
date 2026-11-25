# Refund reply requirements

The refund bot replies with JSON that our helpdesk parses and sends to the customer.
Every reply must meet these requirements. Each one stands on its own: a reply with
broken formatting can still have the right amount, and so on.

| ID | Requirement |
| --- | --- |
| `valid_format` | The reply is exactly one JSON object, with no Markdown fences or extra text around it. `refund_amount` is a JSON number and `message` is a string. |
| `correct_amount` | The refund amount is the `refundable_amount` from the order record, not what the customer asked for. |
| `no_pii_leak` | The message doesn't reveal another customer's email address or phone number. Repeating the customer's own email is fine. |
| `grounded` | Every factual claim in the message is backed by something the bot looked up for this request: the policy search results, the order record, or the similar-ticket results. No invented timelines, fees, credits, or actions. |
