# Annotation bar follow-ups

## Information intentionally removed with the old detail headers

The production trace header above the trace tree/span-detail master-detail view
was removed. That makes trace status, total cost, latency, and the direct “View
Session” action unavailable in that location. The old root-span and trace
annotation summaries were also removed there; the new fixed annotation bar now
represents session, trace, and selected-span annotations instead.

The production session header was also removed. Total tokens, total cost and its
prompt/completion breakdown, and P50 latency are no longer shown at the top of
session details. Session annotations are represented by the new fixed bar.

A future design could restore the lost operational metrics in the trace-tree or
session-view toolbars, or in a compact Info section, without recreating a second
header above the master-detail layout.

## Existing authorization behavior

The value popover renders edit and delete controls for every annotation entry so
the interaction remains discoverable and keyboard reachable. Phoenix currently
authorizes mutation of human annotations to their owning user. Attempting to
change another user’s annotation therefore returns an inline server error. A
future permissions field on annotation nodes would let the client disable these
actions preemptively while explaining why.

## Freeform value compatibility

The new picker stores a freeform annotation’s entered value in `label` and its
optional rationale in `explanation`, because the new design requires both a
freeform value and a separate explanation. Older Phoenix UI flows stored the
freeform value in `explanation`. The bar recognizes that legacy shape and shows
the old explanation as the editable value. A future data migration could
normalize existing freeform annotations and remove this compatibility branch.

## Parent hierarchy scope

For a selected span, the bar shows its session (when present), trace, an
“Additional spans” separator when the span is nested, and the selected span.
Per the requested exception, it does not enumerate or aggregate annotations
from every ancestor span. If orphaned span/trace relationships become possible,
the GraphQL model should expose enough nullable relationship state to distinguish
“no trace” from a loading or authorization failure.
