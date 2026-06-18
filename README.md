# pi-session-gzip

Gzip Pi session files at rest. When a session closes it's compressed to a `.jsonl.gz` file alongside the original and the plain file is removed; `/resume-compressed` restores and reopens it on demand. Plain JSONL stays Pi's working format — nothing changes during a live session.

Built for anyone whose `~/.pi/agent/sessions/` has grown large and wants closed sessions to sit compressed without losing the ability to reopen them.

## How it works

- **Compress on shutdown.** Quitting Pi compresses the closed session's `session.jsonl` to `session.jsonl.gz` and removes the plain file.
- **Restore on demand.** Run `/resume-compressed` to pick from this project's compressed sessions (newest first); your choice is decompressed and reopened in place. Pass an id or path to skip the picker.

Zero runtime dependencies. Pi loads the TypeScript directly, so there's no build step. Runs under Node or Bun.

## Install

```bash
pi install npm:@8monkey/pi-session-gzip
```

That's it — the extension loads on the next `pi` launch. Update with `pi update`.

For development against a local clone, point pi at the file directly in `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "~/pi-session-gzip/src/index.ts"
  ]
}
```

## Command

| Command | Description |
|---|---|
| `/resume-compressed [id\|path]` | Restore a compressed session and reopen it. With no argument, shows a picker of this project's compressed sessions (newest first). Accepts a session id (exact or prefix) or a file path. |

## Behaviour notes

- Compresses on quit only; live sessions, reloads, and switches are left untouched.
- Restoring is safe to repeat — running compress or restore twice is a no-op.
- Ephemeral (`--no-session`) and empty sessions are skipped.
- The `.gz` sits next to the original; the sessions layout is never reorganized.

## Development

```bash
node --test
```

## License

MIT
