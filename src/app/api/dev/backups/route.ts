import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// SENTINEL: SCRIPT_BACKUPS_LIST_V1

export async function GET() {
  try {
    const backupsDir = path.join(process.cwd(), "backups");
    let entries: string[] = [];
    try {
      entries = await fs.readdir(backupsDir);
    } catch {
      return NextResponse.json({ backups: [] });
    }
    const list = await Promise.all(
      entries
        .filter((e) => e.startsWith("snapshot_"))
        .map(async (name) => {
          const full = path.join(backupsDir, name);
          const stat = await fs.lstat(full).catch(() => null);
          if (!stat || !stat.isDirectory()) return null;
          const manifestPath = path.join(full, "MANIFEST.txt");
          let files: number | undefined;
          try {
            const manifest = await fs.readFile(manifestPath, "utf8");
            const m = manifest.match(/Total Files: (\d+)/);
            if (m) files = parseInt(m[1], 10);
          } catch {}
          const archiveExists = await fs
            .access(path.join(backupsDir, name + ".tar.gz"))
            .then(() => true)
            .catch(() => false);
          const parts = name.split("_");
          const ts = parts[1];
          const tag = parts.slice(2).join("_") || "ui";
          return { name, files, archived: archiveExists, timestamp: ts, tag };
        })
    );
    const backups = list
      .filter(Boolean)
      .sort((a, b) => (a!.name < b!.name ? 1 : -1));
    return NextResponse.json({ backups });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json(
      { error: err?.message || "List failed" },
      { status: 500 }
    );
  }
}
