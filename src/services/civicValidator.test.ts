import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCivicText,
  validateCoordinates,
  validateEvidenceFile,
} from './civicValidator.js';
import { computePriority, vulnerabilityFor } from './priority.js';
import { severityAndSafety, classifyText } from './classify.js';

test('Strict Civic Validator - Rejects philosophical and personal identity questions', () => {
  const result1 = validateCivicText('why am i a boy');
  assert.equal(result1.isValid, false);
  assert.equal(result1.rejectionReason, 'philosophical_or_identity');

  const result2 = validateCivicText('why am i a girl');
  assert.equal(result2.isValid, false);
  assert.equal(result2.rejectionReason, 'philosophical_or_identity');

  const result3 = validateCivicText('what is the meaning of life');
  assert.equal(result3.isValid, false);
  assert.equal(result3.rejectionReason, 'philosophical_or_identity');

  const result4 = validateCivicText('who created the universe');
  assert.equal(result4.isValid, false);
  assert.equal(result4.rejectionReason, 'philosophical_or_identity');
});

test('Strict Civic Validator - Rejects general science trivia and non-civic queries', () => {
  const result1 = validateCivicText('why is earth round');
  assert.equal(result1.isValid, false);
  assert.equal(result1.rejectionReason, 'general_trivia_or_science');

  const result2 = validateCivicText('why is the sky blue');
  assert.equal(result2.isValid, false);
  assert.equal(result2.rejectionReason, 'general_trivia_or_science');

  const result3 = validateCivicText('how to make biryani recipe');
  assert.equal(result3.isValid, false);
  assert.equal(result3.rejectionReason, 'general_trivia_or_science');

  const result4 = validateCivicText('write code in python for calculator');
  assert.equal(result4.isValid, false);
  assert.equal(result4.rejectionReason, 'general_trivia_or_science');
});

test('Strict Civic Validator - Rejects spam, keyboard mash, and greetings', () => {
  const result1 = validateCivicText('asdfghjklqwerty');
  assert.equal(result1.isValid, false);
  assert.equal(result1.rejectionReason, 'gibberish_or_spam');

  const result2 = validateCivicText('hello there');
  assert.equal(result2.isValid, false);
  assert.equal(result2.rejectionReason, 'conversational_or_greeting');

  const result3 = validateCivicText('fix');
  assert.equal(result3.isValid, false);
  assert.equal(result3.rejectionReason, 'too_short');
});

test('Strict Civic Validator - Approves genuine public municipal problems', () => {
  const result1 = validateCivicText(
    'Huge pothole outside Engineering College Gate, two-wheelers falling'
  );
  assert.equal(result1.isValid, true);

  const result2 = validateCivicText(
    'Open manhole without cover near market, pedestrians falling risk'
  );
  assert.equal(result2.isValid, true);

  const result3 = validateCivicText(
    'Exposed live wires hanging near school boundary wall, children at risk'
  );
  assert.equal(result3.isValid, true);

  const result4 = validateCivicText(
    'Garbage bin overflowing near Lingaraj Temple entrance, foul smell'
  );
  assert.equal(result4.isValid, true);

  const result5 = validateCivicText(
    'Main water pipe burst leaking drinking water on Rajpath road'
  );
  assert.equal(result5.isValid, true);
});

test('Location Coordinates Validator - Catches invalid coords', () => {
  assert.equal(validateCoordinates(20.2969, 85.8242).isValid, true);
  assert.equal(validateCoordinates(105.0, 85.0).isValid, false); // Lat > 90
  assert.equal(validateCoordinates(0, 0).isValid, false); // Null Island
});

test('Evidence File Validator - Rejects dangerous/empty files', () => {
  assert.equal(
    validateEvidenceFile({ name: 'pothole.jpg', size: 50000, mime: 'image/jpeg' }).isValid,
    true
  );
  assert.equal(
    validateEvidenceFile({ name: 'hack.exe', size: 50000, mime: 'application/x-msdownload' })
      .isValid,
    false
  );
  assert.equal(
    validateEvidenceFile({ name: 'empty.jpg', size: 0, mime: 'image/jpeg' }).isValid,
    false
  );
});

test('Priority Score Model - High accuracy and precision', () => {
  // Case 1: Life hazard - Live wires near school
  const text1 = 'Exposed live wires hanging near school boundary wall, children at risk';
  const sev1 = severityAndSafety(text1);
  assert.ok(sev1.safety_risk >= 85.0, 'Live wire near school must have safety risk >= 85');
  const vuln1 = vulnerabilityFor('public_safety', text1);
  assert.ok(vuln1 >= 90.0, 'School zone public safety vulnerability must be >= 90');
  
  const prio1 = computePriority({
    severity_score: sev1.severity_score,
    safety_risk: sev1.safety_risk,
    corroboration: 2,
    waiting_hours: 4,
    vulnerability: vuln1,
  });
  assert.ok(prio1.score >= 70.0, 'Live wire near school must have high/critical priority score');
  assert.ok(['critical', 'high'].includes(prio1.band));

  // Case 2: Corroboration increases priority score
  const prio2Single = computePriority({
    severity_score: 60,
    safety_risk: 50,
    corroboration: 1,
    waiting_hours: 2,
    vulnerability: 60,
  });
  const prio2Multiple = computePriority({
    severity_score: 60,
    safety_risk: 50,
    corroboration: 5,
    waiting_hours: 2,
    vulnerability: 60,
  });
  assert.ok(
    prio2Multiple.score > prio2Single.score,
    'Multiple corroborations must increase priority score'
  );

  // Case 3: Approaching/Breached SLA increases urgency factor
  const prioFresh = computePriority({
    severity_score: 60,
    safety_risk: 50,
    corroboration: 1,
    waiting_hours: 1,
    target_sla_hours: 24,
  });
  const prioOverdue = computePriority({
    severity_score: 60,
    safety_risk: 50,
    corroboration: 1,
    waiting_hours: 30,
    target_sla_hours: 24,
  });
  assert.ok(
    prioOverdue.factors.waiting.score > prioFresh.factors.waiting.score,
    'Overdue waiting score must be higher than fresh'
  );
});
