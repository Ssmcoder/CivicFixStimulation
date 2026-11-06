import type { LocationCandidate } from '../types/civic';

export interface GazetteerEntry {
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  ward: string;
}

export const GAZETTEER: GazetteerEntry[] = [
  {
    name: 'Engineering College Gate',
    aliases: ['engineering college', 'college gate', 'engg college', 'college'],
    lat: 20.2969,
    lon: 85.8242,
    ward: 'Ward 12',
  },
  {
    name: 'Main Market',
    aliases: ['main market', 'market', 'bazaar', 'market entrance'],
    lat: 20.3001,
    lon: 85.819,
    ward: 'Ward 12',
  },
  {
    name: 'Railway Station',
    aliases: ['railway station', 'train station', 'station', 'rail station'],
    lat: 20.256,
    lon: 85.844,
    ward: 'Ward 8',
  },
  {
    name: 'Biju Patnaik Airport',
    aliases: ['airport', 'biju patnaik'],
    lat: 20.244,
    lon: 85.817,
    ward: 'Ward 5',
  },
  {
    name: 'Rajbhavan',
    aliases: ['rajbhavan', 'governor house'],
    lat: 20.302,
    lon: 85.821,
    ward: 'Ward 12',
  },
  {
    name: 'Lingaraj Temple',
    aliases: ['lingaraj', 'temple', 'lingaraj temple'],
    lat: 20.315,
    lon: 85.831,
    ward: 'Ward 18',
  },
  {
    name: 'Master Canteen',
    aliases: ['master canteen', 'canteen'],
    lat: 20.3025,
    lon: 85.817,
    ward: 'Ward 12',
  },
  {
    name: 'Bus Stand',
    aliases: ['bus stand', 'bus station'],
    lat: 20.289,
    lon: 85.835,
    ward: 'Ward 10',
  },
  {
    name: 'Khandagiri',
    aliases: ['khandagiri', 'udayagiri', 'khandagiri temple'],
    lat: 20.262,
    lon: 85.813,
    ward: 'Ward 6',
  },
  {
    name: 'Marichi Hospital',
    aliases: ['marichi', 'hospital', 'marichi hospital'],
    lat: 20.307,
    lon: 85.829,
    ward: 'Ward 18',
  },
  {
    name: 'NANDAN',
    aliases: ['nandan', 'nandankanan'],
    lat: 20.275,
    lon: 85.815,
    ward: 'Ward 7',
  },
  {
    name: 'Bhatia Park',
    aliases: ['bhatia park', 'park'],
    lat: 20.292,
    lon: 85.806,
    ward: 'Ward 12',
  },
  {
    name: 'Sanjivan Hospital',
    aliases: ['sanjivan', 'sanjivan hospital'],
    lat: 20.299,
    lon: 85.831,
    ward: 'Ward 18',
  },
  {
    name: 'Gole Bazar',
    aliases: ['gole bazar', 'gole market'],
    lat: 20.294,
    lon: 85.823,
    ward: 'Ward 12',
  },
  {
    name: 'Kalpana Square',
    aliases: ['kalpana square', 'square'],
    lat: 20.296,
    lon: 85.816,
    ward: 'Ward 12',
  },
];

export const WARDS: Record<string, [number, number, number, number]> = {
  'Ward 5': [20.23, 20.26, 85.8, 85.83],
  'Ward 6': [20.25, 20.275, 85.8, 85.83],
  'Ward 7': [20.265, 20.29, 85.8, 85.83],
  'Ward 8': [20.245, 20.27, 85.83, 85.86],
  'Ward 10': [20.28, 20.305, 85.83, 85.86],
  'Ward 12': [20.29, 20.315, 85.81, 85.835],
  'Ward 18': [20.305, 20.33, 85.825, 85.855],
};

export interface LocationResult {
  lat: number | null;
  lon: number | null;
  landmark_text: string | null;
  confidence: number;
  verified: boolean;
  candidates: LocationCandidate[];
  ward_name: string | null;
  method: 'gps' | 'manual_pin' | 'landmark' | 'landmark_ambiguous' | 'vague' | 'none';
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function extractLandmarks(text: string): string[] {
  const t = (text || '').toLowerCase();
  const found: string[] = [];
  for (const entry of GAZETTEER) {
    for (const alias of entry.aliases) {
      if (t.includes(alias)) {
        found.push(entry.name);
        break;
      }
    }
  }
  return found;
}

export function vagueCandidates(text: string): LocationCandidate[] {
  const t = (text || '').toLowerCase();
  const out: LocationCandidate[] = [];
  if (t.includes('railway') || t.includes('station') || t.includes('train')) {
    out.push({ name: 'Railway Station', lat: 20.256, lon: 85.844, ward: 'Ward 8' });
  }
  if (t.includes('market')) {
    out.push({ name: 'Main Market', lat: 20.3001, lon: 85.819, ward: 'Ward 12' });
    out.push({ name: 'Gole Bazar', lat: 20.294, lon: 85.823, ward: 'Ward 12' });
  }
  if (t.includes('college') || t.includes('school') || t.includes('university')) {
    out.push({
      name: 'Engineering College Gate',
      lat: 20.2969,
      lon: 85.8242,
      ward: 'Ward 12',
    });
  }
  if (t.includes('temple') || t.includes('mandir')) {
    out.push({ name: 'Lingaraj Temple', lat: 20.315, lon: 85.831, ward: 'Ward 18' });
  }
  if (t.includes('airport')) {
    out.push({ name: 'Biju Patnaik Airport', lat: 20.244, lon: 85.817, ward: 'Ward 5' });
  }
  if (t.includes('bus') && t.includes('stand')) {
    out.push({ name: 'Bus Stand', lat: 20.289, lon: 85.835, ward: 'Ward 10' });
  }
  if (t.includes('hospital')) {
    out.push({ name: 'Marichi Hospital', lat: 20.307, lon: 85.829, ward: 'Ward 18' });
    out.push({ name: 'Sanjivan Hospital', lat: 20.299, lon: 85.831, ward: 'Ward 18' });
  }
  return out;
}

export function wardFor(lat: number, lon: number): string | null {
  for (const [name, [minla, maxla, minlo, maxlo]] of Object.entries(WARDS)) {
    if (lat >= minla && lat <= maxla && lon >= minlo && lon <= maxlo) {
      return name;
    }
  }
  return null;
}

export function resolveLocation(
  text: string,
  lat: number | null = null,
  lon: number | null = null,
  manualConfirmed = false
): LocationResult {
  if (lat !== null && lon !== null) {
    const ward = wardFor(lat, lon);
    if (manualConfirmed) {
      return {
        lat,
        lon,
        landmark_text: null,
        confidence: 0.95,
        verified: true,
        candidates: [],
        ward_name: ward,
        method: 'manual_pin',
      };
    }
    return {
      lat,
      lon,
      landmark_text: null,
      confidence: 0.9,
      verified: false,
      candidates: [],
      ward_name: ward,
      method: 'gps',
    };
  }

  const landmarks = extractLandmarks(text);
  if (landmarks.length > 0) {
    const cands: LocationCandidate[] = [];
    for (const name of landmarks) {
      const g = GAZETTEER.find((item) => item.name === name);
      if (g) {
        cands.push({ name: g.name, lat: g.lat, lon: g.lon, ward: g.ward });
      }
    }
    if (cands.length === 1) {
      const c = cands[0];
      return {
        lat: c.lat,
        lon: c.lon,
        landmark_text: c.name,
        confidence: 0.75,
        verified: false,
        candidates: cands,
        ward_name: c.ward,
        method: 'landmark',
      };
    }
    return {
      lat: null,
      lon: null,
      landmark_text: null,
      confidence: 0.3,
      verified: false,
      candidates: cands,
      ward_name: null,
      method: 'landmark_ambiguous',
    };
  }

  const vague = vagueCandidates(text);
  if (vague.length > 0) {
    return {
      lat: null,
      lon: null,
      landmark_text: null,
      confidence: 0.25,
      verified: false,
      candidates: vague,
      ward_name: null,
      method: 'vague',
    };
  }

  return {
    lat: null,
    lon: null,
    landmark_text: null,
    confidence: 0.0,
    verified: false,
    candidates: [],
    ward_name: null,
    method: 'none',
  };
}
