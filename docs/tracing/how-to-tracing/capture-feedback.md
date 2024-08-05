# Capture Feedback

{% hint style="info" %}
feedback and annotations are available for arize-phoenix>=4.20.0 and in beta
{% endhint %}

In LLM applications it is important to collect feedback to understand how your app is performing in production. The ability to observe user feedback along with traces can be very powerful as it allows you to drill down into the most interesting examples. Once you have feedback, you can send those examples for further review, automatic evaluation, or datasets.&#x20;

Phoenix lets you attach user feedback to spans and traces in the form of annotations. It's helpful to expose a simple mechanism (such as 👍👎) to collect user feedback in your app. You can then use the Phoenix API to send feedback for a span.&#x20;

Phoenix expects feedback to be in the simple form of an **annotation** which consists of three fields:\


```typescript
{
  "label": "good", // A human-readable category for the feedback
  "score": 1, // a numeric score, can be 0 or 1, or a range like 0 to 100
  "explanation": "The response answered the question I asked",
}
```

Note that you can provide  **label**, a **score**, or both. With Phoenix an annotation has a name (like **correctness**), is associated with  an **annotator** (either an **LLM** or a **HUMAN**) and can be attached to the **spans** you have logged to Phoenix.\
\
To log annotatons for spans to phoenix, you will need the following information:

<table><thead><tr><th width="202">span_id</th><th>name</th><th width="158">label</th><th>score</th><th>explanation</th></tr></thead><tbody><tr><td>67f6740bbe1ddc3f</td><td>correctness</td><td>thumbs_up</td><td>1</td><td>good answer</td></tr><tr><td>fc0bdc5af949699f</td><td>correctness</td><td>thumbs_down</td><td>0</td><td>bad code</td></tr><tr><td>6a5311f99f73c328</td><td>correctness</td><td>thumbs_down</td><td>0</td><td>wrong link</td></tr></tbody></table>

## Feedback from a User

\
Once you construct the annotation, you can send this to Phoenix via it's REST API. You can POST an annotation from your application to `/v1/span_annotations` like so:

```bash
curl -X 'POST' \
  'http://localhost:6006/v1/span_annotations?sync=true' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "data": [
    {
      "span_id": "67f6740bbe1ddc3f",
      "name": "correctness",
      "annotator_kind": "HUMAN",
      "result": {
        "label": "correct",
        "score": 1,
        "explanation": "it is correct"
      },
      "metadata": {}
    }
  ]
}'
```

## Annotate Traces in the UI

Phoenix allows you to manually annotate traces with feedback within the application. This can be useful for adding context to a trace, such as a user's comment or a note about a specific issue. You can annotate a span directly from the span details page.
