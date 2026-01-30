src/phoenix/server/api/helpers/prompts/conversions/openai.py

Used `cast` in the `to_openai` method because ty does not automatically narrow discriminated unions based on type checks. The `obj.type == "specific_function"` check should narrow the type to `PromptToolChoiceSpecificFunctionTool`, but ty still warns about `possibly-missing-attribute` for `function_name`. Using `cast` is safe here because the type check guarantees the correct type.

Added ValueError for unsupported OpenAI tool choice types (`allowed_tools`, `custom`). The OpenAI API union includes these types, but Phoenix doesn't support them. Previously, the code would have raised a `TypeError` from `assert_never`, now it raises a more descriptive `ValueError`. This is a minor behavioral change but doesn't affect existing functionality since these types were never supported.


src/phoenix/trace/attributes.py

Used `cast` in two locations:

1. SEMANTIC_CONVENTIONS initialization: `sorted()` with `key=len` returns `list[Sized]` in ty's type system, but we know the actual runtime type is `list[str]`. Cast is necessary to align the type annotation with the actual type. The cast is safe because we're sorting a list comprehension that explicitly produces strings.

2. In `flatten()` function after `isinstance(obj, Mapping)` check: ty does not narrow the union type `Union[Mapping[str, Any], Iterable[Any]]` to just `Mapping[str, Any]` after the isinstance check. The cast is safe because the isinstance check guarantees the type at runtime.


