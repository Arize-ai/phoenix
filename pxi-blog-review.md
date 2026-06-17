# Review: "Meet PXI: the AI engineering agent inside Phoenix"

A list of suggested fixes and edits, grouped by priority. Line references are to the
draft as supplied. Technical claims were spot-checked against the Phoenix codebase
where possible (notes below).

---

## 1. Must-fix (typos, punctuation, broken text)

1. **Caption under the final architecture diagram:** "he full system in one view."
   → **"The full system in one view."** (dropped leading capital "T").

2. **Section "An agent you can trust to act":** the sentence
   "We built two ways for PXI to pause before it changes anything" is missing its
   terminal period → add a period.

3. **Caption under the time-range example:** "so the view just updates.." has a
   **double period** → reduce to a single period.

4. **Caption under "Caching the system prompt":** "You pay only the skill's tokens"
   is missing a terminal period → add a period.

5. **Em dash / hyphen consistency:** the post mixes spaced hyphens used as dashes
   (e.g., "the time, tokens, retries, and false starts add up") with true em dashes
   elsewhere. Pick one convention (em dash `—` recommended) and apply it throughout.

---

## 2. High-priority (factual / consistency)

6. **Model-name inconsistency — pick one and be deliberate.**
   - Body ("Open, hackable, and yours to run"): "claude-opus-4-8, gpt-5.5, and
     gemini-3.5-flash".
   - Trace screenshot caption: "PXIAgent.iter calling render_generative_ui and
     **claude-opus-4-6**".

   The two model versions differ (4-8 vs 4-6). If the screenshot is genuinely from
   an older run, add a one-line note ("screenshot from an earlier build") so readers
   don't think it's an error. Otherwise align them. (Codebase note: seed/test scripts
   currently reference `claude-opus-4-6` and `claude-opus-4-7`, so the older number is
   plausibly real — call it out rather than silently mismatching.)

7. **Protocol name — verify exact branding.** The post calls it the
   "Vercel Data Streaming Protocol." Vercel's actual term is the **"Data Stream
   Protocol"** (part of the Vercel AI SDK). Recommend "the Vercel AI SDK's Data Stream
   Protocol" on first mention, then shorten. (Codebase note: the implementation uses a
   `tool_execution_environment` flag — `client`/`server` — exactly as the post
   describes, so that claim checks out; only the proper-noun naming needs confirming.)

8. **`just-bash` attribution.** Confirm the project name and link it on first mention
   ("a bash emulator written in TypeScript"). Readers will want the reference, and an
   unlinked tool name invites doubt about whether it's real.

9. **"the strongest coding agents" / "best coding agents available"** — these
   superlatives appear twice and are unverifiable marketing claims. Soften to
   "the same setup leading coding agents run on" or similar, once.

---

## 3. Medium-priority (clarity & redundancy)

10. **Open-source claim is repeated three times** in close succession:
    - "Phoenix is open source, so you can read every line of how PXI works."
    - "Because Phoenix is open source, you do not have to take our word for it. You can
      read all of it on GitHub."
    - "Because it is open source, you can inspect PXI..."
    Keep the strongest one near the top and the closing one; cut the middle repeat or
    fold it in.

11. **TL;DR vs. body overlap.** The TL;DR bullets are nearly verbatim restatements of
    the intro paragraph ("debugs traces, builds evaluators, optimizes prompts, and runs
    experiments from the context you are already viewing"). That's fine for a TL;DR, but
    consider trimming the intro paragraph so the reader isn't told the same thing twice
    within three sentences.

12. **"primitives" payoff is stated twice.** The opening anecdote (15-minute
    auto-optimize run) and the closing section "Why the order was the point" make the
    same point ("we never built that workflow; it fell back to the primitives"). This is
    an intentional bookend and works — but tighten the closing recap so it adds the
    *lesson* rather than re-narrating the anecdote.

13. **Define acronyms/terms on first use for a general reader:**
    - "RAG" — spelled out as "retrieval-augmented generation," good. Keep.
    - "MCP" — never expanded. Add "(Model Context Protocol)" on first use
      ("a hosted MCP server").
    - "GraphQL", "Zustand", "Mintlify", "pydantic-ai", "Vercel AI SDK" — Zustand and
      Mintlify get a brief gloss; consider one for pydantic-ai too.

14. **"It put itself to sleep" anecdote** is great but slightly buried. The phrase
    "dropped a sleep into a bash command" reads as jargon mid-narrative. Consider:
    "it inserted a `sleep` into a shell command to wait, then woke up and checked
    again." Minor.

15. **Generative UI section** ends with "It dispatches an action when that is what is
    needed, and it renders a chart when a chart communicates better." This restates the
    preceding two sentences. Cut one.

16. **"An agent you can trust to act"** — the intro line trails into the two
    sub-headings (Elicitation, Permissions). Add a connecting clause so the two
    mechanisms are clearly framed as the "two ways" promised.

---

## 4. Low-priority (style & polish)

17. **Heading capitalization is inconsistent** — some headings are sentence case
    ("Why put an agent inside Phoenix?", "Caching the system prompt") and the post is
    mostly sentence case, which is good. Audit for any stray title-case headings and
    standardize on sentence case.

18. **"Arize:Observe, our AI agent evals conference"** — consider "our conference on
    AI agent evaluation" for readers unfamiliar with the shorthand "evals."

19. **Repeated sentence openers.** Several paragraphs open with "Because…"
    (Because Phoenix is open source / Because that protocol / Because they are plain
    files / Because we keep the docs current / Because PXI always has a shell). Vary a
    couple to avoid a tic.

20. **"system of record"** appears once and is good; ensure it isn't later weakened by
    "source of record" elsewhere (one caption says "the source of training data" — that's
    a different phrase and fine).

21. **Captions vs. body duplication.** Several image captions restate the body sentence
    almost word-for-word (e.g., the docs/Mintlify caption and the prompt-caching caption).
    Captions should add a detail the body doesn't, not echo it. Tighten 3–4 captions.

22. **"claude-opus-4-6" in the trace caption** also names a cost ($0.34) and latency
    (24.7s) — good, concrete detail. Keep these; they add credibility. Just make sure the
    model number is reconciled with item 6.

23. **Closing CTA** ("we'd love to hear what you try, what breaks, and what you want PXI
    to do next") is strong. Consider adding a direct link/handle (GitHub Discussions,
    Slack) so the invitation is actionable.

---

## 5. Structural suggestion (optional)

24. The post is long and front-loads architecture before the reader has seen what PXI
    *does* end-to-end. The opening anecdote helps, but consider adding a single
    one-sentence "here's a concrete task → here's what PXI does" example near the top of
    each capability section (most already have one via captions — make that consistent
    across all sections so each capability has exactly one worked example).

---

### Verification notes
- Confirmed present in the codebase: `phoenix-gql`, `search_phoenix`, the browser/server
  split via a `tool_execution_environment` flag, skills as markdown-with-frontmatter,
  playground/evaluator/trace contexts, and bash-tool filesystem policy (`/phoenix`
  read-only + writable workspace). These claims are accurate.
- Needs author confirmation: exact Vercel protocol name, `just-bash` project name/link,
  and the model-version mismatch between body and screenshot.
