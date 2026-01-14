# Visual Test Report: JSON_PATH Feature

**Date:** January 14, 2026  
**Tester:** Automated Visual Testing (agent-browser)  
**Application:** Phoenix Playground  
**URL:** http://localhost:6006

## Test Objective
Verify that the JSON_PATH template format feature works correctly in the Phoenix Playground UI.

## Test Environment
- Phoenix Backend: Running on port 6006
- Phoenix Frontend: Vite dev server 
- Browser: Chromium (via agent-browser)

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Template format selector shows JSON_PATH | ✅ PASS | JSON_PATH option visible and selectable |
| 2. JSON_PATH selection works | ✅ PASS | Radio button successfully selected |
| 3. JSON editor appears for input | ✅ PASS | JSON input textbox available |
| 4. Syntax highlighting in template editor | ⚠️  PARTIAL | Tested but not visually confirmed in trace |
| 5. JSON input accepts valid JSON | ✅ PASS | Accepted nested JSON object |
| 6. Prompt execution | ❌ FAIL | Variables not substituted before API call |

## Detailed Test Execution

### 1. Navigation to Playground
- **Action:** Navigated to http://localhost:6006 and clicked "Playground" link
- **Result:** ✅ Successfully loaded playground page
- **Screenshot:** `screenshot-1-format-selector.png`

### 2. Template Format Selector
- **Action:** Located template format radio group
- **Observation:** Four options available:
  - Mustache (initially selected)
  - F-String  
  - **JSONPath** ← New option present
  - None
- **Result:** ✅ JSON_PATH option is visible and available
- **Screenshot:** `screenshot-1-format-selector.png`

### 3. Selecting JSON_PATH Format
- **Action:** Clicked on "JSONPath" radio button
- **Result:** ✅ JSONPath radio button became checked
- **Screenshot:** `screenshot-2-json-editor.png`

### 4. JSON Editor Interface
- **Action:** Examined the Inputs section after selecting JSON_PATH
- **Observation:** A JSON input textbox is available (instead of individual variable fields)
- **Result:** ✅ JSON editor interface is present
- **Screenshot:** `screenshot-2-json-editor.png`

### 5. Template with JSON Path Expressions
- **Action:** Entered template in User message field:
  ```
  Hello {$.user.name}, you have {$.messages.count} messages
  ```
- **Result:** ✅ Template accepted
- **Screenshot:** `screenshot-3-syntax-highlighting.png`

### 6. JSON Input Data
- **Action:** Entered JSON data in the input field:
  ```json
  {"user": {"name": "Alice"}, "messages": {"count": 5}}
  ```
- **Result:** ✅ JSON input accepted
- **Screenshot:** `screenshot-4-json-input.png`

### 7. Prompt Execution
- **Action:** Clicked "Run" button to execute the prompt
- **Expected Result:** Template should be formatted to "Hello Alice, you have 5 messages"
- **Actual Result:** ❌ Template was sent to LLM without variable substitution
- **Evidence:** 
  - AI response: "Hello! It looks like there might be some placeholders or variables in your message that weren't filled in..."
  - Trace shows user message as: "Hello {$.user.name}, you have {$.messages.count} messages" (unchanged)
- **Screenshots:** 
  - `screenshot-5-output.png` - AI output indicating unsubstituted variables
  - `screenshot-6-trace.png` - Trace showing raw template sent to LLM

## Issue Identified

**Critical Issue:** JSON path variables are not being substituted during prompt execution in the Playground UI.

### Evidence
From the trace view, the actual message sent to OpenAI was:
```
userText: "Hello {$.user.name}, you have {$.messages.count} messages"
```

Expected message after substitution:
```
userText: "Hello Alice, you have 5 messages"
```

### Possible Causes
1. JSON input data not being passed to the template formatter
2. Playground subscription or mutation not handling JSON_PATH format correctly
3. Frontend not properly packaging the JSON data when sending the request
4. Timing issue where template is sent before JSON data is parsed

### Integration Tests vs. UI
- ✅ Backend integration tests pass (confirmed in commit `06504bfd0`)
- ❌ UI execution fails to substitute variables

This suggests the issue is in how the Playground UI sends data to the backend, not in the backend template formatting logic itself.

## Screenshots

All screenshots are saved in `/Users/tony/repos/phoenix/todo/`:

1. `screenshot-1-format-selector.png` - Template format selector with JSON_PATH option
2. `screenshot-2-json-editor.png` - JSON editor in Inputs section
3. `screenshot-3-syntax-highlighting.png` - Template with JSON path expressions
4. `screenshot-4-json-input.png` - JSON input data entered
5. `screenshot-5-output.png` - AI output showing unsubstituted variables
6. `screenshot-6-trace.png` - Trace view showing raw template sent to LLM

## Recommendations

### Immediate Actions Required
1. **Debug the Playground mutation/subscription** - Investigate why JSON variables aren't being passed to the backend
2. **Check frontend-playground-input-integration** - Review the implementation from this task to ensure JSON data is properly sent
3. **Add browser console logging** - Check for JavaScript errors during execution
4. **Compare with working test** - Review how integration tests structure the request vs. how the UI does it

### Investigation Areas
- `app/src/pages/playground/` - Playground component logic
- GraphQL mutation being sent from the frontend
- Network tab analysis to compare request structure with integration tests
- Check if the JSON input needs to be parsed before sending

## Conclusion

The JSON_PATH feature UI components are successfully implemented:
- ✅ UI elements present and functional
- ✅ User can select JSON_PATH format
- ✅ JSON editor interface works
- ✅ Template editor accepts JSON path syntax

However, the core functionality is **NOT working**:
- ❌ Variables are not being substituted during execution

**Status: INCOMPLETE** - UI implementation complete, but variable substitution does not work in practice. Further debugging required before this feature can be considered production-ready.
