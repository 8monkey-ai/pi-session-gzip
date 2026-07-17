# pi-session-gzip

Gzip Pi session files at rest. When a session closes, its full history is compressed to a `.jsonl.gz` file and the `.jsonl` is shrunk to a small stub (session header + name). The stub keeps the session visible to anything that lists sessions — including [pi-acp](https://github.com/nikvdp/pi-acp)'s `session/list` — while the history sits compressed. Resuming restores the full file transparently.

Built for anyone whose `~/.pi/agent/sessions/` has grown large and wants closed sessions to sit compressed without losing the ability to list or reopen them.

## How it works

- **Compress on quit.** Quitting Pi archives `session.jsonl` to `session.jsonl.gz` and rewrites the `.jsonl` as a stub: the session header plus the latest session name. Listings keep working; disk usage drops to the compressed size.
- **Restore on resume.** Any in-app resume or session switch (`/resume`, pi-acp's `session/load` into a running pi) fires before Pi reads the file, and the extension restores the full history first. `/resume-compressed` does the same on demand.

Zero runtime dependencies. Pi loads the TypeScript directly, so there's no build step. Runs under Node or Bun.

## Install

```bash
pi install npm:@8monkey/pi-session-gzip
```

## Command

| Command | Description |
|---|---|
| `/resume-compressed [id\|path]` | Restore a compressed session and reopen it. With no argument, restores the current session's `.gz`, or this project's newest compressed session if there is none. Accepts a session id (exact or prefix) or a file path. |

## Cold starts (`pi --session <file>`)

Pi reads the session file at startup, before extensions load, so a cold `pi --session <stub>` would open the stub without its history. The package ships a tiny shim that restores the archive first and then execs `pi`:

```
shell/pi-gz
```

Point whatever spawns pi at it. For pi-acp, set the env var it already supports:

```bash
export PI_ACP_PI_COMMAND=~/.pi/agent/npm/node_modules/@8monkey/pi-session-gzip/shell/pi-gz
```

The shim only acts on `--session <path>` when `<path>.gz` exists; every other invocation passes through unchanged.

## Behaviour notes

- Compresses on quit only; live sessions, reloads, and switches are left untouched.
- Compress and restore are idempotent — running either twice is a no-op.
- Ephemeral (`--no-session`) and message-less sessions are skipped.
- The `.gz` sits beside the stub at the same path (`session.jsonl` + `session.jsonl.gz`); the sessions layout is never reorganized.

## Development

```bash
node --test
```

## License

MIT
