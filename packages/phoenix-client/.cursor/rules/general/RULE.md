# Phoenix Client Design Guidelines

## Code Style

- Follow resource-based API patterns
- Use type hints for all public methods
- Keep client methods simple and focused
- Delegate complex logic to helper modules

## Canonical Examples

See existing resource modules in `src/phoenix/client/resources/`:

- `datasets/` - Dataset operations
- `spans/` - Span queries and annotations
- `experiments/` - Experiment management

## Workflow

1. Define resources in `resources/` directory
2. Add types in `types/` directory
3. Create helpers in `helpers/` for complex logic
4. Keep API surface minimal and intuitive
5. Add comprehensive docstrings
