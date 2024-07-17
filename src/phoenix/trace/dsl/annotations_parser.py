import re


def lexer(input_text):
    token_specification = [
        ('ANNOTATIONS', r'Annotations'),
        ('LBRACKET', r'\['),
        ('RBRACKET', r'\]'),
        ('STRING', r'"[^"]*"'),
        ('DOT', r'\.'),
        ('EQUALS', r'=='),
        ('NOTEQUALS', r'!='),
        ('GTE', r'>='),
        ('LTE', r'<='),
        ('GT', r'>'),
        ('LT', r'<'),
        ('IDENTIFIER', r'[a-zA-Z_][a-zA-Z0-9_]*'),
        ('NUMBER', r'\d+(\.\d*)?'),
        ('SKIP', r'[ \t]+'),
        ('MISMATCH', r'.'),
    ]
    token_regex = '|'.join(f'(?P<{pair[0]}>{pair[1]})' for pair in token_specification)
    get_token = re.compile(token_regex).match
    position = 0
    match = get_token(input_text)
    while match is not None:
        kind = match.lastgroup
        value = match.group(kind)
        if kind == 'SKIP':
            pass
        elif kind != 'MISMATCH':
            yield kind, value
        position = match.end()
        match = get_token(input_text, position)
    if position != len(input_text):
        raise RuntimeError(f'Unexpected character {input_text[position]}')


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.current_token = next(self.tokens, None)

    def eat(self, token_type):
        if self.current_token and self.current_token[0] == token_type:
            self.current_token = next(self.tokens, None)
        else:
            raise ValueError(f"Expected token {token_type}, got {self.current_token[0] if self.current_token else 'EOF'}")

    def parse(self):
        return self.expression()

    def expression(self):
        self.eat('ANNOTATIONS')
        self.eat('LBRACKET')
        name = self.current_token[1].strip('"')
        self.eat('STRING')
        self.eat('RBRACKET')
        self.eat('DOT')
        field = self.current_token[1]
        self.eat('IDENTIFIER')
        self.eat('EQUALS')
        value = self.current_token[1].strip('"')
        self.eat('STRING')
        return {'name': name, 'field': field, 'value': value}
