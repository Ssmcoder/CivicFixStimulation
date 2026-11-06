export type CategoryKey =
  | 'roads'
  | 'waste'
  | 'drainage'
  | 'water'
  | 'electricity'
  | 'public_safety'
  | 'other';

export type ComplaintStatus =
  | 'received'
  | 'under_review'
  | 'inspection_scheduled'
  | 'in_progress'
  | 'awaiting_verification'
  | 'resolved'
  | 'reopened'
  | 'closed';

export type IncidentStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_verification'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export type AdminRole =
  | 'super_admin'
  | 'state_admin'
  | 'district_admin'
  | 'municipal_admin'
  | 'ward_admin';

export type InputSource = 'form' | 'chat' | 'voice' | 'qr' | 'api';

export interface PriorityFactor {
  score: number;
  weight: number;
  contribution: number;
  plain: string;
}

export interface PriorityBreakdown {
  score: number;
  band: PriorityBand;
  factors: {
    severity: PriorityFactor;
    safety_risk: PriorityFactor;
    corroboration: PriorityFactor;
    waiting: PriorityFactor;
    vulnerability: PriorityFactor;
  };
  weights: PriorityWeights;
  formula: string;
}

export interface PriorityWeights {
  w_severity: number;
  w_safety: number;
  w_corroboration: number;
  w_waiting: number;
  w_vulnerability: number;
}

export interface EvidenceItem {
  id: string;
  complaint_id: string;
  kind: 'photo' | 'video' | 'audio' | 'document';
  name: string;
  mime: string;
  size: number;
  caption: string;
  data_url?: string;
  is_resolution: boolean;
  uploader_type: 'citizen' | 'admin' | 'field_worker';
  marked_by?: string | null;
  created_at: string;
}

export interface StatusHistoryItem {
  id: string;
  from: string;
  to: string;
  actor: 'system' | 'admin' | 'citizen' | 'ai';
  actor_id?: string | null;
  note: string;
  at: string;
}

export interface ComplaintLocation {
  lat: number | null;
  lon: number | null;
  landmark: string | null;
  confidence: number;
  verified: boolean;
  ward?: string | null;
  district?: string | null;
}

export interface Complaint {
  id: string;
  public_id: string;
  tracking_token: string;
  description: string;
  transcript?: string | null;
  language: string;
  source: InputSource;
  category: CategoryKey;
  issue_type: string;
  ai_category: CategoryKey;
  ai_confidence: number;
  ai_explanation: string;
  category_confirmed: boolean;
  location: ComplaintLocation;
  ward_id: string | null;
  district_id: string | null;
  municipality_id: string | null;
  severity: 'high' | 'medium' | 'low';
  severity_score: number;
  safety_risk: number;
  priority_score: number;
  priority_band: PriorityBand;
  priority_factors: PriorityBreakdown['factors'];
  priority_override_reason?: string | null;
  department_id: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  status: ComplaintStatus;
  review_reason?: string | null;
  incident_id: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  anonymous: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  evidence: EvidenceItem[];
  status_history: StatusHistoryItem[];
}

export interface Incident {
  id: string;
  title: string;
  category: CategoryKey;
  lat: number | null;
  lon: number | null;
  ward_id: string | null;
  ward_name?: string | null;
  district_id: string | null;
  department_id: string | null;
  priority_score: number;
  priority_band: PriorityBand;
  priority_factors: PriorityBreakdown['factors'];
  sla_deadline: string | null;
  status: IncidentStatus;
  citizens_affected: number;
  first_reported_at: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentReportLink {
  id: string;
  incident_id: string;
  complaint_id: string;
  match_text_sim: number;
  match_geo_dist_m: number;
  match_evidence: Record<string, unknown>;
  link_type: 'auto' | 'reviewed' | 'manual' | 'citizen_confirmed' | 'citizen_denied';
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  categories: CategoryKey[];
}

export interface Jurisdiction {
  id: string;
  level: 'state' | 'district' | 'municipality' | 'ward';
  name: string;
  parent_id: string | null;
  min_lat?: number;
  max_lat?: number;
  min_lon?: number;
  max_lon?: number;
}

export interface SlaRule {
  id: string;
  category: CategoryKey | '*';
  priority_band: PriorityBand;
  deadline_hours: number;
  escalation_hours: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  password: string;
  full_name: string;
  role: AdminRole;
  jurisdiction_id: string | null;
  jurisdiction_name: string;
  mfa_enabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string | null;
  admin_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

export interface MlFeedbackEntry {
  id: string;
  complaint_id?: string | null;
  chat_message_id?: string | null;
  kind: string;
  input_text: string;
  predicted_label: string | null;
  confirmed_label: string | null;
  confidence?: number | null;
  created_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  department: string;
}

export interface LocationCandidate {
  name: string;
  lat: number;
  lon: number;
  ward: string;
}

export interface MatchCandidate {
  incident_id: string;
  incident_title: string;
  citizens_affected: number;
  status: IncidentStatus;
  score: number;
  verdict: 'auto_link' | 'review' | 'none';
  evidence: {
    text_similarity: number;
    geo_distance_m: number | null;
    geo_score: number;
    category_match: boolean;
    time_gap_hours: number;
    combined_score: number;
  };
}

export interface ChatCard {
  type: 'intake_start' | 'intake' | 'location_candidates' | 'complaint_created' | 'status' | 'suggestion' | 'nearby';
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  quick_replies?: string[];
  card?: ChatCard | null;
  scope?: 'civic' | 'out_of_scope' | 'unclear';
  feedback?: 1 | -1 | null;
  at: string;
}
