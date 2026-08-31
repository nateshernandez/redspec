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

### Developing against a real repo

A scratch app is fine for a quick smoke test, but `init`'s own install step and
any agent-authored `npx redspec ...` invocations only behave like the real
thing when they run inside an actual project. None of `@redspec/*` is
published, so a plain `npx redspec` or `pnpm add @redspec/cli` in that project
will 404 against the registry. Link your local checkout in instead:

1. **Rebuild on save**, in this repo:

   ```bash
   pnpm --parallel --filter @redspec/core --filter @redspec/method --filter @redspec/cli run build -- --watch
   ```

   Add `--filter @redspec/next` too if you're touching the Next.js package.
   Each `tsup --watch` does one `--clean` on startup, then patches `dist/`
   incrementally on every save.

2. **Link the packages you're testing**, in the target repo's `package.json`.
   `npx` resolves a bin by walking `node_modules/.bin` up from the current
   directory — the same lookup npm and pnpm both use — so once a package is
   linked there, `npx` finds it with no network call. pnpm's `link:` protocol
   is what populates `node_modules` from a sibling checkout without going
   through the registry:

   ```json
   "dependencies": {
     "@redspec/cli": "link:../redspec/packages/cli",
     "@redspec/core": "link:../redspec/packages/core",
     "@redspec/next": "link:../redspec/packages/next"
   }
   ```

   (drop `@redspec/next` if the target repo doesn't use Next), then:

   ```bash
   pnpm install
   ```

3. **Run it:**

   ```bash
   npx redspec init
   ```

   This resolves your local build with no registry round trip. It also makes
   `init`'s own dependency-install step a no-op for `@redspec/*`:
   `missingDeps()` in `packages/cli/src/install.ts` skips anything already
   present under `node_modules/<pkg>` — a link, a local tarball, a pinned
   version — specifically so a setup like this is never re-fetched or
   overwritten. Only the real registry deps it still needs (`vitest`,
   `fast-check`, `@playwright/test`) get installed normally.

Because the linked packages are symlinks, the watcher from step 1 keeps them
current: edit source, save, rerun the command in the target repo, see the
change — no manual rebuild or reinstall in between.

These `link:` entries point at a path on your machine, so they only work for
you. Don't commit them to a target repo you don't control long-term, and
remove them once `@redspec/*` is actually published — replace with real
version ranges at that point.

## Where things live

|                                       |                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/core/src`                   | one module per concern; each has a `.test.ts` beside it                                          |
| `packages/core/src/__fixtures__/repo` | a fake repo built to be wrong in every way `reportBundle` should catch                           |
| `packages/method/plugin`              | the skills, agents, and doc templates — the one source every harness is rendered from            |
| `packages/cli/src/templates.ts`       | everything `init` and `new` write, inline so a template cannot drift from the code that fills it |

## Commits

Conventional commits, one line: `type(scope): summary`. A body only when the change genuinely resists one line, and then it carries _why_.
