# Directives for agents working in this repository

## Working with git

### Writing commit messages

Write commit messages in the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) style: `type(scope): description`, where `scope` is optional.

```
feat(cli): add --watch flag to redspec run
```

Keep the message to that one line. A body is for the rare change no single line can express — and needing one usually means the commit is doing several things, so split it into several one-line commits first.
