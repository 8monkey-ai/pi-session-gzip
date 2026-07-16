import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { GZ_SUFFIX } from "./gzip.ts";

function looksLikePath(arg: string) {
	return arg.includes("/") || arg.includes("\\") || arg.endsWith(".jsonl") || arg.endsWith(".jsonl.gz");
}

function gzPathFromArg(arg: string, base: string) {
	const abs = isAbsolute(arg) ? arg : resolve(base, arg);
	return abs.endsWith(GZ_SUFFIX) ? abs : `${abs}${GZ_SUFFIX}`;
}

function gzPathsIn(dir: string) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(`.jsonl${GZ_SUFFIX}`))
		.map((f) => join(dir, f));
}

function toInfo(gzPath: string) {
	try {
		const lines = gunzipSync(readFileSync(gzPath)).toString("utf8").split("\n");
		const header = JSON.parse(lines[0]) as { type?: string; id?: unknown };
		if (header.type !== "session" || typeof header.id !== "string") return undefined;
		return { gzPath, id: header.id, modified: statSync(gzPath).mtimeMs };
	} catch {
		return undefined;
	}
}

// Compressed sessions in `sessionDir` (the live session's directory), newest first.
export function listCompressedSessions(sessionDir: string) {
	return gzPathsIn(sessionDir)
		.map(toInfo)
		.filter((s) => s !== undefined)
		.sort((a, b) => b.modified - a.modified);
}

// Resolve a `<id|path>` argument to a compressed session's `.gz` path in
// `sessionDir`. A path resolves directly; an id matches a session header
// (exact, else prefix). Returns null when no id matches.
export function resolveGzPath(arg: string, sessionDir: string): string | null {
	const trimmed = arg.trim();
	if (looksLikePath(trimmed)) return gzPathFromArg(trimmed, sessionDir);

	const sessions = listCompressedSessions(sessionDir);
	return (sessions.find((s) => s.id === trimmed) ?? sessions.find((s) => s.id.startsWith(trimmed)))?.gzPath ?? null;
}
