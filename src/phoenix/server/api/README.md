# Permission Matrix for GraphQL API

## Mutations

| Action                       | Admin | Member |
|:-----------------------------|:-----:|:------:|
| Create User                  |  Yes  |   No   |
| Delete User                  |  Yes  |   No   |
| Change Own Password          |  Yes  |  Yes   |
| Change Other's Password      |  Yes  |   No   |
| Change Own Username          |  Yes  |  Yes   |
| Change Other's Username      |  Yes  |   No   |
| Change Own Email             |  No   |   No   |
| Change Other's Email         |  No   |   No   |
| Create System API Keys       |  Yes  |   No   |
| Delete System API Keys       |  Yes  |   No   |
| Create Own User API Keys     |  Yes  |  Yes   |
| Delete Own User API Keys     |  Yes  |  Yes   |
| Delete Other's User API Keys |  Yes  |   No   |

## Queries

| Action                               | Admin | Member |
|:-------------------------------------|:-----:|:------:|
| List All System API Keys             |  Yes  |   No   |
| List All User API Keys               |  Yes  |   No   |
| List All Users                       |  Yes  |   No   |
| Fetch Other User's Info, e.g. emails |  Yes  |   No   |
