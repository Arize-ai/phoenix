# Bug Analysis: JSON_PATH Variables Not Substituted

## Issue
When using JSON_PATH template format in the Playground UI, template variables are not substituted. The raw template (e.g., `{$.user.name}`) is sent to the LLM instead of the substituted values (e.g., `Alice`).

## Root Cause

The bug is in how JSON data is passed from the frontend to the backend for JSON_PATH templates.

### Current (Broken) Flow:

1. **Frontend Storage** (`PlaygroundInput.tsx`, line 22-26):
   - JSON data is stored in `variablesValueCache` under a special key: `"__json_data__"`
   - Example: `{ "__json_data__": '{"user": {"name": "Alice"}, "messages": {"count": 5}}' }`

2. **Frontend Packaging** (`playgroundUtils.ts`, line 1286-1298):
   ```typescript
   const { variablesMap } = getVariablesMapFromInstances({
     instances,
     templateFormat,
     input,
   });
   
   return {
     ...baseChatCompletionVariables,
     template: {
       variables: variablesMap,  // ← This passes { "__json_data__": "..." }
       format: templateFormat,
     },
   };
   ```

3. **Backend Expectation** (from integration test):
   ```python
   "template": {
       "format": "JSON_PATH",
       "variables": {"country": "France"},  # ← Expects the actual JSON object!
   }
   ```

4. **What Actually Gets Sent**:
   ```json
   {
     "template": {
       "format": "JSON_PATH",
       "variables": {
         "__json_data__": "{\"user\": {\"name\": \"Alice\"}, \"messages\": {\"count\": 5}}"
       }
     }
   }
   ```

5. **Result**:
   - Template `{$.user.name}` tries to find `$.user.name` in `{"__json_data__": "..."}`
   - The path doesn't exist, so the variable remains unsubstituted

## The Fix

Modify `getVariablesMapFromInstances` in `app/src/pages/playground/playgroundUtils.ts` to handle JSON_PATH format specially:

```typescript
export const getVariablesMapFromInstances = ({
  instances,
  templateFormat,
  input,
}: {
  instances: PlaygroundInstance[];
  templateFormat: TemplateFormat;
  input: PlaygroundInput;
}) => {
  if (templateFormat == TemplateFormats.NONE) {
    return { variablesMap: {}, variableKeys: [] };
  }
  
  // Special handling for JSON_PATH format
  if (templateFormat === TemplateFormats.JSONPath) {
    const JSON_DATA_KEY = "__json_data__";
    const jsonString = input.variablesValueCache?.[JSON_DATA_KEY] ?? "{}";
    try {
      const variablesMap = JSON.parse(jsonString);
      return { variablesMap, variableKeys: [] };
    } catch (error) {
      // If JSON is invalid, return empty object
      console.error("Invalid JSON in variables:", error);
      return { variablesMap: {}, variableKeys: [] };
    }
  }
  
  // Original logic for Mustache and F-String
  const variableKeys = extractVariablesFromInstances({
    instances,
    templateFormat,
  });

  const variableValueCache = input.variablesValueCache ?? {};

  const variablesMap = variableKeys.reduce(
    (acc, key) => {
      acc[key] = variableValueCache[key] || "";
      return acc;
    },
    {} as NonNullable<PlaygroundInput["variablesValueCache"]>
  );
  return { variablesMap, variableKeys };
};
```

## Files Involved

1. **Storage**: `app/src/pages/playground/PlaygroundInput.tsx`
   - Line 10: `const JSON_DATA_KEY = "__json_data__";`
   - Line 22-26: Stores JSON as string under special key

2. **Packaging**: `app/src/pages/playground/playgroundUtils.ts`
   - Line 846-873: `getVariablesMapFromInstances()` function (needs fix)
   - Line 1286-1298: `getChatCompletionInput()` function (calls getVariablesMapFromInstances)

3. **Backend (Working Correctly)**: 
   - `src/phoenix/utilities/template_formatters.py`: JSONPathTemplateFormatter
   - `src/phoenix/server/api/subscriptions.py`: Subscription handling
   - Integration tests pass, confirming backend works correctly

## Testing

### Integration Tests
✅ All backend integration tests pass (6 tests)
- Confirms the backend correctly substitutes JSON path variables when given proper input

### Manual UI Testing
❌ UI execution fails
- JSON path variables not substituted
- Confirms the bug is in frontend→backend data flow

## Impact

- **Severity**: High - Core functionality doesn't work
- **Scope**: All JSON_PATH template executions in Playground UI
- **Workaround**: None - feature is non-functional in UI
- **Backend**: Working correctly (proven by integration tests)
- **Frontend UI**: Components render correctly, but data flow is broken

## Next Steps

1. Implement the fix in `getVariablesMapFromInstances()`
2. Add unit tests for the JSON_PATH case
3. Manually verify in UI
4. Consider adding E2E test to catch this type of integration issue
