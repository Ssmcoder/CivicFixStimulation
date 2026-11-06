import type {
  AdminRole,
  CategoryKey,
  ComplaintStatus,
  IncidentStatus,
  PriorityBand,
  PriorityWeights,
} from '../types/civic';

export const CATEGORIES: Record<CategoryKey, string> = {
  roads: 'Roads (potholes, broken roads)',
  waste: 'Waste (garbage overflow, missed collection)',
  drainage: 'Drainage (blocked drains, waterlogging)',
  water: 'Water supply (leakage, no water)',
  electricity: 'Electricity (streetlights, poles, wires)',
  public_safety: 'Public safety (exposed wires, dangerous infrastructure)',
  other: 'Other municipal issue',
};

export const CATEGORY_SHORT: Record<CategoryKey, string> = {
  roads: 'Roads',
  waste: 'Waste',
  drainage: 'Drainage',
  water: 'Water Supply',
  electricity: 'Electricity',
  public_safety: 'Public Safety',
  other: 'Other',
};

export const CATEGORIES_ORDERED: CategoryKey[] = [
  'roads',
  'waste',
  'drainage',
  'water',
  'electricity',
  'public_safety',
  'other',
];

export const ISSUE_KEYWORDS: Record<Exclude<CategoryKey, 'other'>, string[]> = {
  roads: [
    'pothole',
    'road',
    'street',
    'asphalt',
    'crack',
    'hole',
    'broken road',
    'speed breaker',
    'footpath',
    'koliba',
    'sadak',
    'galli',
    'gaddha',
  ],
  waste: [
    'garbage',
    'waste',
    'trash',
    'dustbin',
    'rubbish',
    'kacha',
    'kachra',
    'safai',
    'dumpster',
    'overflowing bin',
    'swachh',
  ],
  drainage: [
    'drain',
    'drainage',
    'sewage',
    'blocked',
    'choked',
    'waterlogging',
    'nala',
    'nalika',
    'gutka',
    'manhole blocked',
    'stagnant',
  ],
  water: [
    'water',
    'leak',
    'leakage',
    'tap',
    'pipeline',
    'no water',
    'water supply',
    'pani',
    'jal',
    'overflow tank',
  ],
  electricity: [
    'streetlight',
    'street light',
    'pole',
    'wire',
    'cable',
    'electricity',
    'light',
    'transformer',
    'bijli',
    'bijlee',
    'lamp post',
  ],
  public_safety: [
    'dangerous',
    'exposed wire',
    'open manhole',
    'collapsed',
    'unsafe',
    'hazard',
    'live wire',
    'electrocution risk',
    'falling',
  ],
};

export const SEVERITY_KEYWORDS_HIGH = [
  'huge',
  'large',
  'big',
  'severe',
  'dangerous',
  'accident',
  'falling',
  'exposed',
  'live wire',
  'flood',
  'emergency',
  'critical',
  'huge pothole',
  'two-wheelers',
  'bike',
  'vehicle damage',
  'child',
  'school',
  'hospital',
];

export const SEVERITY_KEYWORDS_LOW = ['minor', 'small', 'tiny', 'slight', 'cosmetic'];

export const SAFETY_RISK_TERMS = [
  'exposed wire',
  'live wire',
  'open manhole',
  'manhole',
  'collapsed',
  'falling',
  'dangerous',
  'hazard',
  'electrocution',
  'accident',
  'fire',
  'flood',
  'deep water',
  'school',
  'children',
  'hospital',
  'pedestrian',
  'two-wheeler',
  'bike',
  'vehicle',
  'traffic',
];

export const STATUSES: ComplaintStatus[] = [
  'received',
  'under_review',
  'inspection_scheduled',
  'in_progress',
  'awaiting_verification',
  'resolved',
  'reopened',
  'closed',
];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  received: 'Received',
  under_review: 'Under Review',
  inspection_scheduled: 'Inspection Scheduled',
  in_progress: 'In Progress',
  awaiting_verification: 'Awaiting Verification',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
};

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'open',
  'in_progress',
  'awaiting_verification',
  'resolved',
  'closed',
  'reopened',
];

export const PRIORITY_BANDS: PriorityBand[] = ['critical', 'high', 'medium', 'low'];

export const ROLES: AdminRole[] = [
  'super_admin',
  'state_admin',
  'district_admin',
  'municipal_admin',
  'ward_admin',
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  state_admin: 'State Admin',
  district_admin: 'District Admin',
  municipal_admin: 'Municipal Admin',
  ward_admin: 'Ward Officer',
};

export const DEFAULT_SLA_RULES: Array<{
  category: CategoryKey | '*';
  priority_band: PriorityBand;
  deadline_hours: number;
  escalation_hours: number;
}> = [
  { category: '*', priority_band: 'critical', deadline_hours: 24, escalation_hours: 6 },
  { category: '*', priority_band: 'high', deadline_hours: 48, escalation_hours: 12 },
  { category: '*', priority_band: 'medium', deadline_hours: 168, escalation_hours: 48 },
  { category: '*', priority_band: 'low', deadline_hours: 336, escalation_hours: 72 },
];

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  w_severity: 0.35,
  w_safety: 0.2,
  w_corroboration: 0.2,
  w_waiting: 0.15,
  w_vulnerability: 0.1,
};
