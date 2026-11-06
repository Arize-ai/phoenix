# Provider Routing For Evaluators

## Problem

**Prompts are saved. Configuration is external.**

```
Prompt (saved in database) ──depends on──▶ Configuration (lives elsewhere)
                                                   │
                                                   ▼
                                            Can change independently:
                                            • Admin updates env vars
                                            • Someone deletes a custom provider
                                            • Credentials get rotated
                                            • User clears their browser
```

This is a dependency management problem. It's the same problem as code depending on libraries that can be updated or deleted. We can't make the dependency go away—we can only decide how to handle it.

## Four Things to Keep in Mind

To reason about provider configuration, hold four concerns in your head at once. They're not independent—they interact in messy ways—but they're useful handles for thinking.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. WHAT         2. WHERE           3. HOW            4. WHEN               │
│  ─────────       ──────────         ─────────         ──────────            │
│  • Routing       • Env vars         • Interactive     • Create time         │
│  • Credentials   • Custom provider  • Scheduled       • Load time           │
│                  • Browser storage                    • Save time           │
│                  • Ephemeral                          • Run time            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Let's walk through each one.

### 1. WHAT — Routing vs Credentials

To call an LLM, you need two things:

| Component | What it is | Example |
|-----------|------------|---------|
| **Routing** | Where to send the request | `https://my-resource.openai.azure.com` |
| **Credentials** | How to authenticate | API key, IAM role, managed identity |

Different providers need different things:

| Provider | Routing | Credentials |
|----------|---------|-------------|
| OpenAI | Global endpoint (built-in) | API key |
| Anthropic | Global endpoint (built-in) | API key |
| Azure OpenAI | Per-deployment endpoint (must configure) | API key or Managed Identity |
| AWS Bedrock | Region (has default) | Access keys or IAM Role |

**Key insight:** OpenAI and Anthropic are simple—just need an API key. Azure and AWS are complex—need explicit routing configuration.

### 2. WHERE — Configuration Sources

Configuration can come from multiple places:

| Source | Credentials? | Routing? | Storage | Shared? | Survives Reload? |
|--------|-------------|----------|---------|---------|------------------|
| **Ephemeral fields** | ❌ | ✅ (playground only) | Memory | ❌ | ❌ |
| **Save as Default** | ✅ | ✅ (playground only) | Browser localStorage | ❌ | ✅ |
| **Secrets** | ✅ | ❌ | Database | ✅ | ✅ |
| **Custom provider** | ✅ | ✅ | Database | ✅ | ✅ |
| **Environment variables** | ✅ | ✅ | Server process | ✅ | ✅ |

**The asymmetry**

| Context | Credentials from Frontend? | Routing from Frontend? |
|---------|---------------------------|------------------------|
| Playground | ✅ Yes | ✅ Yes |
| Evaluator Test | ✅ Yes | ❌ No |

Users can experiment with different endpoints in the playground. But evaluators always use explicit configuration (custom provider or env vars).

### 3. HOW — Execution Mode

| Mode | User Present? | Browser Available? | Feedback |
|------|--------------|-------------------|----------|
| **Interactive** | ✅ Yes | ✅ Yes | Immediate |
| **Scheduled** | ❌ No | ❌ No | Delayed |

**Why this matters:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXECUTION MODE IMPACT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INTERACTIVE                          SCHEDULED (future)                    │
│  ───────────                          ──────────────────                    │
│                                                                             │
│  Credentials from:                    Credentials from:                     │
│  1. Frontend (localStorage)           1. Custom provider secrets            │
│  2. Custom provider secrets           2. Environment variables              │
│  3. Environment variables                                                   │
│                                       (No frontend! No browser!)            │
│                                                                             │
│  Routing from:                        Routing from:                         │
│  1. Custom provider                   1. Custom provider                    │
│  2. Environment variables             2. Environment variables              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Interactive paths can use browser storage. Scheduled paths can't—there's no browser. This constrains which WHERE sources are available in each mode.

*Note: Scheduled evaluators aren't implemented yet. Currently everything is interactive.*

### 4. WHEN — Operation Timing

The gap between "when you configure" and "when it runs" is where things go wrong.

**Playground timing:**

| Operation | What Happens | Config Source |
|-----------|-------------|---------------|
| Enter routing | User types endpoint | Ephemeral (memory only) |
| Run | API call made | Ephemeral fields + env vars |
| Save as Prompt | Prompt record created | Only model name saved, **routing discarded** |

**The gap:** User enters routing, runs successfully, saves prompt. The prompt doesn't include the routing that made it work.

**Evaluator timing:**

| Operation | What Happens | Config Source |
|-----------|-------------|---------------|
| Create | Select prompt, configure mapping | Prompt's custom_provider_id or env vars |
| Run (later) | Execute in background | Resolved when job runs |

**The gap:** Evaluator is created referencing a prompt. The prompt relies on env vars. Evaluator runs days later. Env vars have changed. Behavior differs.

**Key insight:** Playground validates immediately with user present. Evaluators validate via the Test button at creation time—if routing is missing, the test fails before the evaluator is saved. This catches configuration issues while the user can still fix them.

### How the Dimensions Interact

Here's a scenario that shows how these all connect:

```
User creates prompt with Azure (WHAT: routing needed)
        │
        ├── Enters endpoint in UI field (WHERE: ephemeral)
        │         │
        │         └── Run in playground → ✅ Works (HOW: interactive)
        │         └── Save prompt → ❌ Endpoint not saved (WHEN: save discards routing)
        │
        ├── Clicks "Save as Default" (WHERE: browser localStorage)
        │         │
        │         └── New playground → ✅ Pre-filled (same browser)
        │         └── Scheduled job → ❌ No access (HOW: no browser in scheduled)
        │
        ├── Uses custom provider (WHERE: database)
        │         │
        │         └── Run in playground → ✅ Works
        │         └── Scheduled job → ✅ Works (database accessible everywhere)
        │
        └── Relies on env vars (WHERE: server process)
                  │
                  └── Playground → ✅ Works
                  └── Scheduled job → ✅ Works (same server)
                  └── Later, env vars change → ❓ RISK: config drift
```

The "it worked in playground, broke in evaluator" problem happens when a user tests with ephemeral fields, sees success, then creates an evaluator that uses env vars instead.

## The Policy

### Resolution Order

```python
def resolve_provider_config(prompt):
    # 1. Try custom provider
    if prompt.custom_provider_id:
        provider = get_provider(prompt.custom_provider_id)
        if provider and provider.sdk == prompt.model_provider:
            return provider.config
        # Fall through if provider deleted or SDK mismatched
    
    # 2. Fall back to environment variables
    return get_config_from_env(prompt.model_provider)
```

### When to Warn (Future Enhancement)

*Not currently implemented. If we add proactive warnings, here's the policy:*

| State | What Happens | Warning? |
|-------|--------------|----------|
| Custom provider exists | Use it | ❌ No warning |
| No provider, simple SDK | Use env vars | ❌ No warning |
| No provider, Azure | Use env vars | ✅ Warning: "Using server environment variables" |
| No provider, AWS | Use env vars | ⚠️ Softer warning (has default region) |
| Provider deleted | Falls back to env vars | ✅ Warning |

**The criterion:** Does a sensible default exist? Azure has no default endpoint (guaranteed failure if missing). AWS has a default region (often works). Simple providers have global endpoints (just need API key).

### What We Accept

- Env vars may change over time → admin's responsibility
- Prompt may hit different endpoint if env var changes → warn but allow
- Credential failures happen at API call time → unavoidable in any design

### What We Reject (Goals)

- Silent failures with no indication → could show banner when in fallback mode
- Confusing error messages → errors should include what's wrong + how to fix
- Accidental provider deletion → could add confirmation dialog showing affected resources

## UI Behavior

### Ephemeral Fields: Playground Yes, Evaluator No

**Playground** supports experimentation. Users want to test different endpoints quickly. We allow ephemeral fields. We could add an explicit warning (not currently implemented):

```
┌─────────────────────────────────────────────────────────────────┐
│ Endpoint: https://my-resource.openai.azure.com                  │
│           ⚠️ Session only — not saved with prompt               │
└─────────────────────────────────────────────────────────────────┘
```

**Evaluators** are production artifacts. Ephemeral fields would be immediately lost. We don't show them at all. We could add a warning banner and path to custom providers (not currently implemented):

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Using server environment variables                           │
│                                                                 │
│ This evaluator will use AZURE_OPENAI_ENDPOINT from the server.  │
│ For reliable execution, select a custom provider.               │
│                                                                 │
│ [Select Custom Provider ▼]                                      │
└─────────────────────────────────────────────────────────────────┘
```

### "Save as Default" and the Evaluator Test Button

**"Save as Default" saves everything, including routing.** This is intentional—it makes Playground iteration convenient. Users can enter an endpoint once, save it, and have it pre-filled across browser sessions.

The routing saved to localStorage won't transfer to evaluators (they use custom provider or env vars). But that's okay—**the evaluator editor's Test button is the validation gate.**

```
Playground                              Evaluator Editor
──────────                              ────────────────

User enters endpoint                    User selects prompt
     │                                       │
     ▼                                       ▼
Runs → works ✅                         Clicks "Test" → ?
     │                                       │
     ▼                                       ├── Custom provider set → ✅
"Save as Default"                            ├── Env vars configured → ✅
(saves to localStorage                       └── Neither → ❌ Fails immediately
 for convenience)                                 │
     │                                            ▼
     ▼                                  User sees error, can attach
"Save as Prompt"                        custom provider right there
(no routing saved)
```

**Why this works:**
- Playground stays convenient—no need to re-enter endpoints every session
- The Test button surfaces routing issues at the right moment (evaluator creation)
- When the test fails, user is in the evaluator editor where they can fix it
- No false sense of security—user has actually validated the evaluator works

### Error Messages (Recommendation)

When we do surface errors, make them actionable:

```
Azure OpenAI endpoint not configured.

To fix this:
  1. Set AZURE_OPENAI_ENDPOINT environment variable, or
  2. Select a custom Azure provider in the model menu
```

Not just "configuration error"—tell them what's wrong and how to fix it.

## SDK Modification: Block Incompatible Changes

**The question:** Should we allow changing a custom provider's SDK after creation?

**Our answer:** Block incompatible changes. Allow compatible ones.

| Change | Allowed? | Reason |
|--------|----------|--------|
| OpenAI ↔ Azure | ✅ Yes | Same SDK family, just routing change |
| OpenAI → Anthropic | ❌ No | Different invocation parameters |
| Anything → Bedrock | ❌ No | Completely different SDK |

**Why block instead of warn:**
- No legitimate use case—if admin wants different SDK, create new provider
- Invocation parameters are stored un-normalized—switching SDK causes silent behavior changes
- Existing prompts shouldn't break because admin wanted to repurpose a provider
- Easy workaround: create new provider, update prompts individually

## The User's Mental Model

What users need to understand to use this correctly:

1. **Credentials:** Enter once per browser. Saved locally. Sent with requests.
2. **Routing:** Comes from custom provider or server config. Not stored in prompt.
3. **Custom providers:** Explicit, stable, shared. The "proper" way to configure complex providers.
4. **Prompts:** Store model name + provider reference. Not configuration details.

**Simple providers:** Enter API key. Done.

**Complex providers:** Create custom provider, or rely on admin-configured env vars.

## Who's Responsible for What

| Actor | Responsible For |
|-------|-----------------|
| **Admin** | Env vars are correct for deployment |
| **User** | Selects appropriate provider for their use case |
| **System** | Validates via Test button at creation time, fails loudly at run time |

**The contract:** Using env vars = trusting admin. Want explicit control = use custom provider.

**The validation flow:** User creates evaluator → clicks Test → if routing is missing, test fails immediately with actionable error → user fixes it before saving. No silent failures.

## Edge Cases

**Q: What if custom provider credentials become invalid?**

Prompt fails at runtime with 401/403. Same as env var case, but more diagnosable—the error points to a specific named provider rather than "the env vars."

**Q: What if user creates prompt with env vars, then admin creates custom provider?**

Nothing changes. Prompt has `custom_provider_id = NULL` = "use env vars." New providers don't retroactively attach to existing prompts.

**Q: What if same model name means different things on different endpoints?**

Real risk with Azure. Two providers could have a "gpt-4" deployment that's actually different models. System trusts configuration—no semantic validation.

**Q: What does a saved prompt actually guarantee?**

| Aspect | Guaranteed? |
|--------|-------------|
| Same model name | ✅ Yes |
| Same SDK | ✅ Yes (incompatible changes blocked) |
| Same endpoint | ❌ No |
| Same credentials | ❌ No |
| Same LLM behavior | ❌ No (provider can update their models) |

**The honest answer:** Very limited. If external dependencies unchanged, prompt behaves same. That's the best we can do.
