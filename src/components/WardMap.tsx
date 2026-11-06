import React, { useState } from 'react';
import { Crosshair, Layers, MapPin } from 'lucide-react';
import { GAZETTEER, WARDS } from '../services/location';
import type { Incident, PriorityBand } from '../types/civic';

interface WardMapProps {
  incidents?: Incident[];
  selectedLat?: number | null;
  selectedLon?: number | null;
  onSelectCoords?: (lat: number, lon: number) => void;
  onSelectIncident?: (incident: Incident) => void;
  showLandmarks?: boolean;
  heightClass?: string;
}

// Bounding box for Bhubaneswar demo area
const MIN_LAT = 20.225;
const MAX_LAT = 20.335;
const MIN_LON = 85.795;
const MAX_LON = 85.865;

function toSvgX(lon: number): number {
  return ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * 800;
}

function toSvgY(lat: number): number {
  return 460 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 460;
}

function bandColor(band: PriorityBand): string {
  switch (band) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f59e0b';
    case 'medium':
      return '#10b981';
    default:
      return '#64748b';
  }
}

export const WardMap: React.FC<WardMapProps> = ({
  incidents = [],
  selectedLat,
  selectedLon,
  onSelectCoords,
  onSelectIncident,
  showLandmarks = true,
  heightClass = 'h-80',
}) => {
  const [hoveredIncident, setHoveredIncident] = useState<Incident | null>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelectCoords) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const lon = MIN_LON + relX * (MAX_LON - MIN_LON);
    const lat = MAX_LAT - relY * (MAX_LAT - MIN_LAT);
    onSelectCoords(
      Math.round(lat * 10000) / 10000,
      Math.round(lon * 10000) / 10000
    );
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200/90 bg-slate-900 shadow-xs">
      <svg
        viewBox="0 0 800 460"
        className={`w-full ${heightClass} select-none ${
          onSelectCoords ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onClick={handleSvgClick}
        role="img"
        aria-label="Bhubaneswar Municipal Wards and Civic Incidents Map"
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
          </radialGradient>
          <pattern id="dotPattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#334155" fillOpacity="0.3" />
          </pattern>
        </defs>

        <rect width="800" height="460" fill="url(#mapGlow)" />
        <rect width="800" height="460" fill="url(#dotPattern)" />

        {/* Major arterial corridors simulation (Janpath, NH-16, Rajpath, Cuttack Road) */}
        <g stroke="#334155" strokeWidth="2.5" strokeOpacity="0.5" strokeLinecap="round" fill="none">
          {/* NH-16 diagonal corridor */}
          <path d="M 40 420 Q 300 280 500 180 T 780 40" stroke="#475569" strokeWidth="3.5" strokeOpacity="0.6" />
          {/* Janpath North-South */}
          <path d="M 380 30 L 390 440" />
          {/* Rajpath East-West */}
          <path d="M 60 210 Q 400 230 760 220" />
          {/* Station link */}
          <path d="M 520 200 L 610 370" />
        </g>

        {/* Ward bounding areas */}
        {Object.entries(WARDS).map(([wardName, [minLa, maxLa, minLo, maxLo]]) => {
          const x = toSvgX(minLo);
          const y = toSvgY(maxLa);
          const w = toSvgX(maxLo) - x;
          const h = toSvgY(minLa) - y;
          return (
            <g key={wardName}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#0f172a"
                fillOpacity={0.4}
                stroke="#38bdf8"
                strokeWidth="1"
                strokeOpacity={0.25}
                strokeDasharray="3 3"
                rx="6"
              />
              <text
                x={x + 10}
                y={y + 18}
                fontSize="10"
                fontWeight="600"
                fill="#94a3b8"
                letterSpacing="0.05em"
              >
                {wardName.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Landmarks */}
        {showLandmarks &&
          GAZETTEER.map((g) => {
            const cx = toSvgX(g.lon);
            const cy = toSvgY(g.lat);
            return (
              <g
                key={g.name}
                className={onSelectCoords ? 'cursor-pointer group' : ''}
                onClick={(e) => {
                  if (onSelectCoords) {
                    e.stopPropagation();
                    onSelectCoords(g.lat, g.lon);
                  }
                }}
              >
                <circle cx={cx} cy={cy} r="3" fill="#64748b" />
                <circle cx={cx} cy={cy} r="6" fill="#64748b" fillOpacity="0.2" />
                <text
                  x={cx + 7}
                  y={cy + 3.5}
                  fontSize="9.5"
                  fill="#cbd5e1"
                  className="pointer-events-none select-none"
                  fontWeight="500"
                >
                  {g.name}
                </text>
              </g>
            );
          })}

        {/* Incident markers */}
        {incidents.map((inc) => {
          if (inc.lat === null || inc.lon === null) return null;
          const cx = toSvgX(inc.lon);
          const cy = toSvgY(inc.lat);
          const color = bandColor(inc.priority_band);
          const radius = Math.min(13, 6 + Math.sqrt(inc.citizens_affected) * 2.2);
          const isHovered = hoveredIncident?.id === inc.id;

          return (
            <g
              key={inc.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIncident(inc)}
              onMouseLeave={() => setHoveredIncident(null)}
              onClick={(e) => {
                if (onSelectIncident) {
                  e.stopPropagation();
                  onSelectIncident(inc);
                }
              }}
            >
              {/* Pulse glow on high/critical */}
              {(inc.priority_band === 'critical' || inc.priority_band === 'high') && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius + 8}
                  fill={color}
                  fillOpacity="0.2"
                >
                  <animate
                    attributeName="r"
                    values={`${radius + 4};${radius + 12};${radius + 4}`}
                    dur="2.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="fillOpacity"
                    values="0.3;0.05;0.3"
                    dur="2.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={color}
                stroke="#0f172a"
                strokeWidth={isHovered ? '2.5' : '1.5'}
              />
              {inc.citizens_affected > 1 && (
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#ffffff"
                  className="pointer-events-none"
                >
                  {inc.citizens_affected}
                </text>
              )}
            </g>
          );
        })}

        {/* Selected Pin */}
        {selectedLat !== null &&
          selectedLat !== undefined &&
          selectedLon !== null &&
          selectedLon !== undefined && (
            <g>
              <circle
                cx={toSvgX(selectedLon)}
                cy={toSvgY(selectedLat)}
                r="18"
                fill="#10b981"
                fillOpacity="0.3"
              />
              <circle
                cx={toSvgX(selectedLon)}
                cy={toSvgY(selectedLat)}
                r="7"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <circle
                cx={toSvgX(selectedLon)}
                cy={toSvgY(selectedLat)}
                r="2"
                fill="#064e3b"
              />
            </g>
          )}
      </svg>

      {/* Floating Hover Card */}
      {hoveredIncident && (
        <div className="absolute left-4 top-4 z-10 max-w-xs rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs text-white shadow-lg backdrop-blur-xs">
          <div className="flex items-center justify-between gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: bandColor(hoveredIncident.priority_band) }}
            />
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              {hoveredIncident.priority_band} ({hoveredIncident.priority_score})
            </span>
            <span className="text-slate-400">
              {hoveredIncident.citizens_affected} affected
            </span>
          </div>
          <p className="mt-1 font-medium text-slate-100">{hoveredIncident.title}</p>
          <p className="mt-0.5 text-slate-400">
            {hoveredIncident.ward_name || 'Bhubaneswar'} · Status:{' '}
            {hoveredIncident.status.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      {/* Footer / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Critical
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> High
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Medium
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> Low
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          <span>Odisha Geo-Grid</span>
          {onSelectCoords && (
            <span className="hidden sm:inline text-slate-500">· Click map to set pin</span>
          )}
        </div>
      </div>
    </div>
  );
};
