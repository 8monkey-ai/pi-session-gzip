# pi-session-gzip

Gzip Pi session files at rest. When a session closes it's compressed to a `.jsonl.gz` file and the plain file is removed; `/resume-compressed` restores and reopens it on demand. Plain JSONL stays Pi's working format — nothing changes during a live session.

Built for anyone whose `~/.pi/agent/sessions/` has grown large and wants closed sessions to sit compressed without losing the ability to reopen them.

## How it works

- **Compress on shutdown.** Quitting Pi compresses the closed session's `session.jsonl` to `session.jsonl.gz` and removes the plain file.
- **Restore on demand.** Run `/resume-compressed` to decompress and reopen the current session's `.gz` (falling back to this project's newest compressed session). Pass an id or path to restore a specific one.

Zero runtime dependencies. Pi loads the TypeScript directly, so there's no build step. Runs under Node or Bun.

## Install

```bash
pi install npm:@8monkey/pi-session-gzip
```

## Command

| Command | Description |
|---|---|
| `/resume-compressed [id\|path]` | Restore a compressed session and reopen it. With no argument, restores the current session's `.gz`, or this project's newest compressed session if there is none. Accepts a session id (exact or prefix) or a file path. |

## Behaviour notes

- Compresses on quit only; live sessions, reloads, and switches are left untouched.
- Restoring is safe to repeat — running compress or restore twice is a no-op.
- Ephemeral (`--no-session`) and empty sessions are skipped.
- The `.gz` replaces the original at the same path (`session.jsonl` → `session.jsonl.gz`); the sessions layout is never reorganized.

## Development

```bash
node --test
```

## License

MIT
