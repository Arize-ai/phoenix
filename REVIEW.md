# Code Review Guidelines

## Always check

- New API endpoints have corresponding integration tests and RBAC
- Database migrations are tested and reversible
- Error messages don't leak internal details to users

## Style

- Don't use short variable names like 'x' or 'cv', make them human readable like 'num_experiments' or 'current_version'
- Use prefixes to denote the type - e.x. use 'num_records' rather than 'records'
- Name functions precisely with action verbs - e.x. 'list_sessions()' rather than 'sessions()'
- Use keyword or object arguments over positional arguments for clarity - e.x. write '({ numerator, denominator }) -> divided' rather than '(x, y) -> z'
- Prefer composition over inheritance

## Skip

- Generated files under `__generated__` directories
