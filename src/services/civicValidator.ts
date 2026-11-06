import type { CategoryKey } from '../types/civic';
import { ISSUE_KEYWORDS } from './taxonomy';

export type RejectionReason =
  | 'philosophical_or_identity'
  | 'general_trivia_or_science'
  | 'conversational_or_greeting'
  | 'gibberish_or_spam'
  | 'too_short'
  | 'out_of_scope'
  | 'inappropriate'
  | 'invalid_location'
  | 'invalid_file';

export interface CivicValidationResult {
  isValid: boolean;
  rejectionReason?: RejectionReason;
  title: string;
  message: string;
  suggestedAction?: string;
  matchedCategory?: CategoryKey;
}

// Philosophical, existential, or personal identity patterns (specifically flagged by user)
const PHILOSOPHICAL_AND_IDENTITY_PATTERNS = [
  /\bwhy\s+am\s+i\s+(a\s+)?(boy|girl|man|woman|human|alive|here|alone|sad|happy|ugly|poor|rich|different)\b/i,
  /\bwho\s+am\s+i\b/i,
  /\bwhat\s+is\s+my\s+(gender|identity|purpose|destiny|name|future)\b/i,
  /\bwhat\s+is\s+the\s+meaning\s+of\s+life\b/i,
  /\bwhy\s+do\s+we\s+exist\b/i,
  /\bwhy\s+was\s+i\s+born\b/i,
  /\bdo\s+i\s+have\s+a\s+soul\b/i,
  /\bis\s+there\s+(a\s+)?god\b/i,
  /\bwho\s+created\s+(god|the\s+universe|the\s+world|humans)\b/i,
  /\bwhat\s+happens\s+after\s+death\b/i,
  /\bam\s+i\s+(real|alive|dreaming|a\s+boy|a\s+girl)\b/i,
];

// General science trivia, homework, or curiosities that are not public problems
const GENERAL_TRIVIA_AND_SCIENCE_PATTERNS = [
  /\bwhy\s+is\s+(the\s+)?earth\s+(round|flat|spherical|spinning|rotating|blue)\b/i,
  /\bwhy\s+is\s+(the\s+)?sky\s+(blue|dark|red)\b/i,
  /\bwhy\s+is\s+water\s+(wet|clear|liquid)\b/i,
  /\bwhy\s+do\s+(birds\s+fly|fish\s+swim|stars\s+twinkle|leaves\s+fall)\b/i,
  /\bhow\s+far\s+is\s+(the\s+)?(sun|moon|mars|jupiter)\b/i,
  /\bhow\s+big\s+is\s+(the\s+)?universe\b/i,
  /\bwhat\s+is\s+gravity\b/i,
  /\bwho\s+discovered\s+(gravity|electricity|america|india)\b/i,
  /\bwho\s+is\s+(the\s+)?(president|prime\s+minister|best\s+cricketer|richest\s+person|actor)\b/i,
  /\bhow\s+to\s+make\s+(money|cake|pizza|biryani|friends|a\s+girlfriend)\b/i,
  /\bwrite\s+(me\s+)?(a\s+)?(code|python|java|javascript|essay|poem|song|story|letter)\b/i,
  /\bsolve\s+(this\s+)?(math|equation|question|puzzle)\b/i,
  /\bwhat\s+is\s+\d+\s*[\+\-\*\/]\s*\d+\b/i,
];

// Conversational chit-chat with no problem reported
const CONVERSATIONAL_ONLY_PATTERNS = [
  /^(hi|hello|hey|hola|namaste|yo|good\s+(morning|afternoon|evening|night)|howdy|sup)(\s+(there|everyone|all|friend|bot|assistant))?[\s\.\!\?]*$/i,
  /^(how\s+are\s+you|what\s+are\s+you\s+doing|who\s+are\s+you|what\s+is\s+your\s+name)[\s\.\!\?]*$/i,
  /^(ok|okay|cool|nice|yes|no|yeah|nope|sure|fine|thanks|thank\s+you)[\s\.\!\?]*$/i,
  /^(test|testing|check|hello\s+world|asdf|qwerty)[\s\.\!\?]*$/i,
];

// Inappropriate, abusive, or trolling patterns
const TROLLING_PATTERNS = [
  /\b(fool|stupid|idiot|hate\s+you|fuck|shit|bitch|bastard|kill|murder|bomb|hack)\b/i,
];

// Genuine civic indicators across multiple languages (English, Odia, Hindi/Hinglish)
const CIVIC_PROBLEM_ROOTS = [
  // Roads & Transport
  'pothole', 'gaddha', 'koliba', 'pit', 'crater', 'crack', 'asphalt', 'tar',
  'road', 'sadak', 'rasta', 'raasta', 'footpath', 'sidewalk', 'curb', 'divider',
  'speed breaker', 'flyover', 'pavement', 'traffic light', 'zebra crossing',
  // Waste & Sanitation
  'garbage', 'kachra', 'waste', 'trash', 'dustbin', 'bin', 'rubbish', 'safai',
  'dumpster', 'litter', 'filth', 'decaying', 'smell', 'odor', 'stray animals',
  'dead animal', 'carcass', 'sweeping',
  // Drainage & Waterlogging
  'drain', 'drainage', 'nala', 'nalika', 'sewer', 'sewage', 'gutter', 'waterlog',
  'waterlogging', 'choked', 'clogged', 'blocked drain', 'stagnant water', 'overflowing drain',
  'gutka', 'overflow', 'manhole',
  // Water Supply
  'water supply', 'drinking water', 'pipeline', 'pipe burst', 'leakage', 'leak',
  'pani', 'jal', 'water tanker', 'dirty water', 'contaminated water', 'low pressure',
  'no water', 'tap broken', 'borewell',
  // Electricity & Street Lighting
  'streetlight', 'street light', 'pole', 'lamp', 'bulb', 'wire', 'cable',
  'live wire', 'exposed wire', 'spark', 'short circuit', 'transformer', 'bijli',
  'electric pole', 'power cut in street', 'dark street', 'current',
  // Public Safety & Infrastructure Hazards
  'open manhole', 'manhole cover', 'dangerous', 'hazard', 'falling tree', 'fallen branch',
  'collapse', 'cave-in', 'sinkhole', 'broken wall', 'railing broken', 'encroachment',
  'slipping', 'pedestrian risk', 'school zone hazard', 'electrocution',
  // Odia script terms (Odia language support)
  'ରାସ୍ତା', 'ଗାଡ଼ା', 'ଗାତ', 'ପାଣି', 'ନାଳ', 'ନାଳିକା', 'ଅଳିଆ', 'ବିଜୁଳି', 'ବିଦ୍ୟୁତ', 'ମାର୍କେଟ',
];

/**
 * Validates a complaint description string against strict public civic utility rules.
 */
export function validateCivicText(
  rawText: string,
  categoryOverride?: CategoryKey | null
): CivicValidationResult {
  const text = (rawText || '').trim();

  // 1. Minimum Length Check
  if (!text) {
    return {
      isValid: false,
      rejectionReason: 'too_short',
      title: 'Empty Issue Description',
      message: 'Please provide a clear description of the civic problem you are reporting.',
      suggestedAction: 'Describe the infrastructure or municipal issue with location details.',
    };
  }

  if (text.length < 8) {
    return {
      isValid: false,
      rejectionReason: 'too_short',
      title: 'Input Too Short',
      message: 'The description is too brief to be identified as a actionable civic issue. Please describe what is broken, leaking, or damaged.',
      suggestedAction: 'Example: "Pothole on main road outside city hospital creating accident risk."',
    };
  }

  // 2. Gibberish & Keyboard Mash Detection
  const cleanChars = text.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanChars.length >= 6) {
    // Check for single character repetition: "aaaaaaa", "xxxxxx"
    if (/^(.)\1{4,}$/i.test(cleanChars)) {
      return {
        isValid: false,
        rejectionReason: 'gibberish_or_spam',
        title: 'Spam or Gibberish Input Detected',
        message: 'This input consists of repeating characters. CivicFix requires legitimate civic issue descriptions.',
        suggestedAction: 'Please enter a genuine municipal grievance.',
      };
    }
    // Check for keyboard sequence mash like "asdfghjkl", "zxcvbnm", "12345678"
    if (/^(asdf|qwer|zxcv|1234|5678|abcd)/i.test(cleanChars) && cleanChars.length > 8) {
      return {
        isValid: false,
        rejectionReason: 'gibberish_or_spam',
        title: 'Unusable Key Sequence Detected',
        message: 'Random keyboard typing or test text cannot be submitted as a municipal issue.',
        suggestedAction: 'Please enter a genuine description of public damage or municipal failure.',
      };
    }
  }

  // 3. Conversational chit-chat check
  for (const pattern of CONVERSATIONAL_ONLY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        rejectionReason: 'conversational_or_greeting',
        title: 'No Civic Problem Described',
        message: 'You have entered a conversational greeting or acknowledgment rather than a civic problem.',
        suggestedAction: 'Please report a specific public problem like road damage, waste overflow, broken streetlights, or drainage issues.',
      };
    }
  }

  // 4. Philosophical & Identity Queries (Strict Cap requested by user: e.g. "why am i a boy")
  for (const pattern of PHILOSOPHICAL_AND_IDENTITY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        rejectionReason: 'philosophical_or_identity',
        title: 'Non-Civic Personal / Philosophical Query Blocked',
        message: 'CivicFix is exclusively dedicated to solving public infrastructure and municipal issues for the general public (such as potholes, waterlogging, garbage accumulation, sewage leaks, non-functional streetlights, broken pipes, open manholes, or road damage). Personal questions, identity queries, and philosophical musings cannot be registered as municipal grievances.',
        suggestedAction: 'Please use CivicFix solely for reporting physical civic and municipal problems.',
      };
    }
  }

  // 5. General Science, Trivia, and Homework Queries (Strict Cap: e.g. "why is earth round")
  for (const pattern of GENERAL_TRIVIA_AND_SCIENCE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        rejectionReason: 'general_trivia_or_science',
        title: 'General Trivia / Non-Municipal Query Blocked',
        message: 'CivicFix is not a general search engine or chatbot. Questions regarding general science (e.g. "why is earth round"), homework, recipes, or sports trivia cannot be accepted as municipal issues.',
        suggestedAction: 'Report a local public problem affecting your neighborhood or community.',
      };
    }
  }

  // 6. Trolling / Abuse check
  for (const pattern of TROLLING_PATTERNS) {
    if (pattern.test(text) && !CIVIC_PROBLEM_ROOTS.some((r) => text.toLowerCase().includes(r))) {
      return {
        isValid: false,
        rejectionReason: 'inappropriate',
        title: 'Inappropriate or Trolling Content Blocked',
        message: 'This submission contains abusive or non-constructive terms without any legitimate municipal problem context.',
        suggestedAction: 'Please submit only legitimate grievances for municipal action.',
      };
    }
  }

  // 7. Positive Civic Domain Verification
  // Check if at least one legitimate municipal problem domain keyword or concept is present
  const lowerText = text.toLowerCase();
  const hasCivicTerm = CIVIC_PROBLEM_ROOTS.some((root) => lowerText.includes(root));

  // Also check if any category keywords match from taxonomy
  const hasTaxonomyTerm = Object.values(ISSUE_KEYWORDS).some((list) =>
    list.some((kw) => lowerText.includes(kw))
  );

  const hasCategoryOverride = Boolean(
    categoryOverride && categoryOverride !== 'other'
  );

  if (!hasCivicTerm && !hasTaxonomyTerm && !hasCategoryOverride) {
    // If text does not mention any civic problem or physical infrastructure:
    return {
      isValid: false,
      rejectionReason: 'out_of_scope',
      title: 'Unrecognized Civic Problem',
      message: 'Could not identify a valid municipal or public infrastructure problem. CivicFix handles issues such as road damage, garbage overflow, water supply disruption, drainage blockages, electrical faults, and public hazards.',
      suggestedAction: 'Please clarify what public infrastructure is damaged, blocked, or malfunctioning.',
    };
  }

  // Input passed all strict checks
  return {
    isValid: true,
    title: 'Valid Civic Problem',
    message: 'Verified as a legitimate public municipal issue eligible for departmental triage.',
  };
}

/**
 * Validates coordinate inputs to prevent impossible or invalid location data.
 */
export function validateCoordinates(lat: number | null, lon: number | null): {
  isValid: boolean;
  message?: string;
} {
  if (lat === null && lon === null) {
    return { isValid: true }; // Location can be inferred from text landmark
  }

  if (lat !== null && (lat < -90 || lat > 90)) {
    return {
      isValid: false,
      message: `Latitude ${lat} is invalid. Latitude must be between -90 and +90 degrees.`,
    };
  }

  if (lon !== null && (lon < -180 || lon > 180)) {
    return {
      isValid: false,
      message: `Longitude ${lon} is invalid. Longitude must be between -180 and +180 degrees.`,
    };
  }

  // Null Island check (0, 0 in Atlantic Ocean)
  if (lat === 0 && lon === 0) {
    return {
      isValid: false,
      message: 'Coordinates (0, 0) point to the middle of the ocean. Please specify a valid local position.',
    };
  }

  return { isValid: true };
}

/**
 * Validates uploaded evidence media (images and documents).
 */
export function validateEvidenceFile(file: {
  name: string;
  size: number;
  mime: string;
}): { isValid: boolean; message?: string } {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
  ];

  if (file.size <= 0) {
    return { isValid: false, message: `File "${file.name}" is empty (0 bytes). Please upload a valid image.` };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { isValid: false, message: `File "${file.name}" exceeds the 10MB size limit.` };
  }

  const isAllowed = allowedMimes.includes(file.mime.toLowerCase()) ||
    /\.(jpe?g|png|webp|heic|pdf)$/i.test(file.name);

  if (!isAllowed) {
    return {
      isValid: false,
      message: `File "${file.name}" has an unsupported format. Please upload photos (JPEG, PNG, WebP) or PDF documents.`,
    };
  }

  return { isValid: true };
}
