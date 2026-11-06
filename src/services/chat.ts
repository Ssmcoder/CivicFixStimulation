import type { CategoryKey, ChatCard, ChatMessage, LocationCandidate } from '../types/civic';
import { validateCivicText } from './civicValidator';
import { classifyText } from './classify';
import { haversineM, resolveLocation } from './location';
import { CATEGORIES, CATEGORIES_ORDERED } from './taxonomy';
import { CivicState, submitComplaintToState } from '../store/civicStore';

export const QUICK_REPLIES = ['Report a problem', 'Track a complaint', 'Nearby issues'];

const SAFETY_TERMS = [
  'exposed wire',
  'live wire',
  'open manhole',
  'manhole',
  'collapsed',
  'falling',
  'flood',
  'deep water',
  'fire',
  'electrocution',
];

const EMERGENCY_NOTE =
  'If anyone is in immediate danger, please call the national emergency number 112. CivicFix is not an emergency service.';

const OUT_OF_SCOPE_REPLY =
  "I'm the CivicFix assistant — I can only help with civic problems like potholes, garbage, blocked drains, water or electricity issues, or tracking a complaint you already filed.";

const CIVIC_INTENT_PATTERNS: Record<string, string[]> = {
  report: [
    'pothole',
    'garbage',
    'waste',
    'drain',
    'water',
    'leak',
    'light',
    'streetlight',
    'pole',
    'wire',
    'manhole',
    'broken',
    'blocked',
    'overflow',
    'complaint',
    'report',
    'issue',
    'problem',
    'fix',
    'road',
    'sadak',
    'bijli',
    'pani',
    'kachra',
    'nalika',
    'jama',
    'gaddha',
  ],
  track: [
    'track',
    'status',
    'cfx-',
    'complaint id',
    'where is',
    'progress',
    'update',
    'fixed yet',
    'done',
  ],
  delay: [
    'why',
    'delay',
    'taking',
    'waiting',
    "haven't",
    "hasn't",
    'still',
    'long',
    'when will',
    'not fixed',
    'pending',
  ],
  nearby: [
    'nearby',
    'near me',
    'around',
    'already',
    'duplicate',
    'same issue',
    'any complaint',
    'others reported',
    'support',
  ],
  howto: ['how', 'use', 'civicfix', 'register', 'file', 'anonymous', 'qr'],
};

const OUT_OF_SCOPE_STRONG = [
  'weather',
  'joke',
  'song',
  'movie',
  'game',
  'cricket',
  'recipe',
  'write code',
  'python',
  'javascript',
  'capital of',
  'meaning of',
  'translate',
  'poem',
  'story',
  'news',
  'politics',
  'vote',
  'election',
  'president',
  'prime minister',
  'who is',
  'how old',
  'love',
  'advice',
  'medical',
  'doctor',
  'medicine',
];

export interface ChatDialogueState {
  mode: 'chat' | 'intake';
  pending_track_pid?: string;
  pending_nearby?: boolean;
  intake: {
    description: string;
    category: CategoryKey | '';
    lat: number | null;
    lon: number | null;
    landmark: string | null;
    location_confirmed: boolean;
  };
}

export function createInitialChatState(): ChatDialogueState {
  return {
    mode: 'chat',
    intake: {
      description: '',
      category: '',
      lat: null,
      lon: null,
      landmark: null,
      location_confirmed: false,
    },
  };
}

export function redactPii(text: string): string {
  let t = (text || '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  t = t.replace(/(?<!\d)\+?\d[\d\s-]{8,}\d(?!\d)/g, '[phone]');
  return t;
}

export function scopeGuard(text: string): { scope: 'civic' | 'out_of_scope' | 'unclear'; conf: number } {
  const t = (text || '').toLowerCase().trim();
  if (!t) return { scope: 'unclear', conf: 0 };
  const oosHits = OUT_OF_SCOPE_STRONG.filter((k) => t.includes(k)).length;
  let civicHits = 0;
  for (const pats of Object.values(CIVIC_INTENT_PATTERNS)) {
    for (const k of pats) {
      if (t.includes(k)) civicHits += 1;
    }
  }
  if (oosHits >= 2 && civicHits === 0) {
    return { scope: 'out_of_scope', conf: Math.min(0.95, 0.6 + 0.1 * oosHits) };
  }
  if (civicHits === 0 && oosHits === 0) {
    return { scope: 'unclear', conf: 0.4 };
  }
  if (civicHits > 0) {
    return { scope: 'civic', conf: Math.min(0.95, 0.55 + 0.08 * civicHits) };
  }
  return { scope: 'unclear', conf: 0.4 };
}

function detectIntent(text: string): string {
  const t = text.toLowerCase();
  let best = 'chat';
  let bestScore = 0;
  for (const [intent, pats] of Object.entries(CIVIC_INTENT_PATTERNS)) {
    const score = pats.filter((p) => t.includes(p)).length;
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return bestScore > 0 ? best : 'chat';
}

function missingSlots(intake: ChatDialogueState['intake']): string[] {
  const missing: string[] = [];
  if (!intake.description) missing.push('description');
  if (!intake.category) missing.push('category');
  if (!intake.location_confirmed && intake.lat === null) missing.push('location');
  return missing;
}

function askNextSlot(intake: ChatDialogueState['intake']): string {
  const missing = missingSlots(intake);
  if (missing.includes('description')) {
    return "What's the problem? Describe it in one or two sentences.";
  }
  if (missing.includes('category')) {
    return 'What kind of issue is it? (roads, waste, drainage, water, electricity, public safety)';
  }
  if (missing.includes('location')) {
    return 'Where is it? Share GPS, or name a landmark (e.g. Main Market, Railway Station).';
  }
  return 'Ready to submit — shall I file it?';
}

export function processChatTurn(params: {
  civicState: CivicState;
  dialogue: ChatDialogueState;
  userText: string;
  onStateMutated: () => void;
}): {
  message: ChatMessage;
  nextDialogue: ChatDialogueState;
} {
  const { civicState, dialogue, userText, onStateMutated } = params;
  const text = userText.trim();
  const low = text.toLowerCase();
  const next: ChatDialogueState = JSON.parse(JSON.stringify(dialogue));

  // Check if user pasted a tracking secret directly
  if (text.startsWith('cfx_') && text.length >= 16) {
    delete next.pending_track_pid;
    return {
      message: buildTrackResponse(civicState, text),
      nextDialogue: next,
    };
  }

  // Strict Input Cap: Check for fake, useless, philosophical, trivia, or invalid queries
  const inputCheck = validateCivicText(text);
  if (
    !inputCheck.isValid &&
    (inputCheck.rejectionReason === 'philosophical_or_identity' ||
      inputCheck.rejectionReason === 'general_trivia_or_science' ||
      inputCheck.rejectionReason === 'gibberish_or_spam' ||
      inputCheck.rejectionReason === 'inappropriate')
  ) {
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: `🚫 Input Blocked: ${inputCheck.title}\n\n${inputCheck.message}\n\n👉 ${inputCheck.suggestedAction || ''}`,
        quick_replies: QUICK_REPLIES,
        scope: 'out_of_scope',
        at: new Date().toISOString(),
      },
      nextDialogue: createInitialChatState(),
    };
  }

  // Safety check FIRST
  if (SAFETY_TERMS.some((term) => low.includes(term)) && next.mode === 'chat') {
    const cls = classifyText(text);
    next.mode = 'intake';
    next.intake.description = text;
    next.intake.category = cls.category;
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: `${EMERGENCY_NOTE} I've noted this as a high-priority safety issue. ${askNextSlot(next.intake)}`,
        quick_replies: ['Use my GPS', 'Main Market', 'Engineering College Gate'],
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  // Pending nearby landmark lookup
  if (next.pending_nearby) {
    delete next.pending_nearby;
    const loc = resolveLocation(text);
    if (loc.lat !== null && loc.lon !== null) {
      return {
        message: buildNearbyResponse(civicState, loc.lat, loc.lon, loc.landmark_text || text),
        nextDialogue: next,
      };
    }
    if (loc.candidates.length > 0) {
      const c = loc.candidates[0];
      return {
        message: buildNearbyResponse(civicState, c.lat, c.lon, c.name),
        nextDialogue: next,
      };
    }
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content:
          'I could not match that landmark. Try naming a Bhubaneswar landmark (e.g. Main Market, Railway Station, Bus Stand) or click "Use my GPS".',
        quick_replies: ['Use my GPS', 'Main Market', 'Railway Station'],
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  // Scope guard in chat mode
  if (next.mode === 'chat') {
    const { scope, conf } = scopeGuard(text);
    if (scope === 'out_of_scope' && conf > 0.7) {
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: OUT_OF_SCOPE_REPLY,
          quick_replies: QUICK_REPLIES,
          scope: 'out_of_scope',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }
    if (scope === 'unclear') {
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content:
            'Could you tell me a bit more — are you reporting a civic problem (like a broken road, garbage, or water issue), or tracking a complaint?',
          quick_replies: QUICK_REPLIES,
          scope: 'unclear',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }
  }

  // Intake mode
  if (next.mode === 'intake') {
    if (low === 'cancel' || low === 'cancel intake') {
      next.mode = 'chat';
      next.intake = createInitialChatState().intake;
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: 'No problem — intake cancelled. How else can I help?',
          quick_replies: QUICK_REPLIES,
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }

    if (!next.intake.description) {
      const descCheck = validateCivicText(text);
      if (!descCheck.isValid) {
        return {
          message: {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: `🚫 Input Blocked: ${descCheck.title}\n\n${descCheck.message}\n\n👉 ${descCheck.suggestedAction || 'Please state a public municipal problem.'}`,
            quick_replies: QUICK_REPLIES,
            scope: 'out_of_scope',
            at: new Date().toISOString(),
          },
          nextDialogue: createInitialChatState(),
        };
      }
      next.intake.description = text;
      const cls = classifyText(text);
      next.intake.category = cls.category;
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: `Got it — ${CATEGORIES[cls.category]}. ${askNextSlot(next.intake)}`,
          quick_replies: ['Use my GPS', 'Main Market', 'Engineering College Gate'],
          card: {
            type: 'intake',
            category: cls.category,
            category_label: CATEGORIES[cls.category],
          },
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }

    if (!next.intake.category) {
      const matchedCat = CATEGORIES_ORDERED.find(
        (c) => low.includes(c.replace('_', ' ')) || low.includes(c)
      );
      if (matchedCat) {
        next.intake.category = matchedCat;
        return {
          message: {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: `Category set: ${CATEGORIES[matchedCat]}. ${askNextSlot(next.intake)}`,
            quick_replies: ['Use my GPS', 'Main Market', 'Railway Station'],
            scope: 'civic',
            at: new Date().toISOString(),
          },
          nextDialogue: next,
        };
      }
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content:
            'Please pick a category: roads, waste, drainage, water, electricity, or public safety.',
          quick_replies: ['roads', 'waste', 'drainage', 'water', 'electricity', 'public_safety'],
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }

    if (!next.intake.location_confirmed && next.intake.lat === null) {
      const loc = resolveLocation(`${next.intake.description} ${text}`);
      if (loc.lat !== null && loc.lon !== null && loc.candidates.length === 1) {
        next.intake.lat = loc.lat;
        next.intake.lon = loc.lon;
        next.intake.landmark = loc.landmark_text;
        next.intake.location_confirmed = true;
        return submitFromChat(civicState, next, onStateMutated);
      }
      if (loc.candidates.length > 0) {
        return {
          message: {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: `I found possible locations: ${loc.candidates
              .slice(0, 3)
              .map((c) => c.name)
              .join(', ')}. Which one is correct?`,
            quick_replies: loc.candidates.slice(0, 3).map((c) => c.name),
            card: {
              type: 'location_candidates',
              candidates: loc.candidates.slice(0, 5),
            },
            scope: 'civic',
            at: new Date().toISOString(),
          },
          nextDialogue: next,
        };
      }
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content:
            "I couldn't pinpoint the location. Please name a landmark (e.g. 'Main Market', 'Railway Station') or click 'Use my GPS'.",
          quick_replies: ['Use my GPS', 'Main Market', 'Engineering College Gate', 'Bus Stand'],
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }

    return submitFromChat(civicState, next, onStateMutated);
  }

  // Chat mode intent routing
  const intent = detectIntent(text);

  if (
    intent === 'report' ||
    /\b(report|file|new complaint|there'?s|there is)\b/.test(low)
  ) {
    const cls = classifyText(text);
    const hasProblemDetail =
      text.split(/\s+/).length > 4 || cls.category !== 'other';
    next.mode = 'intake';
    if (hasProblemDetail && !low.includes('report a problem')) {
      next.intake.description = text;
      next.intake.category = cls.category;
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: `I can help you report that (${CATEGORIES[cls.category]}). ${askNextSlot(next.intake)}`,
          quick_replies: ['Use my GPS', 'Main Market', 'Engineering College Gate'],
          card: {
            type: 'intake_start',
            category: cls.category,
            category_label: CATEGORIES[cls.category],
            description: text.slice(0, 200),
          },
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: 'Sure — please describe the problem (what, where, how bad).',
        quick_replies: [
          'Huge pothole near Main Market',
          'Garbage overflowing at Bus Stand',
          'Exposed wire near Engineering College Gate',
        ],
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  if (intent === 'track' || /cfx-\d{4}-\d+/.test(low)) {
    const m = low.match(/cfx-\d{4}-\d+/);
    const pid = m ? m[0].toUpperCase() : undefined;
    if (pid) {
      next.pending_track_pid = pid;
      return {
        message: {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content: `To view ${pid}, please paste the tracking secret (starts with cfx_) shown when it was filed.`,
          quick_replies: QUICK_REPLIES,
          scope: 'civic',
          at: new Date().toISOString(),
        },
        nextDialogue: next,
      };
    }
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content:
          'Paste your tracking secret (starts with cfx_) and I will pull up the live status and SLA details.',
        quick_replies: QUICK_REPLIES,
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  if (intent === 'delay') {
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content:
          'To explain a delay I need your complaint tracking secret (cfx_...). Paste it here and I will check SLA and queue status.',
        quick_replies: QUICK_REPLIES,
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  if (intent === 'nearby') {
    next.pending_nearby = true;
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content:
          'Sure — share your GPS location or name a landmark, and I will find open complaints nearby you can support.',
        quick_replies: ['Use my GPS', 'Main Market', 'Railway Station', 'Engineering College Gate'],
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  if (intent === 'howto') {
    const words = low.split(/\s+/).filter((w) => w.length > 3);
    const faq = civicState.faqs.find((f) =>
      words.some((w) => (f.question + ' ' + f.answer).toLowerCase().includes(w))
    );
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: faq
          ? faq.answer
          : "You can report a problem with text, a photo, or voice — no login needed. You'll get a tracking ID and secret.",
        quick_replies: QUICK_REPLIES,
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  const cls = classifyText(text);
  if (cls.category !== 'other') {
    next.mode = 'intake';
    next.intake.description = text;
    next.intake.category = cls.category;
    return {
      message: {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: `That sounds like a ${CATEGORIES[cls.category]} issue. ${askNextSlot(next.intake)}`,
        quick_replies: ['Use my GPS', 'Main Market', 'Engineering College Gate'],
        scope: 'civic',
        at: new Date().toISOString(),
      },
      nextDialogue: next,
    };
  }

  return {
    message: {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content:
        'I can help you report a civic problem, track a complaint, or find nearby issues. What would you like to do?',
      quick_replies: QUICK_REPLIES,
      scope: 'civic',
      at: new Date().toISOString(),
    },
    nextDialogue: next,
  };
}

export function submitFromChat(
  civicState: CivicState,
  dialogue: ChatDialogueState,
  onStateMutated: () => void
): { message: ChatMessage; nextDialogue: ChatDialogueState } {
  const res = submitComplaintToState(civicState, {
    description: dialogue.intake.description,
    lat: dialogue.intake.lat,
    lon: dialogue.intake.lon,
    landmark_text: dialogue.intake.landmark,
    manual_location_confirmed: dialogue.intake.location_confirmed,
    source: 'chat',
    category_override: dialogue.intake.category || null,
  });
  onStateMutated();

  const c = res.complaint;
  const card: ChatCard = {
    type: 'complaint_created',
    public_id: c.public_id,
    tracking_token: res.tracking_token,
    status: c.status,
    category: c.category,
    category_label: CATEGORIES[c.category],
    priority_band: c.priority_band,
    priority_score: c.priority_score,
    sla_deadline: c.sla_deadline,
    possible_duplicates: res.possible_duplicates,
  };

  const resetDialogue = createInitialChatState();
  return {
    message: {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: `Complaint filed: ${c.public_id} (${CATEGORIES[c.category]}). Priority: ${c.priority_band.toUpperCase()} (${c.priority_score}/100). Save your tracking secret shown on the card below.`,
      quick_replies: QUICK_REPLIES,
      card,
      scope: 'civic',
      at: new Date().toISOString(),
    },
    nextDialogue: resetDialogue,
  };
}

export function buildTrackResponse(civicState: CivicState, token: string): ChatMessage {
  const c = civicState.complaints.find((item) => item.tracking_token === token.trim());
  if (!c) {
    return {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content:
        "I couldn't find a complaint with that tracking secret. Double-check the secret from your confirmation card.",
      quick_replies: QUICK_REPLIES,
      scope: 'civic',
      at: new Date().toISOString(),
    };
  }
  const inc = civicState.incidents.find((i) => i.id === c.incident_id);
  const card: ChatCard = {
    type: 'status',
    public_id: c.public_id,
    status: c.status,
    priority_band: c.priority_band,
    priority_score: c.priority_score,
    sla_deadline: c.sla_deadline,
    sla_breached: c.sla_breached,
    citizens_affected: inc?.citizens_affected || 1,
    history: c.status_history.slice(-4),
  };
  return {
    id: `msg_${Date.now()}_a`,
    role: 'assistant',
    content: `${c.public_id} (${c.category.replace('_', ' ')}) is currently ${c.status.replace(
      /_/g,
      ' '
    )}. Priority: ${c.priority_band} (${c.priority_score}/100).${
      c.sla_breached ? ' SLA deadline breached — escalated.' : ''
    }`,
    quick_replies: QUICK_REPLIES,
    card,
    scope: 'civic',
    at: new Date().toISOString(),
  };
}

export function buildNearbyResponse(
  civicState: CivicState,
  lat: number,
  lon: number,
  label: string
): ChatMessage {
  const open = civicState.incidents
    .filter(
      (i) =>
        ['open', 'in_progress', 'awaiting_verification', 'reopened'].includes(i.status) &&
        i.lat !== null &&
        i.lon !== null
    )
    .map((i) => ({
      incident_id: i.id,
      title: i.title,
      category: i.category,
      distance_m: Math.round(haversineM(lat, lon, i.lat!, i.lon!)),
      citizens_affected: i.citizens_affected,
      status: i.status,
    }))
    .filter((x) => x.distance_m <= 2500)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 5);

  return {
    id: `msg_${Date.now()}_a`,
    role: 'assistant',
    content:
      open.length > 0
        ? `Found ${open.length} open issue(s) near ${label}:`
        : `No open issues reported within 2.5 km of ${label}.`,
    quick_replies: QUICK_REPLIES,
    card: {
      type: 'nearby',
      location_label: label,
      items: open,
    },
    scope: 'civic',
    at: new Date().toISOString(),
  };
}

export function confirmCandidateInChat(
  civicState: CivicState,
  dialogue: ChatDialogueState,
  candidate: LocationCandidate,
  onStateMutated: () => void
): { message: ChatMessage; nextDialogue: ChatDialogueState } {
  const next: ChatDialogueState = JSON.parse(JSON.stringify(dialogue));
  next.intake.lat = candidate.lat;
  next.intake.lon = candidate.lon;
  next.intake.landmark = candidate.name;
  next.intake.location_confirmed = true;
  return submitFromChat(civicState, next, onStateMutated);
}
