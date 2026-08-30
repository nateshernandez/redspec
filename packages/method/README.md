# @redspec/method

The redspec method as one source — `plugin/skills/*/SKILL.md`, `plugin/agents/*.md`, `plugin/docs/*.md` — and renderers that turn it into per-harness context:

| Harness     | Rendered as                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Claude Code | `.claude/skills/`, `.claude/agents/`, a section in `CLAUDE.md` (or install `plugin/` from the marketplace) |
| Cursor      | `.cursor/rules/redspec-*.mdc` (manual steps), `redspec.mdc` (always), a section in `AGENTS.md`             |
| Codex       | a section in `AGENTS.md` carrying the steps as prose                                                       |
| Copilot     | a section in `.github/copilot-instructions.md` and `AGENTS.md`, `.github/prompts/redspec-*.prompt.md`      |
| Gemini      | a section in `GEMINI.md`                                                                                   |

`plugin/` is also a complete Claude Code plugin. `CAPABILITIES` records what each harness can enforce — only Claude Code can make a step HITL-only — and `redspec doctor` says so.
