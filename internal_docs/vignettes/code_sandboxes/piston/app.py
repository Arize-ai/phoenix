import ast
import json
import logging
import os
import textwrap
import time

import httpx
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PISTON_URL = os.environ.get("PISTON_URL", "http://localhost:2000")
PYTHON_VERSION = "*"


def _fetch_python_version() -> str:
    try:
        resp = httpx.get(f"{PISTON_URL}/api/v2/runtimes", timeout=5)
        resp.raise_for_status()
        for rt in resp.json():
            if rt["language"] == "python":
                return rt["version"]
    except Exception as exc:
        logger.warning("Could not fetch Python version: %s", exc)
    return "*"


def _extract_function_names(code: str) -> list[str]:
    """Return all top-level function names defined in *code*."""
    try:
        tree = ast.parse(textwrap.dedent(code))
        return [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
    except SyntaxError:
        return []


def _coerce_args_dict(args_dict: str) -> str:
    """Replace JSON-style literals with Python equivalents so users can type
    either style without getting NameErrors."""
    import re

    # Only replace when they appear as values (after : or at start of collection),
    # not inside strings. A simple token-level replace is good enough here.
    result = re.sub(r'(?<!["\w])true(?![\w"])', "True", args_dict)
    result = re.sub(r'(?<!["\w])false(?![\w"])', "False", result)
    result = re.sub(r'(?<!["\w])null(?![\w"])', "None", result)
    return result


def _build_script(function_def: str, args_dict: str) -> str:
    """
    Wrap the user's function definition and args dict into a complete Python
    script that calls the function and prints the result as JSON.
    """
    args_dict = _coerce_args_dict(args_dict)
    names = _extract_function_names(function_def)
    func_name = names[-1] if names else None

    call_block: str
    if func_name:
        call_block = f"""\
_func_name = {func_name!r}
_func = locals().get(_func_name) or globals().get(_func_name)
if _func is None:
    raise NameError(f"function {{_func_name!r}} not found")
_result = _func(**_args)
"""
    else:
        call_block = """\
raise ValueError("No function definition found in the left pane")
"""

    return f"""\
import json as _json

# ── user function ────────────────────────────────────────────────────────────
{textwrap.dedent(function_def)}

# ── execute ──────────────────────────────────────────────────────────────────
try:
    _args = {args_dict}
    if not isinstance(_args, dict):
        raise TypeError("Arguments pane must be a Python dict literal")
    {textwrap.indent(call_block, "    ").lstrip()}
    print(_json.dumps({{"result": _result}}, default=str))
except Exception as _e:
    print(_json.dumps({{"error": type(_e).__name__ + ": " + str(_e)}}))
"""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/execute", methods=["POST"])
def execute():
    data = request.get_json(force=True)
    function_def: str = data.get("function_def", "").strip()
    args_dict: str = data.get("args_dict", "{}").strip() or "{}"

    if not function_def:
        return jsonify({"error": "ValueError: Function definition is empty"}), 400

    script = _build_script(function_def, args_dict)

    payload = {
        "language": "python",
        "version": PYTHON_VERSION,
        "files": [{"name": "main.py", "content": script}],
        "run_timeout": 3000,
        "compile_timeout": 3000,
    }

    try:
        resp = httpx.post(f"{PISTON_URL}/api/v2/execute", json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        run = result.get("run", {})
        raw_stdout = run.get("stdout", "").strip()

        output: dict
        if raw_stdout:
            try:
                output = json.loads(raw_stdout)
            except json.JSONDecodeError:
                output = {"raw": raw_stdout}
        else:
            output = {}

        stderr = run.get("stderr", "").strip()
        if stderr:
            output["_stderr"] = stderr

        return jsonify(
            {
                "output": output,
                "exit_code": run.get("code"),
                "wall_time": run.get("wall_time"),
                "python_version": result.get("version"),
            }
        )
    except httpx.HTTPStatusError as exc:
        try:
            msg = exc.response.json().get("message", str(exc))
        except Exception:
            msg = str(exc)
        return jsonify({"error": msg}), 502
    except Exception as exc:
        return jsonify({"error": f"Piston unreachable: {exc}"}), 503


@app.route("/health")
def health():
    try:
        resp = httpx.get(f"{PISTON_URL}/api/v2/runtimes", timeout=3)
        piston_ok = resp.status_code == 200
    except Exception:
        piston_ok = False
    return jsonify({"app": "ok", "piston": "ok" if piston_ok else "unavailable"})


if __name__ == "__main__":
    for attempt in range(10):
        v = _fetch_python_version()
        if v != "*":
            PYTHON_VERSION = v
            logger.info("Piston ready — Python %s", PYTHON_VERSION)
            break
        logger.info("Waiting for Piston… (attempt %d/10)", attempt + 1)
        time.sleep(3)

    app.run(host="0.0.0.0", port=5000, debug=False)
