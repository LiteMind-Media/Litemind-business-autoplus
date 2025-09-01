"use client";
import { CheckCircle2, PhoneCall, UserCheck, Activity } from 'lucide-react';
import { Customer } from '@/types/customer';

export function ProgressBell({ customers }: { customers: Customer[] }) {
    const total = customers.length;
    const registered = customers.filter(c => c.finalStatus === 'Registered').length;
    const interested = customers.filter(c => c.firstCallStatus === 'Interested').length;
    const answered = customers.filter(c => c.firstCallStatus === 'Answered').length;
    return (
        <div className="flex items-center gap-3 px-3 h-10 rounded-full bg-white/60 backdrop-blur ring-1 ring-white/70 shadow-sm">
            <Stat icon={<Activity size={14} />} label="Total" value={total} />
            <Divider />
            <Stat icon={<PhoneCall size={14} />} label="Answered" value={answered} />
            <Divider />
            <Stat icon={<UserCheck size={14} />} label="Interested" value={interested} />
            <Divider />
            <Stat icon={<CheckCircle2 size={14} />} label="Reg" value={registered} highlight />
        </div>
    );
}
function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
    return (
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${highlight ? 'text-emerald-700' : 'text-amber-800'}`}> {icon} <span>{label}</span><span className={`px-1 rounded ${highlight ? 'bg-emerald-100/70' : 'bg-amber-100/60'} text-[10px]`}>{value}</span></div>
    );
}
function Divider() { return <div className="w-px h-5 bg-gradient-to-b from-amber-300/60 via-amber-400/40 to-amber-300/60" /> }
export default ProgressBell;
