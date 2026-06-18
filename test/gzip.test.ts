import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { GZ_SUFFIX, gunzipFile, gzipFile } from "../src/gzip.ts";
import { withTmpDir } from "./support.ts";

const SAMPLE =
	[
		JSON.stringify({ type: "session", id: "abc123", cwd: "/x", timestamp: "2026-06-18T00:00:00Z" }),
		JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "hi" } }),
		JSON.stringify({ type: "message", id: "m2", message: { role: "assistant", content: "yo" } }),
	].join("\n") + "\n";

test("round trip: gzip deletes the plain file, gunzip restores it byte-identically", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);

		const gz = gzipFile(jsonl);
		assert.equal(gz, jsonl + GZ_SUFFIX);
		assert.ok(!existsSync(jsonl), "plain deleted by default");
		assert.ok(!readdirSync(dir).some((f) => f.includes(".tmp-")), "no temp files left behind");

		const restored = gunzipFile(gz!);
		assert.equal(restored, jsonl);
		assert.equal(readFileSync(restored, "utf8"), SAMPLE);
	});
});

test("keepPlain keeps both files", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);
		gzipFile(jsonl, { keepPlain: true });
		assert.ok(existsSync(jsonl) && existsSync(jsonl + GZ_SUFFIX));
	});
});

test("empty session is skipped, no gz created", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "empty.jsonl");
		writeFileSync(jsonl, "");
		assert.equal(gzipFile(jsonl), null);
		assert.ok(!existsSync(jsonl + GZ_SUFFIX));
	});
});

test("gzip returns null when the plain file is already gone", () => {
	withTmpDir((dir) => {
		const jsonl = join(dir, "s.jsonl");
		writeFileSync(jsonl, SAMPLE);
		gzipFile(jsonl);
		assert.equal(gzipFile(jsonl), null);
	});
});

test("gunzip throws when the gz is missing", () => {
	withTmpDir((dir) => {
		assert.throws(() => gunzipFile(join(dir, "nope.jsonl.gz")));
	});
});
