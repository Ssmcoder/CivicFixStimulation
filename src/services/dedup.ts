import type { CategoryKey, Complaint, Incident, MatchCandidate } from '../types/civic';
import { haversineM } from './location';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'near',
  'there',
  'this',
  'that',
  'it',
  'with',
  'from',
  'by',
  'has',
  'have',
  'been',
  'very',
  'hai',
  'ka',
  'ke',
  'ki',
  'se',
  'me',
  'par',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function textSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const w of ta) freqA.set(w, (freqA.get(w) || 0) + 1);
  for (const w of tb) freqB.set(w, (freqB.get(w) || 0) + 1);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [w, va] of freqA.entries()) {
    normA += va * va;
    const vb = freqB.get(w) || 0;
    dot += va * vb;
  }
  for (const vb of freqB.values()) {
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.min(1.0, Math.max(0.0, cos));
}

function geoScore(distM: number | null, maxM = 500): number {
  if (distM === null) return 0.4;
  if (distM <= 50) return 1.0;
  if (distM >= maxM) return 0.0;
  return 1.0 - (distM - 50) / (maxM - 50);
}

export function findMatches(params: {
  text: string;
  category: CategoryKey;
  lat: number | null;
  lon: number | null;
  incidents: Incident[];
  complaints: Complaint[];
}): MatchCandidate[] {
  const { text, category, lat, lon, incidents, complaints } = params;
  const now = Date.now();
  const cutoffMs = 30 * 24 * 3600 * 1000;
  const maxDistM = 500;
  const autoLinkThreshold = 0.78;
  const reviewThreshold = 0.52;

  const openIncidents = incidents.filter(
    (inc) =>
      ['open', 'in_progress', 'awaiting_verification', 'reopened'].includes(inc.status) &&
      now - new Date(inc.created_at).getTime() <= cutoffMs
  );

  const out: MatchCandidate[] = [];

  for (const inc of openIncidents) {
    const memberTexts = complaints
      .filter((c) => c.incident_id === inc.id)
      .map((c) => c.description);
    if (memberTexts.length === 0) {
      memberTexts.push(inc.title);
    }

    const textSim = Math.max(...memberTexts.map((mt) => textSimilarity(text, mt)));

    let dist: number | null = null;
    if (lat !== null && lon !== null && inc.lat !== null && inc.lon !== null) {
      dist = haversineM(lat, lon, inc.lat, inc.lon);
    }

    const catMatch =
      category === inc.category || category === 'other' || inc.category === 'other';
    const timeGapHours = Math.max(
      0,
      (now - new Date(inc.created_at).getTime()) / (3600 * 1000)
    );
    const geo = geoScore(dist, maxDistM);
    const catScore = catMatch ? 1.0 : 0.0;
    const score = 0.5 * textSim + 0.3 * geo + 0.2 * catScore;

    let verdict: 'auto_link' | 'review' | 'none' = 'none';
    if (score >= autoLinkThreshold && catMatch && textSim >= 0.55) {
      verdict = 'auto_link';
    } else if (score >= reviewThreshold) {
      verdict = 'review';
    }

    if (verdict !== 'none') {
      out.push({
        incident_id: inc.id,
        incident_title: inc.title,
        citizens_affected: inc.citizens_affected,
        status: inc.status,
        score: Math.round(score * 1000) / 1000,
        verdict,
        evidence: {
          text_similarity: Math.round(textSim * 1000) / 1000,
          geo_distance_m: dist !== null ? Math.round(dist * 10) / 10 : null,
          geo_score: Math.round(geo * 1000) / 1000,
          category_match: catMatch,
          time_gap_hours: Math.round(timeGapHours * 10) / 10,
          combined_score: Math.round(score * 1000) / 1000,
        },
      });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}
