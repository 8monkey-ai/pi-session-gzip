import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

export const GZ_SUFFIX = ".gz";

// Write via a temp sibling + fsync + atomic rename so readers never observe a
// half-written file, even across a crash.
function writeFileDurable(targetPath: string, data: Buffer | string): void {
	const tmpPath = `${targetPath}.tmp-${process.pid}`;
	const fd = openSync(tmpPath, "w");
	try {
		writeSync(fd, data as Buffer);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
	renameSync(tmpPath, targetPath);
}

function entryType(line: string) {
	try {
		return (JSON.parse(line) as { type?: string }).type;
	} catch {
		return undefined;
	}
}

function hasMessageEntries(jsonl: string) {
	return jsonl.split("\n").some((line) => entryType(line) === "message");
}

// Compress `jsonlPath` to a `.gz` beside it and shrink the plain file to a stub
// (session header + latest session_info) so session listings still see the
// session's id, cwd, and title. Returns the .gz path, null when there is
// nothing to compress (no session header or no messages — re-compressing a
// stub would clobber the archive), or "conflict" when the existing .gz holds
// history the plain file lacks (a stub was chatted on without being restored).
export function compressFile(jsonlPath: string): string | "conflict" | null {
	if (!existsSync(jsonlPath)) return null;

	const plain = readFileSync(jsonlPath, "utf8");
	const lines = plain.split("\n").filter((line) => line);
	if (lines.length === 0 || entryType(lines[0]) !== "session") return null;
	if (!hasMessageEntries(plain)) return null;

	const gzPath = `${jsonlPath}${GZ_SUFFIX}`;
	if (existsSync(gzPath)) {
		try {
			const archived = gunzipSync(readFileSync(gzPath)).toString("utf8");
			if (!plain.startsWith(archived)) return "conflict";
		} catch {
			return "conflict";
		}
	}
	writeFileDurable(gzPath, gzipSync(plain));

	const stub = [lines[0]];
	const info = lines.findLast((line) => entryType(line) === "session_info");
	if (info) stub.push(info);
	writeFileDurable(jsonlPath, stub.join("\n") + "\n");
	return gzPath;
}

// Restore the full history from `gzPath` over its `.jsonl`. Overwrites only a
// missing file, a stub (no message entries), or an identical copy; a file with
// messages the archive may lack is left untouched ("diverged"). Throws
// (ENOENT) if the .gz is missing.
export function restoreFile(gzPath: string): "restored" | "diverged" {
	const jsonlPath = gzPath.slice(0, -GZ_SUFFIX.length);
	const full = gunzipSync(readFileSync(gzPath));

	if (existsSync(jsonlPath)) {
		const plain = readFileSync(jsonlPath, "utf8");
		if (hasMessageEntries(plain) && plain !== full.toString("utf8")) return "diverged";
	}
	writeFileDurable(jsonlPath, full);
	return "restored";
}
