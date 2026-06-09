"""Interpreter - AST Execution Engine.

Main interpreter class that executes bash AST nodes.
Delegates to specialized modules for:
- Word expansion (expansion.py)
- Arithmetic evaluation (arithmetic.py)
- Conditional evaluation (conditionals.py)
- Built-in commands (builtins/)
- Redirections (redirections.py)
"""

import time
from typing import Optional

from ..ast.types import (
    CommandNode,
    PipelineNode,
    ScriptNode,
    SimpleCommandNode,
    StatementNode,
    IfNode,
    ForNode,
    CStyleForNode,
    WhileNode,
    UntilNode,
    CaseNode,
    SubshellNode,
    GroupNode,
    FunctionDefNode,
    ConditionalCommandNode,
    ArithmeticCommandNode,
)
from ..types import Command, ExecResult, ExecutionLimits, IFileSystem, SecureFetch
from .errors import (
    BadSubstitutionError,
    BreakError,
    ContinueError,
    ErrexitError,
    ExecutionLimitError,
    ExitError,
    NounsetError,
    ReturnError,
)
from .types import InterpreterContext, InterpreterState, ShellOptions, VariableStore, FDTable
from .expansion import expand_word_async, expand_word_with_glob, get_variable, evaluate_arithmetic
from .conditionals import evaluate_conditional
from .control_flow import (
    execute_if,
    execute_for,
    execute_c_style_for,
    execute_while,
    execute_until,
    execute_case,
)
from .builtins import BUILTINS
from .builtins.alias import get_aliases
from .builtins.shopt import DEFAULT_SHOPTS


def _word_has_literal_equals(word) -> bool:
    """Check if a WordNode contains a literal '=' (not from variable expansion)."""
    from ..ast.types import LiteralPart, DoubleQuotedPart
    for part in word.parts:
        if isinstance(part, LiteralPart) and "=" in part.value:
            return True
    return False


def _apply_tilde_to_assignment(arg: str, ctx) -> str:
    """Apply tilde expansion to the value portion of a name=value argument."""
    if "=" in arg:
        eq_idx = arg.index("=")
        name = arg[:eq_idx]
        value = arg[eq_idx + 1:]
        from .expansion import expand_tilde_in_assignment_value
        value = expand_tilde_in_assignment_value(ctx, value)
        return name + "=" + value
    return arg


def _maybe_export_variable(state: "InterpreterState", name: str) -> None:
    """If allexport is enabled, mark the variable as exported."""
    if state.options.allexport and isinstance(state.env, VariableStore):
        # Don't export special/internal variables
        if not name.startswith("_") and name not in ("?", "#", "$", "!", "-", "*", "@") and not name.isdigit():
            state.env.set_attribute(name, "x")


def _ok() -> ExecResult:
    """Return a successful result."""
    return ExecResult(stdout="", stderr="", exit_code=0)


def _result(stdout: str, stderr: str, exit_code: int) -> ExecResult:
    """Create an ExecResult."""
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


def _failure(stderr: str) -> ExecResult:
    """Create a failed result with stderr."""
    return ExecResult(stdout="", stderr=stderr, exit_code=1)


def _is_shopt_set(env: dict[str, str], name: str) -> bool:
    """Check if a shopt option is set."""
    key = f"__shopt_{name}__"
    if key in env:
        return env[key] == "1"
    return DEFAULT_SHOPTS.get(name, False)


def _word_has_quoting(word) -> bool:
    """Check if a word contains any quoting (single, double, or escape)."""
    from ..ast.types import SingleQuotedPart, DoubleQuotedPart, EscapedPart
    if word is None or not hasattr(word, 'parts'):
        return False
    for part in word.parts:
        if isinstance(part, (SingleQuotedPart, DoubleQuotedPart, EscapedPart)):
            return True
    return False


class Interpreter:
    """AST interpreter for bash scripts."""

    def __init__(
        self,
        fs: IFileSystem,
        commands: dict[str, Command],
        limits: ExecutionLimits,
        state: Optional[InterpreterState] = None,
        fetch: Optional[SecureFetch] = None,
    ):
        """Initialize the interpreter.

        Args:
            fs: Filesystem interface
            commands: Command registry
            limits: Execution limits
            state: Optional initial state (creates default if not provided)
            fetch: Optional secure fetch function for network-enabled commands
        """
        self._fs = fs
        self._commands = commands
        self._limits = limits
        self._fetch = fetch
        self._state = state or InterpreterState(
            env=VariableStore({
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "HOME": "/home/user",
                "USER": "user",
                "SHELL": "/bin/bash",
                "PWD": "/home/user",
                "?": "0",
            }),
            cwd="/home/user",
            previous_dir="",
            start_time=time.time(),
        )

        # Build the context
        self._ctx = InterpreterContext(
            state=self._state,
            fs=fs,
            commands=commands,
            limits=limits,
            exec_fn=self._exec_fn,
            execute_script=self.execute_script,
            execute_statement=self.execute_statement,
            execute_command=self.execute_command,
        )

    @property
    def state(self) -> InterpreterState:
        """Get the interpreter state."""
        return self._state

    async def _exec_fn(
        self,
        script: str,
        env: Optional[dict[str, str]] = None,
        cwd: Optional[str] = None,
    ) -> ExecResult:
        """Execute a script string (for subcommands)."""
        # Import here to avoid circular imports
        from ..parser import parse

        # Parse the script
        ast = parse(script)

        # Create a new state for the subshell if env/cwd are provided
        if env or cwd:
            new_env = self._state.env.copy() if isinstance(self._state.env, VariableStore) else VariableStore(self._state.env)
            if env:
                new_env.update(env)
            new_state = InterpreterState(
                env=new_env,
                cwd=cwd or self._state.cwd,
                previous_dir=self._state.previous_dir,
                functions=dict(self._state.functions),
                start_time=self._state.start_time,
                options=ShellOptions(
                    errexit=self._state.options.errexit,
                    pipefail=self._state.options.pipefail,
                    nounset=self._state.options.nounset,
                    xtrace=self._state.options.xtrace,
                    verbose=self._state.options.verbose,
                    noglob=self._state.options.noglob,
                    noclobber=self._state.options.noclobber,
                    nobraceexpand=self._state.options.nobraceexpand,
                    allexport=self._state.options.allexport,
                    emacs=self._state.options.emacs,
                    vi=self._state.options.vi,
                ),
                fd_table=self._state.fd_table.clone(),
            )
            sub_interpreter = Interpreter(
                fs=self._fs,
                commands=self._commands,
                limits=self._limits,
                state=new_state,
                fetch=self._fetch,
            )
            try:
                return await sub_interpreter.execute_script(ast)
            except ExitError as e:
                return ExecResult(stdout=e.stdout, stderr=e.stderr, exit_code=e.exit_code)
            except ErrexitError as e:
                return ExecResult(stdout=e.stdout, stderr=e.stderr, exit_code=e.exit_code)

        try:
            return await self.execute_script(ast)
        except ExitError as e:
            return ExecResult(stdout=e.stdout, stderr=e.stderr, exit_code=e.exit_code)
        except ErrexitError as e:
            return ExecResult(stdout=e.stdout, stderr=e.stderr, exit_code=e.exit_code)

    async def execute_script(self, node: ScriptNode) -> ExecResult:
        """Execute a script AST node."""
        stdout = ""
        stderr = ""
        exit_code = 0

        # Reset alias snapshot line tracking for new script.
        # This ensures aliases from previous exec() calls are available.
        self._state.alias_snapshot_line = None

        for statement in node.statements:
            try:
                result = await self.execute_statement(statement)
                stdout += result.stdout
                stderr += result.stderr
                exit_code = result.exit_code
                self._state.last_exit_code = exit_code
                self._state.env["?"] = str(exit_code)
            except ExitError as error:
                # ExitError always propagates up to terminate the script
                error.prepend_output(stdout, stderr)
                raise
            except ExecutionLimitError:
                # ExecutionLimitError must always propagate
                raise
            except ErrexitError as error:
                stdout += error.stdout
                stderr += error.stderr
                exit_code = error.exit_code
                self._state.last_exit_code = exit_code
                self._state.env["?"] = str(exit_code)
                return ExecResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    env=dict(self._state.env),
                )
            except NounsetError as error:
                stdout += error.stdout
                stderr += error.stderr
                exit_code = 1
                self._state.last_exit_code = exit_code
                self._state.env["?"] = str(exit_code)
                return ExecResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    env=dict(self._state.env),
                )
            except BadSubstitutionError as error:
                stdout += error.stdout
                stderr += error.stderr
                exit_code = 1
                self._state.last_exit_code = exit_code
                self._state.env["?"] = str(exit_code)
                return ExecResult(
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=exit_code,
                    env=dict(self._state.env),
                )
            except (BreakError, ContinueError) as error:
                # Handle break/continue errors
                if self._state.loop_depth > 0:
                    # Inside a loop, propagate the error
                    error.prepend_output(stdout, stderr)
                    raise
                # Outside loops, silently continue
                stdout += error.stdout
                stderr += error.stderr
                continue
            except ReturnError as error:
                if self._state.call_depth == 0 and self._state.source_depth == 0:
                    # At top level - warn and use return's exit code
                    stdout += error.stdout
                    stderr += error.stderr + "bash: return: can only `return' from a function or sourced script\n"
                    exit_code = error.exit_code if error.exit_code != 0 else 1
                    self._state.last_exit_code = exit_code
                    self._state.env["?"] = str(exit_code)
                    continue
                # Inside function or sourced script - propagate
                error.prepend_output(stdout, stderr)
                raise

        return ExecResult(
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            env=dict(self._state.env),
        )

    async def execute_statement(self, node: StatementNode) -> ExecResult:
        """Execute a statement AST node."""
        self._state.command_count += 1
        if self._state.command_count > self._limits.max_command_count:
            raise ExecutionLimitError(
                f"too many commands executed (>{self._limits.max_command_count}), "
                "increase execution_limits.max_command_count",
                "commands",
            )

        # Snapshot aliases at line boundaries for bash-like expansion semantics.
        # In bash, aliases defined on a line aren't available for expansion until
        # the next line (since parsing happens before execution). We approximate
        # this by snapshotting aliases when we start executing a new line.
        from .builtins.alias import get_aliases
        # Get line number from first command in first pipeline
        stmt_line = None
        if node.pipelines and node.pipelines[0].commands:
            cmd = node.pipelines[0].commands[0]
            if hasattr(cmd, 'line'):
                stmt_line = cmd.line
        # Update snapshot if this is a new line (or first statement)
        current_snapshot_line = getattr(self._state, 'alias_snapshot_line', None)
        if stmt_line is None or stmt_line != current_snapshot_line:
            self._state.alias_snapshot = dict(get_aliases(self._ctx))
            self._state.alias_snapshot_line = stmt_line

        stdout = ""
        stderr = ""
        exit_code = 0
        last_executed_index = -1
        last_pipeline_negated = False
        has_and_or = len(node.pipelines) > 1

        for i, pipeline in enumerate(node.pipelines):
            operator = node.operators[i - 1] if i > 0 else None

            if operator == "&&" and exit_code != 0:
                continue
            if operator == "||" and exit_code == 0:
                continue

            result = await self.execute_pipeline(pipeline)
            stdout += result.stdout
            stderr += result.stderr
            exit_code = result.exit_code
            last_executed_index = i
            last_pipeline_negated = pipeline.negated

            # Update $? after each pipeline
            self._state.last_exit_code = exit_code
            self._state.env["?"] = str(exit_code)

        # Track whether the non-zero exit was from a short-circuited AND-OR.
        # Compound commands (groups, etc.) should not trigger errexit for
        # exits that came from non-last commands in an AND-OR chain.
        and_or_short_circuited = (
            has_and_or
            and exit_code != 0
            and last_executed_index < len(node.pipelines) - 1
        )

        # Check errexit (set -e)
        if (
            self._state.options.errexit
            and exit_code != 0
            and not and_or_short_circuited
            and not last_pipeline_negated
            and not self._state.in_condition
        ):
            raise ErrexitError(exit_code, stdout, stderr)

        return _result(stdout, stderr, exit_code)

    async def execute_pipeline(self, node: PipelineNode) -> ExecResult:
        """Execute a pipeline AST node."""
        # Use group_stdin for the first command if we're inside a group.
        # Don't clear it here - commands that consume stdin (like read)
        # will update it via __remaining_stdin__. Commands that don't
        # consume stdin leave it unchanged for subsequent pipelines.
        stdin = self._state.group_stdin or ""
        last_result = _ok()
        pipefail_exit_code = 0
        pipestatus_exit_codes: list[int] = []

        for i, command in enumerate(node.commands):
            is_last = i == len(node.commands) - 1

            try:
                result = await self.execute_command(command, stdin)
            except BadSubstitutionError as error:
                result = ExecResult(
                    stdout=error.stdout,
                    stderr=error.stderr,
                    exit_code=1,
                )
            except ExitError as error:
                # In a multi-command pipeline, each command runs in subshell context
                if len(node.commands) > 1:
                    result = ExecResult(
                        stdout=error.stdout,
                        stderr=error.stderr,
                        exit_code=error.exit_code,
                    )
                else:
                    raise

            # Check if a command (like read) consumed stdin and set remaining
            remaining = self._state.env.get("__remaining_stdin__")
            if remaining is not None:
                self._state.group_stdin = remaining
                del self._state.env["__remaining_stdin__"]

            # Track exit code for PIPESTATUS
            pipestatus_exit_codes.append(result.exit_code)

            # Track failing exit code for pipefail
            if result.exit_code != 0:
                pipefail_exit_code = result.exit_code

            if not is_last:
                # Check if this pipe is |& (merge stderr into stdin for next command)
                is_pipe_amp = (node.pipe_amp and i < len(node.pipe_amp) and node.pipe_amp[i])
                if is_pipe_amp:
                    stdin = result.stdout + result.stderr
                    last_result = ExecResult(
                        stdout="",
                        stderr="",
                        exit_code=result.exit_code,
                    )
                else:
                    stdin = result.stdout
                    last_result = ExecResult(
                        stdout="",
                        stderr=result.stderr,
                        exit_code=result.exit_code,
                    )
            else:
                last_result = result

        # Set PIPESTATUS array
        for key in list(self._state.env.keys()):
            if key.startswith("PIPESTATUS_"):
                del self._state.env[key]
        for i, code in enumerate(pipestatus_exit_codes):
            self._state.env[f"PIPESTATUS_{i}"] = str(code)
        self._state.env["PIPESTATUS__length"] = str(len(pipestatus_exit_codes))

        # Apply pipefail
        if self._state.options.pipefail and pipefail_exit_code != 0:
            last_result = ExecResult(
                stdout=last_result.stdout,
                stderr=last_result.stderr,
                exit_code=pipefail_exit_code,
            )

        # Apply negation
        if node.negated:
            last_result = ExecResult(
                stdout=last_result.stdout,
                stderr=last_result.stderr,
                exit_code=1 if last_result.exit_code == 0 else 0,
            )

        return last_result

    async def execute_command(self, node: CommandNode, stdin: str) -> ExecResult:
        """Execute a command AST node."""
        # For compound commands with redirections (except Group/Subshell which
        # handle their own), process input redirections to provide stdin
        needs_stdin_setup = (
            hasattr(node, 'redirections') and node.redirections
            and node.type not in ("SimpleCommand", "Group", "Subshell")
        )
        saved_group_stdin = None
        if needs_stdin_setup:
            stdin = await self._process_input_redirections(node.redirections, stdin)
            if stdin:
                saved_group_stdin = self._state.group_stdin
                self._state.group_stdin = stdin

        try:
            return await self._execute_command_inner(node, stdin)
        finally:
            if saved_group_stdin is not None:
                self._state.group_stdin = saved_group_stdin

    async def _execute_command_inner(self, node: CommandNode, stdin: str) -> ExecResult:
        """Inner dispatch for command execution."""
        if isinstance(node, SimpleCommandNode) or node.type == "SimpleCommand":
            return await self._execute_simple_command(node, stdin)
        elif isinstance(node, IfNode) or node.type == "If":
            return await execute_if(self._ctx, node)
        elif isinstance(node, ForNode) or node.type == "For":
            return await execute_for(self._ctx, node)
        elif isinstance(node, CStyleForNode) or node.type == "CStyleFor":
            return await execute_c_style_for(self._ctx, node)
        elif isinstance(node, WhileNode) or node.type == "While":
            return await execute_while(self._ctx, node, stdin)
        elif isinstance(node, UntilNode) or node.type == "Until":
            return await execute_until(self._ctx, node)
        elif isinstance(node, CaseNode) or node.type == "Case":
            return await execute_case(self._ctx, node)
        elif isinstance(node, SubshellNode) or node.type == "Subshell":
            return await self._execute_subshell(node, stdin)
        elif isinstance(node, GroupNode) or node.type == "Group":
            return await self._execute_group(node, stdin)
        elif isinstance(node, FunctionDefNode) or node.type == "FunctionDef":
            return await self._execute_function_def(node)
        elif isinstance(node, ConditionalCommandNode) or node.type == "ConditionalCommand":
            return await self._execute_conditional(node)
        elif isinstance(node, ArithmeticCommandNode) or node.type == "ArithmeticCommand":
            return await self._execute_arithmetic(node)
        else:
            return _ok()

    async def _execute_subshell(self, node: SubshellNode, stdin: str) -> ExecResult:
        """Execute a subshell command."""
        # Process input redirections (heredoc, herestring, <) to get stdin
        if node.redirections:
            stdin = await self._process_input_redirections(node.redirections, stdin)

        # Create a new interpreter with a copy of the state
        new_state = InterpreterState(
            env=self._state.env.copy() if isinstance(self._state.env, VariableStore) else VariableStore(self._state.env),
            cwd=self._state.cwd,
            previous_dir=self._state.previous_dir,
            functions=dict(self._state.functions),
            start_time=self._state.start_time,
            options=ShellOptions(
                errexit=self._state.options.errexit,
                pipefail=self._state.options.pipefail,
                nounset=self._state.options.nounset,
                xtrace=self._state.options.xtrace,
                verbose=self._state.options.verbose,
            ),
            fd_table=self._state.fd_table.clone(),
            parent_has_loop_context=self._state.loop_depth > 0 or self._state.parent_has_loop_context,
        )
        # Pass pipeline stdin to subshell
        if stdin:
            new_state.group_stdin = stdin

        sub_interpreter = Interpreter(
            fs=self._fs,
            commands=self._commands,
            limits=self._limits,
            state=new_state,
            fetch=self._fetch,
        )

        # Execute statements in subshell
        stdout = ""
        stderr = ""
        exit_code = 0
        try:
            for stmt in node.body:
                result = await sub_interpreter.execute_statement(stmt)
                stdout += result.stdout
                stderr += result.stderr
                exit_code = result.exit_code
        except ExitError as e:
            # exit inside a subshell only exits the subshell
            stdout += e.stdout
            stderr += e.stderr
            exit_code = e.exit_code
        except (BreakError, ContinueError) as e:
            # break/continue inside a subshell cannot cross the subshell boundary
            # The subshell exits with exit code 0 (bash behavior)
            stdout += e.stdout
            stderr += e.stderr
            exit_code = 0
        except ErrexitError as e:
            # errexit inside a subshell exits the subshell
            stdout += e.stdout
            stderr += e.stderr
            exit_code = e.exit_code

        result = _result(stdout, stderr, exit_code)

        # Process output redirections on the subshell
        if node.redirections:
            result = await self._process_output_redirections(node.redirections, result)

        return result

    async def _execute_group(self, node: GroupNode, stdin: str) -> ExecResult:
        """Execute a command group { ... }."""
        # Groups execute in the current shell context
        stdout = ""
        stderr = ""
        exit_code = 0

        # Process input redirections (heredoc, herestring, <) to get stdin
        if node.redirections:
            stdin = await self._process_input_redirections(node.redirections, stdin)

        # Save and set group stdin
        saved_group_stdin = self._state.group_stdin
        if stdin:
            self._state.group_stdin = stdin

        try:
            for stmt in node.body:
                result = await self.execute_statement(stmt)
                stdout += result.stdout
                stderr += result.stderr
                exit_code = result.exit_code
        except (ReturnError, BreakError, ContinueError, ErrexitError) as error:
            # Prepend accumulated output before propagating control flow
            error.prepend_output(stdout, stderr)
            raise
        finally:
            self._state.group_stdin = saved_group_stdin

        result = _result(stdout, stderr, exit_code)

        # Process output redirections on the group
        if node.redirections:
            result = await self._process_output_redirections(node.redirections, result)

        return result

    async def _execute_function_def(self, node: FunctionDefNode) -> ExecResult:
        """Execute a function definition."""
        # Store the function in state
        self._state.functions[node.name] = node
        return _ok()

    async def _execute_conditional(self, node: ConditionalCommandNode) -> ExecResult:
        """Execute a conditional command [[ ... ]]."""
        # Update currentLine for $LINENO
        if node.line is not None:
            self._state.current_line = node.line

        if node.expression is None:
            return _result("", "", 0)

        try:
            result = await evaluate_conditional(self._ctx, node.expression)
            return _result("", "", 0 if result else 1)
        except ValueError as e:
            return _result("", f"bash: conditional: {e}\n", 2)

    async def _execute_arithmetic(self, node: ArithmeticCommandNode) -> ExecResult:
        """Execute an arithmetic command (( ... ))."""
        # Update currentLine for $LINENO
        if node.line is not None:
            self._state.current_line = node.line

        if node.expression is None:
            return _result("", "", 1)

        try:
            result = await evaluate_arithmetic(self._ctx, node.expression.expression)
            # (( expr )) returns 0 if result is non-zero, 1 if result is zero
            return _result("", "", 0 if result != 0 else 1)
        except Exception as e:
            return _result("", f"bash: arithmetic: {e}\n", 1)

    async def _execute_simple_command(
        self, node: SimpleCommandNode, stdin: str
    ) -> ExecResult:
        """Execute a simple command."""
        # Update currentLine for $LINENO
        if node.line is not None:
            self._state.current_line = node.line

        # Clear expansion state
        self._state.expansion_stderr = ""
        self._state.expansion_exit_code = None

        # Temporary assignments for command environment
        # Stores (old_value, was_exported) for restoration
        temp_assignments: dict[str, tuple[str | None, bool]] = {}

        # Handle assignments
        for assignment in node.assignments:
            name = assignment.name

            # Check for array subscript in name: a[idx]=value
            import re as _re
            _array_lhs = _re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', name)

            # Resolve nameref for array assignment target
            if (assignment.array
                    and isinstance(self._state.env, VariableStore)
                    and self._state.env.is_nameref(name)):
                try:
                    name = self._state.env.resolve_nameref(name)
                except ValueError:
                    pass

            # Check readonly before assignment
            # In bash, readonly errors are non-fatal (print error, set exit code 1)
            # unless errexit is set.
            _ro_name = name
            if _array_lhs:
                _ro_name = _array_lhs.group(1)
            _is_ro = (_ro_name in self._state.readonly_vars
                      or (isinstance(self._state.env, VariableStore) and self._state.env.is_readonly(_ro_name)))
            if _is_ro:
                ro_result = ExecResult(stdout="", stderr=f"bash: {_ro_name}: readonly variable\n", exit_code=1)
                if self._state.options.errexit:
                    raise ErrexitError(1, stderr=f"bash: {_ro_name}: readonly variable\n")
                return ro_result

            # Check for array assignment
            if assignment.array:
                if assignment.append:
                    # a+=(2 3) - append to existing array
                    # If variable is a scalar, convert it to an array first
                    if f"{name}__is_array" not in self._state.env and name in self._state.env:
                        scalar_val = self._state.env[name]
                        self._state.env[f"{name}_0"] = scalar_val
                        self._state.env[f"{name}__is_array"] = "indexed"
                        del self._state.env[name]

                    # Find next available index
                    from .expansion import get_array_elements as _get_elems
                    existing_elems = _get_elems(self._ctx, name)
                    next_idx = (max(i for i, _ in existing_elems) + 1) if existing_elems else 0

                    # Mark as array if not already
                    if f"{name}__is_array" not in self._state.env:
                        self._state.env[f"{name}__is_array"] = "indexed"

                    # Expand and store each new element
                    for i, elem in enumerate(assignment.array):
                        elem_value = await expand_word_async(self._ctx, elem)
                        self._state.env[f"{name}_{next_idx + i}"] = elem_value
                    _maybe_export_variable(self._state, name)
                else:
                    # a=(1 2 3) - replace array
                    # IMPORTANT: Expand elements FIRST to handle self-reference like a=(0 "${a[@]}")
                    # First pass: expand elements and check if any non-numeric keys exist
                    # Use expand_word_with_glob to handle "${arr[@]}" expanding to multiple elements
                    expanded_elements = []
                    has_non_numeric_key = False
                    for elem in assignment.array:
                        result = await expand_word_with_glob(self._ctx, elem, no_split=True)
                        for elem_value in result["values"]:
                            bracket_match = _re.match(r'^\[([^\]]+)\]=(.*)$', elem_value)
                            if bracket_match:
                                key = bracket_match.group(1)
                                try:
                                    int(key)
                                except ValueError:
                                    has_non_numeric_key = True
                            expanded_elements.append(elem_value)

                    # Now clear existing array elements (after expansion)
                    prefix = f"{name}_"
                    to_remove = [k for k in self._state.env if k.startswith(prefix) and not k.startswith(f"{name}__")]
                    for k in to_remove:
                        del self._state.env[k]

                    # Preserve array type if already declared (e.g., declare -A)
                    # Otherwise mark as indexed (may upgrade to assoc if non-numeric keys found)
                    existing_type = self._state.env.get(f"{name}__is_array")
                    if existing_type not in ("assoc", "associative"):
                        self._state.env[f"{name}__is_array"] = "indexed"

                    # Upgrade to associative if non-numeric keys found and not already associative
                    if has_non_numeric_key and self._state.env.get(f"{name}__is_array") == "indexed":
                        self._state.env[f"{name}__is_array"] = "assoc"

                    # Second pass: store elements
                    auto_idx = 0
                    for elem_value in expanded_elements:
                        # Check for [idx]=value syntax (from GlobPart + LiteralPart)
                        bracket_match = _re.match(r'^\[([^\]]+)\]=(.*)$', elem_value)
                        if bracket_match:
                            key = bracket_match.group(1)
                            val = bracket_match.group(2)
                            self._state.env[f"{name}_{key}"] = val
                            try:
                                auto_idx = int(key) + 1
                            except ValueError:
                                pass  # assoc array key
                        else:
                            self._state.env[f"{name}_{auto_idx}"] = elem_value
                            auto_idx += 1
                    _maybe_export_variable(self._state, name)
                continue

            # Handle nameref for the assignment target
            _is_nameref_without_target = False
            _original_nameref_name = name
            if (isinstance(self._state.env, VariableStore)
                    and not _array_lhs
                    and self._state.env.is_nameref(name)):
                # Check if nameref has a target
                meta = self._state.env._metadata.get(name)
                if meta and meta.nameref_target:
                    # Has target - resolve and assign to target
                    try:
                        name = self._state.env.resolve_nameref(name)
                    except ValueError:
                        pass
                else:
                    # No target - we'll set the assigned value as the target
                    _is_nameref_without_target = True

            # Expand assignment value
            value = ""
            if assignment.value:
                value = await expand_word_async(self._ctx, assignment.value)

            # Apply attribute-based transformations
            if isinstance(self._state.env, VariableStore):
                attrs = self._state.env.get_attributes(name)
                if "i" in attrs:
                    # Integer attribute: evaluate as arithmetic
                    try:
                        from .expansion import evaluate_arithmetic_sync
                        from ..parser.parser import Parser
                        parser = Parser()
                        arith_expr = parser._parse_arith_comma(value)
                        value = str(evaluate_arithmetic_sync(self._ctx, arith_expr))
                    except Exception:
                        try:
                            value = str(int(value))
                        except ValueError:
                            value = "0"
                if "l" in attrs:
                    value = value.lower()
                elif "u" in attrs:
                    value = value.upper()

            if node.name is None:
                # Assignment-only command - set in environment
                if _array_lhs:
                    # a[idx]=value or a[idx]+=value
                    arr_name = _array_lhs.group(1)
                    subscript = _array_lhs.group(2)
                    # Evaluate subscript as arithmetic expression for indexed arrays
                    # but preserve string keys for associative arrays
                    if subscript not in ("@", "*"):
                        is_assoc = self._state.env.get(f"{arr_name}__is_array") in ("assoc", "associative")
                        if not is_assoc:
                            from .expansion import _eval_array_subscript, get_array_elements
                            idx = _eval_array_subscript(self._ctx, subscript)
                            # Handle negative indices - resolve to actual position
                            if idx < 0:
                                elements = get_array_elements(self._ctx, arr_name)
                                if elements:
                                    max_idx = max(i for i, _ in elements)
                                    idx = max_idx + 1 + idx
                                    # If still negative, it's out of bounds
                                    if idx < 0:
                                        return ExecResult(
                                            stdout="",
                                            stderr=f"bash: {arr_name}[{subscript}]: bad array subscript\n",
                                            exit_code=1,
                                        )
                                else:
                                    # Empty array with negative index is an error
                                    return ExecResult(
                                        stdout="",
                                        stderr=f"bash: {arr_name}[{subscript}]: bad array subscript\n",
                                        exit_code=1,
                                    )
                            subscript = str(idx)
                        else:
                            # For associative arrays, expand variables and strip surrounding quotes
                            from .expansion import _expand_subscript_vars
                            # Check if double-quoted (expand $VAR) vs single-quoted (literal)
                            if subscript.startswith('"') and subscript.endswith('"'):
                                # Double-quoted: expand variables, then strip quotes
                                inner = subscript[1:-1]
                                subscript = _expand_subscript_vars(self._ctx, inner)
                            elif subscript.startswith("'") and subscript.endswith("'"):
                                # Single-quoted: literal, just strip quotes
                                subscript = subscript[1:-1]
                            else:
                                # Unquoted: expand variables
                                subscript = _expand_subscript_vars(self._ctx, subscript)
                    # Resolve nameref for array base name
                    if isinstance(self._state.env, VariableStore) and self._state.env.is_nameref(arr_name):
                        try:
                            arr_name = self._state.env.resolve_nameref(arr_name)
                        except ValueError:
                            pass
                    # Mark as array if not already
                    if f"{arr_name}__is_array" not in self._state.env:
                        self._state.env[f"{arr_name}__is_array"] = "indexed"
                    if assignment.append:
                        existing = self._state.env.get(f"{arr_name}_{subscript}", "")
                        self._state.env[f"{arr_name}_{subscript}"] = existing + value
                    else:
                        self._state.env[f"{arr_name}_{subscript}"] = value
                elif assignment.append:
                    # Check if this is an array - if so, append to element 0
                    is_array = self._state.env.get(f"{name}__is_array") is not None
                    if is_array:
                        existing = self._state.env.get(f"{name}_0", "")
                        self._state.env[f"{name}_0"] = existing + value
                    else:
                        existing = self._state.env.get(name, "")
                        self._state.env[name] = existing + value
                    _maybe_export_variable(self._state, name)
                else:
                    # Special handling for SECONDS - reset timer
                    if name == "SECONDS":
                        import time
                        try:
                            offset = int(value)
                            self._state.seconds_reset_time = time.time() - offset
                        except (ValueError, TypeError):
                            self._state.seconds_reset_time = time.time()
                    # Check if we're assigning to a nameref without a target
                    if _is_nameref_without_target and isinstance(self._state.env, VariableStore):
                        # Set the value as the nameref target
                        self._state.env.set_nameref(_original_nameref_name, value)
                    else:
                        self._state.env[name] = value
                    _maybe_export_variable(self._state, name)
            else:
                # Temporary assignment for command - exported to command environment
                old_value = self._state.env.get(name)
                was_exported = False
                if isinstance(self._state.env, VariableStore):
                    was_exported = "x" in self._state.env.get_attributes(name)
                temp_assignments[name] = (old_value, was_exported)
                if assignment.append:
                    existing = self._state.env.get(name, "")
                    self._state.env[name] = existing + value
                else:
                    self._state.env[name] = value
                # Mark as exported for the command
                if isinstance(self._state.env, VariableStore):
                    self._state.env.set_attribute(name, "x")

        # If no command name, it's an assignment-only statement
        if node.name is None:
            # Exit code is from the last command substitution during expansion, or 0
            assign_exit = self._state.expansion_exit_code if self._state.expansion_exit_code is not None else 0
            # Still process output redirections (e.g., x=$(cmd) 2>/dev/null)
            if node.redirections:
                result = ExecResult(stdout="", stderr="", exit_code=assign_exit)
                # Collect any expansion stderr
                if self._state.expansion_stderr:
                    result = ExecResult(
                        stdout=result.stdout,
                        stderr=self._state.expansion_stderr,
                        exit_code=assign_exit,
                    )
                    self._state.expansion_stderr = ""
                    self._state.expansion_exit_code = None
                return await self._process_output_redirections(node.redirections, result)
            return ExecResult(stdout="", stderr="", exit_code=assign_exit)

        # Process redirections for heredocs and input redirections
        from ..ast.types import WordNode

        for redir in node.redirections:
            if redir.operator in ("<<", "<<-"):
                # Here-document: the target should be a HereDocNode
                fd = redir.fd if redir.fd is not None else 0
                target = redir.target
                if hasattr(target, 'content'):
                    # Expand content - parser handles quoted vs unquoted delimiter
                    # (quoted delimiter parses content as literal SingleQuotedPart)
                    heredoc_content = await expand_word_async(self._ctx, target.content)
                    # Strip leading tabs if <<-
                    if redir.operator == "<<-":
                        lines = heredoc_content.split("\n")
                        heredoc_content = "\n".join(line.lstrip("\t") for line in lines)
                    if fd == 0:
                        stdin = heredoc_content
                    else:
                        # Custom FD here-doc - store in FD table
                        self._state.fd_table.open(fd, f"heredoc-fd{fd}", "r")
                        self._state.fd_table._fds[fd].content = heredoc_content
            elif redir.operator == "<<<":
                # Here-string: expand the word and use as stdin with trailing newline
                if redir.target is not None and isinstance(redir.target, WordNode):
                    herestring_content = await expand_word_async(self._ctx, redir.target)
                    stdin = herestring_content + "\n"
            elif redir.operator == "<":
                # Input redirection: read file content
                fd = redir.fd if redir.fd is not None else 0
                if redir.target is not None and isinstance(redir.target, WordNode):
                    target_path = await expand_word_async(self._ctx, redir.target)
                    resolved_path = self._fs.resolve_path(self._state.cwd, target_path)
                    # Handle /dev/null specially
                    if target_path in ("/dev/null", "/dev/zero"):
                        file_content = ""
                    else:
                        try:
                            file_content = await self._fs.read_file(resolved_path)
                        except FileNotFoundError:
                            return _failure(f"bash: {target_path}: No such file or directory\n")
                        except IsADirectoryError:
                            return _failure(f"bash: {target_path}: Is a directory\n")
                    if fd == 0:
                        stdin = file_content
                    else:
                        # Custom FD input redirect - store in FD table
                        self._state.fd_table.open(fd, target_path, "r")
                        self._state.fd_table._fds[fd].content = file_content
            elif redir.operator == "<&":
                # Input FD duplication
                fd = redir.fd if redir.fd is not None else 0
                if redir.target is not None and isinstance(redir.target, WordNode):
                    target_str = await expand_word_async(self._ctx, redir.target)
                    if target_str == "-":
                        self._state.fd_table.close(fd)
                    elif target_str.endswith("-") and target_str[:-1].isdigit():
                        # Move FD: dup target then close target (e.g. <&5-)
                        move_fd = int(target_str[:-1])
                        if self._state.fd_table.is_open(move_fd):
                            if fd == 0:
                                fd_path = self._state.fd_table.get_path(move_fd)
                                if fd_path:
                                    try:
                                        stdin = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        pass
                                else:
                                    stdin = self._state.fd_table.read(move_fd)
                            else:
                                self._state.fd_table.dup(move_fd, fd)
                            self._state.fd_table.close(move_fd)
                    elif target_str.isdigit():
                        target_fd = int(target_str)
                        if self._state.fd_table.is_open(target_fd):
                            if fd == 0:
                                fd_path = self._state.fd_table.get_path(target_fd)
                                if fd_path:
                                    try:
                                        stdin = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        pass
                                else:
                                    stdin = self._state.fd_table.read(target_fd)
                            else:
                                self._state.fd_table.dup(target_fd, fd)

        try:
            # Expand command name
            cmd_name = await expand_word_async(self._ctx, node.name)

            # If command name expanded to empty from unquoted expansion
            # (e.g., $(true) or $UNSET_VAR), treat as no-op preserving exit code.
            # In bash, temp assignments become permanent when there's no command
            # (e.g., FOO=bar $unset makes FOO=bar permanent).
            if not cmd_name and not _word_has_quoting(node.name):
                # Expand all arguments too (bash expands all words before execution),
                # so command substitutions in args still run and set exit code.
                for arg in node.args:
                    await expand_word_async(self._ctx, arg)
                exit_code = self._state.expansion_exit_code if self._state.expansion_exit_code is not None else self._state.last_exit_code
                result = ExecResult(stdout="", stderr="", exit_code=exit_code)
                # Clear temp_assignments so finally block doesn't revert them
                temp_assignments.clear()
                return await self._process_output_redirections(node.redirections, result)

            # Alias expansion (before checking functions/builtins)
            # Use the alias snapshot from statement start to match bash semantics
            # where aliases defined on a line aren't available until the next line
            alias_args: list[str] = []
            if _is_shopt_set(self._state.env, "expand_aliases"):
                alias_snapshot = getattr(self._state, 'alias_snapshot', None)
                aliases = alias_snapshot if alias_snapshot is not None else get_aliases(self._ctx)
                # Don't expand if command name was quoted
                name_is_quoted = _word_has_quoting(node.name) if node.name else False
                if not name_is_quoted and cmd_name in aliases:
                    expanded_aliases: set[str] = set()
                    trailing_space = False
                    while cmd_name in aliases and cmd_name not in expanded_aliases:
                        expanded_aliases.add(cmd_name)
                        alias_value = aliases[cmd_name]
                        # Check if alias value ends with whitespace (triggers next-word expansion)
                        trailing_space = alias_value.endswith((" ", "\t"))
                        # Simple word splitting for alias value
                        import shlex
                        try:
                            alias_parts = shlex.split(alias_value)
                        except ValueError:
                            alias_parts = alias_value.split()
                        if alias_parts:
                            cmd_name = alias_parts[0]
                            alias_args = alias_parts[1:] + alias_args
                    # Trailing space: alias-expand first argument too
                    if trailing_space and node.args and aliases:
                        first_arg = await expand_word_async(self._ctx, node.args[0])
                        if not _word_has_quoting(node.args[0]) and first_arg in aliases:
                            arg_alias_value = aliases[first_arg]
                            import shlex
                            try:
                                arg_parts = shlex.split(arg_alias_value)
                            except ValueError:
                                arg_parts = arg_alias_value.split()
                            if arg_parts:
                                alias_args.extend(arg_parts)

            # Expand alias_args (they may contain $VAR references)
            if alias_args:
                from ..parser.parser import Parser
                parser = Parser()
                expanded_alias_args = []
                for arg_str in alias_args:
                    # Parse the string as a word to get proper expansion
                    try:
                        word = parser._parse_word_from_string(arg_str)
                        expanded = await expand_word_async(self._ctx, word)
                        expanded_alias_args.append(expanded)
                    except Exception:
                        # If parsing fails, use the literal string
                        expanded_alias_args.append(arg_str)
                alias_args = expanded_alias_args

            # Check for function call first (functions override builtins)
            if cmd_name in self._state.functions:
                return await self._call_function(cmd_name, node.args, stdin, alias_args)

            # Check for builtins (which need InterpreterContext access)
            if cmd_name in BUILTINS:
                return await self._execute_builtin(cmd_name, node, stdin, alias_args)

            # Expand arguments with glob support
            args: list[str] = list(alias_args)  # Start with alias args
            for arg in node.args:
                expanded = await expand_word_with_glob(self._ctx, arg)
                args.extend(expanded["values"])

            # Check for expansion errors (e.g., failglob) - only abort if
            # there's an expansion error message, not for normal command
            # substitution exit codes
            if self._state.expansion_stderr:
                exit_code = self._state.expansion_exit_code or 1
                stderr = self._state.expansion_stderr
                self._state.expansion_exit_code = None
                self._state.expansion_stderr = ""
                return _result("", stderr, exit_code)

            # Update last arg for $_
            if args:
                self._state.last_arg = args[-1]

            # Look up command
            if cmd_name in self._commands:
                cmd = self._commands[cmd_name]
                # Create command context
                from ..types import CommandContext

                # Collect custom FD contents for commands
                fd_contents: dict[int, str] = {}
                for fd_num, fd_entry in self._state.fd_table._fds.items():
                    if fd_num >= 3 and not fd_entry.is_closed:
                        fd_contents[fd_num] = fd_entry.content

                ctx = CommandContext(
                    fs=self._fs,
                    cwd=self._state.cwd,
                    env=self._state.env,
                    stdin=stdin,
                    limits=self._limits,
                    exec=lambda script, opts: self._exec_fn(
                        script, opts.get("env"), opts["cwd"]
                    ),
                    get_registered_commands=lambda: list(self._commands.keys()),
                    fetch=self._fetch,
                    fd_contents=fd_contents,
                )
                result = await cmd.execute(args, ctx)
            else:
                # Try to find and execute as a VFS script
                result = await self._try_execute_vfs_script(cmd_name, args, stdin)

            # Process output redirections
            result = await self._process_output_redirections(node.redirections, result)
            return result
        finally:
            # Restore temporary assignments (both value and export status)
            for name, (old_value, was_exported) in temp_assignments.items():
                if old_value is None:
                    if name in self._state.env:
                        del self._state.env[name]
                else:
                    self._state.env[name] = old_value
                # Restore export status
                if isinstance(self._state.env, VariableStore):
                    if was_exported:
                        self._state.env.set_attribute(name, "x")
                    else:
                        self._state.env.remove_attribute(name, "x")

    async def _process_input_redirections(self, redirections: list, stdin: str) -> str:
        """Process input redirections (heredoc, herestring, <) to get stdin.

        Returns the stdin content from input redirections, or the original
        stdin if no input redirections are present.
        """
        from ..ast.types import WordNode

        for redir in redirections:
            if redir.operator in ("<<", "<<-"):
                target = redir.target
                if hasattr(target, 'content'):
                    heredoc_content = await expand_word_async(self._ctx, target.content)
                    if redir.operator == "<<-":
                        lines = heredoc_content.split("\n")
                        heredoc_content = "\n".join(line.lstrip("\t") for line in lines)
                    stdin = heredoc_content
            elif redir.operator == "<<<":
                if redir.target is not None and isinstance(redir.target, WordNode):
                    herestring_content = await expand_word_async(self._ctx, redir.target)
                    stdin = herestring_content + "\n"
            elif redir.operator == "<":
                if redir.target is not None and isinstance(redir.target, WordNode):
                    target_path = await expand_word_async(self._ctx, redir.target)
                    target_path = self._fs.resolve_path(self._state.cwd, target_path)
                    fd = redir.fd if redir.fd is not None else 0
                    try:
                        if fd >= 3:
                            # Custom FD: open for reading in FD table
                            self._state.fd_table.open(fd, target_path, "r")
                        else:
                            file_content = await self._fs.read_file(target_path)
                            stdin = file_content
                    except FileNotFoundError:
                        pass
                    except Exception:
                        pass
            elif redir.operator == "<&":
                if redir.target is not None and isinstance(redir.target, WordNode):
                    target_path = await expand_word_async(self._ctx, redir.target)
                    fd = redir.fd if redir.fd is not None else 0
                    if target_path == "-":
                        self._state.fd_table.close(fd)
                    elif target_path.endswith("-") and target_path[:-1].isdigit():
                        # Move FD: dup target then close target
                        move_fd = int(target_path[:-1])
                        if self._state.fd_table.is_open(move_fd):
                            if fd == 0:
                                # Read content from source FD as stdin
                                fd_path = self._state.fd_table.get_path(move_fd)
                                if fd_path:
                                    try:
                                        stdin = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        pass
                                else:
                                    stdin = self._state.fd_table.read(move_fd)
                            else:
                                self._state.fd_table.dup(move_fd, fd)
                            self._state.fd_table.close(move_fd)
                    elif target_path.isdigit():
                        src_fd = int(target_path)
                        if self._state.fd_table.is_open(src_fd):
                            if fd == 0:
                                # Read content from source FD as stdin
                                fd_path = self._state.fd_table.get_path(src_fd)
                                if fd_path:
                                    try:
                                        stdin = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        pass
                                else:
                                    stdin = self._state.fd_table.read(src_fd)
                            else:
                                self._state.fd_table.dup(src_fd, fd)
        return stdin

    async def _process_output_redirections(
        self, redirections: list, result: ExecResult
    ) -> ExecResult:
        """Process output redirections after command execution."""
        from ..ast.types import RedirectionNode, WordNode

        stdout = result.stdout
        stderr = result.stderr

        # Pre-process: find the last file redirect index per fd for "last wins" semantics
        # For > or >>, last redirect per fd gets the content; earlier ones just create/truncate
        last_file_redir_for_fd: dict[int, int] = {}
        for idx, redir in enumerate(redirections):
            if not isinstance(redir, RedirectionNode):
                continue
            if redir.operator in (">", ">>", ">|"):
                fd = redir.fd if redir.fd is not None else 1
                last_file_redir_for_fd[fd] = idx
            elif redir.operator in ("&>", "&>>"):
                last_file_redir_for_fd[1] = idx
                last_file_redir_for_fd[2] = idx

        for idx, redir in enumerate(redirections):
            if not isinstance(redir, RedirectionNode):
                continue

            # Skip heredocs and input redirections - already handled
            if redir.operator in ("<<", "<<-", "<<<", "<"):
                continue

            # Get the target path
            if redir.target is None:
                continue

            # Expand the target if it's a WordNode
            if isinstance(redir.target, WordNode):
                target_path = await expand_word_async(self._ctx, redir.target)
            else:
                continue

            try:
                fd = redir.fd if redir.fd is not None else 1  # Default to stdout

                # Reject empty redirect target
                if not target_path and redir.operator in (">", ">>", ">|", "&>", "&>>", "<"):
                    return ExecResult(stdout="", stderr=f"bash: : ambiguous redirect\n", exit_code=1)

                # Check for FD duplication operators - don't resolve as path
                is_fd_dup = redir.operator in (">&", "<&")
                is_fd_target = is_fd_dup and (
                    target_path.isdigit() or target_path == "-"
                    or (target_path.endswith("-") and target_path[:-1].isdigit())
                )

                # Handle /dev/null and special device files
                if target_path in ("/dev/null", "/dev/zero"):
                    if redir.operator in (">", ">>", ">|"):
                        if fd == 1:
                            stdout = ""
                        elif fd == 2:
                            stderr = ""
                    elif redir.operator in ("&>", "&>>"):
                        stdout = ""
                        stderr = ""
                    continue
                elif target_path in ("/dev/stdout", "/dev/stderr", "/dev/stdin"):
                    continue

                # Resolve to absolute path for file operations
                original_target = target_path
                if not is_fd_target:
                    target_path = self._fs.resolve_path(self._state.cwd, target_path)

                # Check if target is a directory (can't redirect to directory)
                if not is_fd_target and redir.operator in (">", ">>", ">|", "&>", "&>>"):
                    try:
                        if await self._fs.is_directory(target_path):
                            return ExecResult(stdout="", stderr=f"bash: {original_target}: Is a directory\n", exit_code=1)
                    except Exception:
                        pass

                if redir.operator in (">", ">|"):
                    # Check noclobber: > on existing regular file is an error
                    # >| bypasses noclobber
                    if redir.operator == ">" and self._state.options.noclobber:
                        try:
                            if await self._fs.exists(target_path) and not await self._fs.is_directory(target_path):
                                # Discard stdout since command shouldn't have run
                                return ExecResult(stdout="", stderr=f"bash: {original_target}: cannot overwrite existing file\n", exit_code=1)
                        except Exception:
                            pass
                    is_last_for_fd = last_file_redir_for_fd.get(fd) == idx
                    if is_last_for_fd:
                        # Last redirect for this fd - write content
                        if fd == 1:
                            await self._fs.write_file(target_path, stdout)
                            stdout = ""
                        elif fd == 2:
                            await self._fs.write_file(target_path, stderr)
                            stderr = ""
                        elif fd >= 3:
                            # Custom FD - register in FD table and create file
                            self._state.fd_table.open(fd, target_path, "w")
                            await self._fs.write_file(target_path, "")
                    else:
                        # Not the last redirect - just create/truncate the file
                        await self._fs.write_file(target_path, "")
                        if fd >= 3:
                            self._state.fd_table.open(fd, target_path, "w")

                elif redir.operator == ">>":
                    # Append to file
                    try:
                        existing = await self._fs.read_file(target_path)
                    except FileNotFoundError:
                        existing = ""
                    is_last_for_fd = last_file_redir_for_fd.get(fd) == idx
                    if is_last_for_fd:
                        if fd == 1:
                            await self._fs.write_file(target_path, existing + stdout)
                            stdout = ""
                        elif fd == 2:
                            await self._fs.write_file(target_path, existing + stderr)
                            stderr = ""
                        elif fd >= 3:
                            self._state.fd_table.open(fd, target_path, "a")
                    else:
                        # Not last - ensure file exists but don't write content
                        if not existing:
                            await self._fs.write_file(target_path, "")
                        if fd >= 3:
                            self._state.fd_table.open(fd, target_path, "a")

                elif redir.operator == "&>":
                    # Check noclobber
                    if self._state.options.noclobber:
                        try:
                            if await self._fs.exists(target_path) and not await self._fs.is_directory(target_path):
                                return ExecResult(stdout="", stderr=f"bash: {original_target}: cannot overwrite existing file\n", exit_code=1)
                        except Exception:
                            pass
                    # Redirect both stdout and stderr to file
                    await self._fs.write_file(target_path, stdout + stderr)
                    stdout = ""
                    stderr = ""

                elif redir.operator == "&>>":
                    # Append both stdout and stderr to file (not subject to noclobber)
                    try:
                        existing = await self._fs.read_file(target_path)
                    except FileNotFoundError:
                        existing = ""
                    await self._fs.write_file(target_path, existing + stdout + stderr)
                    stdout = ""
                    stderr = ""

                elif redir.operator == ">&":
                    # FD duplication
                    if target_path == "-":
                        # Close FD
                        self._state.fd_table.close(fd)
                    elif target_path.endswith("-") and target_path[:-1].isdigit():
                        # Move FD: dup target then close target (e.g. >&5-)
                        move_fd = int(target_path[:-1])
                        if not self._state.fd_table.is_open(move_fd):
                            return ExecResult(
                                stdout="", stderr=f"bash: {move_fd}: Bad file descriptor\n",
                                exit_code=1,
                            )
                        self._state.fd_table.dup(move_fd, fd)
                        self._state.fd_table.close(move_fd)
                    elif target_path == "2":
                        # fd>&2: redirect fd to stderr
                        if fd == 1:
                            stderr = stderr + stdout
                            stdout = ""
                        elif fd >= 3:
                            # Custom FD to stderr - no content to redirect
                            self._state.fd_table.dup(2, fd)
                    elif target_path == "1":
                        # fd>&1: redirect fd to stdout
                        if fd == 2:
                            stdout = stdout + stderr
                            stderr = ""
                        elif fd >= 3:
                            self._state.fd_table.dup(1, fd)
                    elif target_path.isdigit():
                        target_fd = int(target_path)
                        if not self._state.fd_table.is_open(target_fd):
                            return ExecResult(
                                stdout="", stderr=f"bash: {target_fd}: Bad file descriptor\n",
                                exit_code=1,
                            )
                        if target_fd >= 3:
                            # Redirect fd to a custom FD
                            fd_entry = self._state.fd_table._fds.get(target_fd)
                            fd_path = self._state.fd_table.get_path(target_fd)
                            # Check if target FD is a dup of stdout or stderr
                            target_dup_of = fd_entry.dup_of if fd_entry else None
                            if fd == 1:
                                if target_dup_of == 1:
                                    # FD is dup of stdout - content stays in stdout
                                    pass
                                elif target_dup_of == 2:
                                    # FD is dup of stderr - merge into stderr
                                    stderr = stderr + stdout
                                    stdout = ""
                                elif fd_path:
                                    # Write stdout to the target FD's file
                                    try:
                                        existing = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        existing = ""
                                    await self._fs.write_file(fd_path, existing + stdout)
                                    stdout = ""
                                else:
                                    # Custom FD without file - store content
                                    self._state.fd_table.write(target_fd, stdout)
                                    stdout = ""
                            elif fd == 2:
                                if target_dup_of == 2:
                                    # FD is dup of stderr - content stays in stderr
                                    pass
                                elif target_dup_of == 1:
                                    # FD is dup of stdout - merge into stdout
                                    stdout = stdout + stderr
                                    stderr = ""
                                elif fd_path:
                                    try:
                                        existing = await self._fs.read_file(fd_path)
                                    except FileNotFoundError:
                                        existing = ""
                                    await self._fs.write_file(fd_path, existing + stderr)
                                    stderr = ""
                                else:
                                    self._state.fd_table.write(target_fd, stderr)
                                    stderr = ""
                            else:
                                self._state.fd_table.dup(target_fd, fd)
                        else:
                            self._state.fd_table.dup(target_fd, fd)
                    else:
                        # >&file is same as &> for fd 1
                        if fd == 1:
                            await self._fs.write_file(target_path, stdout + stderr)
                            stdout = ""
                            stderr = ""

                elif redir.operator == "<&":
                    # Input FD duplication - in output context, works same as >&
                    if target_path == "-":
                        self._state.fd_table.close(fd)
                    elif target_path.endswith("-") and target_path[:-1].isdigit():
                        # Move FD: dup target then close target (e.g. <&5-)
                        move_fd = int(target_path[:-1])
                        if not self._state.fd_table.is_open(move_fd):
                            return ExecResult(
                                stdout="", stderr=f"bash: {move_fd}: Bad file descriptor\n",
                                exit_code=1,
                            )
                        self._state.fd_table.dup(move_fd, fd)
                        self._state.fd_table.close(move_fd)
                    elif target_path == "2":
                        if fd == 1:
                            stderr = stderr + stdout
                            stdout = ""
                    elif target_path == "1":
                        if fd == 2:
                            stdout = stdout + stderr
                            stderr = ""

                elif redir.operator == "2>&1":
                    # Redirect stderr to stdout
                    stdout = stdout + stderr
                    stderr = ""

            except Exception as e:
                return ExecResult(
                    stdout=stdout,
                    stderr=stderr + f"bash: {target_path}: {e}\n",
                    exit_code=1,
                )

        return ExecResult(
            stdout=stdout,
            stderr=stderr,
            exit_code=result.exit_code,
        )

    async def _try_execute_vfs_script(
        self, cmd_name: str, args: list[str], stdin: str
    ) -> ExecResult:
        """Try to find and execute a command as a VFS script file.

        Searches by direct path (if cmd_name contains /) or by PATH lookup.
        Returns command-not-found result if nothing is found.
        """
        import stat

        resolved_path: str | None = None

        if "/" in cmd_name:
            # Direct path
            candidate = self._fs.resolve_path(self._state.cwd, cmd_name)
            try:
                if await self._fs.exists(candidate):
                    if not await self._fs.is_directory(candidate):
                        resolved_path = candidate
            except Exception:
                pass
        else:
            # Search PATH directories in VFS
            path_str = self._state.env.get("PATH", "")
            if path_str:
                for dir_entry in path_str.split(":"):
                    if not dir_entry:
                        dir_entry = "."
                    candidate = self._fs.resolve_path(
                        self._state.cwd, f"{dir_entry}/{cmd_name}"
                    )
                    try:
                        if await self._fs.exists(candidate):
                            if not await self._fs.is_directory(candidate):
                                resolved_path = candidate
                                break
                    except Exception:
                        pass

        if resolved_path is None:
            return ExecResult(
                stdout="",
                stderr=f"bash: {cmd_name}: command not found\n",
                exit_code=127,
            )

        # Check if executable
        try:
            st = await self._fs.stat(resolved_path)
            if not (st.mode & stat.S_IXUSR):
                return ExecResult(
                    stdout="",
                    stderr=f"bash: {cmd_name}: Permission denied\n",
                    exit_code=126,
                )
        except Exception:
            return ExecResult(
                stdout="",
                stderr=f"bash: {cmd_name}: Permission denied\n",
                exit_code=126,
            )

        # Read and execute as shell script
        try:
            content = await self._fs.read_file(resolved_path)
            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="replace")

            # Strip shebang line if present
            if content.startswith("#!"):
                newline_idx = content.find("\n")
                if newline_idx >= 0:
                    content = content[newline_idx + 1:]
                else:
                    content = ""

            # Set up positional parameters for the script
            old_params: dict[str, str | None] = {}
            old_count = self._state.env.get("#")
            old_zero = self._state.env.get("0")

            # Save old positional params
            i = 1
            while str(i) in self._state.env:
                old_params[str(i)] = self._state.env[str(i)]
                i += 1

            # Clear old positional params
            for key in list(old_params.keys()):
                del self._state.env[key]

            # Set new positional params from args
            self._state.env["0"] = cmd_name
            for idx, arg in enumerate(args, 1):
                self._state.env[str(idx)] = arg
            self._state.env["#"] = str(len(args))

            try:
                result = await self._exec_fn(content, None, None)
            finally:
                # Restore old positional params
                # Clear script params
                for idx in range(1, len(args) + 1):
                    self._state.env.pop(str(idx), None)

                # Restore old params
                for key, val in old_params.items():
                    if val is not None:
                        self._state.env[key] = val

                if old_count is not None:
                    self._state.env["#"] = old_count
                else:
                    self._state.env.pop("#", None)

                if old_zero is not None:
                    self._state.env["0"] = old_zero
                else:
                    self._state.env.pop("0", None)

            return result

        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"bash: {cmd_name}: {e}\n",
                exit_code=2,
            )

    async def _call_function(
        self, name: str, args: list, stdin: str, alias_args: list[str] | None = None
    ) -> ExecResult:
        """Call a user-defined function."""
        func_def = self._state.functions[name]

        # Check call depth
        self._state.call_depth += 1
        if self._state.call_depth > self._limits.max_call_depth:
            self._state.call_depth -= 1
            raise ExecutionLimitError(
                f"function call depth exceeded ({self._limits.max_call_depth})",
                "call_depth",
            )

        # Save positional parameters
        saved_params = {}
        i = 1
        while str(i) in self._state.env:
            saved_params[str(i)] = self._state.env[str(i)]
            del self._state.env[str(i)]
            i += 1
        saved_count = self._state.env.get("#", "0")

        # Set new positional parameters (alias args first, then expanded args)
        expanded_args: list[str] = list(alias_args) if alias_args else []
        for arg in args:
            expanded = await expand_word_with_glob(self._ctx, arg)
            expanded_args.extend(expanded["values"])

        for i, arg in enumerate(expanded_args):
            self._state.env[str(i + 1)] = arg
        self._state.env["#"] = str(len(expanded_args))

        # Save and set FUNCNAME
        saved_funcname = self._state.env.get("FUNCNAME")
        self._state.env["FUNCNAME"] = name

        # Create local scope
        self._state.local_scopes.append({})
        if isinstance(self._state.env, VariableStore):
            self._state.env.push_local_meta_scope()

        try:
            # Execute function body (which is a CompoundCommandNode)
            try:
                result = await self.execute_command(func_def.body, stdin)
                return result
            except ReturnError as e:
                return _result(e.stdout, e.stderr, e.exit_code)
        finally:
            # Pop local scope and restore saved variables
            scope = self._state.local_scopes.pop()

            # Pop and restore metadata scope
            if isinstance(self._state.env, VariableStore) and self._state.env._local_meta_scopes:
                meta_scope = self._state.env.pop_local_meta_scope()
                self._state.env.restore_metadata_from_scope(meta_scope)

            # First pass: identify arrays that need element cleanup
            # If __is_array is restored to None, the array didn't exist before
            # and we need to clean up all element keys created inside the function
            arrays_to_clean = []
            for var_name, original_value in scope.items():
                if var_name.endswith("__is_array") and original_value is None:
                    arr_name = var_name[:-len("__is_array")]
                    arrays_to_clean.append(arr_name)

            # Clean up array element keys created inside the function
            for arr_name in arrays_to_clean:
                prefix = f"{arr_name}_"
                to_remove = [
                    k for k in self._state.env
                    if k.startswith(prefix) and not k.startswith(f"{arr_name}__")
                ]
                for k in to_remove:
                    del self._state.env[k]

            # Second pass: restore all saved variables
            for var_name, original_value in scope.items():
                if original_value is None:
                    self._state.env.pop(var_name, None)
                else:
                    self._state.env[var_name] = original_value

            # Restore positional parameters
            i = 1
            while str(i) in self._state.env:
                del self._state.env[str(i)]
                i += 1
            for k, v in saved_params.items():
                self._state.env[k] = v
            self._state.env["#"] = saved_count

            # Restore FUNCNAME
            if saved_funcname is None:
                self._state.env.pop("FUNCNAME", None)
            else:
                self._state.env["FUNCNAME"] = saved_funcname

            self._state.call_depth -= 1

    async def _execute_builtin(
        self, cmd_name: str, node: SimpleCommandNode, stdin: str,
        alias_args: list[str] | None = None
    ) -> ExecResult:
        """Execute a shell builtin command.

        Builtins get direct access to InterpreterContext so they can
        modify interpreter state (env, cwd, options, etc.).
        """
        # Expand arguments with glob support (alias args first)
        args: list[str] = list(alias_args) if alias_args else []
        # Declaration builtins get tilde expansion on literal assignment args
        is_declaration = cmd_name in ("declare", "typeset", "local", "readonly", "export")
        for arg in node.args:
            # Declaration builtins suppress word splitting on assignment args
            is_assignment_arg = is_declaration and _word_has_literal_equals(arg)
            expanded = await expand_word_with_glob(self._ctx, arg, no_split=is_assignment_arg, no_glob=is_assignment_arg)
            values = expanded["values"]
            if is_assignment_arg:
                from .expansion import expand_tilde_in_assignment_value
                values = [
                    _apply_tilde_to_assignment(v, self._ctx)
                    for v in values
                ]
            args.extend(values)

        # Update last arg for $_
        if args:
            self._state.last_arg = args[-1]

        # Get the builtin handler and execute
        handler = BUILTINS[cmd_name]
        # Some builtins (like mapfile) need stdin - check signature
        import inspect
        sig = inspect.signature(handler)
        if len(sig.parameters) >= 3:
            result = await handler(self._ctx, args, stdin)
        else:
            result = await handler(self._ctx, args)

        # Process output redirections
        result = await self._process_output_redirections(node.redirections, result)
        return result
