This Phoenix module uses Python's `ast` module. The code snippets below provides a basic introduction to the `ast` module.

# Abstract Syntax Tree (AST)

The idea is that any Python expression can be parsed into an AST, and then transformed into a different one. The new AST can then be compiled back into a Python expression and evaluated at runtime.

```python
import ast
```

# Constant
https://docs.python.org/3/library/ast.html#ast.Constant

```python
print(ast.dump(ast.parse("None", mode="eval").body, indent=4))
print(ast.dump(ast.parse("1", mode="eval").body, indent=4))
print(ast.dump(ast.parse("'xyz'", mode="eval").body, indent=4))
```
### Output
```python
Constant(value=None)
Constant(value=1)
Constant(value='xyz')
```

# Name
https://docs.python.org/3/library/ast.html#ast.Name

```python
print(ast.dump(ast.parse("xyz", mode="eval").body, indent=4))
```
### Output
```python
Name(id='xyz', ctx=Load())
```

# Compilation and Evaluation
https://docs.python.org/3/library/functions.html#compile

```python
parsed = ast.parse("xyz", mode="eval")
compiled = compile(parsed, filename="", mode="eval")

eval(compiled, {"xyz": 42})
```
### Output
```python
42
```

# Attribute
https://docs.python.org/3/library/ast.html#ast.Attribute

```python
print(ast.dump(ast.parse("llm.token_count.completion", mode="eval").body, indent=4))
```
### Output
```python
Attribute(
    value=Attribute(
        value=Name(id='llm', ctx=Load()),
        attr='token_count',
        ctx=Load()),
    attr='completion',
    ctx=Load())
```

# Subscript
https://docs.python.org/3/library/ast.html#ast.Subscript

```python
print(ast.dump(ast.parse("attributes[['llm', 'token_count', 'completion']]", mode="eval").body, indent=4))
```
### Output
```python
Subscript(
    value=Name(id='attributes', ctx=Load()),
    slice=List(
        elts=[
            Constant(value='llm'),
            Constant(value='token_count'),
            Constant(value='completion')],
        ctx=Load()),
    ctx=Load())
```

# Translation of Attribute to Subscript
https://docs.python.org/3/library/ast.html#ast.NodeTransformer

```python
class Translator(ast.NodeTransformer):
    def visit_Attribute(self, node):
        path = []
        while isinstance(node, ast.Attribute):
            path.append(node.attr)
            node = node.value
            if isinstance(node, ast.Name):
                path.append(node.id)
                break
        return ast.Subscript(
            value=ast.Name(id='attributes', ctx=ast.Load()),
            slice=ast.List(
                elts=[ast.Constant(value=p) for p in reversed(path)],
                ctx=ast.Load(),
            ),
            ctx=ast.Load(),
        )

parsed = ast.parse("llm.token_count.completion", mode="eval")
translated = Translator().visit(parsed)
print(ast.unparse(translated))
```
### Output
```python
attributes[['llm', 'token_count', 'completion']]
```
