// SwapPreview.jsx
// Collapsible schedule-context grid for a pending swap (starts folded).
//
// Per-day logic (matching the calendar view):
//   Call   → Sat = C, Sun = C   (call covers full weekend)
//   Float  → Sat = F, Sun = X   (float is Saturday night only)
//   Nights → Sat = X, Sun = N   (nights rotation covers Sunday night)
//   Off    → Sat = X, Sun = X
//
// Row colours:
//   Yellow → give or receive row (no conflict)
//   Red    → receive row where person already has duty (conflict)

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { abbreviateRotation, weekendStatuses, hasDuty } from '../../utils/vacationHelpers';
import { blockDates as localBlockDates } from '../../data/scheduleData';

const STATUS_STYLE = {
  C: 'text-orange-600 dark:text-orange-400 font-bold',
  F: 'text-blue-600  dark:text-blue-400  font-bold',
  N: 'text-purple-600 dark:text-purple-400 font-bold',
  X: 'text-gray-400  dark:text-gray-500',
};

// Returns the Saturday date for a given parent blockNum + weekPart (1 or 2).
// Uses the same algorithm as CallView / workHourChecker.
function getSatDate(blockNum, wk) {
  const bd = localBlockDates.find(b => b.block === blockNum);
  if (!bd) return null;
  // Parse as local noon to avoid DST/timezone shift
  const [y, m, d] = bd.start.split('-').map(Number);
  const start = new Date(y, m - 1, d, 12, 0, 0);
  const daysUntilSat = (6 - start.getDay() + 7) % 7;
  const sat = new Date(start);
  sat.setDate(start.getDate() + daysUntilSat + (wk === 2 ? 7 : 0));
  return sat.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// PersonGrid: shows schedule context for one person.
//   giveBlock/giveWk    = shift being given away          → yellow
//   receiveBlock/receiveWk = shift being received         → yellow (or red if conflict)
function PersonGrid({ name, giveBlock, giveWk, receiveBlock, receiveWk, getBlockDetails }) {
  if (!giveBlock) return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold mb-1 text-blue-800 dark:text-blue-200 truncate">{name}</div>
      <div className="text-[10px] text-gray-400 italic">Block unknown</div>
    </div>
  );

  // Core range: giveBlock ± 1; extend to include receiveBlock if outside that window
  const rangeMin = Math.max(1, giveBlock - 1);
  const rangeMax = Math.min(26, giveBlock + 1);
  const blockSet = new Set();
  for (let b = rangeMin; b <= rangeMax; b++) blockSet.add(b);
  if (receiveBlock && receiveBlock < rangeMin) {
    for (let b = Math.max(1, receiveBlock); b < rangeMin; b++) blockSet.add(b);
  } else if (receiveBlock && receiveBlock > rangeMax) {
    for (let b = rangeMax + 1; b <= Math.min(26, receiveBlock); b++) blockSet.add(b);
  }
  const blockRange = Array.from(blockSet).sort((a, b) => a - b);

  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold mb-1 text-blue-800 dark:text-blue-200 truncate">{name}</div>
      <table className="w-full border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="text-gray-400 dark:text-gray-500 border-b border-blue-200 dark:border-blue-700">
            <th className="px-0.5 pb-0.5 text-left   font-normal">Rot</th>
            <th className="px-0.5 pb-0.5 text-center font-normal">Date</th>
            <th className="px-0.5 pb-0.5 text-center font-normal">Sa</th>
            <th className="px-0.5 pb-0.5 text-center font-normal">Su</th>
          </tr>
        </thead>
        <tbody>
          {blockRange.flatMap(block => {
            const details  = getBlockDetails(name, block);
            const rotation = details?.find(d => d.label === 'Rotation')?.value ?? '—';
            const rotAbbr  = abbreviateRotation(rotation);
            return [1, 2].map(wk => {
              const { sat, sun } = weekendStatuses(details, wk);
              const isGive    = block === giveBlock    && wk === giveWk;
              const isReceive = receiveBlock != null && block === receiveBlock && wk === receiveWk;
              const conflict  = isReceive && hasDuty({ sat, sun });
              const rowClass  = conflict
                ? 'bg-red-100 dark:bg-red-900/40'
                : (isGive || isReceive)
                ? 'bg-yellow-100 dark:bg-yellow-900/40'
                : '';
              const dateLabel = getSatDate(block, wk) ?? `B${block}W${wk}`;
              return (
                <tr key={`${block}-${wk}`} className={rowClass}>
                  <td className="px-0.5 py-px text-left   text-gray-600 dark:text-gray-300">{rotAbbr}</td>
                  <td className="px-0.5 py-px text-center text-gray-500 dark:text-gray-400">{dateLabel}</td>
                  <td className={`px-0.5 py-px text-center ${STATUS_STYLE[sat]}`}>{sat}</td>
                  <td className={`px-0.5 py-px text-center ${STATUS_STYLE[sun]}`}>{sun}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SwapPreview({ requester, target, reqBlock, fromWk, tgtBlock, toWk, getBlockDetails }) {
  const [open, setOpen] = useState(false);

  if (!requester || !target || requester === target || !getBlockDetails) return null;
  if (!reqBlock && !tgtBlock) return null;

  // Requester: gives reqBlock/fromWk, receives tgtBlock/toWk
  // Target:    gives tgtBlock/toWk,  receives reqBlock/fromWk
  const resolvedTgtBlock = tgtBlock ?? reqBlock;

  return (
    <div className="mt-2 rounded border border-blue-200 dark:border-blue-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[10px] font-semibold text-blue-700 dark:text-blue-300 transition-colors"
      >
        <span>Schedule context</span>
        {open
          ? <ChevronDown className="w-3 h-3 shrink-0" />
          : <ChevronRight className="w-3 h-3 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-2 pb-2 pt-1.5 bg-blue-50 dark:bg-blue-900/20">
          <div className="grid grid-cols-2 gap-3">
            <PersonGrid
              name={requester}
              giveBlock={reqBlock}
              giveWk={fromWk}
              receiveBlock={resolvedTgtBlock}
              receiveWk={toWk}
              getBlockDetails={getBlockDetails}
            />
            <PersonGrid
              name={target}
              giveBlock={resolvedTgtBlock}
              giveWk={toWk}
              receiveBlock={reqBlock}
              receiveWk={fromWk}
              getBlockDetails={getBlockDetails}
            />
          </div>
          <div className="mt-1.5 flex gap-2 flex-wrap text-[9px] text-gray-400 dark:text-gray-500">
            <span>C = Call (Sa+Su)</span>
            <span>F = Float (Sa)</span>
            <span>N = Nights (Su)</span>
            <span>X = Off</span>
            <span className="text-yellow-600 dark:text-yellow-400">■ = swap wknd</span>
            <span className="text-red-600 dark:text-red-400">■ = conflict</span>
          </div>
        </div>
      )}
    </div>
  );
}
