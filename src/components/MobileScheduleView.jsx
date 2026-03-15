// Mobile-first zoomable schedule heatmap with progressive content disclosure
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { pgyLevels } from '../data/scheduleData';
import { getRotationColor } from '../utils/scheduleUtils';
import { X } from 'lucide-react';

const CELL_SIZE_MIN = 24;  // Min size at default zoom
const CELL_SIZE_MAX = 200; // Max size when fully zoomed
const CELL_SIZE_DEFAULT = 40; // Default mobile size

// Determine what text to show based on zoom level
const getContentLevel = (zoom) => {
  if (zoom < 1.5) return 'none';      // Just color
  if (zoom < 2.5) return 'abbrev';    // Rotation abbreviation
  if (zoom < 4) return 'label';       // Full rotation name
  return 'full';                       // Full details + icons
};

const abbreviateRotation = (rotation) => {
  if (!rotation) return '';
  return rotation.split(' ').map(w => w[0]).join('').slice(0, 3);
};

export default function MobileScheduleView({
  fellows,
  schedule,
  vacations = [],
  blockDates = [],
  dateCallMap = {},
  onSelectCell,
}) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Selected cell for detail panel
  const [selectedCell, setSelectedCell] = useState(null);

  const cellSize = Math.max(CELL_SIZE_MIN, Math.min(CELL_SIZE_MAX, CELL_SIZE_DEFAULT * zoom));
  const contentLevel = getContentLevel(zoom);

  // Precompute vacation set
  const vacationSet = useMemo(() => {
    const s = new Set();
    (vacations || []).forEach((v) => {
      if (v.status !== 'approved') return;
      for (let b = v.startBlock; b <= v.endBlock; b++) {
        s.add(`${v.fellow}#${b}`);
      }
    });
    return s;
  }, [vacations]);

  const isBlockInVacation = (fellow, blockNumber) =>
    vacationSet.has(`${fellow}#${blockNumber}`);

  // Group fellows by PGY
  const fellowsByPGY = useMemo(() => ({
    4: fellows.filter((f) => pgyLevels[f] === 4),
    5: fellows.filter((f) => pgyLevels[f] === 5),
    6: fellows.filter((f) => pgyLevels[f] === 6),
  }), [fellows]);

  const allFellows = useMemo(() =>
    [...fellowsByPGY[4], ...fellowsByPGY[5], ...fellowsByPGY[6]],
    [fellowsByPGY]
  );

  // Handle pinch zoom
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const newZoom = Math.max(0.5, Math.min(8, zoom * (1 - e.deltaY * 0.001)));
    setZoom(newZoom);
  }, [zoom]);

  // Handle pan with mouse
  const handleMouseDown = (e) => {
    if (e.button !== 2 && !e.ctrlKey && !e.metaKey) return; // Right click or Ctrl+click
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Handle touch pinch zoom and pan
  const touchRef = useRef({ distance: 0, initialZoom: 1 });

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.distance = Math.sqrt(dx * dx + dy * dy);
      touchRef.current.initialZoom = zoom;
    } else if (e.touches.length === 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const ratio = newDistance / touchRef.current.distance;
      const newZoom = Math.max(0.5, Math.min(8, touchRef.current.initialZoom * ratio));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isPanning) {
      setPan({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    if (isPanning) setIsPanning(false);
    touchRef.current = { distance: 0, initialZoom: 1 };
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheel, isPanning, pan, panStart]);

  const renderCell = (fellow, blockIdx) => {
    const blockNumber = blockIdx + 1;
    const rotation = schedule[fellow]?.[blockIdx] ?? '';
    const isVacation = isBlockInVacation(fellow, blockNumber);
    const baseColor = rotation ? getRotationColor(rotation) : 'bg-gray-100 dark:bg-gray-700';

    return (
      <button
        key={`${fellow}-${blockIdx}`}
        onClick={() => setSelectedCell({ fellow, blockIdx, rotation, isVacation })}
        className={`
          ${baseColor}
          ${isVacation ? 'opacity-40 border-2 border-yellow-400' : ''}
          border border-gray-300 dark:border-gray-600
          flex items-center justify-center
          text-[10px] font-semibold text-white
          transition-transform hover:scale-105
          cursor-pointer
        `}
        style={{
          width: cellSize,
          height: cellSize,
          fontSize: Math.max(8, cellSize * 0.3),
          opacity: isVacation ? 0.4 : 1,
        }}
        title={`${fellow} - Block ${blockNumber}: ${rotation || 'Unassigned'}`}
      >
        {contentLevel === 'none' && null}
        {contentLevel === 'abbrev' && rotation && (
          <span>{abbreviateRotation(rotation)}</span>
        )}
        {contentLevel === 'label' && rotation && (
          <span className="text-center leading-tight px-1">{rotation}</span>
        )}
        {contentLevel === 'full' && rotation && (
          <div className="text-center leading-tight px-1">
            <div className="font-bold">{rotation}</div>
            {isVacation && <div className="text-[8px]">VAC</div>}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="font-bold text-lg">Schedule</h2>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {(zoom * 100).toFixed(0)}% · {allFellows.length} fellows × {blockDates.length} blocks
          </div>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Pinch to zoom · Drag to pan
        </div>
      </div>

      {/* Main scrollable container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 relative"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid container */}
          <div className="inline-flex">
            {/* Row headers (sticky left) */}
            <div className="flex flex-col sticky left-0 z-10 bg-white dark:bg-gray-800">
              {/* Top-left corner */}
              <div
                style={{
                  width: Math.max(80, cellSize * 2),
                  height: cellSize,
                  minWidth: 80,
                }}
                className="flex items-center justify-center font-bold text-xs border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
              >
                Fellows
              </div>
              {/* Fellow names */}
              {allFellows.map((fellow) => (
                <div
                  key={`row-${fellow}`}
                  style={{
                    width: Math.max(80, cellSize * 2),
                    height: cellSize,
                    minWidth: 80,
                  }}
                  className="flex items-center justify-center font-semibold text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 truncate px-1"
                  title={fellow}
                >
                  {fellow}
                </div>
              ))}
            </div>

            {/* Columns (blocks) */}
            <div className="flex flex-col">
              {/* Column headers (sticky top) */}
              <div className="sticky top-0 z-10 flex bg-white dark:bg-gray-800">
                {blockDates.map((bd, idx) => (
                  <div
                    key={`col-${idx}`}
                    style={{ width: cellSize, height: cellSize }}
                    className="flex items-center justify-center font-bold text-[10px] border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
                    title={`Block ${idx + 1}`}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Data cells */}
              {allFellows.map((fellow) => (
                <div key={`row-data-${fellow}`} className="flex">
                  {blockDates.map((_, blockIdx) =>
                    renderCell(fellow, blockIdx)
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls (mobile) */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setZoom(Math.min(8, zoom * 1.2))}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm"
        >
          +
        </button>
        <div className="text-xs font-semibold text-center w-8 text-gray-700 dark:text-gray-300">
          {(zoom * 100).toFixed(0)}%
        </div>
        <button
          onClick={() => setZoom(Math.max(0.5, zoom / 1.2))}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 py-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold rounded text-xs"
        >
          Reset
        </button>
      </div>

      {/* Detail panel */}
      {selectedCell && (
        <div className="absolute inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-2xl p-4 max-h-1/2 overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{selectedCell.fellow}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Block {selectedCell.blockIdx + 1}
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Rotation</div>
                <div className="text-lg font-bold">{selectedCell.rotation || 'Unassigned'}</div>
              </div>

              {selectedCell.isVacation && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    Vacation
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  onSelectCell?.(selectedCell);
                  setSelectedCell(null);
                }}
                className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded"
              >
                Edit Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
