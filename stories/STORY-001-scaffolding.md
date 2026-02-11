# STORY-001: Project Scaffolding + PWA Foundation + Design System

## Goal

Set up the project toolchain, PWA foundation, neuroscience-based design system with dark mode, and development environment. This is the base that all future stories build on.

## Acceptance Criteria

- [ ] `package.json` with project name "vector" and dev/build/preview scripts
- [ ] Vite configured as build tool
- [ ] A basic `index.html` renders a "Vector" placeholder page
- [ ] `public/manifest.json` with PWA metadata (name, icons placeholder, display: standalone, theme colors)
- [ ] Service worker registered and caches app shell
- [ ] Dark mode toggle implemented and persisted (localStorage)
- [ ] CSS design tokens defined: neuroscience-based color palette (light + dark)
  - Blues/greens for calm/rest states
  - Warm tones for energy/activity
  - Red/orange for alerts/low energy
- [ ] Base component styles: buttons, cards, inputs, progress bars
- [ ] Mobile-first responsive layout structure
- [ ] Linter configured and passing

## Constraints

- Keep dependencies minimal -- scaffolding + design only, no features
- Design tokens must be documented (what color means what)
- No backend in this story
- DESIGN-01..05 requirements addressed

## Files to Touch

- `package.json` -- create
- `index.html` -- create
- `vite.config.*` -- create
- `src/main.*` -- entry point
- `src/styles/tokens.css` -- design tokens (colors, spacing, typography)
- `src/styles/base.css` -- base styles + dark mode
- `src/styles/components.css` -- button, card, input, progress styles
- `public/manifest.json` -- PWA manifest
- `public/sw.js` -- basic service worker

## Test Plan

- [ ] `npm install` succeeds
- [ ] `npm run build` produces working build
- [ ] App installs on mobile home screen
- [ ] Dark mode toggle switches themes and persists on reload
- [ ] Service worker registers in devtools
- [ ] Colors match neuroscience palette documentation

## Notes

This is Phase 1, Part 1. Next story (STORY-002) adds auth UI on top of this foundation.
