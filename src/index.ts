import { existsSync } from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { compressFile, GZ_SUFFIX, restoreFile } from "./gzip.ts";
import { listCompressedSessions, resolveGzPath } from "./session-paths.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async (event, ctx) => {
		// Only "quit" means pi is done with the file. reload/new/resume/fork
		// reopen or switch files, so compressing then could remove a file pi
		// still reads.
		if (event.reason !== "quit") return;

		const file = ctx.sessionManager.getSessionFile();
		if (!file) return;

		const gz = compressFile(file);
		if (gz && ctx.hasUI) {
			ctx.ui.notify(`Compressed session to ${gz.split("/").pop()}.`, "info");
		}
	});

	// Fires before pi reads the target, so restore is invisible to resume/switch.
	pi.on("session_before_switch", async (event) => {
		const target = event.targetSessionFile;
		if (!target || !existsSync(`${target}${GZ_SUFFIX}`)) return;
		try {
			restoreFile(`${target}${GZ_SUFFIX}`);
		} catch {
			// Pi loads whatever is on disk.
		}
	});

	pi.registerCommand("resume-compressed", {
		description: "Restore a compressed session (.jsonl.gz) and resume it",
		handler: async (args, ctx) => {
			const sessionDir = ctx.sessionManager.getSessionDir();
			const arg = args.trim();
			if (arg) {
				const gzPath = resolveGzPath(arg, sessionDir);
				if (gzPath) await restoreAndResume(gzPath, ctx);
				else ctx.ui.notify(`No compressed session matching "${arg}".`, "info");
				return;
			}

			const gzPath = findRestorableGz(ctx, sessionDir);
			if (!gzPath) {
				ctx.ui.notify("No compressed session to restore.", "info");
				return;
			}
			await restoreAndResume(gzPath, ctx);
		},
	});
}

// The current session's own .gz if it exists, else the newest .gz in the project.
function findRestorableGz(ctx: ExtensionCommandContext, sessionDir: string) {
	const file = ctx.sessionManager.getSessionFile();
	const exact = file ? `${file}${GZ_SUFFIX}` : undefined;
	if (exact && existsSync(exact)) return exact;
	return listCompressedSessions(sessionDir)[0]?.gzPath;
}

async function restoreAndResume(gzPath: string, ctx: ExtensionCommandContext) {
	let restored: string;
	try {
		restored = restoreFile(gzPath);
	} catch (err) {
		ctx.ui.notify(`Failed to restore session: ${(err as Error).message}.`, "warning");
		return;
	}

	// After a successful switch the outer ctx is stale; notify via withSession's
	// fresh ctx. On cancel no replacement happened, so the outer ctx is still valid.
	const { cancelled } = await ctx.switchSession(restored, {
		withSession: async (newCtx) => {
			newCtx.ui.notify(`Resumed ${restored.split("/").pop()}.`, "info");
		},
	});
	if (cancelled) ctx.ui.notify("Resume cancelled.", "info");
}
