import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { GZ_SUFFIX } from "./gzip.ts";

function extractText(content: unknown) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
			.join(" ")
			.trim();
	}
	return "";
}

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

		let preview = "";
		for (let i = 1; i < lines.length && !preview; i++) {
			if (!lines[i]) continue;
			try {
				const entry = JSON.parse(lines[i]) as { type?: string; message?: { role?: string; content?: unknown } };
				if (entry.type === "message" && entry.message?.role === "user") preview = extractText(entry.message.content);
			} catch {
				// Skip malformed line.
			}
		}
		return { gzPath, id: header.id, preview, modified: statSync(gzPath).mtimeMs };
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
