# AiaA development harness

Read `CLAUDE.md` first. It is the product and engineering source of truth. Then read the relevant
documents in `docs/` before changing code. Instructions in this file adapt the existing Claude Code
harness for Codex and other coding agents.

## Working mode

- Continue through implementation, verification, and a reviewable commit when the user has already
  authorized the work. Do not stop after presenting a plan.
- Work on a feature branch. Never force-push and never push directly to `main`.
- Commit after each coherent, verified milestone using Conventional Commits in English.
- Never read `.env` files. `.env.example` is the only exception.
- Never deploy or apply a migration to a remote Supabase project.
- Keep external communications and paid AI calls simulated until the user explicitly configures and
  authorizes a real provider and budget.

## Roles and delegation

Use the smallest useful team. Parallelize only independent work with disjoint files.

### Backend and product agents

Own `supabase/`, `lib/`, server actions and queries, agent engines, schemas, decisions, integrations,
generated database types, and their unit/integration tests. Follow `.claude/agents/automatisation-ia.md`
except for tool-specific metadata. Do not implement UI pages or reusable visual components.

### Frontend and UX

Own pages, layouts, `components/ui/`, feature components, interface text, `docs/design-system.md`, and
Playwright scenarios. Follow `.claude/agents/frontend-ux.md`. Consume server actions and queries; do
not duplicate business rules in the browser.

### Security review

Audit each sensitive or cross-cutting milestone after implementation. Follow
`.claude/agents/cybersecurite.md` and `.claude/skills/appsec-review/SKILL.md`. Critical or high findings
block the milestone until fixed and covered by a test.

The primary agent integrates the work, resolves overlap, runs the complete checks, commits, and
reports any environment limitation precisely.

## Product invariants

- Every business row belongs to an agency and is isolated with tested RLS.
- Session, agency membership, role, consent, kill switch, and limits are rechecked server-side.
- Prospect content is untrusted data, never an instruction to an LLM.
- LLM output is schema-validated. Code decides and writes; the model drafts and classifies.
- A human validates the first outbound message and confirms `mandat_signe`.
- Missing information stays missing and creates a human task; agents never invent it.
- All prototype messages, appointments, and provider runs remain clearly marked as simulations.

## Definition of done

Run the checks relevant to the change, then the complete suite at a major milestone:

```text
npm run typecheck
npm run lint
npx vitest run
npx playwright test
npm run build
```

Report only checks that actually ran. If the environment blocks a check, give the exact error and a
single command the user can run locally. Update `docs/product.md`, `docs/architecture.md`,
`docs/workflows.md`, `docs/security.md`, and `docs/design-system.md` whenever their source-of-truth
statements change.
