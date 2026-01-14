# Visual Test Script for JSON_PATH Feature

## Test Objective
Verify that the JSON_PATH template format feature works correctly in the Phoenix Playground UI.

## Test Steps

1. **Navigate to Playground**
   - Go to http://localhost:6006
   - Click on "playground" in the navigation

2. **Verify Template Format Selector**
   - Look for the template format radio group/selector
   - Verify "JSON_PATH" option is available alongside MUSTACHE, F_STRING, and NONE
   - Take a screenshot showing the JSON_PATH option

3. **Select JSON_PATH Format**
   - Click on the JSON_PATH radio button
   - Verify it becomes selected

4. **Verify JSON Editor Appears**
   - After selecting JSON_PATH, check that the input area changes
   - Instead of individual text fields for variables, a JSON editor should appear
   - Take a screenshot of the JSON editor interface

5. **Test Template Syntax Highlighting**
   - In the template editor, type: `Hello {$.user.name}, you have {$.messages.count} messages`
   - Verify that the JSON path expressions are syntax highlighted
   - The `{$.user.name}` and `{$.messages.count}` should be visually distinct
   - Take a screenshot of syntax highlighting

6. **Test JSON Input**
   - In the JSON editor, enter the following JSON:
   ```json
   {
     "user": {
       "name": "Alice"
     },
     "messages": {
       "count": 5
     }
   }
   ```
   - Verify the JSON is properly formatted and highlighted

7. **Test Autocomplete (if implemented)**
   - In the template editor, start typing a new variable: `{$.`
   - Check if autocomplete suggestions appear showing available paths like `user.name`, `messages.count`
   - Note: This may or may not appear depending on implementation

8. **Test Prompt Execution**
   - Click the run/execute button to format the template
   - Verify the output shows: "Hello Alice, you have 5 messages"
   - The JSON path variables should be successfully substituted
   - Take a screenshot of the successful execution

9. **Test Edge Cases**
   - Test with an unmatched path: `{$.nonexistent.path}`
   - Verify it remains unsubstituted (doesn't error)
   - Test escaped brackets: `\{not a variable}`
   - Verify escaped brackets are rendered as literal text

## Expected Results

- ✅ JSON_PATH option is visible in template format selector
- ✅ Selecting JSON_PATH shows a JSON editor for input
- ✅ Template editor syntax highlights JSON path expressions
- ✅ JSON path variables are correctly substituted during execution
- ✅ Unmatched paths remain as-is without errors
- ✅ Escaped brackets are handled correctly

## Screenshots to Capture

1. Template format selector showing JSON_PATH option
2. JSON editor interface when JSON_PATH is selected
3. Syntax highlighting of JSON path expressions in template
4. Successful prompt execution with substituted values
