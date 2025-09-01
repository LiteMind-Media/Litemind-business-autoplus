import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// SENTINEL: SCRIPT_BACKUP_API_V1

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const archive = !!body.archive;
    let tag: string = (body.tag || (archive ? "ui-arch" : "ui")) as string;
    tag = tag.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 32) || "ui";
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, "tools", "backup_snapshot.sh");
    try {
      await fs.access(scriptPath);
    } catch {
      return NextResponse.json(
        { error: "Backup script missing" },
        { status: 500 }
      );
    }
    const args = [scriptPath, "--tag", tag];
    if (archive) args.push("--archive");
    const started = Date.now();
    const output: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("bash", args, { cwd: projectRoot });
      proc.stdout.on("data", (d) => output.push(d.toString()));
      proc.stderr.on("data", (d) => output.push(d.toString()));
      proc.on("error", reject);
      proc.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Exit " + code))
      );
    });
    const durationMs = Date.now() - started;
    // Extract snapshot folder name from output line containing '[done]' or 'Creating snapshot'
    const doneLine = output.find((l) => l.includes("[done]")) || "";
    // Fallback parse: look for backups/snapshot_ lines
    const snapMatch = doneLine.match(/backups\/snapshot_[A-Za-z0-9T\-:_]+/); // may not catch tag with hyphen, fallback below
    let snapshot: string | null = null;
    if (snapMatch) {
      snapshot = path.basename(snapMatch[0]);
    } else {
      const createLine =
        output.find((l) => l.includes("Creating snapshot at")) || "";
      const clMatch = createLine.match(/backups\/snapshot_[^\s]+/);
      if (clMatch) snapshot = path.basename(clMatch[0]);
    }
    let files: number | undefined;
    let archived = false;
    if (snapshot) {
      const manifestPath = path.join(
        projectRoot,
        "backups",
        snapshot,
        "MANIFEST.txt"
      );
      try {
        const manifest = await fs.readFile(manifestPath, "utf8");
        const m = manifest.match(/Total Files: (\d+)/);
        if (m) files = parseInt(m[1], 10);
      } catch {
        /* ignore */
      }
      const archivePath = path.join(
        projectRoot,
        "backups",
        snapshot + ".tar.gz"
      );
      archived = await fs
        .access(archivePath)
        .then(() => true)
        .catch(() => false);
    }
    return NextResponse.json({
      success: true,
      archive,
      archived,
      tag,
      snapshot,
      files,
      durationMs,
      raw: output.join(""),
    });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json(
      { error: err?.message || "Backup failed" },
      { status: 500 }
    );
  }
}

// Delete a snapshot directory (and its archive) by name
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    if (!/^snapshot_[A-Za-z0-9_.\-]+$/.test(name))
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    const projectRoot = process.cwd();
    const backupsDir = path.join(projectRoot, "backups");
    const targetDir = path.join(backupsDir, name);
    // Safety: ensure targetDir is inside backupsDir
    if (!targetDir.startsWith(backupsDir))
      return NextResponse.json(
        { error: "Path traversal blocked" },
        { status: 400 }
      );
    const dirStat = await fs.lstat(targetDir).catch(() => null);
    if (!dirStat)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Remove directory
    await fs.rm(targetDir, { recursive: true, force: true });
    // Remove archive if exists
    const archivePath = targetDir + ".tar.gz";
    await fs.rm(archivePath, { force: true }).catch(() => {});
    return NextResponse.json({ deleted: name });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
