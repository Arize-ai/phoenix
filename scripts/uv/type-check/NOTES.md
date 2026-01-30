src/phoenix/server/api/helpers/prompts/conversions/openai.py

Used `cast` in the `to_openai` method because ty does not automatically narrow discriminated unions based on type checks. The `obj.type == "specific_function"` check should narrow the type to `PromptToolChoiceSpecificFunctionTool`, but ty still warns about `possibly-missing-attribute` for `function_name`. Using `cast` is safe here because the type check guarantees the correct type.

Added ValueError for unsupported OpenAI tool choice types (`allowed_tools`, `custom`). The OpenAI API union includes these types, but Phoenix doesn't support them. Previously, the code would have raised a `TypeError` from `assert_never`, now it raises a more descriptive `ValueError`. This is a minor behavioral change but doesn't affect existing functionality since these types were never supported.


