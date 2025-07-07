# Dependabot Configuration for Phoenix Monorepo

## Overview

This document explains the Dependabot configuration for the Phoenix monorepo and how it addresses the issue of false positive security vulnerability reports.

## Problem Statement

The Phoenix monorepo contains a significant amount of example code, tutorials, and demo applications that have their own dependencies. While these dependencies may have security vulnerabilities, they are not part of the actual Phoenix application's Software Bill of Materials (SBOM) and therefore do not represent real security risks in production deployments.

Previously, Dependabot was scanning all directories in the repository, leading to:
- False positive security alerts for dependencies in example code
- Noise in security reports that made it harder to identify actual vulnerabilities
- Unnecessary maintenance burden from alerts on non-production code

## Solution

The new Dependabot configuration (`.github/dependabot.yml`) implements a targeted approach that:

1. **Includes only actual application code** in dependency scanning
2. **Excludes example code, tutorials, and demo applications**
3. **Provides clear documentation** of what is excluded and why

## Included Directories

The following directories are included in Dependabot scanning as they contain dependencies that are part of the Phoenix application SBOM:

### Python Packages
- `/` - Main Phoenix Python application (`arize-phoenix` package)
- `/packages/phoenix-client` - Phoenix Client Python package
- `/packages/phoenix-evals` - Phoenix Evals Python package
- `/packages/phoenix-otel` - Phoenix OTEL Python package

### JavaScript/TypeScript Packages
- `/js` - Main JavaScript/TypeScript workspace
- `/js/packages/phoenix-client` - Phoenix Client TypeScript package
- `/js/packages/phoenix-mcp` - Phoenix MCP TypeScript package

### Infrastructure
- `/` - GitHub Actions workflows
- `/` - Docker configurations

## Excluded Directories

The following directories are intentionally excluded from Dependabot scanning:

| Directory | Purpose | Reason for Exclusion |
|-----------|---------|---------------------|
| `/examples/` | Example applications and demos | Contains dependencies for demo purposes, not shipped with Phoenix |
| `/tutorials/` | Jupyter notebooks and tutorial code | Educational content with dependencies for learning purposes |
| `/docs/` | Documentation | May contain dependencies for documentation generation |
| `/scripts/` | Utility scripts | Development and maintenance scripts |
| `/tests/` | Test code | Testing dependencies, not part of production application |
| `/js/examples/` | JavaScript examples | Demo code for JavaScript/TypeScript examples |
| `/internal_docs/` | Internal documentation | Documentation dependencies |
| `/api_reference/` | API reference documentation | Documentation generation dependencies |
| `/app/` | Frontend application | Built separately with its own build process |
| `/helm/` | Helm charts | Kubernetes deployment configurations |
| `/kustomize/` | Kubernetes configurations | Kubernetes deployment configurations |
| `/schemas/` | Schema definitions | Schema files, not application dependencies |
| `/requirements/` | Development requirements | Development-only dependencies |

## Configuration Features

### Scheduling
- All updates are scheduled for **Tuesday at 9:00 AM (Python)** and **10:00 AM (JS/TS)**
- Weekly interval to balance security with stability
- Consistent timing for predictable maintenance windows

### Update Strategy
- **Patch updates are ignored** for stable dependencies to reduce noise
- **Minor and major updates are included** to capture important security fixes
- **Commit message prefixes** help categorize updates by component

### Review Process
- **Reviewers**: `phoenix-devs` team for all updates
- **Labels**: Automatic labeling by ecosystem and component
- **Scoped commits**: Clear commit messages with component prefixes

## Benefits

1. **Reduced False Positives**: Only scan dependencies that are actually shipped
2. **Clearer Security Posture**: Focus on real vulnerabilities in production code
3. **Better Maintainability**: Less noise means more attention to actual issues
4. **Faster Triage**: Clear categorization of updates by component
5. **Documented Approach**: Clear documentation of what is and isn't scanned

## Maintenance

This configuration should be reviewed when:
- New packages are added to the Phoenix ecosystem
- New example directories are created
- The repository structure changes significantly
- Security requirements change

## Validation

To validate the configuration:
1. Check that all actual application packages are included
2. Verify that example/tutorial directories are excluded
3. Test that Dependabot creates PRs only for included directories
4. Monitor security alerts to ensure they focus on actual application code

## References

- [GitHub Dependabot Configuration Reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [Phoenix Repository Structure](../README.md)
- [Issue #7692: Dependabot false positives](https://github.com/Arize-ai/phoenix/issues/7692)