# Permission Matrix for GraphQL API

## Mutations

| Action                     | Admin | Member |
|:---------------------------|:-----:|:------:|
| Create System API Keys     |  Yes  |   No   |
| Create User API Keys       |  Yes  |  Yes   |
| Delete System API Keys     |  Yes  |   No   |
| Delete Any User's API Keys |  Yes  |   No   |
| Delete Own User API Keys   |  Yes  |  Yes   |

## Queries

| Action                               | Admin | Member |
|:-------------------------------------|:-----:|:------:|
| List All System API Keys             |  Yes  |   No   |
| List All User API Keys               |  Yes  |   No   |
| List All Users                       |  Yes  |   No   |
| Fetch Other User's Info, e.g. emails |  Yes  |   No   |
