import type { CategoryKey } from '../types/civic';
import {
  CATEGORIES,
  ISSUE_KEYWORDS,
  SAFETY_RISK_TERMS,
  SEVERITY_KEYWORDS_HIGH,
  SEVERITY_KEYWORDS_LOW,
} from './taxonomy';

export interface ClassificationResult {
  category: CategoryKey;
  category_label: string;
  issue_type: string;
  confidence: number;
  explanation: string;
  matched_keywords: string[];
  all_scores: Record<string, number>;
}

export interface SeverityResult {
  severity: 'high' | 'medium' | 'low';
  severity_score: number;
  safety_risk: number;
  reasons: string[];
}

export function issueTypeFor(cat: CategoryKey, t: string): string {
  if (cat === 'roads') {
    if (t.includes('pothole') || t.includes('hole') || t.includes('gaddha')) return 'Pothole';
    if (t.includes('crack')) return 'Road crack';
    if (t.includes('speed breaker')) return 'Broken speed breaker';
    if (t.includes('footpath') || t.includes('sidewalk')) return 'Footpath damage';
    return 'Road damage';
  }
  if (cat === 'waste') {
    if (t.includes('overflow')) return 'Overflowing waste bin';
    if (t.includes('missed') || t.includes('not collected')) return 'Missed collection';
    return 'Garbage accumulation';
  }
  if (cat === 'drainage') {
    if (t.includes('waterlog') || t.includes('stagnant') || t.includes('flood')) {
      return 'Waterlogging';
    }
    return 'Blocked drain';
  }
  if (cat === 'water') {
    if (t.includes('leak')) return 'Water leakage';
    if (t.includes('no water') || t.includes('pani nahi')) return 'Water supply disruption';
    return 'Water pipeline issue';
  }
  if (cat === 'electricity') {
    if (t.includes('streetlight') || t.includes('street light')) return 'Streetlight fault';
    if (t.includes('pole')) return 'Electric pole issue';
    if (t.includes('wire') || t.includes('cable')) return 'Electrical wiring issue';
    return 'Electricity fault';
  }
  if (cat === 'public_safety') {
    if (t.includes('manhole')) return 'Open/manhole hazard';
    if (t.includes('wire')) return 'Exposed wiring hazard';
    return 'Public safety hazard';
  }
  return 'General municipal issue';
}

export function classifyText(text: string): ClassificationResult {
  const t = (text || '').toLowerCase();
  const scores: Record<string, number> = {};
  const hits: Record<string, string[]> = {};

  (Object.entries(ISSUE_KEYWORDS) as Array<[Exclude<CategoryKey, 'other'>, string[]]>).forEach(
    ([cat, kws]) => {
      const found = kws.filter((kw) => t.includes(kw));
      if (found.length > 0) {
        scores[cat] =
          found.length * 2.0 +
          found.reduce((acc, kw) => acc + kw.split(/\s+/).length, 0);
        hits[cat] = found;
      }
    }
  );

  const boosts: Record<Exclude<CategoryKey, 'other'>, string[]> = {
    roads: ['pothole', 'broken road', 'road damage', 'sadak', 'koliba', 'gaddha'],
    waste: ['garbage', 'safai', 'waste', 'bin overflow', 'kachra'],
    drainage: ['drain', 'nala', 'nalika', 'waterlog', 'choked'],
    water: ['leak', 'no water', 'water supply', 'pani'],
    electricity: ['streetlight', 'street light', 'pole', 'bijli'],
    public_safety: ['exposed wire', 'open manhole', 'dangerous'],
  };

  (Object.entries(boosts) as Array<[Exclude<CategoryKey, 'other'>, string[]]>).forEach(
    ([cat, phrases]) => {
      for (const ph of phrases) {
        if (t.includes(ph)) {
          scores[cat] = (scores[cat] || 0) + 3.0;
        }
      }
    }
  );

  const keys = Object.keys(scores) as CategoryKey[];
  if (keys.length === 0) {
    return {
      category: 'other',
      category_label: CATEGORIES.other,
      issue_type: 'General municipal issue',
      confidence: 0.3,
      explanation: 'No strong keyword match; marked Other for review',
      matched_keywords: [],
      all_scores: {},
    };
  }

  let best: CategoryKey = keys[0];
  for (const k of keys) {
    if (scores[k] > scores[best]) best = k;
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1.0;
  const rawConf = scores[best] / total;
  const conf = Math.min(0.98, 0.45 + 0.5 * rawConf);
  const issue = issueTypeFor(best, t);
  const matched = hits[best] || [];
  const explanation = `Matched keywords [${matched.join(', ')}] for category '${best}' (${CATEGORIES[best]})`;

  const roundedScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    roundedScores[k] = Math.round(v * 100) / 100;
  }

  return {
    category: best,
    category_label: CATEGORIES[best],
    issue_type: issue,
    confidence: Math.round(conf * 1000) / 1000,
    explanation,
    matched_keywords: matched,
    all_scores: roundedScores,
  };
}

export function severityAndSafety(text: string): SeverityResult {
  const t = (text || '').toLowerCase();
  const highHits = SEVERITY_KEYWORDS_HIGH.filter((k) => t.includes(k));
  const lowHits = SEVERITY_KEYWORDS_LOW.filter((k) => t.includes(k));
  const safetyHits = SAFETY_RISK_TERMS.filter((k) => t.includes(k));

  // 1. Precise Base Structural/Operational Severity Calculation
  let baseSeverity = 48.0; // Standard municipal default
  const reasons: string[] = [];

  // Critical hazard cues (+35 to +50)
  if (
    t.includes('sinkhole') ||
    t.includes('cave-in') ||
    t.includes('burst') ||
    t.includes('collapsed') ||
    t.includes('completely blocked') ||
    t.includes('impassable') ||
    t.includes('fire') ||
    t.includes('explosion') ||
    t.includes('transformer blast')
  ) {
    baseSeverity = Math.max(baseSeverity, 88.0);
    reasons.push('structural collapse or critical lifeline failure');
  } else if (
    t.includes('huge') ||
    t.includes('massive') ||
    t.includes('severe') ||
    t.includes('accident') ||
    t.includes('falling') ||
    t.includes('deep pothole') ||
    t.includes('live wire') ||
    t.includes('exposed wire')
  ) {
    baseSeverity = Math.max(baseSeverity, 74.0);
    reasons.push('high damage scale / active danger cues');
  } else if (
    t.includes('overflowing') ||
    t.includes('waterlogging') ||
    t.includes('choked') ||
    t.includes('stagnant') ||
    t.includes('broken')
  ) {
    baseSeverity = Math.max(baseSeverity, 58.0);
    reasons.push('moderate operational disruption');
  }

  // Adjust by number of reinforcing cues
  const severityScore = Math.min(
    98.0,
    Math.max(
      15.0,
      baseSeverity +
        highHits.length * 4.5 -
        lowHits.length * 12.0 +
        (t.includes('urgent') || t.includes('immediate') ? 8.0 : 0)
    )
  );

  let severity: 'high' | 'medium' | 'low' = 'medium';
  if (severityScore >= 72.0) severity = 'high';
  else if (severityScore < 40.0) severity = 'low';

  // 2. High-Precision Public Safety & Health Risk Calculation
  let baseSafety = 20.0;
  if (
    t.includes('live wire') ||
    t.includes('exposed wire') ||
    t.includes('electrocution') ||
    t.includes('sparking')
  ) {
    baseSafety = 92.0;
    reasons.push('direct electrocution / electrical shock hazard');
  } else if (
    t.includes('open manhole') ||
    t.includes('manhole without cover') ||
    t.includes('sinkhole')
  ) {
    baseSafety = 88.0;
    reasons.push('fall / severe trauma hazard from open excavation');
  } else if (
    t.includes('two-wheelers') ||
    t.includes('slipping') ||
    t.includes('accident') ||
    t.includes('falling risk')
  ) {
    baseSafety = Math.max(baseSafety, 76.0);
    reasons.push('vehicular / pedestrian slip & collision risk');
  } else if (
    t.includes('sewage') ||
    t.includes('drinking water') ||
    t.includes('foul smell') ||
    t.includes('contaminated')
  ) {
    baseSafety = Math.max(baseSafety, 68.0);
    reasons.push('public health / biological contamination hazard');
  }

  // Vulnerable population proximity boosts
  let locationBonus = 0;
  if (t.includes('school') || t.includes('children') || t.includes('kindergarten')) {
    locationBonus += 22.0;
    reasons.push('adjacent to school/children zone');
  }
  if (t.includes('hospital') || t.includes('clinic') || t.includes('elderly')) {
    locationBonus += 22.0;
    reasons.push('adjacent to healthcare facility');
  }
  if (t.includes('highway') || t.includes('main road') || t.includes('market') || t.includes('bus stand')) {
    locationBonus += 14.0;
    reasons.push('high pedestrian/traffic density zone');
  }

  const safetyRisk = Math.min(
    98.0,
    Math.max(
      10.0,
      baseSafety + locationBonus + Math.min(20.0, safetyHits.length * 3.5)
    )
  );

  if (reasons.length === 0) {
    reasons.push('standard routine municipal maintenance');
  }

  return {
    severity,
    severity_score: Math.round(severityScore * 10) / 10,
    safety_risk: Math.round(safetyRisk * 10) / 10,
    reasons,
  };
}

export function stripPii(text: string): string {
  let t = (text || '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  t = t.replace(/(?<!\d)(\+?\d[\d\s-]{8,}\d)(?!\d)/g, '[phone]');
  return t;
}
