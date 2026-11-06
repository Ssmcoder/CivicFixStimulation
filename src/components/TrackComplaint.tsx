import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { CATEGORIES, STATUS_LABELS } from '../services/taxonomy';
import { CivicState, verifyComplaintFix } from '../store/civicStore';
import type { Complaint } from '../types/civic';
import { LiveLeafletMap } from './LiveLeafletMap';

interface TrackComplaintProps {
  state: CivicState;
  initialToken?: string;
  onStateChange: () => void;
}

export const TrackComplaint: React.FC<TrackComplaintProps> = ({
  state,
  initialToken = '',
  onStateChange,
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      setActiveToken(initialToken);
    }
  }, [initialToken]);

  const complaint: Complaint | undefined = activeToken
    ? state.complaints.find((c) => c.tracking_token === activeToken.trim())
    : undefined;

  const incident = complaint?.incident_id
    ? state.incidents.find((i) => i.id === complaint.incident_id)
    : undefined;

  const department = complaint?.department_id
    ? state.departments.find((d) => d.id === complaint.department_id)
    : undefined;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    setActiveToken(tokenInput.trim());
  };

  const handleVerify = (action: 'confirm' | 'reject') => {
    if (!complaint) return;
    if (action === 'reject' && !showRejectBox) {
      setShowRejectBox(true);
      return;
    }
    const res = verifyComplaintFix(
      state,
      complaint.id,
      complaint.tracking_token,
      action,
      rejectReason
    );
    if (res.ok) {
      onStateChange();
      setShowRejectBox(false);
      setRejectReason('');
      setFeedbackBanner({
        type: 'success',
        text:
          action === 'confirm'
            ? 'Thank you! You confirmed the fix and the complaint is now closed.'
            : 'Complaint reopened and escalated back to the municipal department.',
      });
    } else {
      setFeedbackBanner({
        type: 'error',
        text: res.error || 'Verification failed.',
      });
    }
  };

  // Sample complaints for quick demo testing (including awaiting_verification)
  const sampleComplaints = state.complaints.slice(0, 4);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Lookup Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Track & Verify Your Complaint
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your one-time tracking secret (<code className="font-mono">cfx_...</code>) to
          view live status, priority factors, SLA countdown, and verify completed work.
        </p>

        <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste tracking secret (e.g. cfx_...)"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 whitespace-nowrap shrink-0 transition-colors"
          >
            Look Up Status
          </button>
        </form>

        {/* Quick demo tokens */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            Demo quick-fill (click any seeded complaint to inspect):
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sampleComplaints.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setTokenInput(sc.tracking_token);
                  setActiveToken(sc.tracking_token);
                  setFeedbackBanner(null);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                <span className="font-mono font-semibold">{sc.public_id}</span> ·{' '}
                {STATUS_LABELS[sc.status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedbackBanner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedbackBanner.text}
        </div>
      )}

      {activeToken && !complaint && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            No Complaint Found
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Check that you pasted the full tracking secret (<code className="font-mono">cfx_...</code>).
          </p>
        </div>
      )}

      {complaint && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-900">
                  {complaint.public_id}
                </span>
                <span>·</span>
                <span>{CATEGORIES[complaint.category]}</span>
                <span>·</span>
                <span>{complaint.issue_type}</span>
              </div>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                {complaint.description}
              </h3>
            </div>
            <div className="text-right">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                  complaint.status === 'closed' || complaint.status === 'resolved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : complaint.status === 'awaiting_verification'
                    ? 'bg-amber-50 text-amber-800'
                    : complaint.status === 'reopened'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {STATUS_LABELS[complaint.status]}
              </span>
            </div>
          </div>

          {/* Citizen Verification Gate */}
          {complaint.status === 'awaiting_verification' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-5">
              <h4 className="text-sm font-bold text-amber-950">
                Action Required: Verify Completed Work
              </h4>
              <p className="mt-1 text-xs text-amber-900">
                The municipal department has marked this issue as resolved with evidence.
                Please confirm if the problem is fixed, or reopen it if work is incomplete.
              </p>

              {complaint.evidence.filter((e) => e.is_resolution).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {complaint.evidence
                    .filter((e) => e.is_resolution)
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700"
                      >
                        <span className="font-semibold">Resolution Proof:</span> {ev.name} —{' '}
                        {ev.caption}
                      </div>
                    ))}
                </div>
              )}

              {showRejectBox && (
                <div className="mt-3">
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why the issue is not fixed (e.g. pothole still open)..."
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleVerify('confirm')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Fix & Close
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify('reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {showRejectBox ? 'Submit Reopen Request' : 'Not Fixed — Reopen'}
                </button>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Priority</p>
              <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                {complaint.priority_band.toUpperCase()} ({complaint.priority_score})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Department</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {department?.name || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">SLA Deadline</p>
              <p
                className={`mt-1 font-mono text-xs font-semibold tabular-nums ${
                  complaint.sla_breached ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {complaint.sla_deadline
                  ? new Date(complaint.sla_deadline).toLocaleDateString()
                  : 'N/A'}
                {complaint.sla_breached ? ' (BREACHED)' : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Citizens Affected</p>
              <p className="mt-1 inline-flex items-center gap-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                <Users className="h-4 w-4 text-slate-400" />
                {incident?.citizens_affected || 1}
              </p>
            </div>
          </div>

          {/* Live Incident Location Map */}
          {incident?.lat !== null && incident?.lat !== undefined && incident?.lon !== null && incident?.lon !== undefined && (
            <div className="border-t border-slate-200 pt-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">
                Live Incident Map Location
              </h4>
              <LiveLeafletMap
                pinLat={incident.lat}
                pinLon={incident.lon}
                centerLat={incident.lat}
                centerLon={incident.lon}
                zoom={15}
                heightClass="h-56"
                interactive={false}
              />
            </div>
          )}

          {/* Explainable Priority Factors */}
          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Explainable Priority Score Breakdown
            </h4>
            <div className="mt-3 space-y-2">
              {Object.entries(complaint.priority_factors).map(([k, f]) => (
                <div
                  key={k}
                  className="flex items-center justify-between text-xs text-slate-700"
                >
                  <span>{f.plain}</span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    {f.score} × {f.weight} = +{f.contribution}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status History Timeline */}
          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-sm font-semibold text-slate-900">Status History</h4>
            <div className="mt-3 space-y-3">
              {complaint.status_history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start justify-between gap-4 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900">
                        {STATUS_LABELS[h.to as keyof typeof STATUS_LABELS] || h.to}
                      </span>{' '}
                      <span className="text-slate-500">({h.actor})</span>
                      {h.note && <p className="text-slate-600 mt-0.5">{h.note}</p>}
                    </div>
                  </div>
                  <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                    {new Date(h.at).toLocaleString()}
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
