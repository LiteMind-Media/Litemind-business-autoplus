"use client";

// Business Auto Plus Multi-Instance Manager Root Page
// Original Parlay Proz instance moved to /parlay-pros

import Link from 'next/link';
import { Plus, ExternalLink, FolderKanban, Users, Database, Settings, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { useInstances } from '@/hooks/useInstances';

// Legacy inline InstanceMeta replaced by shared types + hook

export default function BusinessAutoPlusRoot() {
  const { instances, createInstance } = useInstances();

  // Example: compute lead counts lazily (simple side-effect, could be moved to hook later)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Enrich instances with quick metric if missing (non-persistent for now)
  }, [instances]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 font-sans">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-black tracking-tight">
            <img src="/LiteMind%20Logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <span className="text-black leading-none">BUSINESS AUTO+</span>
          </h1>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-900 shadow">
              <Plus size={14} /> New Instance
            </button>
            <Link href="/parlay-pros" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold hover:bg-gray-50 shadow-sm">
              Go to Parlay Proz <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-10">
          <h2 className="text-lg font-bold tracking-tight text-gray-800 flex items-center gap-2"><FolderKanban size={18} className="text-gray-500" /> Instances</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">Manage and monitor all client workspaces. Each instance maintains its own leads, pipeline, and settings. This manager will evolve to include provisioning, suspension, usage metrics, and consolidated analytics.</p>
        </section>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {instances.map(inst => (
            <div key={inst.id} className="group relative rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-6 shadow-sm hover:shadow-md transition flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-gray-900 flex items-center gap-2">
                    <span>{inst.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Instance</span>
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{inst.slug === 'parlay-pros' ? 'Original lead management instance (migrated).' : inst.customDomain ? `Custom Domain: ${inst.customDomain}` : inst.subdomain ? `Subdomain: ${inst.subdomain}` : 'Provisioned workspace'}</p>
                </div>
                <Link href={`/${inst.slug}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-[11px] font-semibold hover:bg-gray-50 shadow-sm">
                  Open <ExternalLink size={14} />
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Metric label="Leads" value={inst.customerCount ?? 0} icon={<Database size={14} className='text-indigo-600' />} />
                <Metric label="Customers" value={(inst.customerCount ?? 0) / 2} icon={<Users size={14} className='text-emerald-600' />} />
                <Metric label="Status" value={1} icon={<Settings size={14} className='text-gray-600' />} formatter={() => 'Active'} />
              </div>
              <div className="mt-5 flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <span>ID:</span><span className="text-gray-700">{inst.id.slice(0, 8)}</span>
                <span className="ml-auto">Slug {inst.slug}</span>
              </div>
              <div className="absolute inset-0 rounded-2xl ring-1 ring-transparent group-hover:ring-black/5 pointer-events-none" />
            </div>
          ))}
          <button onClick={() => {
            const name = prompt('Instance name?');
            if (!name) return;
            try { createInstance({ name }); } catch (e: any) { alert(e.message); }
          }} className="rounded-2xl border-2 border-dashed border-gray-300 hover:border-black/50 bg-white/50 backdrop-blur p-6 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-black transition">
            <Plus size={24} />
            <span className="text-sm font-semibold">Create New Instance</span>
            <span className="text-[11px] text-gray-400">Provision isolated workspace</span>
          </button>
        </div>
        <section className="mt-14">
          <h2 className="text-lg font-bold tracking-tight text-gray-800 flex items-center gap-2"><Users size={18} className="text-gray-500" /> Roadmap</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <RoadmapItem title="Instance Provisioning" desc="Generate a new isolated workspace with default data schema." />
            <RoadmapItem title="Role-Based Access" desc="Owner / Admin / Agent roles per client instance." />
            <RoadmapItem title="Central Analytics" desc="Aggregate funnel & performance metrics across instances." />
            <RoadmapItem title="Usage Metering" desc="Track active leads, API calls, storage per instance." />
            <RoadmapItem title="Suspend / Archive" desc="Temporarily disable or archive inactive instances." />
            <RoadmapItem title="Custom Domains" desc="Map client subdomains (e.g., client.businessauto.plus)." />
          </ul>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, formatter }: { label: string; value: number; icon: React.ReactNode; formatter?: (v: number) => string }) {
  const display = formatter ? formatter(value) : value.toLocaleString();
  return (
    <div className="rounded-xl border border-gray-200 bg-white/60 p-3 flex flex-col items-center gap-1">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">{icon}</div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold text-gray-800 tabular-nums">{display}</div>
    </div>
  );
}

function RoadmapItem({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="rounded-xl border border-gray-200 bg-white/60 backdrop-blur p-4 flex flex-col gap-2 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 tracking-tight">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </li>
  );
}
