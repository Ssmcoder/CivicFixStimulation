import type {
  AdminUser,
  AuditLogEntry,
  CategoryKey,
  Complaint,
  ComplaintStatus,
  Department,
  EvidenceItem,
  FaqItem,
  Incident,
  InputSource,
  Jurisdiction,
  MatchCandidate,
  MlFeedbackEntry,
  PriorityWeights,
  SlaRule,
} from '../types/civic';
import { classifyText, severityAndSafety, stripPii } from '../services/classify';
import {
  validateCivicText,
  validateCoordinates,
  validateEvidenceFile,
} from '../services/civicValidator';
import { findMatches } from '../services/dedup';
import { GAZETTEER, resolveLocation, wardFor } from '../services/location';
import {
  bandFor,
  computePriority,
  deadlineFor,
  vulnerabilityFor,
} from '../services/priority';
import {
  CATEGORIES_ORDERED,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_SLA_RULES,
} from '../services/taxonomy';
import { canTransition, deriveIncidentStatus, isDeptPlus } from '../services/workflow';

const STORAGE_KEY = 'civicfix_360_state_v1';

export interface CivicState {
  departments: Department[];
  jurisdictions: Jurisdiction[];
  slaRules: SlaRule[];
  priorityWeights: PriorityWeights;
  faqs: FaqItem[];
  admins: AdminUser[];
  complaints: Complaint[];
  incidents: Incident[];
  auditLogs: AuditLogEntry[];
  mlFeedback: MlFeedbackEntry[];
  idCounter: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function trackingSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let out = 'cfx_';
  for (let i = 0; i < 24; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function createInitialState(): CivicState {
  const stateJur: Jurisdiction = {
    id: 'jur_state_odisha',
    level: 'state',
    name: 'Odisha',
    parent_id: null,
  };
  const distJur: Jurisdiction = {
    id: 'jur_dist_khordha',
    level: 'district',
    name: 'Khordha',
    parent_id: stateJur.id,
  };
  const muniJur: Jurisdiction = {
    id: 'jur_muni_bbsr',
    level: 'municipality',
    name: 'Bhubaneswar',
    parent_id: distJur.id,
  };

  const wardJurs: Jurisdiction[] = [
    { id: 'jur_ward_5', level: 'ward', name: 'Ward 5', parent_id: muniJur.id, min_lat: 20.23, max_lat: 20.26, min_lon: 85.8, max_lon: 85.83 },
    { id: 'jur_ward_6', level: 'ward', name: 'Ward 6', parent_id: muniJur.id, min_lat: 20.25, max_lat: 20.275, min_lon: 85.8, max_lon: 85.83 },
    { id: 'jur_ward_7', level: 'ward', name: 'Ward 7', parent_id: muniJur.id, min_lat: 20.265, max_lat: 20.29, min_lon: 85.8, max_lon: 85.83 },
    { id: 'jur_ward_8', level: 'ward', name: 'Ward 8', parent_id: muniJur.id, min_lat: 20.245, max_lat: 20.27, min_lon: 85.83, max_lon: 85.86 },
    { id: 'jur_ward_10', level: 'ward', name: 'Ward 10', parent_id: muniJur.id, min_lat: 20.28, max_lat: 20.305, min_lon: 85.83, max_lon: 85.86 },
    { id: 'jur_ward_12', level: 'ward', name: 'Ward 12', parent_id: muniJur.id, min_lat: 20.29, max_lat: 20.315, min_lon: 85.81, max_lon: 85.835 },
    { id: 'jur_ward_18', level: 'ward', name: 'Ward 18', parent_id: muniJur.id, min_lat: 20.305, max_lat: 20.33, min_lon: 85.825, max_lon: 85.855 },
  ];

  const jurisdictions = [stateJur, distJur, muniJur, ...wardJurs];

  const departments: Department[] = [
    {
      id: 'dept_roads',
      name: 'Road Maintenance',
      description: 'Potholes, asphalt repair, footpaths, and speed breakers',
      categories: ['roads'],
    },
    {
      id: 'dept_waste',
      name: 'Sanitation & Waste',
      description: 'Garbage collection, bin overflow, and street sweeping',
      categories: ['waste'],
    },
    {
      id: 'dept_drainage',
      name: 'Drainage & Waterlogging',
      description: 'Stormwater drains, desilting, and sewage blockages',
      categories: ['drainage'],
    },
    {
      id: 'dept_water',
      name: 'Water Supply',
      description: 'Pipeline leaks, water pressure, and tanker dispatch',
      categories: ['water'],
    },
    {
      id: 'dept_electricity',
      name: 'Electrical Services',
      description: 'Streetlights, poles, transformers, and overhead cables',
      categories: ['electricity'],
    },
    {
      id: 'dept_safety',
      name: 'Public Safety & Works',
      description: 'Exposed live wires, open manholes, and structural hazards',
      categories: ['public_safety', 'other'],
    },
  ];

  const slaRules: SlaRule[] = DEFAULT_SLA_RULES.map((r, idx) => ({
    id: `sla_${idx + 1}`,
    ...r,
  }));

  const faqs: FaqItem[] = [
    {
      id: 'faq_1',
      question: 'How do I report a problem?',
      answer:
        "Open CivicFix, tap 'Report a problem', describe the issue, confirm location, and submit. No login needed.",
      department: 'General',
    },
    {
      id: 'faq_2',
      question: 'How do I track my complaint?',
      answer:
        'Use the tracking ID and secret shown at submission, or ask the AI assistant.',
      department: 'General',
    },
    {
      id: 'faq_3',
      question: 'What do priority bands mean?',
      answer:
        'Computed from severity, safety risk, report count, waiting time and infrastructure vulnerability — all factors are shown.',
      department: 'General',
    },
    {
      id: 'faq_4',
      question: 'Why grouped with other complaints?',
      answer:
        'Similar text + nearby location + same category are grouped into one incident.',
      department: 'General',
    },
    {
      id: 'faq_5',
      question: 'Is my information private?',
      answer:
        'Contact details are optional and never public. You can report anonymously.',
      department: 'Privacy',
    },
    {
      id: 'faq_6',
      question: "What if it's not fixed?",
      answer:
        'After work is marked complete you can confirm or reopen — reopening alerts the department.',
      department: 'General',
    },
  ];

  const admins: AdminUser[] = [
    {
      id: 'adm_super',
      email: 'superadmin@civicfix.odisha.gov.in',
      username: 'superadmin',
      password: 'Admin@123456',
      full_name: 'Ananya Mohanty',
      role: 'super_admin',
      jurisdiction_id: stateJur.id,
      jurisdiction_name: 'Odisha (Statewide)',
      mfa_enabled: false,
    },
    {
      id: 'adm_muni',
      email: 'commissioner@bmc.odisha.gov.in',
      username: 'dept_head',
      password: 'Dept@123456',
      full_name: 'Debashis Patnaik',
      role: 'municipal_admin',
      jurisdiction_id: muniJur.id,
      jurisdiction_name: 'Bhubaneswar Municipal Corp',
      mfa_enabled: false,
    },
    {
      id: 'adm_ward12',
      email: 'ward12@bmc.odisha.gov.in',
      username: 'ward12_officer',
      password: 'Ward@123456',
      full_name: 'Subhashree Dash',
      role: 'ward_admin',
      jurisdiction_id: 'jur_ward_12',
      jurisdiction_name: 'Ward 12 (Central)',
      mfa_enabled: false,
    },
  ];

  const state: CivicState = {
    departments,
    jurisdictions,
    slaRules,
    priorityWeights: { ...DEFAULT_PRIORITY_WEIGHTS },
    faqs,
    admins,
    complaints: [],
    incidents: [],
    auditLogs: [],
    mlFeedback: [],
    idCounter: 0,
  };

  // Seed realistic Odisha / Bhubaneswar corpus from seed.py
  const seedScenes: Array<{
    desc: string;
    lang: string;
    catHint?: CategoryKey;
    landmark: string | null;
    ageDays: number;
    status: ComplaintStatus;
    source: InputSource;
    hasResolutionEvidence?: boolean;
  }> = [
    {
      desc: 'There is a huge pothole outside the engineering college gate and two-wheelers are almost falling',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Engineering College Gate',
      ageDays: 4,
      status: 'in_progress',
      source: 'form',
    },
    {
      desc: 'College gate ke paas bahut bada gaddha hai, bike waale gir rahe hain',
      lang: 'hinglish',
      catHint: 'roads',
      landmark: 'Engineering College Gate',
      ageDays: 3,
      status: 'in_progress',
      source: 'chat',
    },
    {
      desc: 'ଇଞ୍ଜିନିୟରିଂ କଲେଜ ଗେଟ୍ ପାଖରେ ବଡ଼ ଗାଡ଼ା ଅଛି, ବାଇକ୍ ପଡ଼ୁଛି',
      lang: 'odia',
      catHint: 'roads',
      landmark: 'Engineering College Gate',
      ageDays: 2,
      status: 'under_review',
      source: 'voice',
    },
    {
      desc: 'Road damaged near the market entrance, big hole troubling vehicles',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Main Market',
      ageDays: 6,
      status: 'awaiting_verification',
      source: 'form',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Big hole near the market, bikes and cars hitting it daily',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Main Market',
      ageDays: 5,
      status: 'awaiting_verification',
      source: 'qr',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Exposed live wires hanging near school boundary wall, children at risk',
      lang: 'en',
      catHint: 'public_safety',
      landmark: 'Engineering College Gate',
      ageDays: 2,
      status: 'inspection_scheduled',
      source: 'form',
    },
    {
      desc: 'Open manhole without cover near market, pedestrians falling risk',
      lang: 'en',
      catHint: 'public_safety',
      landmark: 'Main Market',
      ageDays: 3,
      status: 'in_progress',
      source: 'form',
    },
    {
      desc: 'Garbage bin overflowing near temple entrance for a week, smell unbearable',
      lang: 'en',
      catHint: 'waste',
      landmark: 'Lingaraj Temple',
      ageDays: 8,
      status: 'under_review',
      source: 'form',
    },
    {
      desc: 'Safai nahi ho rahi, kachra ka dher bus stand ke paas',
      lang: 'hinglish',
      catHint: 'waste',
      landmark: 'Bus Stand',
      ageDays: 5,
      status: 'closed',
      source: 'chat',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Choked drain near hospital causing waterlogging every monsoon',
      lang: 'en',
      catHint: 'drainage',
      landmark: 'Marichi Hospital',
      ageDays: 7,
      status: 'in_progress',
      source: 'form',
    },
    {
      desc: 'Drainage line broken near Rajbhavan, sewage smell everywhere',
      lang: 'en',
      catHint: 'drainage',
      landmark: 'Rajbhavan',
      ageDays: 4,
      status: 'awaiting_verification',
      source: 'form',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Pipe burst near master canteen, water flooding shopfronts',
      lang: 'en',
      catHint: 'water',
      landmark: 'Master Canteen',
      ageDays: 3,
      status: 'in_progress',
      source: 'form',
    },
    {
      desc: 'Pani nahi aa raha 3 din se, tank empty near airport colony',
      lang: 'hinglish',
      catHint: 'water',
      landmark: 'Biju Patnaik Airport',
      ageDays: 4,
      status: 'under_review',
      source: 'voice',
    },
    {
      desc: 'Streetlight broken near park entrance, dark and unsafe at night',
      lang: 'en',
      catHint: 'electricity',
      landmark: 'Bhatia Park',
      ageDays: 9,
      status: 'closed',
      source: 'form',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Transformer making loud noise near college, sparks at night',
      lang: 'en',
      catHint: 'electricity',
      landmark: 'Engineering College Gate',
      ageDays: 1,
      status: 'under_review',
      source: 'form',
    },
    {
      desc: 'Pothole near railway station crossing, autorickshaws swerving dangerously',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Railway Station',
      ageDays: 10,
      status: 'reopened',
      source: 'form',
    },
    {
      desc: 'Collapsed boundary wall near railway station, debris on tracks',
      lang: 'en',
      catHint: 'public_safety',
      landmark: 'Railway Station',
      ageDays: 2,
      status: 'in_progress',
      source: 'form',
    },
    {
      desc: 'Speed breaker broken near Gole Bazar, cars jolting',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Gole Bazar',
      ageDays: 12,
      status: 'closed',
      source: 'form',
      hasResolutionEvidence: true,
    },
    {
      desc: 'Footpath near Kalpana Square crumbled, pedestrians at risk',
      lang: 'en',
      catHint: 'roads',
      landmark: 'Kalpana Square',
      ageDays: 6,
      status: 'inspection_scheduled',
      source: 'form',
    },
    {
      desc: 'ରାସ୍ତାରେ ବଡ଼ ଗାଡ଼ା ଅଛି ମାର୍କେଟ୍ ପାଖରେ',
      lang: 'odia',
      catHint: 'roads',
      landmark: 'Main Market',
      ageDays: 3,
      status: 'under_review',
      source: 'voice',
    },
  ];

  seedScenes.forEach((s, idx) => {
    const gaz = s.landmark
      ? GAZETTEER.find((g) => g.name.toLowerCase() === s.landmark!.toLowerCase())
      : null;
    const createdDate = new Date(Date.now() - s.ageDays * 24 * 3600 * 1000);
    const createdIso = createdDate.toISOString();

    const { complaint } = submitComplaintToState(
      state,
      {
        description: s.desc,
        lat: gaz ? gaz.lat : null,
        lon: gaz ? gaz.lon : null,
        landmark_text: s.landmark,
        manual_location_confirmed: Boolean(gaz),
        language: s.lang,
        source: s.source,
        transcript: s.source === 'voice' ? s.desc : null,
        anonymous: idx % 5 === 0,
        category_override: s.catHint,
      },
      createdIso
    );

    complaint.status = s.status;
    if (s.status === 'closed' || s.status === 'resolved') {
      const resDate = new Date(createdDate.getTime() + 36 * 3600 * 1000);
      complaint.resolved_at = resDate.toISOString();
    }
    if (
      complaint.sla_deadline &&
      new Date(complaint.sla_deadline).getTime() < Date.now() &&
      !['resolved', 'closed', 'awaiting_verification'].includes(complaint.status)
    ) {
      complaint.sla_breached = true;
    }

    if (s.hasResolutionEvidence) {
      complaint.evidence.push({
        id: `ev_${uid()}`,
        complaint_id: complaint.id,
        kind: 'photo',
        name: `repair_completion_${complaint.public_id.toLowerCase()}.jpg`,
        mime: 'image/jpeg',
        size: 184320,
        caption: 'Field crew completed repair and cleared site',
        is_resolution: true,
        uploader_type: 'admin',
        marked_by: 'adm_muni',
        created_at: new Date().toISOString(),
      });
    }

    complaint.status_history.push({
      id: `sh_${uid()}`,
      from: 'under_review',
      to: s.status,
      actor: 'admin',
      actor_id: 'adm_muni',
      note: `Workflow updated to ${s.status.replace(/_/g, ' ')}`,
      at: new Date(createdDate.getTime() + 12 * 3600 * 1000).toISOString(),
    });
  });

  // Sync incident statuses from member complaints
  for (const inc of state.incidents) {
    const members = state.complaints.filter((c) => c.incident_id === inc.id);
    inc.status = deriveIncidentStatus(members.map((m) => m.status));
  }

  return state;
}

export function loadCivicState(): CivicState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CivicState;
      if (parsed && Array.isArray(parsed.complaints) && parsed.complaints.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const initial = createInitialState();
  saveCivicState(initial);
  return initial;
}

export function saveCivicState(state: CivicState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function resetCivicState(): CivicState {
  const initial = createInitialState();
  saveCivicState(initial);
  return initial;
}

export interface SubmitComplaintInput {
  description: string;
  lat?: number | null;
  lon?: number | null;
  landmark_text?: string | null;
  manual_location_confirmed?: boolean;
  language?: string;
  source?: InputSource;
  transcript?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  anonymous?: boolean;
  category_override?: CategoryKey | null;
  evidence_files?: Array<{
    name: string;
    mime: string;
    size: number;
    data_url?: string;
    caption?: string;
  }>;
}

export interface SubmitComplaintResult {
  complaint: Complaint;
  tracking_token: string;
  location_candidates: Array<{ name: string; lat: number; lon: number; ward: string }>;
  location_method: string;
  possible_duplicates: MatchCandidate[];
  review_reasons: string[];
}

export function submitComplaintToState(
  state: CivicState,
  input: SubmitComplaintInput,
  customCreatedAt?: string
): SubmitComplaintResult {
  const nowIso = customCreatedAt || new Date().toISOString();
  const text = (input.transcript || input.description || '').trim();

  // Strict Validation Gate: Reject fake, philosophical, trivia, or non-civic inputs
  const textValidation = validateCivicText(text, input.category_override);
  if (!textValidation.isValid) {
    throw new Error(
      `${textValidation.title}: ${textValidation.message}${
        textValidation.suggestedAction ? ` (${textValidation.suggestedAction})` : ''
      }`
    );
  }

  // Location Coordinate Validation
  const coordValidation = validateCoordinates(input.lat ?? null, input.lon ?? null);
  if (!coordValidation.isValid) {
    throw new Error(`Location Error: ${coordValidation.message}`);
  }

  // Evidence File Validation
  if (input.evidence_files && input.evidence_files.length > 0) {
    for (const file of input.evidence_files) {
      const fileValidation = validateEvidenceFile(file);
      if (!fileValidation.isValid) {
        throw new Error(`File Upload Error: ${fileValidation.message}`);
      }
    }
  }

  state.idCounter += 1;
  const year = new Date(nowIso).getFullYear();
  const public_id = `CFX-${year}-${String(state.idCounter).padStart(5, '0')}`;
  const tracking_token = trackingSecret();
  const complaintId = `cmp_${uid()}`;

  const cls = classifyText(text);
  const category: CategoryKey =
    input.category_override && CATEGORIES_ORDERED.includes(input.category_override)
      ? input.category_override
      : cls.category;

  if (input.category_override && input.category_override !== cls.category) {
    state.mlFeedback.push({
      id: `mlf_${uid()}`,
      complaint_id: complaintId,
      kind: 'citizen_override',
      input_text: stripPii(text),
      predicted_label: cls.category,
      confirmed_label: input.category_override,
      confidence: cls.confidence,
      created_at: nowIso,
    });
  }

  const sev = severityAndSafety(text);
  const loc = resolveLocation(
    text,
    input.lat ?? null,
    input.lon ?? null,
    Boolean(input.manual_location_confirmed)
  );

  const finalLat = loc.lat ?? input.lat ?? null;
  const finalLon = loc.lon ?? input.lon ?? null;
  const finalLandmark = input.landmark_text || loc.landmark_text || null;
  const wardName =
    loc.ward_name || (finalLat !== null && finalLon !== null ? wardFor(finalLat, finalLon) : null);

  const wardJur = wardName
    ? state.jurisdictions.find(
        (j) => j.level === 'ward' && j.name.toLowerCase() === wardName.toLowerCase()
      )
    : null;
  const muniJur = wardJur?.parent_id
    ? state.jurisdictions.find((j) => j.id === wardJur.parent_id)
    : state.jurisdictions.find((j) => j.level === 'municipality');
  const distJur = muniJur?.parent_id
    ? state.jurisdictions.find((j) => j.id === muniJur.parent_id)
    : state.jurisdictions.find((j) => j.level === 'district');

  const review_reasons: string[] = [];
  if (cls.confidence < 0.55 && !input.category_override) {
    review_reasons.push(`low classification confidence (${cls.confidence.toFixed(2)})`);
  }
  if (
    ['none', 'vague', 'landmark_ambiguous'].includes(loc.method) ||
    loc.confidence < 0.5
  ) {
    review_reasons.push(`location uncertain (${loc.method}, confidence ${loc.confidence.toFixed(2)})`);
  }

  // Duplicate detection
  const matches = findMatches({
    text,
    category,
    lat: finalLat,
    lon: finalLon,
    incidents: state.incidents,
    complaints: state.complaints,
  });

  let incidentId: string | null = null;
  let possible_duplicates: MatchCandidate[] = [];

  if (matches.length > 0 && matches[0].verdict === 'auto_link') {
    const bestInc = state.incidents.find((i) => i.id === matches[0].incident_id);
    if (bestInc) {
      incidentId = bestInc.id;
      bestInc.citizens_affected += 1;
      bestInc.updated_at = nowIso;
    }
  } else if (matches.length > 0) {
    possible_duplicates = matches.slice(0, 3);
    review_reasons.push('possible duplicate incident(s) need review');
  }

  const corroboration = incidentId
    ? state.complaints.filter((c) => c.incident_id === incidentId).length + 1
    : 1;
  const vuln = vulnerabilityFor(category, text);
  const prio = computePriority({
    severity_score: sev.severity_score,
    safety_risk: sev.safety_risk,
    corroboration,
    waiting_hours: 0,
    vulnerability: vuln,
    weights: state.priorityWeights,
  });

  const sla_deadline = deadlineFor(nowIso, category, prio.band, state.slaRules);
  const dept =
    state.departments.find((d) => d.categories.includes(category)) ||
    state.departments[0] ||
    null;

  const evidence: EvidenceItem[] = (input.evidence_files || []).map((f) => ({
    id: `ev_${uid()}`,
    complaint_id: complaintId,
    kind: 'photo',
    name: f.name,
    mime: f.mime,
    size: f.size,
    caption: f.caption || '',
    data_url: f.data_url,
    is_resolution: false,
    uploader_type: 'citizen',
    created_at: nowIso,
  }));

  const complaint: Complaint = {
    id: complaintId,
    public_id,
    tracking_token,
    description: input.description || text,
    transcript: input.transcript || null,
    language: input.language || 'en',
    source: input.source || 'form',
    category,
    issue_type: cls.issue_type,
    ai_category: cls.category,
    ai_confidence: cls.confidence,
    ai_explanation: cls.explanation,
    category_confirmed: Boolean(input.category_override),
    location: {
      lat: finalLat,
      lon: finalLon,
      landmark: finalLandmark,
      confidence: loc.confidence,
      verified: loc.verified,
      ward: wardJur?.name || wardName || null,
      district: distJur?.name || 'Khordha',
    },
    ward_id: wardJur?.id || null,
    district_id: distJur?.id || null,
    municipality_id: muniJur?.id || null,
    severity: sev.severity,
    severity_score: sev.severity_score,
    safety_risk: sev.safety_risk,
    priority_score: prio.score,
    priority_band: prio.band,
    priority_factors: prio.factors,
    department_id: dept?.id || null,
    sla_deadline,
    sla_breached: false,
    status: 'under_review',
    review_reason: review_reasons.length > 0 ? review_reasons.join('; ') : null,
    incident_id: incidentId,
    contact_phone: input.anonymous ? null : input.contact_phone || null,
    contact_email: input.anonymous ? null : input.contact_email || null,
    anonymous: Boolean(input.anonymous),
    created_at: nowIso,
    updated_at: nowIso,
    evidence,
    status_history: [
      {
        id: `sh_${uid()}`,
        from: '',
        to: 'under_review',
        actor: 'system',
        note: `Pipeline processed: classified (${category}), priority ${prio.band} (${prio.score})`,
        at: nowIso,
      },
    ],
  };

  state.complaints.unshift(complaint);

  if (!incidentId) {
    const cleanDesc = (complaint.description || '').trim().replace(/\s+/g, ' ');
    const title = cleanDesc.length > 80 ? `${cleanDesc.slice(0, 80)}…` : cleanDesc;
    const newInc: Incident = {
      id: `inc_${uid()}`,
      title,
      category: complaint.category,
      lat: complaint.location.lat,
      lon: complaint.location.lon,
      ward_id: complaint.ward_id,
      ward_name: complaint.location.ward,
      district_id: complaint.district_id,
      department_id: complaint.department_id,
      priority_score: complaint.priority_score,
      priority_band: complaint.priority_band,
      priority_factors: complaint.priority_factors,
      sla_deadline: complaint.sla_deadline,
      status: 'open',
      citizens_affected: 1,
      first_reported_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.incidents.unshift(newInc);
    complaint.incident_id = newInc.id;
  } else {
    refreshIncidentPriority(state, incidentId);
  }

  state.auditLogs.unshift({
    id: `aud_${uid()}`,
    admin_id: null,
    action: 'complaint.submitted',
    entity_type: 'complaint',
    entity_id: complaint.public_id,
    detail: JSON.stringify({ source: complaint.source, category: complaint.category }),
    created_at: nowIso,
  });

  return {
    complaint,
    tracking_token,
    location_candidates: loc.candidates,
    location_method: loc.method,
    possible_duplicates,
    review_reasons,
  };
}

export function refreshIncidentPriority(state: CivicState, incidentId: string): void {
  const inc = state.incidents.find((i) => i.id === incidentId);
  if (!inc) return;
  const members = state.complaints.filter((c) => c.incident_id === incidentId);
  if (members.length === 0) return;

  const count = members.length;
  const oldestMs = Math.min(...members.map((m) => new Date(m.created_at).getTime()));
  const waitingHours = Math.max(0, (Date.now() - oldestMs) / (3600 * 1000));
  const avgSev = members.reduce((acc, m) => acc + m.severity_score, 0) / count;
  const maxSafety = Math.max(...members.map((m) => m.safety_risk));
  const vuln = vulnerabilityFor(inc.category);

  const prio = computePriority({
    severity_score: avgSev,
    safety_risk: maxSafety,
    corroboration: count,
    waiting_hours: waitingHours,
    vulnerability: vuln,
    weights: state.priorityWeights,
  });

  inc.priority_score = prio.score;
  inc.priority_band = prio.band;
  inc.priority_factors = prio.factors;
  inc.citizens_affected = count;
  inc.updated_at = new Date().toISOString();
}

export function verifyComplaintFix(
  state: CivicState,
  complaintId: string,
  token: string,
  action: 'confirm' | 'reject',
  reason?: string
): { ok: boolean; error?: string; complaint?: Complaint } {
  const c = state.complaints.find(
    (item) =>
      (item.id === complaintId || item.public_id.toUpperCase() === complaintId.toUpperCase()) &&
      item.tracking_token === token
  );
  if (!c) {
    return { ok: false, error: 'Complaint not found or invalid tracking secret.' };
  }
  if (c.status !== 'awaiting_verification') {
    return {
      ok: false,
      error: `Complaint is currently '${c.status}', not awaiting verification.`,
    };
  }
  const nowIso = new Date().toISOString();
  const old = c.status;
  if (action === 'confirm') {
    c.status = 'closed';
    c.resolved_at = c.resolved_at || nowIso;
  } else {
    c.status = 'reopened';
  }
  c.updated_at = nowIso;
  c.status_history.push({
    id: `sh_${uid()}`,
    from: old,
    to: c.status,
    actor: 'citizen',
    note:
      action === 'confirm'
        ? 'Citizen confirmed the fix'
        : `Citizen rejected resolution: ${(reason || 'Issue persists').slice(0, 200)}`,
    at: nowIso,
  });

  if (c.incident_id) {
    const inc = state.incidents.find((i) => i.id === c.incident_id);
    if (inc) {
      const members = state.complaints.filter((m) => m.incident_id === inc.id);
      inc.status = deriveIncidentStatus(members.map((m) => m.status));
      if (inc.status === 'resolved') {
        inc.resolved_at = inc.resolved_at || nowIso;
      }
    }
  }

  state.auditLogs.unshift({
    id: `aud_${uid()}`,
    admin_id: null,
    action: `complaint.verify.${action}`,
    entity_type: 'complaint',
    entity_id: c.public_id,
    detail: JSON.stringify({ reason: reason || '' }),
    created_at: nowIso,
  });

  return { ok: true, complaint: c };
}

export function supportIncidentWithToken(
  state: CivicState,
  incidentId: string,
  token: string
): { ok: boolean; error?: string; citizens_affected?: number } {
  const c = state.complaints.find((item) => item.tracking_token === token.trim());
  if (!c) {
    return { ok: false, error: 'Invalid tracking secret. Submit a report first or enter your secret.' };
  }
  const inc = state.incidents.find((i) => i.id === incidentId);
  if (!inc) {
    return { ok: false, error: 'Incident not found.' };
  }
  if (c.incident_id === incidentId) {
    return { ok: true, citizens_affected: inc.citizens_affected };
  }
  const oldIncId = c.incident_id;
  c.incident_id = incidentId;
  c.updated_at = new Date().toISOString();
  c.status_history.push({
    id: `sh_${uid()}`,
    from: c.status,
    to: c.status,
    actor: 'citizen',
    note: "Citizen marked 'this affects me too' and linked to incident",
    at: c.updated_at,
  });

  if (oldIncId) {
    refreshIncidentPriority(state, oldIncId);
  }
  refreshIncidentPriority(state, incidentId);
  return { ok: true, citizens_affected: inc.citizens_affected };
}

export function adminUpdateComplaint(
  state: CivicState,
  admin: AdminUser,
  complaintId: string,
  patch: {
    status?: ComplaintStatus;
    category?: CategoryKey;
    department_id?: string;
    priority_override_score?: number;
    override_reason?: string;
    close_reason?: string;
    note?: string;
    resolution_evidence?: { name: string; caption: string; data_url?: string };
  }
): { ok: boolean; error?: string; complaint?: Complaint } {
  const c = state.complaints.find(
    (item) => item.id === complaintId || item.public_id === complaintId
  );
  if (!c) return { ok: false, error: 'Complaint not found' };

  const nowIso = new Date().toISOString();

  if (patch.department_id && patch.department_id !== c.department_id) {
    const dept = state.departments.find((d) => d.id === patch.department_id);
    if (!dept) return { ok: false, error: 'Department not found' };
    c.department_id = dept.id;
    if (c.status === 'received') c.status = 'under_review';
    c.status_history.push({
      id: `sh_${uid()}`,
      from: c.status,
      to: c.status,
      actor: 'admin',
      actor_id: admin.id,
      note: `Assigned to ${dept.name}${patch.note ? `: ${patch.note}` : ''}`,
      at: nowIso,
    });
  }

  if (patch.resolution_evidence) {
    c.evidence.push({
      id: `ev_${uid()}`,
      complaint_id: c.id,
      kind: 'photo',
      name: patch.resolution_evidence.name || 'resolution_proof.jpg',
      mime: 'image/jpeg',
      size: 142000,
      caption: patch.resolution_evidence.caption || 'Resolution evidence uploaded by admin',
      data_url: patch.resolution_evidence.data_url,
      is_resolution: true,
      uploader_type: 'admin',
      marked_by: admin.id,
      created_at: nowIso,
    });
  }

  if (patch.status && patch.status !== c.status) {
    if (!canTransition(c.status, patch.status, admin.role)) {
      return {
        ok: false,
        error: `Transition ${c.status} -> ${patch.status} is not permitted for ${admin.role}`,
      };
    }
    if (patch.status === 'awaiting_verification') {
      const hasRes = c.evidence.some((e) => e.is_resolution);
      if (!hasRes) {
        return {
          ok: false,
          error: 'Resolution evidence is required before moving to Awaiting Verification.',
        };
      }
    }
    if (patch.status === 'closed') {
      if (!isDeptPlus(admin.role)) {
        return { ok: false, error: 'Only department-level or higher admins can close.' };
      }
      if (!patch.close_reason?.trim()) {
        return { ok: false, error: 'A close reason is required.' };
      }
    }
    const old = c.status;
    c.status = patch.status;
    if (patch.status === 'closed' || patch.status === 'awaiting_verification') {
      c.resolved_at = c.resolved_at || nowIso;
    }
    c.status_history.push({
      id: `sh_${uid()}`,
      from: old,
      to: patch.status,
      actor: 'admin',
      actor_id: admin.id,
      note: patch.note || patch.close_reason || `Status updated to ${patch.status}`,
      at: nowIso,
    });
  }

  if (patch.category && patch.category !== c.category) {
    const old = c.category;
    c.category = patch.category;
    c.category_confirmed = true;
    state.mlFeedback.push({
      id: `mlf_${uid()}`,
      complaint_id: c.id,
      kind: 'category_correction',
      input_text: stripPii(c.description),
      predicted_label: old,
      confirmed_label: patch.category,
      confidence: c.ai_confidence,
      created_at: nowIso,
    });
  }

  if (patch.priority_override_score !== undefined) {
    if (!isDeptPlus(admin.role)) {
      return { ok: false, error: 'Priority override requires department-level role or higher.' };
    }
    if (!patch.override_reason?.trim()) {
      return { ok: false, error: 'Override reason is required.' };
    }
    c.priority_score = patch.priority_override_score;
    c.priority_band = bandFor(patch.priority_override_score);
    c.priority_override_reason = patch.override_reason.trim();
  }

  c.updated_at = nowIso;

  if (c.incident_id) {
    const inc = state.incidents.find((i) => i.id === c.incident_id);
    if (inc) {
      const members = state.complaints.filter((m) => m.incident_id === inc.id);
      inc.status = deriveIncidentStatus(members.map((m) => m.status));
    }
  }

  state.auditLogs.unshift({
    id: `aud_${uid()}`,
    admin_id: admin.id,
    admin_name: admin.full_name,
    action: 'complaint.update',
    entity_type: 'complaint',
    entity_id: c.public_id,
    detail: JSON.stringify(patch),
    created_at: nowIso,
  });

  return { ok: true, complaint: c };
}
