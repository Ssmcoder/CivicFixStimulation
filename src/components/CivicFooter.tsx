import React from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  Heart,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  PhoneCall,
  RotateCcw,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

interface CivicFooterProps {
  onNavigate: (view: 'home' | 'report' | 'track' | 'admin') => void;
  onResetDemo: () => void;
  userRole?: 'user' | 'official' | null;
}

export const CivicFooter: React.FC<CivicFooterProps> = ({
  onNavigate,
  onResetDemo,
}) => {
  const sampleTags = [
    { tag: '#PotholeRepair', count: '48 reports' },
    { tag: '#StreetlightOutage', count: '32 reports' },
    { tag: '#WaterPipelineLeak', count: '19 reports' },
    { tag: '#SolidWasteManagement', count: '54 reports' },
    { tag: '#DrainageOverflow', count: '27 reports' },
    { tag: '#OpenManholeHazard', count: '8 critical' },
    { tag: '#CleanBhubaneswar', count: 'Civic Pride' },
    { tag: '#SmartGovernance', count: '5T Odisha' },
    { tag: '#GeoTaggedGrievance', count: 'Verified' },
    { tag: '#Ward12Patia', count: 'Active' },
    { tag: '#PublicSafetyFirst', count: 'Zero Compromise' },
    { tag: '#TransparentSLA', count: '24h Target' },
    { tag: '#ZeroDumpingZone', count: 'Swachh City' },
    { tag: '#MonsoonPreparedness', count: 'High Alert' },
  ];

  const emergencyHandles = [
    {
      title: 'Municipal Control Room',
      number: '1800-345-0033',
      subtitle: '24x7 Toll-Free BMC Grievance',
      icon: PhoneCall,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'WhatsApp Grievance Bot',
      number: '+91 94399 00100',
      subtitle: '@CivicFixWhatsApp (AI-Assisted)',
      icon: MessageCircle,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Water Supply (WATCO)',
      number: '155313',
      subtitle: 'Leakage & Contamination Hotline',
      icon: Zap,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
    {
      title: 'Power Grid Emergency',
      number: '1912',
      subtitle: 'TPCODL Fallen Wires & Outages',
      icon: AlertCircle,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Traffic & Obstruction',
      number: '1095 / 0674-2540105',
      subtitle: 'Bhubaneswar Traffic Police Cell',
      icon: MapPin,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Disaster Cell (ODRAF)',
      number: '1077 / 112',
      subtitle: 'Emergency Flood & Cyclone Relief',
      icon: Flame,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
  ];

  const socialHandles = [
    { name: 'X (Twitter)', handle: '@CivicFixHQ', link: 'https://twitter.com' },
    { name: 'Telegram Alerts', handle: 't.me/CivicFixAlerts', link: 'https://telegram.org' },
    { name: 'Official Portal', handle: 'civicfix.gov.in', link: '#' },
    { name: 'Instagram', handle: '@civicfix.city', link: 'https://instagram.com' },
    { name: 'Grievance Desk', handle: 'grievance@civicfix.gov.in', link: 'mailto:grievance@civicfix.gov.in' },
  ];

  return (
    <footer className="border-t border-slate-200/90 bg-slate-900 text-slate-300">
      {/* Slogan Banner Strip */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-sky-950/80 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Our Civic Mission &amp; Slogan</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                "Your City, Your Voice, Resolved Together."
              </h3>
              <p className="text-sm font-medium text-emerald-300/90 italic">
                "ସ୍ୱଚ୍ଛ ଓ ସୁନ୍ଦର ସହର — ପ୍ରତ୍ୟେକ ନାଗରିକଙ୍କ ଅଧିକାର"
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Empowering every citizen with transparent AI-driven civic triage, zero bureaucratic
                delays, and verifiable proof of resolution across municipal wards.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('report')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
              >
                <span>File a Complaint</span>
                <Send className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('track')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors"
              >
                <span>Track Status</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Body: Helping Handles, Tags, Links */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Column 1: Brand & Slogans & Handles (4 cols) */}
          <div className="space-y-5 md:col-span-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white font-display">
                Civic<span className="text-emerald-400">Fix</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              CivicFix is the unified public infrastructure governance platform. Designed strictly
              for municipal civic problem intake, explainable priority triage, automated incident
              deduplication, and citizen-verified issue resolution.
            </p>

            {/* Helping Slogans Pill Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Citizen Charter Motto
              </div>
              <p className="text-slate-300 font-medium text-xs">
                "Report · Corroborate · Resolve — Zero Slop, Real Public Action."
              </p>
              <p className="text-[11px] text-slate-400">
                Verified against municipal GIS and monitored under the 5T Citizen Governance
                Framework.
              </p>
            </div>

            {/* Social & Community Handles */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Official Helping Handles
              </span>
              <div className="flex flex-wrap gap-2">
                {socialHandles.map((h) => (
                  <a
                    key={h.name}
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    <span>{h.name}:</span>
                    <span className="font-mono text-emerald-400">{h.handle}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: 24/7 Helping Handles & Emergency Helplines (5 cols) */}
          <div className="space-y-4 md:col-span-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Emergency &amp; Citizen Helplines
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">Available 24x7</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {emergencyHandles.map((handle) => {
                const Icon = handle.icon;
                return (
                  <div
                    key={handle.title}
                    className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${handle.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-xs font-semibold text-slate-200 leading-tight">
                          {handle.title}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-sm font-bold text-white tracking-wide">
                        {handle.number}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 leading-tight">
                      {handle.subtitle}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 3: Quick Navigation & Services (3 cols) */}
          <div className="space-y-4 md:col-span-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Quick Services
            </span>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-emerald-400 transition-colors text-left"
                >
                  Home &amp; Role Selection
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('report')}
                  className="hover:text-emerald-400 transition-colors text-left font-medium text-emerald-300"
                >
                  File Complaint (No Login Needed)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-emerald-400 transition-colors text-left"
                >
                  Track &amp; Verify Resolution
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="hover:text-emerald-400 transition-colors text-left"
                >
                  Official Municipal Portal
                </button>
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Jurisdiction
              </span>
              <p className="text-xs text-slate-300">
                Bhubaneswar Municipal Corporation (BMC), Odisha, India. Wards 1 to 67.
              </p>
            </div>
          </div>
        </div>

        {/* Sample Tags Section */}
        <div className="mt-10 border-t border-slate-800 pt-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
            <Share2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Popular Civic Tags &amp; Trending Topics</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleTags.map((item) => (
              <span
                key={item.tag}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors cursor-default"
              >
                <span className="font-semibold text-emerald-400">{item.tag}</span>
                <span className="text-[10px] text-slate-500">· {item.count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Strip: Copyright, Demo Reset, Badges */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-6 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-400">CivicFix</span>
            <span>·</span>
            <span>Government of Odisha Civic Redressal Initiative</span>
            <span>·</span>
            <span>All rights reserved</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Demo Dataset</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
