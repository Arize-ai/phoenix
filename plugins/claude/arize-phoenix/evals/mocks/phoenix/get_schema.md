---
expect:
  tools.0:
  - getProjects
---
[
  {
    "name": "getProjects",
    "title": "Getprojects",
    "description": "List all projects",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "Cursor for pagination (project ID)"
        },
        "limit": {
          "type": "integer",
          "exclusiveMinimum": 0.0,
          "description": "The max number of projects to return at a time.",
          "default": 100
        },
        "include_experiment_projects": {
          "type": "boolean",
          "description": "Include experiment projects in the response. Experiment projects are created from running experiments.",
          "default": false
        },
        "include_dataset_evaluator_projects": {
          "type": "boolean",
          "description": "Include dataset evaluator projects in the response. Dataset evaluator projects are created when running experiments with persisted evaluators.",
          "default": false
        },
        "name_contains": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "Return only projects whose name contains this substring (case-insensitive)."
        }
      },
      "required": []
    },
    "outputSchema": {
      "properties": {
        "data": {
          "items": {
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1
              },
              "description": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "id": {
                "type": "string"
              }
            },
            "type": "object",
            "required": [
              "name",
              "id"
            ]
          },
          "type": "array"
        },
        "next_cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "type": "object",
      "required": [
        "data",
        "next_cursor"
      ],
      "x-fastmcp-top-level-schema": "GetProjectsResponseBody"
    },
    "annotations": {
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false
    },
    "_meta": {
      "fastmcp": {
        "tags": [
          "projects"
        ]
      }
    }
  }
]
