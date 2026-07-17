import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

export const GZ_SUFFIX = ".gz";

// Write via a temp sibling + fsync + atomic rename so readers never observe a
// half-written file, even across a crash.
function writeFileDurable(targetPath: string, data: Buffer): void {
	const tmpPath = `${targetPath}.tmp-${process.pid}`;
	const fd = openSync(tmpPath, "w");
	try {
		writeSync(fd, data);
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

// Archive to `.gz` and shrink the plain file to a stub (header + latest
// session_info) so session listings keep working. Returns null when there are
// no messages — re-compressing a stub would clobber the archive.
export function compressFile(jsonlPath: string): string | null {
	if (!existsSync(jsonlPath)) return null;

	const plain = readFileSync(jsonlPath, "utf8");
	const lines = plain.split("\n").filter((line) => line);
	if (lines.length === 0 || entryType(lines[0]) !== "session") return null;
	if (!lines.some((line) => entryType(line) === "message")) return null;

	const gzPath = `${jsonlPath}${GZ_SUFFIX}`;
	writeFileDurable(gzPath, gzipSync(plain));

	const stub = [lines[0]];
	const info = lines.findLast((line) => entryType(line) === "session_info");
	if (info) stub.push(info);
	writeFileDurable(jsonlPath, Buffer.from(stub.join("\n") + "\n"));
	return gzPath;
}

// Restore the archived history over the `.jsonl`; throws if the .gz is missing.
export function restoreFile(gzPath: string): string {
	const jsonlPath = gzPath.slice(0, -GZ_SUFFIX.length);
	writeFileDurable(jsonlPath, gunzipSync(readFileSync(gzPath)));
	return jsonlPath;
}
