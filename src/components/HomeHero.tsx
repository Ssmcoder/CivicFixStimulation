import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Clock,
  Cpu,
  MapPin,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import type { CivicState } from '../store/civicStore';

interface HomeHeroProps {
  state: CivicState;
  onSelectRole: (role: 'user' | 'official') => void;
  onQuickTrack: () => void;
}

export const HomeHero: React.FC<HomeHeroProps> = ({
  state,
  onSelectRole,
  onQuickTrack,
}) => {
  const totalReports = state.complaints.length;
  const resolvedCount = state.complaints.filter(
    (c) => c.status === 'resolved' || c.status === 'closed'
  ).length;
  const activeWardsCount = state.jurisdictions.filter((j) => j.level === 'ward').length;
  const citizensAffected = state.incidents.reduce(
    (acc, i) => acc + (i.citizens_affected || 1),
    0
  );

  return (
    <div className="space-y-12 py-4 md:py-8">
      {/* Central Welcome Hero matching user reference IMG_20261104_211822.jpg.jpeg */}
      <div className="mx-auto max-w-4xl text-center pt-2 sm:pt-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Welcome to <span className="text-emerald-500">Civic</span><span className="text-sky-600">Fix</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base font-normal text-slate-500 sm:text-lg">
          AI-Driven Civic Issue Reporting &amp; Resolution Platform
        </p>

        {/* Two Role Selection Cards */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {/* Card 1: Citizen */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-8 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0284c7] text-white shadow-xs">
                <User className="h-7 w-7" />
              </div>

              <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">I am a User</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                File civic complaints, pin issues on the live OpenFreeMap, and track resolution
              </p>
            </div>

            <div className="mt-8 space-y-2">
              <button
                type="button"
                onClick={() => onSelectRole('user')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors"
              >
                <span>I am a User</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Government Official */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-8 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#9333ea] to-[#ec4899] text-white shadow-xs">
                <Building2 className="h-7 w-7" />
              </div>

              <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
                I am a Government Official
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Manage and resolve civic issues across municipal wards in your jurisdiction
              </p>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => onSelectRole('official')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors"
              >
                <span>Official Portal</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onQuickTrack}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-400 hover:text-slate-900 transition-colors"
          >
            <span>Track Existing Complaint</span>
          </button>
        </div>
      </div>

      {/* Live Impact Stats Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div className="border-r border-slate-100 pr-4 last:border-none">
            <div className="flex items-center gap-2 text-slate-500">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium">Resolved Cases</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {resolvedCount} / {totalReports}
            </p>
            <p className="text-[11px] text-slate-500">Across all categories</p>
          </div>

          <div className="border-r border-slate-100 pr-4 last:border-none">
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium">Wards Monitored</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {activeWardsCount} Wards
            </p>
            <p className="text-[11px] text-slate-500">Bhubaneswar / Khordha</p>
          </div>

          <div className="border-r border-slate-100 pr-4 last:border-none">
            <div className="flex items-center gap-2 text-slate-500">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium">Citizens Supported</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {citizensAffected}
            </p>
            <p className="text-[11px] text-slate-500">Incident corroborated</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium">Critical SLA Target</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              24 Hours
            </p>
            <p className="text-[11px] text-slate-500">Auto-escalation enabled</p>
          </div>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-2xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Explainable Priority Triage
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Priority scores are calculated using a deterministic formula factoring in severity,
            public safety risks, corroboration count, waiting time, and infrastructure
            vulnerability. No black boxes.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-2xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Nearby Deduplication & Clustering
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Nearby reports with similar descriptions are automatically matched into grouped
            incidents. Citizens can vote "I am also affected" without flooding the department
            with duplicate tickets.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-2xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Citizen Verification Gate
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Officials cannot unilaterally close issues without photographic resolution
            evidence. Once fixed, citizens have the power to confirm or reopen the complaint
            if the fix was incomplete.
          </p>
        </div>
      </div>
    </div>
  );
};
