# Vector-test

This repository is bootstrapped with **BMAD Method**, **GSD (Get Stuff Done)**, and the **Ralph loop** for structured AI-driven development.

## Repository Structure

```
.
├── .claude/              # GSD commands, agents, hooks (auto-generated)
├── .devcontainer/        # Codespaces / devcontainer config
├── .planning/            # GSD context files (PROJECT, REQUIREMENTS, ROADMAP, STATE)
├── .ralph/               # Ralph loop config, progress, and done-checklist
├── _bmad/                # BMAD Method core (agents, workflows, config)
├── _bmad-output/         # BMAD planning & implementation artifacts
├── docs/                 # Project documentation
├── stories/              # Story files consumed by the Ralph loop
├── CONTRIBUTING.md       # Branch naming, commit conventions, PR checklist
└── README.md             # This file
```

## Workflows Available

### BMAD Method

Use BMAD slash commands for planning and architecture:

- `/bmad-help` -- Adaptive guidance
- `/bmad-bmm-create-product-brief` -- Define product brief
- `/bmad-bmm-create-prd` -- Create PRD from brief
- `/bmad-bmm-create-architecture` -- Design architecture
- `/bmad-bmm-create-epics-and-stories` -- Break into epics/stories
- `/bmad-bmm-dev-story` -- Implement a story

### GSD (Get Stuff Done)

Use GSD slash commands for execution:

- `/gsd:help` -- Command reference
- `/gsd:new-project` -- Full project setup
- `/gsd:plan-phase N` -- Plan a phase
- `/gsd:execute-phase N` -- Execute a phase
- `/gsd:progress` -- Current status

### Ralph Loop

The Ralph loop reads stories from `stories/*.md` and executes them autonomously.

```
# To run the loop (tell Claude):
Read .ralph/loop-config.md and execute the Ralph loop.
```

See `.ralph/README.md` for details.

## Getting Started

1. Define your product direction in `.planning/PROJECT.md`
2. Add requirements to `.planning/REQUIREMENTS.md`
3. Create stories in `stories/` using `stories/_TEMPLATE.md`
4. Run the Ralph loop or use BMAD/GSD workflows

## Conventions

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit format, and PR checklist.
