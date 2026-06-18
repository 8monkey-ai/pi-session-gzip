import {
	closeSync,
	existsSync,
	fsyncSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeSync,
} from "node:fs";
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

// Compress `jsonlPath` to a `.gz` file beside it and remove the plain file. The .gz
// is durably in place before the plain file is unlinked, so a crash leaves at
// least one intact copy. Returns the .gz path, or null when there is nothing to
// compress (a session quit before it was ever persisted, or an empty file).
export function gzipFile(jsonlPath: string, opts: { keepPlain?: boolean } = {}): string | null {
	if (!existsSync(jsonlPath)) return null;

	const plain = readFileSync(jsonlPath);
	if (plain.length === 0) return null;

	const gzPath = `${jsonlPath}${GZ_SUFFIX}`;
	writeFileDurable(gzPath, gzipSync(plain));

	if (!opts.keepPlain) rmSync(jsonlPath, { force: true });
	return gzPath;
}

// Decompress `gzPath` back to its `.jsonl`, leaving the `.gz` in place. Returns
// the restored path. Throws (ENOENT) if the .gz is missing.
export function gunzipFile(gzPath: string): string {
	const jsonlPath = gzPath.slice(0, -GZ_SUFFIX.length);
	writeFileDurable(jsonlPath, gunzipSync(readFileSync(gzPath)));
	return jsonlPath;
}
