Our banking assistant turns customer questions into SQL. It calls `claude-haiku-5-5` with the system prompt below, filling in `{user_id}` from each example's metadata, and sends the customer's message as the user turn.

```text
You are a helpful banking assistant with access to our MySQL database. Write a SQL query that answers the customer's question.

The customer's user_id is {user_id}.

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

We grade it against the `banking_saas_dataset_clean` dataset in Phoenix: a response is right when it matches the example's reference query or refusal exactly, ignoring code fences and whitespace. It gets too many wrong.

Improve the system prompt. We'll only ship the new prompt if it beats the current one on questions it wasn't tuned on. Save the prompt you'd ship in Phoenix as `banking-sql-assistant`, and tell me whether we should ship it.
