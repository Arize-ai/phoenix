from phoenix.client import Client

client = Client()

# Add a single note to a span
result = client.spans.add_span_note(
    span_id="72dda197b0e1b3ef",
    note="This span shows interesting behavior that warrants further investigation.",
)

print(f"Note created with ID: {result['id']}")

# Multiple notes can be added to the same span
# Each note gets a unique timestamp-based identifier automatically
result2 = client.spans.add_span_note(
    span_id="72dda197b0e1b3ef",
    note="Follow-up: investigated and found the issue was related to timeout settings.",
)

print(f"Second note created with ID: {result2['id']}")
