# Contributing

Thanks for looking. The project is in development, so the most useful contributions right now are the ones that make a claim in the README true or expose one that is not.

## Ground rules

- **Small fixes**: open a PR.
- **Anything larger**: open an issue first. Say what would go red if the change were wrong — a test, a finding kind, a typecheck. That is the bar this repo holds itself to, and it applies to itself.
- AI-assisted contributions are welcome. Say which model and harness in the PR body.

## Developing

```bash
pnpm install
pnpm check          # build → typecheck → test
pnpm test:watch
```

Workspace packages resolve to `src/` in tests via `tsconfig.json` paths, so tests need no build. Typecheck and the CLI binary resolve through `dist/`, so `pnpm build` first.

To try the CLI against a scratch app without publishing:

```bash
pnpm build
mkdir /tmp/app && cd /tmp/app && npm init -y && npm i next react react-dom
node ~/path/to/redspec/packages/cli/bin/redspec.js init
```

## Where things live

|                                       |                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/core/src`                   | one module per concern; each has a `.test.ts` beside it                                          |
| `packages/core/src/__fixtures__/repo` | a fake repo built to be wrong in every way `reportBundle` should catch                           |
| `packages/method/plugin`              | the skills, agents, and doc templates — the one source every harness is rendered from            |
| `packages/cli/src/templates.ts`       | everything `init` and `new` write, inline so a template cannot drift from the code that fills it |

## Commits

Conventional commits, one line: `type(scope): summary`. A body only when the change genuinely resists one line, and then it carries _why_.
