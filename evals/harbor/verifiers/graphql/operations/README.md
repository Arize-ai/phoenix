# GraphQL operations

Each `.graphql` file here is compiled into the typed client in `../__generated__` by
`make codegen-harbor-graphql`, which validates it against `js/app/schema.graphql`. Name
fragments after the type they select so the generated models get readable names, such as
`ExperimentFields`. Commit the regenerated package with any change here; CI regenerates it
and fails on a diff.
