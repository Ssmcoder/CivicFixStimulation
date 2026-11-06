import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  Filter,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Map as MapIcon,
  Search,
  Shield,
  Sliders,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  CATEGORIES,
  CATEGORIES_ORDERED,
  CATEGORY_SHORT,
  PRIORITY_BANDS,
  ROLE_LABELS,
  STATUSES,
  STATUS_LABELS,
} from '../services/taxonomy';
import { allowedTargets, isDeptPlus } from '../services/workflow';
import { CivicState, adminUpdateComplaint } from '../store/civicStore';
import type {
  AdminUser,
  CategoryKey,
  Complaint,
  ComplaintStatus,
  PriorityBand,
  PriorityWeights,
} from '../types/civic';
import { LiveLeafletMap } from './LiveLeafletMap';

interface AdminPortalProps {
  state: CivicState;
  onStateChange: () => void;
}

type AdminTab = 'dashboard' | 'queue' | 'incidents' | 'governance';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  state,
  onStateChange,
}) => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityBand | 'ALL'>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'newest'>('priority');

  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [resEvidenceName, setResEvidenceName] = useState('site_repair_verified.jpg');
  const [resEvidenceCaption, setResEvidenceCaption] = useState(
    'Field crew completed repair and verified site safety'
  );
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [inspectorFeedback, setInspectorFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Jurisdiction-scoped complaints
  const scopedComplaints = useMemo(() => {
    if (!currentAdmin) return [];
    if (
      currentAdmin.role === 'super_admin' ||
      currentAdmin.role === 'state_admin' ||
      currentAdmin.role === 'district_admin' ||
      currentAdmin.role === 'municipal_admin'
    ) {
      return state.complaints;
    }
    return state.complaints.filter(
      (c) =>
        c.ward_id === currentAdmin.jurisdiction_id ||
        c.municipality_id === currentAdmin.jurisdiction_id
    );
  }, [currentAdmin, state.complaints]);

  const filteredComplaints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedComplaints
      .filter((c) => statusFilter === 'ALL' || c.status === statusFilter)
      .filter((c) => categoryFilter === 'ALL' || c.category === categoryFilter)
      .filter((c) => priorityFilter === 'ALL' || c.priority_band === priorityFilter)
      .filter((c) => !overdueOnly || c.sla_breached)
      .filter(
        (c) =>
          !q ||
          c.public_id.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.location.landmark || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sortBy === 'priority') return b.priority_score - a.priority_score;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [
    scopedComplaints,
    statusFilter,
    categoryFilter,
    priorityFilter,
    overdueOnly,
    searchQuery,
    sortBy,
  ]);

  const selectedComplaint: Complaint | undefined = useMemo(
    () => scopedComplaints.find((c) => c.id === selectedComplaintId),
    [scopedComplaints, selectedComplaintId]
  );

  // Dashboard aggregates
  const kpis = useMemo(() => {
    const total = scopedComplaints.length;
    const awaiting = scopedComplaints.filter(
      (c) => c.status === 'awaiting_verification'
    ).length;
    const resolved = scopedComplaints.filter(
      (c) => c.status === 'resolved' || c.status === 'closed'
    ).length;
    const inProgress = scopedComplaints.filter(
      (c) => c.status === 'in_progress' || c.status === 'inspection_scheduled'
    ).length;
    const underReview = scopedComplaints.filter(
      (c) => c.status === 'under_review' || c.status === 'received'
    ).length;
    const breaches = scopedComplaints.filter((c) => c.sla_breached).length;

    const byStatus: Record<string, number> = {};
    const byWard: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const c of scopedComplaints) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      const w = c.location.ward || 'Bhubaneswar Central';
      byWard[w] = (byWard[w] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    }

    return { total, awaiting, resolved, inProgress, underReview, breaches, byStatus, byWard, byCategory };
  }, [scopedComplaints]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const found = state.admins.find(
      (a) =>
        (a.username.toLowerCase() === username.trim().toLowerCase() ||
          a.email.toLowerCase() === username.trim().toLowerCase()) &&
        a.password === password
    );
    if (!found) {
      setLoginError('Invalid credentials. Use one of the demo official accounts below.');
      return;
    }
    setCurrentAdmin(found);
  };

  const handleStatusTransition = (target: ComplaintStatus) => {
    if (!currentAdmin || !selectedComplaint) return;
    setInspectorFeedback(null);

    const needsResEvidence =
      target === 'awaiting_verification' &&
      !selectedComplaint.evidence.some((e) => e.is_resolution);

    const res = adminUpdateComplaint(state, currentAdmin, selectedComplaint.id, {
      status: target,
      note: actionNote,
      close_reason: target === 'closed' ? closeReason : undefined,
      resolution_evidence: needsResEvidence
        ? { name: resEvidenceName, caption: resEvidenceCaption }
        : undefined,
    });

    if (res.ok) {
      onStateChange();
      setActionNote('');
      setCloseReason('');
      setInspectorFeedback({
        type: 'success',
        text: `Status updated to ${STATUS_LABELS[target]}.`,
      });
    } else {
      setInspectorFeedback({
        type: 'error',
        text: res.error || 'Transition failed.',
      });
    }
  };

  const handleAssignDept = (deptId: string) => {
    if (!currentAdmin || !selectedComplaint) return;
    const res = adminUpdateComplaint(state, currentAdmin, selectedComplaint.id, {
      department_id: deptId,
      note: 'Routed via municipal admin console',
    });
    if (res.ok) {
      onStateChange();
      setInspectorFeedback({ type: 'success', text: 'Department assigned.' });
    }
  };

  const handleCorrectCategory = (cat: CategoryKey) => {
    if (!currentAdmin || !selectedComplaint) return;
    const res = adminUpdateComplaint(state, currentAdmin, selectedComplaint.id, {
      category: cat,
    });
    if (res.ok) {
      onStateChange();
      setInspectorFeedback({
        type: 'success',
        text: `Category corrected to ${CATEGORY_SHORT[cat]} (logged for ML retraining).`,
      });
    }
  };

  const handlePriorityOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin || !selectedComplaint) return;
    const num = Number(overrideScore);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      setInspectorFeedback({
        type: 'error',
        text: 'Priority score must be between 0 and 100.',
      });
      return;
    }
    const res = adminUpdateComplaint(state, currentAdmin, selectedComplaint.id, {
      priority_override_score: num,
      override_reason: overrideReason,
    });
    if (res.ok) {
      onStateChange();
      setOverrideScore('');
      setOverrideReason('');
      setInspectorFeedback({
        type: 'success',
        text: `Priority score overridden to ${num}.`,
      });
    } else {
      setInspectorFeedback({
        type: 'error',
        text: res.error || 'Override failed.',
      });
    }
  };

  const handleWeightChange = (key: keyof PriorityWeights, val: number) => {
    if (!currentAdmin || currentAdmin.role !== 'super_admin') return;
    state.priorityWeights[key] = val;
    state.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.full_name,
      action: 'config.priority',
      entity_type: 'priority_config',
      entity_id: key,
      detail: JSON.stringify({ value: val }),
      created_at: new Date().toISOString(),
    });
    onStateChange();
  };

  if (!currentAdmin) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <Lock className="h-6 w-6" />
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Municipal Official Sign In
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to access jurisdiction-scoped grievance queues, SLA enforcement, and
            resolution workflows.
          </p>

          {loginError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Official Username or Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. superadmin, dept_head, ward12_officer"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              Sign In to Operations Console
            </button>
          </form>

          {/* Quick Pre-fills */}
          <div className="mt-8 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold text-slate-500">
              Demo Credentials (Click to load):
            </p>
            <div className="mt-3 space-y-2">
              {state.admins.map((adm) => (
                <button
                  key={adm.id}
                  type="button"
                  onClick={() => {
                    setUsername(adm.username);
                    setPassword(adm.password);
                    setLoginError(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-slate-100"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{adm.full_name}</span>
                    <span className="ml-2 font-mono text-slate-500">@{adm.username}</span>
                  </div>
                  <span className="font-medium text-emerald-700">
                    {ROLE_LABELS[adm.role]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* WealthWise-Inspired Modern Operations Shell Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
            {currentAdmin.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">{currentAdmin.full_name}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {ROLE_LABELS[currentAdmin.role]}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {currentAdmin.jurisdiction_name} · Scoped to {scopedComplaints.length} complaint(s)
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['dashboard', 'Dashboard', LayoutDashboard],
                ['queue', 'Complaint Queue', FileCheck],
                ['incidents', 'Spatial Incidents', MapIcon],
                ['governance', 'SLA & Governance', Sliders],
              ] as const
            ).map(([tabKey, label, Icon]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tabKey
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
                {tabKey === 'queue' && kpis.breaches > 0 && (
                  <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-700">
                    {kpis.breaches}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentAdmin(null);
              setSelectedComplaintId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD (WealthWise-Inspired Modern Operations Console) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Executive Top Row: Main Volume Metric & Radial AI Health Score */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Card 1: Total Civic Volume (WealthWise Net Worth Layout) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">Total Active Complaints</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <span>Today</span>
                      <ChevronRight className="h-3 w-3 rotate-90 text-slate-400" />
                    </span>
                    <button type="button" className="text-slate-400 hover:text-slate-600">
                      •••
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                    {kpis.total}
                  </span>
                  <span className="text-xs font-medium text-slate-500">tickets in jurisdiction</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-xs text-slate-500">Incoming (24h)</span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {kpis.underReview + kpis.inProgress}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        +4.8%
                      </span>
                    </div>
                  </div>

                  <div className="border-l border-slate-200 pl-6">
                    <span className="text-xs text-slate-500">Resolved (Verified)</span>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {kpis.resolved}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        +3.2%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sparkline Visual Comparison Columns (matching WealthWise bar visualization) */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-end justify-between gap-2 h-16 px-1">
                  {[
                    { day: 'Mon', inH: 35, outH: 20 },
                    { day: 'Tue', inH: 50, outH: 35 },
                    { day: 'Wed', inH: 40, outH: 45 },
                    { day: 'Thu', inH: 60, outH: 50 },
                    { day: 'Fri', inH: 45, outH: 55 },
                    { day: 'Sat', inH: 30, outH: 30 },
                    { day: 'Sun', inH: 25, outH: 20 },
                  ].map((bar, i) => (
                    <div key={bar.day} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="flex items-end gap-1 w-full justify-center h-12">
                        {/* Inflow bar */}
                        <div
                          className="w-2.5 rounded-full bg-slate-200"
                          style={{ height: `${bar.inH}%` }}
                          title={`Inflow: ${bar.inH}%`}
                        />
                        {/* Resolved bar */}
                        <div
                          className="w-2.5 rounded-full bg-[#0f766e]"
                          style={{ height: `${bar.outH}%` }}
                          title={`Resolved: ${bar.outH}%`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 2: AI Civic Health & SLA Score (WealthWise Radial Gauge Layout) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">AI Civic Health Score</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <span>Date</span>
                      <ChevronRight className="h-3 w-3 rotate-90 text-slate-400" />
                    </span>
                    <button type="button" className="text-slate-400 hover:text-slate-600">
                      •••
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-6">
                  {/* Radial Gauge */}
                  <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Background track */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                        strokeDasharray="4 4"
                        fill="none"
                      />
                      {/* Active gauge */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#0f766e"
                        strokeWidth="8"
                        strokeDasharray="4 4"
                        strokeDashoffset="75"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="font-mono text-2xl font-extrabold text-slate-900">88%</span>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">On Track</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs leading-relaxed text-slate-700 font-medium">
                      Bhubaneswar jurisdiction is on track to resolve critical tickets within SLA targets.
                    </p>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                        <span>0 Critical SLA breaches today</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                        <span>100% Explainable AI Priority triage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                        <span>Citizen sign-off gate enforced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Auto-escalation interval: 24h</span>
                <span className="font-mono text-teal-700 font-semibold">Khordha Division</span>
              </div>
            </div>
          </div>

          {/* Row 2: Resolution Flow Visualization & Net Spending Category Donut */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Resolution Flow Visualization (WealthWise Cash Flow Style) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Resolution Pipeline Flow
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live grievance flow across municipal intake, inspection, and verification stages
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                    <Filter className="h-3 w-3 text-slate-400" />
                    <span>Filter: All Wards</span>
                  </span>
                </div>
              </div>

              {/* Connected Visual Stage Flow */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>1. Triage / Review</span>
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {kpis.underReview}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Waiting for department routing</p>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>2. In Progress</span>
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {kpis.inProgress}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Field engineering active</p>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>3. Citizen Gate</span>
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-amber-600 tabular-nums">
                    {kpis.awaiting}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Awaiting citizen sign-off</p>
                </div>

                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>4. Closed &amp; Verified</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                    {kpis.resolved}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Evidence verified &amp; archived</p>
                </div>
              </div>

              {/* Progress Distribution Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Stage Distribution</span>
                  <span>{kpis.total} Total Grievances</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${kpis.total > 0 ? (kpis.underReview / kpis.total) * 100 : 0}%` }}
                    title={`Under Review: ${kpis.underReview}`}
                  />
                  <div
                    className="bg-indigo-500 transition-all"
                    style={{ width: `${kpis.total > 0 ? (kpis.inProgress / kpis.total) * 100 : 0}%` }}
                    title={`In Progress: ${kpis.inProgress}`}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{ width: `${kpis.total > 0 ? (kpis.awaiting / kpis.total) * 100 : 0}%` }}
                    title={`Awaiting Verification: ${kpis.awaiting}`}
                  />
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${kpis.total > 0 ? (kpis.resolved / kpis.total) * 100 : 0}%` }}
                    title={`Resolved: ${kpis.resolved}`}
                  />
                </div>
              </div>
            </div>

            {/* Right: Net Spending Category Donut (WealthWise Donut Layout) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Domain Allocation</h3>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    <span>Breakdown</span>
                  </span>
                </div>

                {/* Donut SVG visualization */}
                <div className="mt-4 flex items-center justify-center">
                  <div className="relative flex h-36 w-36 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Roads 45% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        stroke="#0f766e"
                        strokeWidth="16"
                        strokeDasharray="99 220"
                        strokeDashoffset="0"
                        fill="none"
                      />
                      {/* Safety 15% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        stroke="#10b981"
                        strokeWidth="16"
                        strokeDasharray="33 220"
                        strokeDashoffset="-99"
                        fill="none"
                      />
                      {/* Drainage 10% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        stroke="#0284c7"
                        strokeWidth="16"
                        strokeDasharray="22 220"
                        strokeDashoffset="-132"
                        fill="none"
                      />
                      {/* Waste 10% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        stroke="#f59e0b"
                        strokeWidth="16"
                        strokeDasharray="22 220"
                        strokeDashoffset="-154"
                        fill="none"
                      />
                      {/* Power & Water 20% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        stroke="#64748b"
                        strokeWidth="16"
                        strokeDasharray="44 220"
                        strokeDashoffset="-176"
                        fill="none"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="font-mono text-lg font-bold text-slate-900">{kpis.total}</span>
                      <p className="text-[10px] text-slate-400">Total Cases</p>
                    </div>
                  </div>
                </div>

                {/* Legend Chips */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                    <span>Roads (45%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Safety (15%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sky-600" />
                    <span>Drainage (10%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Waste (10%)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>View Full Queue Table</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Row 3: High Priority Urgent Action Queue (Directly on Dashboard) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Urgent Triage &amp; Action Required</h3>
                <p className="text-xs text-slate-500">
                  Critical and high-priority grievances requiring immediate field dispatch
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Open Full Queue ({filteredComplaints.length})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {filteredComplaints.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 rounded-xl px-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900">{c.public_id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-emerald-700">{CATEGORY_SHORT[c.category]}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{c.location.ward || 'Bhubaneswar Central'}</span>
                      {c.sla_breached && (
                        <span className="font-mono font-bold text-red-600 text-[10px]">BREACHED</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">{c.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        c.priority_band === 'critical'
                          ? 'text-red-600'
                          : c.priority_band === 'high'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {c.priority_band.toUpperCase()} ({c.priority_score})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedComplaintId(c.id);
                        setActiveTab('queue');
                      }}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Inspect &amp; Triage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: COMPLAINT QUEUE & WORKFLOW INSPECTOR */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Table / Feed */}
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Grievance Queue ({filteredComplaints.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Select any row to view explainable factors and advance workflow
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={(e) => setOverdueOnly(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Overdue Only</span>
                </label>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'priority' | 'newest')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
                >
                  <option value="priority">Priority: Highest</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter public ID, text…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ComplaintStatus | 'ALL')}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryKey | 'ALL')}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES_ORDERED.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_SHORT[c]}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityBand | 'ALL')}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="ALL">All Bands</option>
                {PRIORITY_BANDS.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Row List */}
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredComplaints.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No grievances found matching the current criteria.
                </div>
              ) : (
                filteredComplaints.map((c) => {
                  const isSelected = c.id === selectedComplaintId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedComplaintId(c.id);
                        setInspectorFeedback(null);
                      }}
                      className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors rounded-xl ${
                        isSelected ? 'bg-emerald-50/70 border border-emerald-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            {c.public_id}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-slate-700">
                            {CATEGORY_SHORT[c.category]}
                          </span>
                          {c.location.ward && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500">{c.location.ward}</span>
                            </>
                          )}
                          {c.sla_breached && (
                            <span className="font-mono font-bold text-red-600 text-[10px]">
                              BREACHED
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600 font-normal">
                          {c.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            c.priority_band === 'critical'
                              ? 'text-red-600'
                              : c.priority_band === 'high'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {c.priority_band.toUpperCase()} ({c.priority_score})
                        </span>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {STATUS_LABELS[c.status]}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Inspector Drawer */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-5">
            {!selectedComplaint ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-xs text-slate-400">
                <FileCheck className="h-8 w-8 text-slate-300" />
                <p className="mt-2 font-medium text-slate-700">Select a grievance to inspect</p>
                <p className="mt-1 text-slate-400">
                  Advance workflow, upload resolution evidence, or correct AI categorization.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {selectedComplaint.public_id}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                      {STATUS_LABELS[selectedComplaint.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800 leading-snug">
                    {selectedComplaint.description}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Location: {selectedComplaint.location.landmark || 'GPS Pin'} ·{' '}
                    {selectedComplaint.location.ward || 'Bhubaneswar Central'}
                  </p>
                </div>

                {inspectorFeedback && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      inspectorFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                  >
                    {inspectorFeedback.text}
                  </div>
                )}

                {/* Assigned Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Assigned Municipal Department
                  </label>
                  <select
                    value={selectedComplaint.department_id || ''}
                    onChange={(e) => handleAssignDept(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs"
                  >
                    {state.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Correction */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Category Correction (Supervised Feedback)
                  </label>
                  <select
                    value={selectedComplaint.category}
                    onChange={(e) => handleCorrectCategory(e.target.value as CategoryKey)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs"
                  >
                    {CATEGORIES_ORDERED.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORIES[c]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workflow Transitions */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Workflow Transitions
                    </span>
                    <span className="font-mono text-slate-400">
                      Role: {ROLE_LABELS[currentAdmin.role]}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Action note for audit trail…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />

                  {allowedTargets(selectedComplaint.status, currentAdmin.role).includes(
                    'awaiting_verification'
                  ) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                      <p className="text-xs font-bold text-amber-900">
                        Resolution Evidence (Mandatory Before Verification)
                      </p>
                      <input
                        type="text"
                        value={resEvidenceName}
                        onChange={(e) => setResEvidenceName(e.target.value)}
                        placeholder="Resolution photo filename"
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                      <input
                        type="text"
                        value={resEvidenceCaption}
                        onChange={(e) => setResEvidenceCaption(e.target.value)}
                        placeholder="Work completion notes"
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  )}

                  {allowedTargets(selectedComplaint.status, currentAdmin.role).includes('closed') && (
                    <input
                      type="text"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder="Mandatory administrative close reason…"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {allowedTargets(selectedComplaint.status, currentAdmin.role).length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No transitions permitted from "{STATUS_LABELS[selectedComplaint.status]}" for{' '}
                        {ROLE_LABELS[currentAdmin.role]}.
                      </p>
                    ) : (
                      allowedTargets(selectedComplaint.status, currentAdmin.role).map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => handleStatusTransition(target)}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          Advance to {STATUS_LABELS[target]}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Priority Override (Dept+ only) */}
                {isDeptPlus(currentAdmin.role) && (
                  <form
                    onSubmit={handlePriorityOverride}
                    className="space-y-2 border-t border-slate-100 pt-4"
                  >
                    <p className="text-xs font-semibold text-slate-900">
                      Emergency Priority Override (Current: {selectedComplaint.priority_score})
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={overrideScore}
                        onChange={(e) => setOverrideScore(e.target.value)}
                        placeholder="0–100"
                        className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 font-mono text-xs"
                      />
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Override justification…"
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
                      >
                        Override
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: SPATIAL INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">
              Spatial Incident Clustered Map ({state.incidents.length} Active Incidents)
            </h3>
            <p className="text-xs text-slate-500">
              Multi-report incidents grouped by text similarity & Haversine geo distance
            </p>
            <div className="mt-4">
              <LiveLeafletMap
                incidents={state.incidents
                  .filter((i) => i.lat !== null && i.lon !== null)
                  .map((i) => ({
                    id: i.id,
                    title: i.title,
                    category: i.category,
                    priority_band: i.priority_band,
                    priority_score: i.priority_score,
                    citizens_affected: i.citizens_affected,
                    lat: i.lat as number,
                    lon: i.lon as number,
                    ward_name: i.ward_name,
                  }))}
                heightClass="h-96"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Incident Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Ward</th>
                  <th className="px-4 py-3 font-semibold text-right">Citizens Affected</th>
                  <th className="px-4 py-3 font-semibold text-right">Priority Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{inc.title}</td>
                    <td className="px-4 py-3 text-slate-600">{CATEGORY_SHORT[inc.category]}</td>
                    <td className="px-4 py-3 text-slate-600">{inc.ward_name || 'Bhubaneswar'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {inc.citizens_affected}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {inc.priority_band.toUpperCase()} ({inc.priority_score})
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {inc.status.replace(/_/g, ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: SLA & GOVERNANCE */}
      {activeTab === 'governance' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Priority Weights */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Priority Formula Weights
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Formula: P = w_severity·S + w_safety·R + w_corroboration·C + w_waiting·T + w_vulnerability·V
            </p>
            <div className="mt-5 space-y-4">
              {(
                Object.entries(state.priorityWeights) as Array<
                  [keyof PriorityWeights, number]
                >
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono text-xs font-semibold text-slate-800">{k}</span>
                    <p className="text-[11px] text-slate-500">
                      {k === 'w_severity'
                        ? 'Weight for issue description severity cues'
                        : k === 'w_safety'
                        ? 'Weight for public electrocution/falling risks'
                        : k === 'w_corroboration'
                        ? 'Weight for multiple independent citizen reports'
                        : k === 'w_waiting'
                        ? 'Weight for hours elapsed since first report'
                        : 'Weight for proximity to schools/hospitals'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={currentAdmin.role !== 'super_admin'}
                      value={v}
                      onChange={(e) => handleWeightChange(k, Number(e.target.value))}
                      className="w-28 accent-emerald-600"
                    />
                    <span className="w-10 text-right font-mono text-xs font-bold tabular-nums">
                      {v.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLA Rules */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Configured SLA Targets</h3>
            <p className="text-xs text-slate-500">
              Municipal response and resolution targets per priority band
            </p>
            <table className="mt-5 w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="py-2.5 font-semibold">Priority Band</th>
                  <th className="py-2.5 font-semibold text-right">Target Deadline</th>
                  <th className="py-2.5 font-semibold text-right">Escalation Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.slaRules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 font-mono font-bold uppercase text-slate-900">
                      {r.priority_band}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-700">
                      {r.deadline_hours} Hours
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-700">
                      {r.escalation_hours} Hours
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit Logs */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-2">
            <h3 className="text-base font-bold text-slate-900">
              Immutable Municipal Audit Trail ({state.auditLogs.length} events)
            </h3>
            <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {state.auditLogs.slice(0, 30).map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-4 py-2.5 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-slate-900">{log.action}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-slate-700">
                      {log.entity_type} ({log.entity_id})
                    </span>
                    {log.admin_name && (
                      <span className="ml-2 text-slate-400">by {log.admin_name}</span>
                    )}
                  </div>
                  <span className="font-mono text-slate-400 tabular-nums shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
