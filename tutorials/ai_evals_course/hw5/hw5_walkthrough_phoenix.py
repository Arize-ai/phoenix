import marimo

__generated_with = "0.14.13"
app = marimo.App(width="medium")


@app.cell
def _():
    from collections import Counter
    from pathlib import Path

    import marimo as mo
    import pandas as pd

    import phoenix as px
    from phoenix.trace.dsl import SpanQuery

    return Counter, Path, SpanQuery, mo, pd, px


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    # Homework 5 - Failure Transition Heat-Map with Phoenix

    **Purpose**: Analyze agent failure patterns using Phoenix observability
    """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""## 1. Phoenix Setup and Trace Loading""")
    return


@app.cell
def _(SpanQuery, px):
    # Load traces from Phoenix
    # Query traces with failure state annotations
    query = SpanQuery().where("span_kind == 'AGENT'")
    traces_df = px.Client().query_spans(query, project_name="recipe-agent-hw5")

    print(f"Successfully loaded {len(traces_df)} traces from Phoenix")

    return (traces_df,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    What we have from Phoenix

    - A DataFrame of traces loaded from Phoenix
    - Each trace has a `conversation_id` we can refer to
    - We have all the messages and tool call information as well as what happened
    - We have the last success and first failure state in span attributes, so we can see the
      transition
    - Phoenix automatically handles the data structure and provides a clean DataFrame interface
    """
    )
    return


@app.cell
def _(traces_df):
    # Display the structure of our Phoenix data
    print(f"DataFrame shape: {traces_df.shape}")
    print(f"Columns: {list(traces_df.columns)}")
    print("\nSample trace:")
    if not traces_df.empty:
        traces_df.iloc[0]
    return


@app.cell
def _(mo, traces_df):
    trace_index_slider = mo.ui.slider(
        start=0, stop=len(traces_df) - 1, step=1, value=0, label="Trace Index"
    )
    trace_index_slider
    return (trace_index_slider,)


@app.cell(hide_code=True)
def _(mo, trace_index_slider, traces_df):
    _trace = traces_df.iloc[trace_index_slider.value]

    # Create a list to hold message elements
    message_elements = []

    mo.md(f"""
    **Failure Transition:** {_trace["attributes.last_success_state"]}
    -> {_trace["attributes.first_failure_state"]}
    **Messages**
    """)

    # Add each message with role-based styling
    if "attributes.output.value" in _trace and _trace["attributes.output.value"] is not None:
        # Parse the string representation of the dictionary
        try:
            import ast

            output_value = ast.literal_eval(_trace["attributes.output.value"])
            if isinstance(output_value, list):
                messages = output_value
            elif isinstance(output_value, dict) and "messages" in output_value:
                messages = output_value["messages"]
            else:
                messages = [output_value] if isinstance(output_value, dict) else []
        except (ValueError, SyntaxError):
            # If parsing fails, try to extract messages from the string
            import re

            messages = []
            # Look for message patterns in the string
            message_pattern = r"""{\s*["\']role["\']\s*:\s*["\']([^"\']+)
            ["\']\s*,\s*["\']content["\']\s*:\s*["\']([^"\']+)["\']\s*}"""
            matches = re.findall(message_pattern, _trace["attributes.output.value"])
            for role, content in matches:
                messages.append({"role": role, "content": content})

        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")

            # Create a styled container for each message
            if role == "user":
                bg_color = "#e3f2fd"
                role_color = "#1976d2"
            elif role == "assistant":
                bg_color = "#f3e5f5"
                role_color = "#7b1fa2"
            else:
                bg_color = "#f5f5f5"
                role_color = "#616161"

            message_elements.append(
                mo.Html(f"""
                <div style="margin: 2px 0; padding: 4px; background-color: {bg_color};
                border-left: 4px solid {role_color};">
                    <div style="font-weight: bold; color: {role_color};
                    margin-bottom: 2px; text-transform: capitalize;">
                        {role}
                    </div>
                    <div style="white-space: pre-wrap; font-family: -apple-system,
                    BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
                        {content}
                    </div>
                </div>
                """)
            )

    # Combine all elements
    mo.vstack(message_elements)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""## 2. Build Transition Matrix from Phoenix Data""")
    return


@app.cell
def _(traces_df):
    # Extract transition tuples from Phoenix DataFrame
    transition_tuples = []
    for _, trace_1 in traces_df.iterrows():
        last_success_1 = trace_1.get("attributes.last_success_state")
        first_failure_1 = trace_1.get("attributes.first_failure_state")
        if last_success_1 and first_failure_1:
            transition_tuples.append((last_success_1, first_failure_1))

    print(f"Extracted {len(transition_tuples)} transitions from Phoenix data")
    return (transition_tuples,)


@app.cell
def _(pd):
    # Create transition matrix
    PIPELINE_STATES = [
        "ParseRequest",
        "PlanToolCalls",
        "GenCustomerArgs",
        "GetCustomerProfile",
        "GenRecipeArgs",
        "GetRecipes",
        "GenWebArgs",
        "GetWebInfo",
        "ComposeResponse",
        "DeliverResponse",
    ]

    transition_matrix = pd.DataFrame(index=PIPELINE_STATES, columns=PIPELINE_STATES, data=0)
    return (transition_matrix,)


@app.cell
def _(Counter, transition_tuples):
    counter = Counter(transition_tuples)
    counter
    return (counter,)


@app.cell
def _(counter, transition_matrix):
    for (last_state, first_failure_2), count in counter.items():
        if last_state in transition_matrix.index and first_failure_2 in transition_matrix.columns:
            transition_matrix.loc[last_state, first_failure_2] = count
    transition_matrix
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""## 3. Visualize Transition Matrix""")
    return


@app.cell(hide_code=True)
def _(transition_matrix):
    # Create a heatmap of the transition matrix
    import matplotlib.pyplot as plt
    import seaborn as sns

    plt.figure(figsize=(10, 8))
    sns.heatmap(
        transition_matrix,
        annot=True,
        fmt="g",
        cmap="YlOrRd",
        cbar_kws={"label": "Count"},
        square=True,
    )
    plt.title("State Transition Matrix Heatmap (Phoenix Data)")
    plt.xlabel("First Failure State")
    plt.ylabel("Last Success State")
    plt.tight_layout()
    plt.gca()
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""## 4. Analyze Transition Matrix""")
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        r"""
    **Analysis of Phoenix Transition Matrix**

    **Most Problematic Transitions (Count of 8-9):**
    - **GetCustomerProfile → GetRecipes (9 failures)** - The highest failure count indicates
    that even after successfully retrieving customer profiles, the system frequently fails to
      access recipe data. This suggests either issues with the recipe database connection,
      authentication, or data format compatibility.

    - **GenCustomerArgs → GetCustomerProfile (8 failures)** - Customer argument generation is
      failing to retrieve customer profiles, indicating potential issues with customer data
        validation, API endpoints, or argument formatting.

    - **GenRecipeArgs → GetRecipes (8 failures)** - Recipe argument generation is failing to
      access recipe data, suggesting problems with recipe query parameters, database queries,
      or data retrieval logic.

    **High Frequency Failures (Count of 6-7):**
    - **PlanToolCalls → GetCustomerProfile (7 failures)** - Planning phase is failing to access
      customer data, indicating issues with tool call planning or customer data integration.

    - **GetCustomerProfile → GenRecipeArgs (7 failures)** - Customer data retrieval is failing to
      generate recipe arguments, suggesting problems with data transformation or recipe generation
      logic.

    - **PlanToolCalls → GenCustomerArgs (6 failures)** - Planning is failing to generate customer
      arguments, indicating issues with planning logic or argument generation.

    - **PlanToolCalls → GetRecipes (6 failures)** - Planning phase is failing to access recipes,
      suggesting problems with tool call planning for recipe retrieval.

    - **GetRecipes → GenWebArgs (6 failures)** - Recipe retrieval is failing to generate web search
      arguments, indicating issues with web search integration or argument generation.

    **Pattern Analysis:**
    - **Cascade Effect**: Failures tend to cascade through the pipeline, with early failures
      (ParseRequest, PlanToolCalls) leading to downstream failures in data retrieval and processing.

    - **Data Access Bottlenecks**: GetRecipes and GetCustomerProfile appear as critical
    bottlenecks, with multiple upstream states failing when trying to access these data sources.

    - **Planning Vulnerabilities**: PlanToolCalls appears frequently as both a failure source
    and target, indicating the planning phase is a weak point in the system.

    - **Web Integration Issues**: The web information flow (GetRecipes → GenWebArgs → GetWebInfo)
    shows consistent failure patterns, suggesting problems with web search integration.
    """
    )
    return


if __name__ == "__main__":
    app.run()
