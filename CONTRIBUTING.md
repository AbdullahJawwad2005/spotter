# Contributing to Spotter

Thank you for your interest in contributing. This document outlines the process for contributing to this project.

## Getting Started

1. Fork the repository and clone it locally.
2. Follow the setup instructions in [README.md](README.md).
3. Create a new branch for your change: `git checkout -b feature/your-feature-name`

## Development Guidelines

### Code Style

- TypeScript strict mode is enforced — no `any` unless unavoidable and explicitly typed.
- Components live in `src/components/`, pages in `src/pages/`, hooks in `src/hooks/`.
- Prefer editing existing files over creating new abstractions.
- No comments unless the **why** is non-obvious (a hidden constraint, a workaround, a subtle invariant).

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add deadlift form scoring
fix: squat depth threshold off by one frame
refactor: consolidate session state into single hook
docs: update environment variable list
```

### Pull Requests

- Keep PRs focused — one feature or fix per PR.
- Fill out the PR template fully.
- All existing functionality must remain working — test the form coach, workout generation, and session flow before submitting.

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:
- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS
- Console errors if applicable

## Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Explain the problem you're solving, not just the solution you want.

## Questions

Open a [Discussion](https://github.com/AbdullahJawwad2005/spotter/discussions) rather than an issue for general questions.
