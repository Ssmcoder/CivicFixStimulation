import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import { GAZETTEER, wardFor } from '../services/location';
import { CATEGORIES, CATEGORY_SHORT } from '../services/taxonomy';
import type { Incident, PriorityBand } from '../types/civic';

// Configure MapLibre Web Worker for Vite
try {
  if (typeof window !== 'undefined') {
    setWorkerUrl(workerUrl);
  }
} catch {
  // Ignore worker setting if server-side
}

export interface LiveMapIncident {
  id: string;
  title: string;
  category: string;
  priority_band: PriorityBand;
  priority_score: number;
  citizens_affected: number;
  lat: number;
  lon: number;
  ward_name?: string | null;
  status?: string;
}

interface LiveLeafletMapProps {
  centerLat?: number;
  centerLon?: number;
  zoom?: number;
  pinLat?: number | null;
  pinLon?: number | null;
  draggablePin?: boolean;
  onPinChange?: (lat: number, lon: number, wardName: string | null) => void;
  incidents?: LiveMapIncident[];
  onSelectIncident?: (incident: LiveMapIncident) => void;
  heightClass?: string;
  className?: string;
  showLandmarks?: boolean;
  interactive?: boolean;
}

// Custom Google Maps-style pin SVG generator
function createGooglePinIcon(color: string, label?: string, isUserPin = false): L.DivIcon {
  const size = isUserPin ? 42 : 34;
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); transition: transform 0.15s ease;">
      <svg viewBox="0 0 384 512" width="${size}" height="${size}" fill="${color}" style="display: block;">
        <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
      </svg>
      <div style="position: absolute; top: ${isUserPin ? '10px' : '8px'}; left: 50%; transform: translateX(-50%); width: ${isUserPin ? '16px' : '14px'}; height: ${isUserPin ? '16px' : '14px'}; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: ${color}; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
        ${label || ''}
      </div>
      ${isUserPin ? '<div style="position: absolute; bottom: -2px; width: 10px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%;"></div>' : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-google-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function getPriorityColor(band: PriorityBand): string {
  switch (band) {
    case 'critical':
      return '#ea4335'; // Google Red
    case 'high':
      return '#fbbc04'; // Google Amber
    case 'medium':
      return '#34a853'; // Google Green
    default:
      return '#4285f4'; // Google Blue
  }
}

export const LiveLeafletMap: React.FC<LiveLeafletMapProps> = ({
  centerLat = 20.2969,
  centerLon = 85.8242,
  zoom = 14,
  pinLat,
  pinLon,
  draggablePin = false,
  onPinChange,
  incidents = [],
  onSelectIncident,
  heightClass = 'h-80',
  className = '',
  showLandmarks = true,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeWard, setActiveWard] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = pinLat ?? centerLat;
    const initialLon = pinLon ?? centerLon;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom,
      zoomControl: false, // We use custom Google Maps styled zoom buttons
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Add Attribution in bottom-right
    L.control
      .attribution({
        prefix:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OSM</a>',
        position: 'bottomright',
      })
      .addTo(map);

    // Layer groups for markers
    incidentsLayerRef.current = L.layerGroup().addTo(map);
    landmarksLayerRef.current = L.layerGroup().addTo(map);

    // Layer initialization: OpenFreeMap Bright vector style with raster fallback
    let layerAdded = false;
    try {
      const glLayer = maplibreGL({
        style: 'https://tiles.openfreemap.org/styles/bright',
      });
      glLayer.addTo(map);
      layerAdded = true;
    } catch {
      // Fallback below
    }

    if (!layerAdded) {
      // Fallback: Google Maps lookalike Voyager raster tiles
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);
    }

    // Click handler to drop/move pin
    if (interactive && onPinChange) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = Math.round(e.latlng.lat * 10000) / 10000;
        const lon = Math.round(e.latlng.lng * 10000) / 10000;
        const ward = wardFor(lat, lon);
        onPinChange(lat, lon, ward);
      });
    }

    // Invalidate size on load
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update User Pin Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pinLat !== null && pinLat !== undefined && pinLon !== null && pinLon !== undefined) {
      const ward = wardFor(pinLat, pinLon);
      setActiveWard(ward);

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([pinLat, pinLon]);
      } else {
        const pinIcon = createGooglePinIcon('#10b981', '★', true);
        const marker = L.marker([pinLat, pinLon], {
          icon: pinIcon,
          draggable: draggablePin,
          zIndexOffset: 1000,
        }).addTo(map);

        if (draggablePin && onPinChange) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            const lat = Math.round(pos.lat * 10000) / 10000;
            const lon = Math.round(pos.lng * 10000) / 10000;
            const newWard = wardFor(lat, lon);
            onPinChange(lat, lon, newWard);
          });
        }

        userMarkerRef.current = marker;
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
      setActiveWard(null);
    }
  }, [pinLat, pinLon, draggablePin, onPinChange]);

  // Update Incidents Layer in Real-Time
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = incidentsLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    incidents.forEach((inc) => {
      if (!inc.lat || !inc.lon) return;

      const color = getPriorityColor(inc.priority_band);
      const icon = createGooglePinIcon(
        color,
        inc.citizens_affected > 1 ? String(inc.citizens_affected) : undefined
      );

      const marker = L.marker([inc.lat, inc.lon], { icon });

      // Google Maps style popup card
      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; min-width: 190px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${color}; letter-spacing: 0.5px;">
              ${CATEGORY_SHORT[inc.category as keyof typeof CATEGORY_SHORT] || inc.category}
            </span>
            <span style="font-size: 10px; font-weight: 700; background: #f1f5f9; padding: 2px 6px; border-radius: 999px; color: #334155;">
              ${inc.priority_band.toUpperCase()} · ${inc.priority_score}
            </span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 4px;">
            ${inc.title}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${inc.ward_name || 'Bhubaneswar'} · ${inc.citizens_affected} citizen(s) affected
          </div>
          <button id="view-inc-${inc.id}" style="width: 100%; font-size: 11px; font-weight: 600; background: #0284c7; color: #ffffff; border: none; border-radius: 6px; padding: 5px 8px; cursor: pointer;">
            Select / View Details
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: true,
        className: 'google-maps-styled-popup',
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-inc-${inc.id}`);
        if (btn && onSelectIncident) {
          btn.onclick = () => onSelectIncident(inc);
        }
      });

      marker.addTo(layer);
    });
  }, [incidents, onSelectIncident]);

  // Update Landmarks Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = landmarksLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (showLandmarks) {
      GAZETTEER.forEach((g) => {
        const landmarkIcon = L.divIcon({
          html: `
            <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.95); border: 1px solid #cbd5e1; box-shadow: 0 2px 5px rgba(0,0,0,0.14); padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 600; color: #1e293b; white-space: nowrap; pointer-events: auto; cursor: pointer;">
              <span style="display: inline-block; width: 6px; height: 6px; background: #0284c7; border-radius: 50%;"></span>
              <span>${g.name}</span>
            </div>
          `,
          className: 'custom-landmark-chip',
          iconSize: [120, 20],
          iconAnchor: [60, 10],
        });

        const marker = L.marker([g.lat, g.lon], { icon: landmarkIcon });
        if (onPinChange) {
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onPinChange(g.lat, g.lon, g.ward);
            map.flyTo([g.lat, g.lon], 16, { duration: 0.8 });
          });
        }
        marker.addTo(layer);
      });
    }
  }, [showLandmarks, onPinChange]);

  const handleFlyTo = (lat: number, lon: number, zoomLevel = 16) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([lat, lon], zoomLevel, { duration: 1.0 });
    }
  };

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        const ward = wardFor(lat, lon);
        if (onPinChange) onPinChange(lat, lon, ward);
        handleFlyTo(lat, lon, 16);
      },
      () => {
        // Fallback to Master Canteen Bhubaneswar
        const lat = 20.2969;
        const lon = 85.8242;
        const ward = wardFor(lat, lon);
        if (onPinChange) onPinChange(lat, lon, ward);
        handleFlyTo(lat, lon, 16);
      }
    );
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-xs ${
        isFullscreen ? 'fixed inset-4 z-50 h-auto' : heightClass
      } ${className}`}
    >
      {/* Live Map Canvas Container */}
      <div ref={mapContainerRef} className="h-full w-full z-0 select-none" />

      {/* Top Floating Bar: Google Maps style Search & Landmarks Jump */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-md">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          </div>
          <span>OpenFreeMap Live</span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-normal text-slate-500">
            {incidents.length} incidents plotted
          </span>
        </div>

        {/* Quick Jump Landmark Dropdown */}
        <div className="hidden sm:block">
          <select
            onChange={(e) => {
              const g = GAZETTEER.find((item) => item.name === e.target.value);
              if (g) {
                handleFlyTo(g.lat, g.lon, 16);
                if (onPinChange) onPinChange(g.lat, g.lon, g.ward);
              }
            }}
            defaultValue=""
            className="rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-md focus:border-emerald-500 focus:outline-none"
          >
            <option value="" disabled>
              Jump to Landmark...
            </option>
            {GAZETTEER.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.ward})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Right Controls: Fullscreen Toggle */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsFullscreen((p) => !p);
            setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-md hover:bg-slate-50 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand Map'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Bottom Right: Google Maps Styled Zoom & Locate Me Stack */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col items-center gap-2">
        {/* GPS Locate Me Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-md hover:bg-slate-50 hover:text-emerald-600 transition-colors"
          title="Detect Current GPS Location"
        >
          <Crosshair className="h-5 w-5" />
        </button>

        {/* Zoom In & Out Stack */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors border-b border-slate-200"
            title="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
            title="Zoom Out"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom Left: Live Coordinates & Ward Tag */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 text-xs">
        {pinLat !== null && pinLat !== undefined && pinLon !== null && pinLon !== undefined ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Pin: {pinLat.toFixed(4)}° N, {pinLon.toFixed(4)}° E</span>
            {activeWard && (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                {activeWard}
              </span>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm backdrop-blur-xs">
            <MapPin className="h-3 w-3 text-emerald-600" />
            <span>Click map to set complaint location</span>
          </div>
        )}
      </div>
    </div>
  );
};
