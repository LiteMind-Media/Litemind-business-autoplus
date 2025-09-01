"use client";
import { useState } from 'react';

interface FormState {
    name: string;
    phone: string;
    email: string;
    country: string;
}

const initial: FormState = { name: '', phone: '', email: '', country: '' };

export default function LeadCapturePage() {
    const [form, setForm] = useState<FormState>(initial);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const update = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true); setError(null); setSuccess(null);
        try {
            const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed');
            }
            const data = await res.json();
            if (data?.customer) {
                // Append to localStorage customers array so internal dashboard sees it immediately when opened in same browser profile.
                if (typeof window !== 'undefined') {
                    try {
                        const existing = JSON.parse(localStorage.getItem('customers') || '[]');
                        existing.push(data.customer);
                        localStorage.setItem('customers', JSON.stringify(existing));
                    } catch { }
                }
            }
            setSuccess('Thanks! Your info was received.');
            setForm(initial);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Submission failed';
            setError(message);
        } finally { setSubmitting(false); }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex flex-col">
            <div className="max-w-2xl mx-auto w-full px-6 py-12">
                <header className="mb-10 text-center">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-3">Join Parlay Proz Early Access</h1>
                    <p className="text-gray-600 max-w-lg mx-auto">Enter your details below for exclusive updates and a team member will reach out to help you get started.</p>
                </header>
                <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur rounded-2xl shadow-md border border-gray-200 p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Name" required>
                            <input required value={form.name} onChange={e => update('name', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Your full name" />
                        </Field>
                        <Field label="Phone" required>
                            <input required value={form.phone} onChange={e => update('phone', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="+1-555-123-4567" />
                        </Field>
                        <Field label="Email" required>
                            <input required type="email" value={form.email} onChange={e => update('email', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="you@example.com" />
                        </Field>
                        <Field label="Country" required>
                            <input required value={form.country} onChange={e => update('country', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Country" />
                        </Field>
                    </div>
                    <div className="pt-2">
                        <button disabled={submitting} className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow focus:outline-none focus:ring-4 focus:ring-indigo-400/40 transition">
                            {submitting ? 'Submitting...' : 'Request Access'}
                        </button>
                    </div>
                    {success && <div className="text-sm font-semibold text-emerald-600">{success}</div>}
                    {error && <div className="text-sm font-semibold text-red-600">{error}</div>}
                    <p className="text-[11px] text-gray-500">We respect your privacy. Submitting this form gives Parlay Proz permission to contact you about early access.</p>
                </form>
            </div>
            <footer className="mt-auto py-6 text-center text-xs text-gray-400">© {new Date().getFullYear()} Parlay Proz. All rights reserved.</footer>
        </main>
    );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block space-y-2 text-sm font-medium text-gray-700">
            <span className="flex items-center gap-1">{label}{required && <span className="text-red-500">*</span>}</span>
            {children}
        </label>
    );
}
