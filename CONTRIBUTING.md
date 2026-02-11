# Contributing

## Branch Naming Convention

```
ai/<story-id>-<slug>
```

Examples:
- `ai/STORY-001-initial-scaffolding`
- `ai/STORY-042-add-auth-flow`

For non-story work:
- `fix/<description>` -- bug fixes
- `chore/<description>` -- maintenance, tooling
- `docs/<description>` -- documentation only

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|------|------------|
| `feat` | New feature or story implementation |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, config, maintenance |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `style` | Formatting, whitespace (no logic change) |

### Scope

Use the story ID when applicable:

```
feat(STORY-001): implement initial scaffolding
fix(STORY-012): correct null check in auth handler
chore: update dependencies
```

## Pull Request Checklist

Before opening a PR, verify:

- [ ] Branch follows naming convention (`ai/<story-id>-<slug>`)
- [ ] All commits follow conventional commit format
- [ ] Acceptance criteria from the story are met
- [ ] Tests pass (if test plan exists in the story)
- [ ] No secrets, credentials, or `.env` files committed
- [ ] `.planning/STATE.md` updated if project state changed
- [ ] `.ralph/progress.md` updated if story was processed by Ralph loop
- [ ] PR description includes:
  - Story ID and link (if applicable)
  - Summary of changes
  - How to test

## PR Description Template

```markdown
## Story

STORY-NNN: [Title]

## Changes

- [Change 1]
- [Change 2]

## Testing

- [ ] [How to verify change 1]
- [ ] [How to verify change 2]

## Checklist

- [ ] Acceptance criteria met
- [ ] Tests pass
- [ ] No secrets committed
```

## Code Review

- Review against the story's acceptance criteria
- Check for security issues (OWASP top 10)
- Verify test coverage for new functionality
- Ensure no product features are invented beyond what the story specifies
