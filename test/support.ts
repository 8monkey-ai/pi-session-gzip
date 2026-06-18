import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function withTmpDir(fn: (dir: string) => void) {
	const dir = mkdtempSync(join(tmpdir(), "psg-"));
	try {
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
