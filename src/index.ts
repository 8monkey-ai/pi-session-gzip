import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { gunzipFile, gzipFile } from "./gzip.ts";
import { listCompressedSessions, resolveGzPath } from "./session-paths.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async (event, ctx) => {
		// Only "quit" means pi is done with the file. reload/new/resume/fork
		// reopen or switch files, so compressing then could remove a file pi
		// still reads.
		if (event.reason !== "quit") return;

		const file = ctx.sessionManager.getSessionFile();
		if (!file) return;

		const gz = gzipFile(file);
		if (gz && ctx.hasUI) {
			ctx.ui.notify(`Compressed session to ${gz.split("/").pop()}.`, "info");
		}
	});

	pi.registerCommand("resume-compressed", {
		description: "Decompress a compressed session (.jsonl.gz) and resume it",
		handler: async (args, ctx) => {
			const sessionDir = ctx.sessionManager.getSessionDir();
			const arg = args.trim();
			const gzPath = arg ? resolveGzPath(arg, sessionDir) : (await pickCompressedSession(ctx, sessionDir))?.gzPath;
			if (gzPath) await decompressAndResume(gzPath, ctx);
		},
	});
}

async function pickCompressedSession(ctx: ExtensionCommandContext, sessionDir: string) {
	const sessions = listCompressedSessions(sessionDir);
	if (sessions.length === 0) {
		ctx.ui.notify("No compressed sessions in this project.", "info");
		return undefined;
	}

	const labels = sessions.map((s) => {
		const when = new Date(s.modified).toISOString().slice(0, 16).replace("T", " ");
		const preview = s.preview.replace(/\s+/g, " ").slice(0, 60) || "(no messages)";
		return `${when}  ${preview}`;
	});
	const choice = await ctx.ui.select("Resume compressed session", labels);
	return choice === undefined ? undefined : sessions[labels.indexOf(choice)];
}

async function decompressAndResume(gzPath: string, ctx: ExtensionCommandContext) {
	let restored: string;
	try {
		restored = gunzipFile(gzPath);
	} catch (err) {
		ctx.ui.notify(`Failed to decompress session: ${(err as Error).message}.`, "warning");
		return;
	}

	const { cancelled } = await ctx.switchSession(restored);
	if (cancelled) ctx.ui.notify("Resume cancelled.", "info");
}
