import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { AdminPortal } from './components/AdminPortal';
import { CivicAssistant } from './components/CivicAssistant';
import { CivicFooter } from './components/CivicFooter';
import { HomeHero } from './components/HomeHero';
import { ReportForm } from './components/ReportForm';
import { TrackComplaint } from './components/TrackComplaint';
import {
  CivicState,
  loadCivicState,
  resetCivicState,
  saveCivicState,
} from './store/civicStore';

type ActiveView = 'home' | 'report' | 'track' | 'assistant' | 'admin';
type UserRole = 'user' | 'official' | null;

export function App() {
  const [state, setState] = useState<CivicState>(() => loadCivicState());
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [trackToken, setTrackToken] = useState<string>('');
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'EN' | 'ଓଡ଼ିଆ' | 'हिन्दी'>('EN');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const handleStateChange = () => {
    saveCivicState(state);
    setState({ ...state });
  };

  const handleResetDemo = () => {
    const fresh = resetCivicState();
    setState(fresh);
    setTrackToken('');
  };

  const handleTrackToken = (token: string) => {
    setTrackToken(token);
    setActiveView('track');
    setIsChatDrawerOpen(false);
  };

  const handleSelectRole = (role: 'user' | 'official') => {
    setUserRole(role);
    if (role === 'user') {
      setActiveView('report');
    } else {
      setActiveView('admin');
    }
  };

  // Build dynamic navigation links:
  // "File Complaint" is visible ONLY if someone selects "I am a user" on the home page!
  const navItems = [
    { key: 'home' as const, label: 'Home' },
    ...(userRole === 'user' ? [{ key: 'report' as const, label: 'File Complaint' }] : []),
    { key: 'track' as const, label: 'Track & Verify' },
    { key: 'admin' as const, label: 'Official Portal' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-600 selection:text-white">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('home')}
            className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="font-display font-bold">
              Civic<span className="text-emerald-500">Fix</span>
            </span>
          </button>

          {/* Zone 2: Navigation links */}
          <nav className="hidden md:flex items-center gap-7 overflow-x-auto text-sm font-medium text-slate-600">
            {navItems.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  activeView === key
                    ? 'text-emerald-600 font-bold border-b-2 border-emerald-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language and Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Active Role Indicator */}
            {userRole && (
              <div className="hidden lg:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800 capitalize">{userRole} Mode</span>
                <button
                  type="button"
                  onClick={() => {
                    setUserRole(null);
                    setActiveView('home');
                  }}
                  className="ml-1 text-[11px] text-slate-400 hover:text-slate-800 underline"
                  title="Switch Role"
                >
                  Switch
                </button>
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Globe className="h-4 w-4 text-slate-500" />
                <span>{selectedLang}</span>
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
                  {(['EN', 'ଓଡ଼ିଆ', 'हिन्दी'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => {
                        setSelectedLang(l);
                        setLangMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setUserRole('official');
                setActiveView('admin');
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap transition-colors"
            >
              <span>Official Login</span>
            </button>

            {/* File Complaint button: Only shown if user has selected "I am a user" */}
            {userRole === 'user' ? (
              <button
                type="button"
                onClick={() => setActiveView('report')}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-600 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>File Complaint</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSelectRole('user')}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
              >
                <User className="h-3.5 w-3.5" />
                <span>I am a User</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile secondary navigation strip */}
        <div className="flex md:hidden border-t border-slate-100 overflow-x-auto px-4 py-2 gap-4 text-xs font-semibold text-slate-600">
          {navItems.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={`whitespace-nowrap shrink-0 ${
                activeView === key ? 'text-emerald-700 font-bold' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {activeView === 'home' && (
          <HomeHero
            state={state}
            onSelectRole={handleSelectRole}
            onQuickTrack={() => setActiveView('track')}
          />
        )}

        {/* File Complaint section: Visible only if user role is selected */}
        {activeView === 'report' && (
          userRole === 'user' ? (
            <ReportForm
              state={state}
              onStateChange={handleStateChange}
              onTrackToken={handleTrackToken}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto shadow-xs my-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <User className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                User Role Selection Required
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                The File Complaint portal is reserved for registered or anonymous public users.
                Please confirm you are a user to continue.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectRole('user')}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors"
                >
                  I am a User (Continue)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Return to Home
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'track' && (
          <TrackComplaint
            state={state}
            initialToken={trackToken}
            onStateChange={handleStateChange}
          />
        )}

        {activeView === 'assistant' && (
          <CivicAssistant
            state={state}
            onStateChange={handleStateChange}
            onTrackToken={handleTrackToken}
          />
        )}

        {activeView === 'admin' && (
          <AdminPortal state={state} onStateChange={handleStateChange} />
        )}
      </main>

      {/* Floating Bottom-Right Action Buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
        {/* Floating AI Assistant Drawer */}
        {isChatDrawerOpen && (
          <div className="relative mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <CivicAssistant
              state={state}
              onStateChange={handleStateChange}
              onTrackToken={handleTrackToken}
              isFloating
              onClose={() => setIsChatDrawerOpen(false)}
            />
          </div>
        )}

        {/* AI Assistant Toggle Button (Upper Green Circle) */}
        <button
          type="button"
          onClick={() => setIsChatDrawerOpen((prev) => !prev)}
          aria-label="Toggle AI Assistant"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none"
        >
          {isChatDrawerOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
        </button>

        {/* Quick File Complaint FAB (Lower Green Circle): Shown when user is in User mode */}
        {userRole === 'user' && (
          <button
            type="button"
            onClick={() => setActiveView('report')}
            aria-label="File Complaint"
            title="File Complaint"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Comprehensive Civic Footer with Slogans, Helping Handles, and Sample Tags */}
      <CivicFooter
        userRole={userRole}
        onNavigate={(view) => {
          if (view === 'report' && userRole !== 'user') {
            handleSelectRole('user');
          } else {
            setActiveView(view);
          }
        }}
        onResetDemo={handleResetDemo}
      />
    </div>
  );
}

export default App;
