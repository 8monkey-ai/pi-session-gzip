import assert from "node:assert/strict";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { compressFile, GZ_SUFFIX, restoreFile } from "../src/gzip.ts";
import { withTmpDir } from "./support.ts";

const HEADER = JSON.stringify({ type: "session", id: "abc123", cwd: "/x", timestamp: "2026-06-18T00:00:00Z" });
const INFO = JSON.stringify({ type: "session_info", name: "my task" });
const SAMPLE =
	[
		HEADER,
		JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "hi" } }),
		INFO,
		JSON.stringify({ type: "message", id: "m2", message: { role: "assistant", content: "yo" } }),
	].join("\n") + "\n";

test("compress archives the full history and leaves a header+info stub", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);

		const gz = compressFile(jsonl);
		assert.equal(gz, jsonl + GZ_SUFFIX);
		assert.equal(readFileSync(jsonl, "utf8"), `${HEADER}\n${INFO}\n`);
		assert.ok(!readdirSync(dir).some((f) => f.includes(".tmp-")), "no temp files left behind");

		assert.equal(restoreFile(gz as string), "restored");
		assert.equal(readFileSync(jsonl, "utf8"), SAMPLE);
	});
});

test("compress and restore are idempotent", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);

		const gz = compressFile(jsonl) as string;
		assert.equal(compressFile(jsonl), null, "stub has no messages, nothing to compress");
		assert.equal(restoreFile(gz), "restored");
		assert.equal(restoreFile(gz), "restored", "restoring an identical file is a no-op");
		assert.equal(readFileSync(jsonl, "utf8"), SAMPLE);
	});
});

test("restore refuses to overwrite a diverged file", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);
		const gz = compressFile(jsonl) as string;

		const newMessage = JSON.stringify({ type: "message", id: "m3", message: { role: "user", content: "more" } });
		appendFileSync(jsonl, newMessage + "\n");

		assert.equal(restoreFile(gz), "diverged");
		assert.ok(readFileSync(jsonl, "utf8").includes("more"), "diverged file untouched");
	});
});

test("compress extends the archive when the restored session grew", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);
		const gz = compressFile(jsonl) as string;
		restoreFile(gz);

		const grown = SAMPLE + JSON.stringify({ type: "message", id: "m3", message: { role: "user", content: "more" } }) + "\n";
		writeFileSync(jsonl, grown);

		assert.equal(compressFile(jsonl), gz);
		assert.equal(restoreFile(gz), "restored");
		assert.equal(readFileSync(jsonl, "utf8"), grown);
	});
});

test("compress reports a conflict when a diverged stub was chatted on", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);
		compressFile(jsonl);

		// A shimless pi appends to the stub without restoring first.
		appendFileSync(jsonl, JSON.stringify({ type: "message", id: "m9", message: { role: "user", content: "lost?" } }) + "\n");

		assert.equal(compressFile(jsonl), "conflict");
	});
});

test("empty and headerless files are skipped", () => {
	withTmpDir((dir) => {
		const empty = join(dir, "empty.jsonl");
		writeFileSync(empty, "");
		assert.equal(compressFile(empty), null);

		const headerless = join(dir, "h.jsonl");
		writeFileSync(headerless, JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "x" } }) + "\n");
		assert.equal(compressFile(headerless), null);

		assert.equal(compressFile(join(dir, "missing.jsonl")), null);
		assert.ok(!existsSync(empty + GZ_SUFFIX));
	});
});

test("restore throws when the gz is missing", () => {
	withTmpDir((dir) => {
		assert.throws(() => restoreFile(join(dir, "nope.jsonl.gz")));
	});
});
