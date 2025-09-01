import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

// SENTINEL: SCRIPT_BACKUP_DOWNLOAD_V1

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const name = searchParams.get('name');
		if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
		if (!/^snapshot_[A-Za-z0-9_.\-]+\.tar\.gz$/.test(name)) return NextResponse.json({ error: 'Invalid archive name' }, { status: 400 });
		const filePath = path.join(process.cwd(), 'backups', name);
		const stat = await fs.lstat(filePath).catch(() => null);
		if (!stat || !stat.isFile()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
		const stream = createReadStream(filePath);
		return new Response(stream as any, {
			headers: {
				'Content-Type': 'application/gzip',
				'Content-Disposition': `attachment; filename="${name}"`
			}
		});
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Download failed' }, { status: 500 });
	}
}

