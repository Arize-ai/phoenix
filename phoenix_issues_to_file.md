# Phoenix Issues to File

This document contains organized GitHub issues for Phoenix feature requests and bug reports from user feedback.

## Filtering Issues

### 1. [ENHANCEMENT]: Easier custom date/time picking with presets and recent selections

**Is your feature request related to a problem?**
When researching historical traces, custom date ranges are selected frequently, which can be time-consuming to enter, especially when specific times of day aren't needed.

**Describe the solution you'd like**
- Pre-load time fields with start of day / end of day defaults
- Include a selector for recently used time ranges
- Add common preset options (last hour, last day, last week, etc.)

**Additional context**
This would significantly improve the user experience when debugging historical issues that require multiple date range queries.

---

### 2. [ENHANCEMENT]: Option to disable filter completions

**Is your feature request related to a problem?**
The filter completion logic frequently replaces user input with unhelpful and syntactically incorrect content. For example, typing `"" in input.value` and hitting Enter results in `"" in input.input.value`.

**Describe the solution you'd like**
- Add a user preference/setting to disable filter auto-completion
- Improve the completion logic to avoid generating invalid syntax
- Allow users to escape or ignore completions

**Additional context**
This affects productivity when writing custom filter expressions, as users have to constantly correct unwanted auto-completions.

---

### 3. [ENHANCEMENT]: Show loading status for filter operations

**Is your feature request related to a problem?**
When changing time filters or typing filter expressions, there's often no indication that a query is in progress. Queries can take seconds or minutes to complete, making it difficult to know if they're still running or have failed.

**Describe the solution you'd like**
- Add loading indicators for filter operations
- Show progress status for long-running queries
- Display query execution time
- Provide clear error messages when queries fail

**Additional context**
This would improve user experience by providing feedback on query status and helping users understand when operations are still processing.

---

### 4. [ENHANCEMENT]: More filter options - filter by error message

**Is your feature request related to a problem?**
When debugging errors in workflows, users want to find other traces with the same error, but there's currently no way to filter by error message.

**Describe the solution you'd like**
- Add error message as a filterable field
- Support partial matching and regex for error messages
- Include error type/category filtering
- Add quick filters for common error patterns

**Additional context**
This would be valuable for debugging and finding patterns in error occurrences across traces.

---

### 5. [ENHANCEMENT]: Link to filter - shareable filter URLs

**Is your feature request related to a problem?**
There's no way to share or bookmark specific filter configurations (query and time range).

**Describe the solution you'd like**
- Generate shareable URLs that include filter state
- Preserve query parameters in browser history
- Allow bookmarking of filtered views
- Support deep linking to specific filter configurations

**Additional context**
This would enable better collaboration and make it easier to return to specific debugging views.

---

### 6. [ENHANCEMENT]: Query documentation for filter syntax

**Is your feature request related to a problem?**
When writing new types of filters, users find themselves reading through the code (https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/trace/dsl/filter.py) to understand the syntax.

**Describe the solution you'd like**
- Comprehensive documentation of filter syntax
- Examples of valid fields and operators
- Interactive documentation or help within the UI
- Autocomplete suggestions with documentation

**Additional context**
Better documentation would reduce the learning curve and improve filter adoption.

---

## Performance Issues

### 7. [BUG]: SQLite performance degradation with large databases

**What happened?**
Large SQLite databases become unusable (>3 min response times) without commenting out token metrics.

**What did you expect to happen?**
Reasonable query performance even with large datasets.

**How can we reproduce the bug?**
1. Use Phoenix with a large SQLite database
2. Enable token metrics
3. Observe query response times exceeding 3 minutes

**Additional information**
- Related to issue: https://github.com/Arize-ai/phoenix/issues/8068
- Possible solutions: composite indexes or environment variable to disable expensive metrics
- Need to balance performance vs. functionality

---

### 8. [BUG]: Postgres performance issues with large datasets

**What happened?**
While Postgres is more responsive than SQLite, it can still take minutes to load in some cases with large datasets.

**What did you expect to happen?**
Consistent, fast query performance regardless of dataset size.

**How can we reproduce the bug?**
1. Use Phoenix with Postgres backend
2. Load large datasets
3. Observe slow loading times (minutes)

**Additional information**
Further troubleshooting needed to identify specific bottlenecks and optimization opportunities.

---

## Playground Issues

### 9. [ENHANCEMENT]: Easily add tool responses in Playground

**Is your feature request related to a problem?**
When sending a long trace that ends in a tool call to the Playground, users need to manually add a tool response first before adding a message at the bottom.

**Describe the solution you'd like**
- Automatically append blank tool responses for all calls in the last message
- Add a button to quickly add tool responses
- Streamline the workflow for continuing conversations from traces

**Additional context**
This would improve the user experience when transitioning from trace analysis to playground experimentation.

---

## Tracing Integration Issues

### 10. [ENHANCEMENT]: Log arbitrary trace events for recoverable errors

**Is your feature request related to a problem?**
During AI workflows, recoverable errors occur that users want to report on the current span for awareness and debugging, even though the workflow completes successfully.

**Describe the solution you'd like**
- Ability to log custom events/errors on spans
- Support for warning-level events that don't fail the span
- Integration with LlamaIndex tracing
- Rich metadata support for error context

**Additional context**
This would improve observability of partial failures and edge cases in AI workflows.

---

### 11. [ENHANCEMENT]: Promptfoo tracing integration

**Is your feature request related to a problem?**
Users want to send LLM traces from promptfoo LLM-as-a-judge evaluations into Phoenix for centralized observability.

**Describe the solution you'd like**
- Native integration with promptfoo
- Support for evaluation trace ingestion
- Preserve evaluation metadata and results
- Documentation and examples for setup

**Additional context**
This would enable unified observability across development and evaluation workflows.

---

### 12. [ENHANCEMENT]: Cost tracking for function calls and external services

**Is your feature request related to a problem?**
With the new cost metrics, users want to report additional costs on spans for external services used in tool calls.

**Describe the solution you'd like**
- Support for custom cost reporting on spans
- Integration with external service cost APIs
- Aggregated cost views across tool calls
- Cost breakdown by service/operation type

**Additional context**
This would provide comprehensive cost visibility across all services used in AI workflows.

---

## Trace Presentation Issues

### 13. [BUG]: Fix scroll-to-top behavior in trace view

**What happened?**
When selecting a large inference span, going to the Input tab, scrolling down, and trying to select text, the view automatically scrolls to the very top.

**What did you expect to happen?**
The view should maintain its scroll position when selecting text.

**How can we reproduce the bug?**
1. Select a large inference span
2. Select the Input tab
3. Scroll down in the input
4. Try to select some text
5. Observe that the view scrolls to the top

**Additional information**
This affects usability when examining large inputs or outputs in trace details.

---

### 14. [ENHANCEMENT]: JSON output formatting with collapse/expand functionality

**Is your feature request related to a problem?**
Tool call outputs often contain large JSON structures that are difficult to navigate and examine.

**Describe the solution you'd like**
- JSON formatting with syntax highlighting
- Collapse/expand functionality for JSON sub-trees
- Search within JSON output
- Custom formatters for different tool call response types

**Additional context**
This would significantly improve the readability and navigation of complex tool outputs.

---

## Summary

Total issues identified: 14
- Feature requests: 11
- Bug reports: 3

Categories:
- Filtering: 6 issues
- Performance: 2 issues  
- Playground: 1 issue
- Tracing Integration: 3 issues
- Trace Presentation: 2 issues

These issues represent valuable user feedback that could significantly improve the Phoenix user experience across filtering, performance, integrations, and UI/UX.