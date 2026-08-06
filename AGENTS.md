# Agent Instructions

## Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm preview  # Preview production build
```

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(component): add new feature`
- `fix: resolve bug`
- `style: update styling`
- `perf: improve performance`
- `docs: update documentation`
- `refactor: restructure code`
- `test: add/update tests`
- `chore: maintenance tasks

Use `()` for scope (optional).

Add `!` before `:` for breaking changes (e.g., `feat!: breaking change` or `feat(component)!: breaking change`)

## Stack

- React 19 + TypeScript
- Vite
- TailwindCSS v4
- oxlint + oxfmt for linting/formatting

## Git Hooks (Husky)

Configured in `.husky/`
