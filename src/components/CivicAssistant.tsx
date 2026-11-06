import React, { useState } from 'react';
import {
  Crosshair,
  MessageSquare,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  QUICK_REPLIES,
  buildNearbyResponse,
  confirmCandidateInChat,
  createInitialChatState,
  processChatTurn,
  redactPii,
} from '../services/chat';
import { CivicState } from '../store/civicStore';
import type { ChatMessage, LocationCandidate } from '../types/civic';

interface CivicAssistantProps {
  state: CivicState;
  onStateChange: () => void;
  onTrackToken: (token: string) => void;
  isFloating?: boolean;
  onClose?: () => void;
}

export const CivicAssistant: React.FC<CivicAssistantProps> = ({
  state,
  onStateChange,
  onTrackToken,
  isFloating = false,
  onClose,
}) => {
  const [dialogue, setDialogue] = useState(createInitialChatState);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        "Namaste! I'm the CivicFix assistant. I can help you report a civic problem (road, waste, drainage, water, electricity, safety), track a complaint, or find nearby issues. What do you need?",
      quick_replies: QUICK_REPLIES,
      scope: 'civic',
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');

  const sendText = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: redactPii(trimmed),
      at: new Date().toISOString(),
    };

    const { message: botMsg, nextDialogue } = processChatTurn({
      civicState: state,
      dialogue,
      userText: trimmed,
      onStateMutated: onStateChange,
    });

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setDialogue(nextDialogue);
    setInput('');
  };

  const handleUseGpsInChat = () => {
    const lat = 20.2969;
    const lon = 85.8242;
    if (dialogue.mode === 'intake') {
      const { message, nextDialogue } = confirmCandidateInChat(
        state,
        dialogue,
        { name: 'Engineering College Gate (GPS)', lat, lon, ward: 'Ward 12' },
        onStateChange
      );
      setMessages((prev) => [...prev, message]);
      setDialogue(nextDialogue);
    } else {
      const msg = buildNearbyResponse(state, lat, lon, 'Your GPS Location (Ward 12)');
      setMessages((prev) => [...prev, msg]);
    }
  };

  const handleCandidateClick = (cand: LocationCandidate) => {
    const { message, nextDialogue } = confirmCandidateInChat(
      state,
      dialogue,
      cand,
      onStateChange
    );
    setMessages((prev) => [...prev, message]);
    setDialogue(nextDialogue);
  };

  const handleFeedback = (msgId: string, score: 1 | -1) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: score } : m))
    );
  };

  return (
    <div
      className={`flex flex-col overflow-hidden bg-white ${
        isFloating
          ? 'h-[520px] w-[380px] rounded-2xl border border-slate-200/90 shadow-2xl'
          : 'mx-auto h-[640px] max-w-3xl rounded-2xl border border-slate-200/80 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              CivicFix Assistant
            </h2>
            <p className="text-[11px] text-slate-500">
              Multilingual grievance intake & live tracker
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDialogue(createInitialChatState());
              setMessages([
                {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content:
                    'Started a fresh session. How can I help with a civic issue today?',
                  quick_replies: QUICK_REPLIES,
                  scope: 'civic',
                  at: new Date().toISOString(),
                },
              ]);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Reset
          </button>
          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'border border-slate-200/80 bg-slate-50 text-slate-900'
              }`}
            >
              <p className="whitespace-pre-line">{m.content}</p>

              {/* Card: Location Candidates */}
              {m.card?.type === 'location_candidates' &&
                Array.isArray(m.card.candidates) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(m.card.candidates as LocationCandidate[]).map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleCandidateClick(c)}
                        className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        {c.name} ({c.ward})
                      </button>
                    ))}
                  </div>
                )}

              {/* Card: Complaint Created */}
              {m.card?.type === 'complaint_created' && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-800 shadow-2xs">
                  <p className="font-mono font-bold text-emerald-700">
                    {String(m.card.public_id)} · {String(m.card.category_label)}
                  </p>
                  <p className="mt-1 text-[11px]">
                    Tracking Secret:{' '}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold select-all text-slate-900">
                      {String(m.card.tracking_token)}
                    </code>
                  </p>
                  <button
                    type="button"
                    onClick={() => onTrackToken(String(m.card?.tracking_token || ''))}
                    className="mt-2 text-xs font-semibold text-emerald-700 hover:underline block"
                  >
                    Open in Complaint Tracker →
                  </button>
                </div>
              )}

              {/* Card: Status */}
              {m.card?.type === 'status' && (
                <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-2xs">
                  <div className="flex justify-between font-mono font-semibold">
                    <span>{String(m.card.public_id)}</span>
                    <span className="uppercase text-emerald-700">{String(m.card.status)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 tabular-nums">
                    Priority: {String(m.card.priority_band)} ({String(m.card.priority_score)}/100) ·{' '}
                    {String(m.card.citizens_affected)} citizen(s) affected
                  </p>
                </div>
              )}

              {/* Card: Nearby */}
              {m.card?.type === 'nearby' && Array.isArray(m.card.items) && (
                <div className="mt-2.5 space-y-1.5">
                  {(
                    m.card.items as Array<{
                      incident_id: string;
                      title: string;
                      distance_m: number;
                      citizens_affected: number;
                    }>
                  ).map((item) => (
                    <div
                      key={item.incident_id}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-semibold text-slate-900">{item.title}</span>
                      <span className="ml-1.5 font-mono text-slate-500 tabular-nums">
                        ({item.distance_m}m · {item.citizens_affected} affected)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick replies & feedback */}
            {m.role === 'assistant' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {m.quick_replies?.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => {
                      if (qr === 'Use my GPS') {
                        handleUseGpsInChat();
                      } else {
                        sendText(qr);
                      }
                    }}
                    className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    {qr === 'Use my GPS' && (
                      <Crosshair className="mr-1 inline h-3 w-3 text-emerald-600" />
                    )}
                    {qr}
                  </button>
                ))}
                {m.id !== 'msg_welcome' && (
                  <div className="ml-2 flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleFeedback(m.id, 1)}
                      aria-label="Helpful"
                      className={`p-1 hover:text-emerald-600 ${
                        m.feedback === 1 ? 'text-emerald-600' : ''
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(m.id, -1)}
                      aria-label="Not helpful"
                      className={`p-1 hover:text-red-600 ${
                        m.feedback === -1 ? 'text-red-600' : ''
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or describe an issue…"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
