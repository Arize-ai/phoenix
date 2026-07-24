# Span event content

A span event is a structured log entry attached to a single point in a span's lifetime. The ingested and stored schema is:

```ts
type SpanEvent = {
  name: string;
  timestamp: string; // timezone-aware ISO 8601 date-time
  attributes: Record<string, unknown>;
};
```

`name` says what happened, `timestamp` says when it happened, and `attributes` carries the event-specific payload. Attribute values are JSON-compatible and may be long, nested, or themselves contain stringified JSON. There is no separate arbitrary message field in the stored event.

The GraphQL detail-panel projection adds a derived `message` field:

```ts
type DetailPanelSpanEvent = SpanEvent & {
  message: string;
};
```

`message` is `attributes["exception.message"]` when that value is present, or an empty string otherwise. The Storybook fixtures supply it directly because they model the GraphQL result rather than the ingestion payload.

The events UI renders the localized timestamp, event name, and derived message in the disclosure header. An event named exactly `exception` also gets the error icon. Non-empty `attributes` render as formatted JSON inside the disclosure; events without attributes cannot be expanded.
