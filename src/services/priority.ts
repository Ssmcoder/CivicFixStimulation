import type {
  CategoryKey,
  PriorityBand,
  PriorityBreakdown,
  PriorityWeights,
  SlaRule,
} from '../types/civic';
import { DEFAULT_PRIORITY_WEIGHTS, DEFAULT_SLA_RULES } from './taxonomy';

export function bandFor(score: number): PriorityBand {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function vulnerabilityFor(category: CategoryKey, text = ''): number {
  const t = (text || '').toLowerCase();
  
  // High-precision base infrastructure vulnerability tier
  const baseMap: Record<CategoryKey, number> = {
    public_safety: 90.0,
    electricity: 80.0,
    water: 75.0,
    drainage: 72.0,
    roads: 65.0,
    waste: 45.0,
    other: 40.0,
  };

  let base = baseMap[category] ?? 50.0;

  // High-vulnerability urban corridor modifiers
  if (t.includes('hospital') || t.includes('clinic') || t.includes('emergency')) {
    base = Math.min(100.0, base + 25.0);
  } else if (t.includes('school') || t.includes('college') || t.includes('university') || t.includes('children')) {
    base = Math.min(100.0, base + 20.0);
  } else if (t.includes('highway') || t.includes('nh-16') || t.includes('main road') || t.includes('janpath') || t.includes('rajpath')) {
    base = Math.min(100.0, base + 18.0);
  } else if (t.includes('market') || t.includes('bus stand') || t.includes('station') || t.includes('crowded')) {
    base = Math.min(100.0, base + 15.0);
  }

  return Math.round(base * 10) / 10;
}

export function computePriority(params: {
  severity_score: number;
  safety_risk: number;
  corroboration: number;
  waiting_hours: number;
  vulnerability?: number;
  weights?: Partial<PriorityWeights>;
  target_sla_hours?: number;
}): PriorityBreakdown {
  const w: PriorityWeights = {
    ...DEFAULT_PRIORITY_WEIGHTS,
    ...(params.weights || {}),
  };

  const vuln = params.vulnerability ?? 50.0;

  // 1. Calibrated Non-Linear Corroboration Curve:
  // 1 report = 22.0, 2 reports = 46.5, 3 reports = 61.2, 5 reports = 78.4, 10+ reports = 96.0+
  const count = Math.max(1, params.corroboration);
  const cScore = Math.min(
    100.0,
    count === 1
      ? 22.0
      : count === 2
      ? 46.5
      : count === 3
      ? 62.0
      : count === 4
      ? 72.5
      : Math.min(100.0, 60.0 + 20.0 * Math.log2(count - 1))
  );

  // 2. High-Precision SLA-Proximity Waiting Urgency:
  // Factors in how close the ticket is to its maximum allowed turnaround time
  const targetSla = params.target_sla_hours || 48.0;
  const ratio = params.waiting_hours / targetSla;
  let tScore: number;

  if (ratio <= 0.05) {
    // Brand new ticket
    tScore = 18.0 + (ratio / 0.05) * 5.0; // 18 - 23
  } else if (ratio <= 0.5) {
    // 5% to 50% elapsed
    tScore = 23.0 + ((ratio - 0.05) / 0.45) * 27.0; // 23 - 50
  } else if (ratio <= 1.0) {
    // Approaching deadline (50% to 100%)
    tScore = 50.0 + ((ratio - 0.5) / 0.5) * 35.0; // 50 - 85
  } else {
    // Overdue / Breached SLA -> Rapid escalation to 90-100
    tScore = Math.min(100.0, 85.0 + Math.min(15.0, (ratio - 1.0) * 10.0));
  }

  const sScore = Math.min(100.0, Math.max(0.0, params.severity_score));
  const rScore = Math.min(100.0, Math.max(0.0, params.safety_risk));

  const factors: PriorityBreakdown['factors'] = {
    severity: {
      score: Math.round(sScore * 10) / 10,
      weight: w.w_severity,
      contribution: Math.round(sScore * w.w_severity * 100) / 100,
      plain: `Impact & structural severity rated ${sScore.toFixed(1)}/100 from damage cues`,
    },
    safety_risk: {
      score: Math.round(rScore * 10) / 10,
      weight: w.w_safety,
      contribution: Math.round(rScore * w.w_safety * 100) / 100,
      plain: `Public safety & pedestrian risk ${rScore.toFixed(1)}/100 (injury/hazard proximity)`,
    },
    corroboration: {
      score: Math.round(cScore * 10) / 10,
      weight: w.w_corroboration,
      contribution: Math.round(cScore * w.w_corroboration * 100) / 100,
      plain: `${count} independent citizen report(s) corroborated (${cScore.toFixed(1)}/100)`,
    },
    waiting: {
      score: Math.round(tScore * 10) / 10,
      weight: w.w_waiting,
      contribution: Math.round(tScore * w.w_waiting * 100) / 100,
      plain: `Time urgency score ${tScore.toFixed(1)}/100 (~${params.waiting_hours.toFixed(1)}h elapsed)`,
    },
    vulnerability: {
      score: Math.round(vuln * 10) / 10,
      weight: w.w_vulnerability,
      contribution: Math.round(vuln * w.w_vulnerability * 100) / 100,
      plain: `Infrastructure criticality & zone vulnerability ${vuln.toFixed(1)}/100`,
    },
  };

  const total = Object.values(factors).reduce((acc, f) => acc + f.contribution, 0);
  const roundedTotal = Math.round(total * 10) / 10;
  const band = bandFor(roundedTotal);

  return {
    score: roundedTotal,
    band,
    factors,
    weights: w,
    formula: `P = ${w.w_severity.toFixed(2)}*S (${sScore.toFixed(1)}) + ${w.w_safety.toFixed(2)}*R (${rScore.toFixed(1)}) + ${w.w_corroboration.toFixed(2)}*C (${cScore.toFixed(1)}) + ${w.w_waiting.toFixed(2)}*T (${tScore.toFixed(1)}) + ${w.w_vulnerability.toFixed(2)}*V (${vuln.toFixed(1)}) = ${roundedTotal.toFixed(1)}`,
  };
}

export function ruleHours(
  category: CategoryKey,
  band: PriorityBand,
  rules: SlaRule[] = []
): [number, number] {
  const exact = rules.find((r) => r.priority_band === band && r.category === category);
  if (exact) return [exact.deadline_hours, exact.escalation_hours];

  const wildcard = rules.find((r) => r.priority_band === band && r.category === '*');
  if (wildcard) return [wildcard.deadline_hours, wildcard.escalation_hours];

  const def = DEFAULT_SLA_RULES.find(
    (r) => r.priority_band === band && (r.category === category || r.category === '*')
  );
  return def ? [def.deadline_hours, def.escalation_hours] : [168, 48];
}

export function deadlineFor(
  createdAtIso: string,
  category: CategoryKey,
  band: PriorityBand,
  rules: SlaRule[] = []
): string {
  const [hours] = ruleHours(category, band, rules);
  const d = new Date(createdAtIso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
