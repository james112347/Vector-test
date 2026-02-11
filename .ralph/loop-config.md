# Ralph Loop Configuration

## Inputs

Read these files at the start of each iteration:

1. `.ralph/progress.md` -- current state and history
2. `.ralph/done-checklist.md` -- stop condition
3. `.planning/STATE.md` -- project-wide context
4. Next unfinished story from `stories/*.md` (sorted alphabetically by filename)

## Story Selection

1. List all `stories/STORY-*.md` files sorted by filename
2. Skip any story whose ID appears in `progress.md` with status `DONE` or `SKIPPED`
3. Pick the first remaining story
4. If no stories remain, the loop is finished

## Execution Steps (per story)

1. **Read** the story file completely
2. **Validate** that Goal, Acceptance Criteria, and Constraints are filled in (not just template placeholders)
   - If the story is still a placeholder/template, mark it `SKIPPED` in progress and move on
3. **Create a branch** named `ai/<story-id>-<slug>` (e.g., `ai/STORY-001-initial-scaffolding`)
4. **Implement** the story following its acceptance criteria
5. **Run** the test plan defined in the story (if any)
6. **Commit** changes with message: `feat(<story-id>): <goal summary>`
7. **Update** `.ralph/progress.md` with the result
8. **Update** `.planning/STATE.md` if the story changed project state

## Stop Conditions

The loop MUST stop when ANY of these are true:

- `progress.md` first line is `STOP`
- All items in `done-checklist.md` are checked `[x]`
- No more stories to process
- An unrecoverable error occurs (log it and stop)

## What to Update

After each story:

| File | What to Update |
|------|---------------|
| `.ralph/progress.md` | Add entry with story ID, status, summary, timestamp |
| `.planning/STATE.md` | Update current position, decisions, blockers if applicable |
| `done-checklist.md` | Check off items that became true |

## Error Handling

- If a story fails mid-execution, log the error in `progress.md`
- Mark the story as `FAILED` with the error reason
- Continue to the next story (do not abort the loop)
- If 3 consecutive stories fail, stop the loop and log the reason
