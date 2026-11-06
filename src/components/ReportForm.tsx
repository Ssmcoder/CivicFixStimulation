import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Crosshair,
  FileUp,
  MapPin,
  Mic,
  MicOff,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { classifyText, severityAndSafety } from '../services/classify';
import {
  validateCivicText,
  validateCoordinates,
  validateEvidenceFile,
} from '../services/civicValidator';
import { findMatches } from '../services/dedup';
import { GAZETTEER, resolveLocation, wardFor } from '../services/location';
import { CATEGORIES, CATEGORIES_ORDERED } from '../services/taxonomy';
import {
  CivicState,
  SubmitComplaintResult,
  submitComplaintToState,
} from '../store/civicStore';
import type { CategoryKey, InputSource } from '../types/civic';
import { LiveLeafletMap } from './LiveLeafletMap';

interface ReportFormProps {
  state: CivicState;
  onStateChange: () => void;
  onTrackToken: (token: string) => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  state,
  onStateChange,
  onTrackToken,
}) => {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'en' | 'hinglish' | 'odia'>('en');
  const [source, setSource] = useState<InputSource>('form');
  const [categoryOverride, setCategoryOverride] = useState<CategoryKey | ''>('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [landmarkText, setLandmarkText] = useState('');
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<
    Array<{ name: string; mime: string; size: number; data_url?: string }>
  >([]);
  const [isListening, setIsListening] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitComplaintResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Strict Civic Validation Memo
  const textValidation = useMemo(
    () => validateCivicText(description),
    [description]
  );

  // Live AI triage preview
  const liveTriage = useMemo(() => {
    if (description.trim().length < 3) return null;
    if (!textValidation.isValid) return null;
    const cls = classifyText(description);
    const sev = severityAndSafety(description);
    const loc = resolveLocation(
      `${description} ${landmarkText}`,
      lat,
      lon,
      manualConfirmed
    );
    const effectiveCat = (categoryOverride || cls.category) as CategoryKey;
    const matches = findMatches({
      text: description,
      category: effectiveCat,
      lat: loc.lat ?? lat,
      lon: loc.lon ?? lon,
      incidents: state.incidents,
      complaints: state.complaints,
    });
    return { cls, sev, loc, matches };
  }, [description, textValidation.isValid, landmarkText, lat, lon, manualConfirmed, categoryOverride, state.incidents, state.complaints]);

  const handleUseGps = () => {
    setErrorMsg(null);
    if (!navigator.geolocation) {
      // Fallback to Bhubaneswar center if geolocation unavailable
      setLat(20.2969);
      setLon(85.8242);
      setManualConfirmed(true);
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setLon(Math.round(pos.coords.longitude * 10000) / 10000);
        setManualConfirmed(true);
        setGpsLoading(false);
      },
      () => {
        // Fallback to Bhubaneswar Engineering College Gate for demo convenience
        setLat(20.2969);
        setLon(85.8242);
        setLandmarkText('Engineering College Gate');
        setManualConfirmed(true);
        setGpsLoading(false);
      },
      { timeout: 5000 }
    );
  };

  const handleVoiceToggle = () => {
    interface ISpeechRecognitionEvent {
      results: { [index: number]: { [index: number]: { transcript: string } } };
    }
    interface ISpeechRecognition {
      lang: string;
      interimResults: boolean;
      onresult: ((event: ISpeechRecognitionEvent) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSource('voice');
      setDescription((prev) =>
        prev
          ? prev
          : 'There is a huge pothole outside the engineering college gate and two-wheelers are almost falling'
      );
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language === 'odia' ? 'or-IN' : language === 'hinglish' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setSource('voice');
      setIsListening(false);
      // Immediate voice validation feedback
      const voiceCheck = validateCivicText(transcript);
      if (!voiceCheck.isValid) {
        setErrorMsg(`Voice Input Blocked: ${voiceCheck.title} — ${voiceCheck.message}`);
      } else {
        setErrorMsg(null);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []);
    if (evidenceFiles.length + files.length > 5) {
      setErrorMsg('Maximum 5 evidence files allowed per complaint.');
      return;
    }
    for (const file of files) {
      const fileVal = validateEvidenceFile({
        name: file.name,
        size: file.size,
        mime: file.type || 'image/jpeg',
      });
      if (!fileVal.isValid) {
        setErrorMsg(fileVal.message || 'Invalid evidence file.');
        return;
      }
    }
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setEvidenceFiles((prev) => [
          ...prev,
          {
            name: file.name,
            mime: file.type || 'image/jpeg',
            size: file.size,
            data_url: typeof reader.result === 'string' ? reader.result : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Strict Description Validation
    const val = validateCivicText(description);
    if (!val.isValid) {
      setErrorMsg(`${val.title}: ${val.message}`);
      return;
    }

    // 2. Coordinate Validation
    const coordVal = validateCoordinates(lat, lon);
    if (!coordVal.isValid) {
      setErrorMsg(coordVal.message || 'Invalid location coordinates.');
      return;
    }

    try {
      const result = submitComplaintToState(state, {
        description: description.trim(),
        lat,
        lon,
        landmark_text: landmarkText.trim() || null,
        manual_location_confirmed: manualConfirmed,
        language,
        source,
        transcript: source === 'voice' ? description.trim() : null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        anonymous,
        category_override: categoryOverride || null,
        evidence_files: evidenceFiles,
      });

      onStateChange();
      setSubmitted(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register complaint.';
      setErrorMsg(msg);
    }
  };

  const handleResetForm = () => {
    setSubmitted(null);
    setDescription('');
    setCategoryOverride('');
    setLat(null);
    setLon(null);
    setLandmarkText('');
    setManualConfirmed(false);
    setEvidenceFiles([]);
    setCopiedToken(false);
  };

  if (submitted) {
    const c = submitted.complaint;
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-emerald-700">Complaint Registered</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {c.public_id} — {CATEGORIES[c.category]}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Your report has been triaged, routed to the responsible municipal department, and
              queued for review.
            </p>
          </div>
        </div>

        {/* One-time Tracking Secret */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-900">
                One-Time Tracking Secret (Save Now)
              </p>
              <p className="text-xs text-amber-800">
                Anyone with the Public ID alone cannot view your details. Keep this secret to
                track status or verify the fix.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(submitted.tracking_token);
                setCopiedToken(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedToken ? 'Copied' : 'Copy Secret'}
            </button>
          </div>
          <div className="mt-2.5 rounded bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-900 select-all border border-amber-200">
            {submitted.tracking_token}
          </div>
        </div>

        {/* Triage & Priority Summary */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Priority Band & Score</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {c.priority_band.toUpperCase()} · {c.priority_score}/100
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Assigned Department</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {state.departments.find((d) => d.id === c.department_id)?.name || 'General Works'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">SLA Target Deadline</p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900 tabular-nums">
              {c.sla_deadline ? new Date(c.sla_deadline).toLocaleString() : 'Standard 7d'}
            </p>
          </div>
        </div>

        {/* Explainable Priority Factors */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Explainable Priority Breakdown
          </h3>
          <div className="mt-3 space-y-2">
            {Object.entries(c.priority_factors).map(([key, f]) => (
              <div
                key={key}
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={handleResetForm}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            File Another Complaint
          </button>
          <button
            type="button"
            onClick={() => onTrackToken(submitted.tracking_token)}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            Track This Complaint
          </button>
        </div>
      </div>
    );
  }

  const currentWard = lat !== null && lon !== null ? wardFor(lat, lon) : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Main Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-xs lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">File a Civic Complaint</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              No login required. Instant AI triage across English, Hinglish, and Odia.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['en', 'hinglish', 'odia'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  language === lang
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'en' ? 'English' : lang === 'hinglish' ? 'Hinglish' : 'Odia'}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Description + Voice */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="desc" className="block text-sm font-medium text-slate-900">
              Problem Description
            </label>
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isListening
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" /> Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" /> Voice Input
                </>
              )}
            </button>
          </div>
          <textarea
            id="desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened, how severe it is, and any nearby landmark (e.g. 'Huge pothole outside Engineering College Gate, two-wheelers falling')..."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              'Huge pothole outside Engineering College Gate, two-wheelers falling',
              'Exposed live wires hanging near Main Market school gate',
              'Garbage bin overflowing near Lingaraj Temple entrance',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setDescription(sample)}
                className="text-xs text-blue-600 hover:underline text-left"
              >
                Try: "{sample.slice(0, 42)}…"
              </button>
            ))}
          </div>

          {/* Strict Civic Validation Feedback */}
          {description.trim().length > 0 && !textValidation.isValid && (
            <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50/95 p-4 text-rose-950 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm text-rose-900">
                      {textValidation.title}
                    </span>
                    <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-rose-900">
                      Submission Blocked
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-rose-800">
                    {textValidation.message}
                  </p>
                  {textValidation.suggestedAction && (
                    <div className="mt-2.5 rounded-lg border border-rose-200 bg-white/80 p-2.5 text-xs text-rose-900">
                      <span className="font-semibold">CivicFix Purpose: </span>
                      <span>{textValidation.suggestedAction}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {description.trim().length >= 8 && textValidation.isValid && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-800 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Verified Civic Problem:</span>
                <span className="text-emerald-700">{textValidation.message}</span>
              </div>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                ELIGIBLE
              </span>
            </div>
          )}
        </div>

        {/* Category Override */}
        <div>
          <label htmlFor="cat" className="block text-sm font-medium text-slate-900">
            Category (Auto-detected, or override)
          </label>
          <select
            id="cat"
            value={categoryOverride}
            onChange={(e) => setCategoryOverride(e.target.value as CategoryKey | '')}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="">
              Auto-detect{' '}
              {liveTriage ? `(${CATEGORIES[liveTriage.cls.category]})` : 'from description'}
            </option>
            {CATEGORIES_ORDERED.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORIES[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-900">
              Location & Ward Pin
            </label>
            <button
              type="button"
              onClick={handleUseGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Crosshair className="h-3.5 w-3.5 text-blue-600" />
              {gpsLoading ? 'Locating…' : 'Use My GPS'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <input
                type="text"
                value={landmarkText}
                onChange={(e) => setLandmarkText(e.target.value)}
                placeholder="Landmark (e.g. Main Market, Bus Stand)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <select
                value=""
                onChange={(e) => {
                  const g = GAZETTEER.find((item) => item.name === e.target.value);
                  if (g) {
                    setLat(g.lat);
                    setLon(g.lon);
                    setLandmarkText(g.name);
                    setManualConfirmed(true);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Quick-pick Bhubaneswar landmark…</option>
                {GAZETTEER.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.ward})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <LiveLeafletMap
            pinLat={lat}
            pinLon={lon}
            draggablePin={true}
            onPinChange={(newLat, newLon) => {
              setLat(newLat);
              setLon(newLon);
              setManualConfirmed(true);
            }}
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
            heightClass="h-72"
          />

          {lat !== null && lon !== null && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                {lat.toFixed(4)}, {lon.toFixed(4)}
                {currentWard ? ` · ${currentWard}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLat(null);
                  setLon(null);
                  setManualConfirmed(false);
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Clear pin
              </button>
            </div>
          )}
        </div>

        {/* Evidence Upload */}
        <div className="border-t border-slate-200 pt-5">
          <label className="block text-sm font-medium text-slate-900">
            Photo Evidence (Optional, up to 5)
          </label>
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <FileUp className="h-4 w-4 text-slate-500" />
              Attach Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <span className="text-xs text-slate-500">
              {evidenceFiles.length} file(s) attached
            </span>
          </div>
          {evidenceFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                >
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional Private Contact */}
        <div className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">
              Contact Details (Optional & Private)
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              Submit Anonymously
            </label>
          </div>
          {!anonymous && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone (e.g. +919876543210)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={description.trim().length > 0 && !textValidation.isValid}
            className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
              description.trim().length > 0 && !textValidation.isValid
                ? 'bg-rose-100 border border-rose-300 text-rose-800 cursor-not-allowed opacity-90'
                : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99]'
            }`}
          >
            {description.trim().length > 0 && !textValidation.isValid
              ? 'Submission Capped & Blocked: Non-Civic Input'
              : 'File Civic Complaint'}
          </button>
        </div>
      </form>

      {/* Right Column: Live AI Triage & Duplicate Check */}
      <div className="space-y-6 lg:col-span-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              Live Triage &amp; Deduplication
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Deterministic classification, safety risk scoring, and nearby incident matching
            update as you type.
          </p>

          {description.trim().length > 0 && !textValidation.isValid ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/70 p-6 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-rose-500" />
              <h4 className="mt-2 text-sm font-bold text-rose-900">
                Triage Suspended: Input Capped
              </h4>
              <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                CivicFix is strictly for public infrastructure and municipal problems. Questions like "why am i a boy" or general trivia cannot be triaged or queued for municipal departments.
              </p>
            </div>
          ) : !liveTriage ? (
            <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Start typing a problem description on the left to preview AI category
              classification, severity, and duplicate matches.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-500">Detected Category</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {CATEGORIES[categoryOverride || liveTriage.cls.category]}
                  </p>
                  <p className="font-mono text-xs text-slate-500 tabular-nums">
                    Confidence: {(liveTriage.cls.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Issue Type</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {liveTriage.cls.issue_type}
                  </p>
                  <p className="font-mono text-xs text-slate-500 tabular-nums">
                    Severity: {liveTriage.sev.severity.toUpperCase()} (
                    {liveTriage.sev.severity_score}/100)
                  </p>
                </div>
              </div>

              {liveTriage.sev.safety_risk >= 40 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">High Public-Safety Risk Detected:</span>{' '}
                    If anyone is in immediate danger, call 112.
                  </div>
                </div>
              )}

              {/* Location candidates */}
              {liveTriage.loc.candidates.length > 0 && lat === null && (
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-medium text-slate-700">
                    Suggested Landmarks (Click to confirm):
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {liveTriage.loc.candidates.map((cand) => (
                      <button
                        key={cand.name}
                        type="button"
                        onClick={() => {
                          setLat(cand.lat);
                          setLon(cand.lon);
                          setLandmarkText(cand.name);
                          setManualConfirmed(true);
                        }}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                      >
                        {cand.name} · {cand.ward}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Possible Duplicates */}
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Similar Open Incidents ({liveTriage.matches.length})
                </p>
                {liveTriage.matches.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    No matching open incidents found — a new incident will be created.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {liveTriage.matches.map((m) => (
                      <div
                        key={m.incident_id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {m.incident_title}
                          </span>
                          <span className="font-mono text-blue-700 shrink-0 tabular-nums">
                            {(m.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 tabular-nums">
                          {m.citizens_affected} citizen(s) affected ·{' '}
                          {m.verdict === 'auto_link'
                            ? 'Will auto-link on submit'
                            : 'Flagged for review'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
