# Ralph Loop

Ralph is an autonomous task execution loop for AI-assisted development.
It reads stories from `/stories/*.md`, executes them one at a time,
and tracks progress in this folder.

## How It Works

1. **Read** the current state from `.ralph/progress.md`
2. **Pick** the next unfinished story from `/stories/` (sorted by filename)
3. **Execute** the story following its acceptance criteria
4. **Update** `.ralph/progress.md` with results
5. **Check** `.ralph/done-checklist.md` -- if all items are checked, stop
6. **Repeat** from step 1

## Files in This Folder

| File | Purpose |
|------|---------|
| `README.md` | This file -- loop overview |
| `loop-config.md` | Detailed loop instructions (what to read, update, stop) |
| `done-checklist.md` | Checklist-based stop condition |
| `progress.md` | Execution log and current state |

## Running the Loop

The loop is designed to be invoked by a human operator telling Claude:

```
Read .ralph/loop-config.md and execute the Ralph loop.
```

Do **not** run the loop without reviewing `.ralph/done-checklist.md` first.

## Safety

- The loop stops when `done-checklist.md` has all items checked
- The loop stops if there are no more stories to process
- The loop stops on any unrecoverable error (logged in `progress.md`)
- The operator can stop at any time by adding `STOP` as the first line of `progress.md`
