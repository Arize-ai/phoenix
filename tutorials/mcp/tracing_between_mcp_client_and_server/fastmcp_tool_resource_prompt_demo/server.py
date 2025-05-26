"""
server.py

Guide Example: MCP instrumentation with context propagation

This server script demonstrates how to:
- Set up a FastMCP server with OpenTelemetry-based instrumentation using OpenInference.
- Provide minimal mocks for PR file resources and review prompt templates.
- Implement context propagation and nested span tracing for tool and resource endpoints.
"""

import time

from dotenv import load_dotenv

# --- Set up tracing and instrumenting before imports that use MCP ---
load_dotenv()
from openinference.instrumentation.mcp import MCPInstrumentor

from phoenix.otel import register

tracer_provider = register(project_name="test_mcp_project")
MCPInstrumentor().instrument(tracer_provider=tracer_provider)
tracer = tracer_provider.get_tracer("financial-analysis-server")
from fastmcp import FastMCP

mcp = FastMCP("server", instructions="Test server for context propagation demo.")

# --- Tools and resources (producing spans) ---


@mcp.tool()
def create_pr_comment(file_path: str, line: int, comment: str, severity: str = "medium"):
    """
    Simulates posting a PR comment. Wraps logic in a span to demonstrate tool-level trace context.
    """

    @tracer.tool
    def mock_pr_comment_post(file_path: str, line: int, comment: str) -> str:
        """
        Here you would make a real request to the PR comment API.
        """
        # Simulate delay for realistic post request.
        time.sleep(0.1)
        return f"PR comment posted for ({file_path}:{line}) : {comment}"

    composed_comment = f"[severity: {severity}] {comment}"
    return mock_pr_comment_post(file_path, line, composed_comment)


@mcp.resource("pr://{pr_id}/files")
def get_pr_added_files(pr_id: str) -> list[str]:
    """
    Returns mock files for the PR, each designed to provide issues for different review types.
    """

    @tracer.tool
    def mock_pr_files_retrieval(sql_query: str) -> list[str]:
        """
        Here you would make a real request to the database.
        """
        # Simulate delay for realistic request to database.
        time.sleep(0.1)
        files = [
            # Security review candidate
            """# src/utils.py
def process_file(filename):
    import os
    os.system(f"cat {filename}")
""",
            # Performance review candidate
            """# src/perf.py
def inefficient_sort(data):
    # O(n^2) sort for demo
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[j] < data[i]:
                data[i], data[j] = data[j], data[i]
""",
        ]
        return files

    sql_query = f"SELECT * FROM pr_files WHERE pr_id = {pr_id}"
    return mock_pr_files_retrieval(sql_query)


# --- Prompt templates for each review type (as plain checklists) ---


@mcp.prompt()
def security_review(recommendations: str) -> str:
    """
    Security checklist template. Only checkboxes that match actual PR comments
    should be marked checked.
    """
    return f"""# Security Review Checklist

- [ ] Command injection vulnerabilities
- [ ] Input validation
- [ ] Authentication issues
- [ ] Data sanitization
- [ ] {recommendations}
"""


@mcp.prompt()
def performance_review(recommendations: str) -> str:
    """
    Performance checklist template.
    """
    return f"""# Performance Review Checklist

- [ ] Detect O(n^2) loops
- [ ] Optimize data structures
- [ ] Database query performance
- [ ] {recommendations}
"""


@mcp.prompt()
def junior_feedback(recommendations: str) -> str:
    """
    Junior/mentorship-oriented checklist template.
    """
    return f"""# Junior Feedback Checklist

- [ ] Consistent naming
- [ ] Function documentation
- [ ] Code organization
- [ ] {recommendations}
"""


if __name__ == "__main__":
    print("Server running.")
    mcp.run()
