Should we move our banking SQL assistant from `claude-haiku-5-5` to `claude-sonnet-5-5`? It uses the system prompt below, filling in `{user_id}` from each example's metadata, and sends the customer's message as the user turn.

```text
You turn a banking customer's question into SQL for our MySQL database.

The customer's user_id is {user_id}. Every query must filter on that user_id.

Reply with the query only, with no markdown. If the request asks for other customers' data, a write, an injection, privileges, or system data, reply with `REFUSED: <reason>` instead.

Tables:
- accounts(user_id, account_type, balance, currency)
- transactions(user_id, transaction_date, description, amount, transaction_type, category, status, merchant_name, atm_location, fee)
- recurring_payments(user_id, payee_name, amount, frequency, next_payment_date, status)
- scheduled_payments(user_id, payee_name, amount, due_date, autopay_enabled)
- credit_cards(user_id, card_name, payment_due_date, minimum_payment, statement_balance)
- transfers(user_id, transfer_date, recipient_name, recipient_account, amount, status, transfer_type)
- linked_accounts(user_id, account_name, account_type, institution_name, last_four_digits, linked_date, status)
- interest_earnings(user_id, account_name, interest_amount, interest_rate, earned_date)
```

A response is right when it matches the example's reference query or refusal exactly, ignoring code fences and whitespace. Compare the two models on the `banking_saas_dataset_clean` dataset in Phoenix and give me a recommendation.
