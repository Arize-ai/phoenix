"""Control Flow Execution.

Handles control flow constructs:
- if/elif/else
- for loops
- C-style for loops
- while loops
- until loops
- case statements
- break/continue
"""

from typing import TYPE_CHECKING

from ..ast.types import (
    IfNode,
    ForNode,
    CStyleForNode,
    WhileNode,
    UntilNode,
    CaseNode,
)
from ..types import ExecResult
from .errors import BreakError, ContinueError, ErrexitError, ExecutionLimitError, ExitError, ReturnError
from .expansion import expand_word_async, expand_word_for_case_pattern, expand_word_with_glob, evaluate_arithmetic

if TYPE_CHECKING:
    from .types import InterpreterContext


def _result(stdout: str, stderr: str, exit_code: int) -> ExecResult:
    """Create an ExecResult."""
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


def _failure(stderr: str) -> ExecResult:
    """Create a failed result."""
    return ExecResult(stdout="", stderr=stderr, exit_code=1)


async def execute_if(ctx: "InterpreterContext", node: IfNode) -> ExecResult:
    """Execute an if statement."""
    stdout = ""
    stderr = ""

    for clause in node.clauses:
        # Execute condition
        cond_result = await execute_condition(ctx, clause.condition)
        stdout += cond_result.stdout
        stderr += cond_result.stderr

        if cond_result.exit_code == 0:
            # Condition is true - execute body
            return await execute_statements(ctx, clause.body, stdout, stderr)

    # No condition matched - check for else
    if node.else_body:
        return await execute_statements(ctx, node.else_body, stdout, stderr)

    return _result(stdout, stderr, 0)


async def execute_for(ctx: "InterpreterContext", node: ForNode) -> ExecResult:
    """Execute a for loop."""
    stdout = ""
    stderr = ""
    exit_code = 0
    iterations = 0

    # Validate variable name
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', node.variable):
        return _failure(f"bash: `{node.variable}': not a valid identifier\n")

    # Get words to iterate over
    words: list[str] = []
    if node.words is None:
        # Iterate over positional parameters ($1, $2, ...)
        count = int(ctx.state.env.get("#", "0"))
        words = []
        for pi in range(1, count + 1):
            val = ctx.state.env.get(str(pi), "")
            if val:
                words.append(val)
        if not words:
            # Fallback to $@ if positional params not set individually
            at_val = ctx.state.env.get("@", "")
            if at_val:
                words = at_val.split()
    elif len(node.words) == 0:
        words = []
    else:
        for word in node.words:
            expanded = await expand_word_with_glob(ctx, word)
            words.extend(expanded["values"])

    ctx.state.loop_depth += 1
    try:
        for value in words:
            iterations += 1
            if iterations > ctx.limits.max_loop_iterations:
                raise ExecutionLimitError(
                    f"for loop: too many iterations ({ctx.limits.max_loop_iterations})",
                    "iterations",
                )

            ctx.state.env[node.variable] = value

            try:
                for stmt in node.body:
                    result = await ctx.execute_statement(stmt)
                    stdout += result.stdout
                    stderr += result.stderr
                    exit_code = result.exit_code
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    e.stdout = stdout
                    e.stderr = stderr
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    e.stdout = stdout
                    e.stderr = stderr
                    raise
                continue
            except ExitError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ReturnError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ErrexitError as e:
                e.prepend_output(stdout, stderr)
                raise
    finally:
        ctx.state.loop_depth -= 1

    return _result(stdout, stderr, exit_code)


async def execute_c_style_for(ctx: "InterpreterContext", node: CStyleForNode) -> ExecResult:
    """Execute a C-style for loop: for ((init; cond; update))."""
    stdout = ""
    stderr = ""
    exit_code = 0
    iterations = 0

    # Set LINENO to the for loop line for condition evaluation
    if node.line is not None:
        ctx.state.current_line = node.line

    # Execute init
    if node.init:
        await evaluate_arithmetic(ctx, node.init.expression)

    ctx.state.loop_depth += 1
    try:
        while True:
            iterations += 1
            if iterations > ctx.limits.max_loop_iterations:
                raise ExecutionLimitError(
                    f"for loop: too many iterations ({ctx.limits.max_loop_iterations})",
                    "iterations",
                )

            # Check condition - update LINENO to for loop line each time
            if node.condition:
                if node.line is not None:
                    ctx.state.current_line = node.line
                cond_result = await evaluate_arithmetic(ctx, node.condition.expression)
                if cond_result == 0:
                    break

            try:
                for stmt in node.body:
                    result = await ctx.execute_statement(stmt)
                    stdout += result.stdout
                    stderr += result.stderr
                    exit_code = result.exit_code
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                # Still run update on continue
                if node.update:
                    await evaluate_arithmetic(ctx, node.update.expression)
                continue
            except ExitError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ReturnError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ErrexitError as e:
                e.prepend_output(stdout, stderr)
                raise

            # Execute update
            if node.update:
                await evaluate_arithmetic(ctx, node.update.expression)
    finally:
        ctx.state.loop_depth -= 1

    return _result(stdout, stderr, exit_code)


async def execute_while(ctx: "InterpreterContext", node: WhileNode, stdin: str = "") -> ExecResult:
    """Execute a while loop."""
    stdout = ""
    stderr = ""
    exit_code = 0
    iterations = 0

    # Set group_stdin so read builtin can consume piped input
    saved_group_stdin = ctx.state.group_stdin
    if stdin:
        ctx.state.group_stdin = stdin

    ctx.state.loop_depth += 1
    try:
        while True:
            iterations += 1
            if iterations > ctx.limits.max_loop_iterations:
                raise ExecutionLimitError(
                    f"while loop: too many iterations ({ctx.limits.max_loop_iterations})",
                    "iterations",
                )

            # Execute condition
            saved_in_condition = ctx.state.in_condition
            ctx.state.in_condition = True
            try:
                cond_result = await execute_condition(ctx, node.condition)
                stdout += cond_result.stdout
                stderr += cond_result.stderr

                if cond_result.exit_code != 0:
                    break
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                continue
            finally:
                ctx.state.in_condition = saved_in_condition

            try:
                for stmt in node.body:
                    result = await ctx.execute_statement(stmt)
                    stdout += result.stdout
                    stderr += result.stderr
                    exit_code = result.exit_code
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                continue
            except ExitError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ReturnError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ErrexitError as e:
                e.prepend_output(stdout, stderr)
                raise
    finally:
        ctx.state.loop_depth -= 1
        ctx.state.group_stdin = saved_group_stdin

    return _result(stdout, stderr, exit_code)


async def execute_until(ctx: "InterpreterContext", node: UntilNode) -> ExecResult:
    """Execute an until loop."""
    stdout = ""
    stderr = ""
    exit_code = 0
    iterations = 0

    ctx.state.loop_depth += 1
    try:
        while True:
            iterations += 1
            if iterations > ctx.limits.max_loop_iterations:
                raise ExecutionLimitError(
                    f"until loop: too many iterations ({ctx.limits.max_loop_iterations})",
                    "iterations",
                )

            # Execute condition (until exits when condition is TRUE)
            saved_in_condition = ctx.state.in_condition
            ctx.state.in_condition = True
            try:
                cond_result = await execute_condition(ctx, node.condition)
                stdout += cond_result.stdout
                stderr += cond_result.stderr

                if cond_result.exit_code == 0:
                    break  # Condition became true, exit loop
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                continue
            finally:
                ctx.state.in_condition = saved_in_condition

            try:
                for stmt in node.body:
                    result = await ctx.execute_statement(stmt)
                    stdout += result.stdout
                    stderr += result.stderr
                    exit_code = result.exit_code
            except BreakError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                break
            except ContinueError as e:
                stdout += e.stdout
                stderr += e.stderr
                if e.levels > 1 and ctx.state.loop_depth > 1:
                    e.levels -= 1
                    raise
                continue
            except ExitError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ReturnError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ErrexitError as e:
                e.prepend_output(stdout, stderr)
                raise
    finally:
        ctx.state.loop_depth -= 1

    return _result(stdout, stderr, exit_code)


async def execute_case(ctx: "InterpreterContext", node: CaseNode) -> ExecResult:
    """Execute a case statement."""
    import fnmatch
    import re as _re
    from .expansion import glob_to_regex

    stdout = ""
    stderr = ""
    exit_code = 0

    # Expand the word to match against
    word_value = await expand_word_async(ctx, node.word)

    # Check if extglob is enabled
    extglob_enabled = ctx.state.env.get("__shopt_extglob__", "0") == "1"
    # Check if nocasematch is enabled
    nocasematch = ctx.state.env.get("__shopt_nocasematch__", "0") == "1"

    def _case_match(value: str, pattern: str) -> bool:
        """Match value against case pattern (supports extglob when enabled)."""
        if nocasematch:
            value = value.lower()
            pattern = pattern.lower()
        if extglob_enabled and _re.search(r'[@?*+!]\(', pattern):
            regex_pat = "^" + glob_to_regex(pattern) + "$"
            try:
                flags = _re.IGNORECASE if nocasematch else 0
                return bool(_re.match(regex_pat, value, flags))
            except _re.error:
                pass
        return fnmatch.fnmatch(value, pattern)

    fall_through = False
    for case_item in node.items:
        if not fall_through:
            # Check each pattern
            matched = False
            for pattern in case_item.patterns:
                pattern_value = await expand_word_for_case_pattern(ctx, pattern)
                if _case_match(word_value, pattern_value):
                    matched = True
                    break
        else:
            # ;& fall-through: execute without pattern check
            matched = True
            fall_through = False

        if matched:
            # Execute the body for this case
            try:
                for stmt in case_item.body:
                    result = await ctx.execute_statement(stmt)
                    stdout += result.stdout
                    stderr += result.stderr
                    exit_code = result.exit_code
            except ExitError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ReturnError as e:
                e.prepend_output(stdout, stderr)
                raise
            except ErrexitError as e:
                e.prepend_output(stdout, stderr)
                raise

            # Check terminator
            if case_item.terminator == ";;":
                # Normal termination - exit case
                break
            elif case_item.terminator == ";&":
                # Fall through to next case body (without pattern check)
                fall_through = True
                continue
            elif case_item.terminator == ";;&":
                # Continue checking patterns
                continue
            else:
                break

    return _result(stdout, stderr, exit_code)


async def execute_condition(ctx: "InterpreterContext", condition: list) -> ExecResult:
    """Execute a condition (list of statements) and return the result."""
    stdout = ""
    stderr = ""
    exit_code = 0

    saved_in_condition = ctx.state.in_condition
    ctx.state.in_condition = True
    try:
        for stmt in condition:
            result = await ctx.execute_statement(stmt)
            stdout += result.stdout
            stderr += result.stderr
            exit_code = result.exit_code
    finally:
        ctx.state.in_condition = saved_in_condition

    return _result(stdout, stderr, exit_code)


async def execute_statements(
    ctx: "InterpreterContext",
    statements: list,
    stdout: str = "",
    stderr: str = "",
) -> ExecResult:
    """Execute a list of statements."""
    exit_code = 0

    try:
        for stmt in statements:
            result = await ctx.execute_statement(stmt)
            stdout += result.stdout
            stderr += result.stderr
            exit_code = result.exit_code
    except (BreakError, ContinueError, ReturnError, ErrexitError) as error:
        # Prepend accumulated output before propagating control flow
        error.prepend_output(stdout, stderr)
        raise

    return _result(stdout, stderr, exit_code)
