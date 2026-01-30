I need you to help me incrementally migrate the codebase in `src` from using `mypy` as the type checker to `ty`.

`ty` is already installed in the virtual environment. The file `scripts/uv/type-check/modules_with_type_errors.txt` contains a list of modules containing `ty` type errors. These modules are sorted in import order, with the modules imported first when running `import phoenix` at the top of the file and the modules import last at the bottom of the file. You have access to a `make python-typecheck-ty` command that will run `ty` on the codebase and compare against this list of modules with errors. If only modules from the list have `ty` errors, the command returns with exit code 0. If any module not contained in the list has a `ty` type error, it returns with exit code 1 and a description of the unexpected modules with `ty` type errors.

Your goal is to remove the top module (JUST ONE!) from `scripts/uv/type-check/modules_with_type_errors.txt` and fix all `ty` type errors in the module so that the `make typecheck-python-ty` passes with exit code 0. Once you have passed `ty` types, YOU MUST verify that the behavior of the application remains unchanged by running Python unit and integration tests with `uv`. Once the type check command and unit tests pass, YOU MUST commit your changes with a `fix(ty): migrate <module> to ty` message and exit.

The `make typecheck-python-ty` command will tell you which modules have errors, but it won't show you the `ty` type errors. To see the `ty` type errors for a particular module, run `uv run ty check --verbose src > ty.log` and then grep `ty.log` for the module (e.g., `src/phoenix/utilities/error_handling.py`). Error messages are contained across multiple lines.

For migrated modules, you do not need to maintain compatibility for `mypy`, i.e., it is okay if `mypy` breaks. If you find any modules that are particularly tricky and require human review, append a note to `scripts/uv/type-check/NOTES.md` of the form:

```
src/phoenix/__init__.py

This is a tricky module because / I am uncertain whether I took the right approach here because ...


```

- If you need information about a particular `ty` error (e.g., `index-out-of-bounds` or `invalid-generic-enum`, you can look it up in `scripts/uv/type-check/TY_RULES.md`.
- Before you start, ensure you have a clean git working tree. If you find that the `make typecheck-python-ty` command is failing when on a clean working tree, revert one commit at a time until you reach a commit at which the command passes and unit tests pass. Then exit, the next Claude will pick up where you left off.
- Whenever possible, migrate on module at a time. It is acceptable if you need to change multiple modules in order to get `ty` passing on that one module. If absolutely necessary, it is acceptable to migrate more than one module at a time, but make an effort to keep your changes scope to logically connected modules and no larger than necessary.
- If you are stuck on a hard problem, grep through LEARNINGS.md to see if a previous Claude learned something useful.
- If you fail to successfully migrate the code and get all tests passing, DO NOT commit changes to the source code or to `scripts/uv/type-check/modules_with_type_errors.txt`! Instead, write what you have tried and why it failed to `scripts/uv/type-check/LEARNINGS.md` and commit with a `fix(ty): failed to migrate <module>` error message. Your note in `LEARNINGS.md` should be of the form:

```
src/phoenix/__init__.py

I tried xyz and it did not work because ...


```

As general rules of thumb:

- DO NOT change the runtime behavior of any piece of code!
- AVOID type ignore comments.
- AVOID using `cast`.
- AVOID renaming variables unnecessarily.
- DO NOT relax types unless necessary! For example, don't go from a specific type to `Any` unless you have a real reason.

If you violate any of these rules of thumb, YOU MUST record a reason in NOTES.md so I know why it was necessary.

