import assert from "node:assert/strict";
import { utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { listCompressedSessions, resolveGzPath } from "../src/session-paths.ts";
import { withTmpDir } from "./support.ts";

function writeGzSession(dir: string, fileBase: string, id: string, userMessage = ""): string {
	const lines = [JSON.stringify({ type: "session", id, cwd: "/proj" })];
	if (userMessage) {
		lines.push(JSON.stringify({ type: "message", message: { role: "user", content: userMessage } }));
	}
	const gzPath = join(dir, `${fileBase}.jsonl.gz`);
	writeFileSync(gzPath, gzipSync(Buffer.from(lines.join("\n") + "\n")));
	return gzPath;
}

test("resolveGzPath matches by exact id, prefix, and reports no match", () => {
	withTmpDir((dir) => {
		const gz = writeGzSession(dir, "2026_abc", "0199-deadbeef");
		assert.equal(resolveGzPath("0199-deadbeef", dir), gz);
		assert.equal(resolveGzPath("0199-dead", dir), gz);
		assert.equal(resolveGzPath("zzzz", dir), null);
	});
});

test("resolveGzPath resolves a direct path argument", () => {
	withTmpDir((dir) => {
		const gz = writeGzSession(dir, "session", "id-1");
		assert.equal(resolveGzPath(gz, dir), gz);
	});
});

test("listCompressedSessions returns sessions newest-first with previews", () => {
	withTmpDir((dir) => {
		const older = writeGzSession(dir, "a", "id-old", "first task");
		const newer = writeGzSession(dir, "b", "id-new", "second task");
		utimesSync(older, new Date(1000), new Date(1000));
		utimesSync(newer, new Date(2000), new Date(2000));

		const sessions = listCompressedSessions(dir);
		assert.deepEqual(
			sessions.map((s) => s.id),
			["id-new", "id-old"],
		);
		assert.equal(sessions[0].preview, "second task");
	});
});
