// src/components/ScheduleView.jsx
import React, { useMemo, useState } from "react";
import { blockDates, pgyLevels } from "../data/scheduleData";
import { getRotationColor, getPGYColor, getBlockDisplay, formatDate } from "../utils/scheduleUtils";

// vacations shape assumed (from your data):
// [{ fellow: 'Name', startBlock: 3, endBlock: 4, reason: 'Vacation' }, ...]
// Blocks are 1-based in vacations.

const isBlockInVacation = (vacations, fellow, blockNumber) => {
  return vacations.some(
    (v) =>
      v.fellow === fellow &&
      v.reason === "Vacation" &&
      blockNumber >= v.startBlock &&
      blockNumber <= v.endBlock
  );
};

const toggleVacationBlock = (vacations, fellow, blockNumber) => {
  // If block is currently vacation -> remove it.
  // If not -> add it.
  // We keep it simple and then compress into contiguous ranges.

  const expanded = new Set();

  vacations.forEach((v) => {
    if (v.fellow !== fellow || v.reason !== "Vacation") return;
    for (let b = v.startBlock; b <= v.endBlock; b++) expanded.add(b);
  });

  if (expanded.has(blockNumber)) expanded.delete(blockNumber);
  else expanded.add(blockNumber);

  const sorted = Array.from(expanded).sort((a, b) => a - b);

  // Keep all other fellows' vacations untouched
  const others = vacations.filter((v) => !(v.fellow === fellow && v.reason === "Vacation"));

  // Compress sorted blocks into ranges
  const nextRanges = [];
  let start = null;
  let prev = null;

  for (const b of sorted) {
    if (start === null) {
      start = b;
      prev = b;
      continue;
    }
    if (b === prev + 1) {
      prev = b;
      continue;
    }
    nextRanges.push({ fellow, startBlock: start, endBlock: prev, reason: "Vacation" });
    start = b;
    prev = b;
  }
  if (start !== null) nextRanges.push({ fellow, startBlock: start, endBlock: prev, reason: "Vacation" });

  return [...others, ...nextRanges];
};

export default function ScheduleView({
  fellows,
  schedule,
  vacations,
  onScheduleChange,
  onVacationsChange, // NEW
}) {
  const [draggedCell, setDraggedCell] = useState(null);
  const [validationWarning, setValidationWarning] = useState(null);

  const [vacMode, setVacMode] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  const rotationGroups = useMemo(() => {
    const groups = [];
    let currentRotation = null;
    let startIdx = 0;

    blockDates.forEach((bd, idx) => {
      if (bd.rotation !== currentRotation) {
        if (currentRotation !== null) {
          groups.push({ rotation: currentRotation, start: startIdx, end: idx - 1 });
        }
        currentRotation = bd.rotation;
        startIdx = idx;
      }
    });
    groups.push({ rotation: currentRotation, start: startIdx, end: blockDates.length - 1 });
    return groups;
  }, []);

const handleDragStart = (fellow, blockIdx) => {
  if (vacMode) return;

  const blockNumber = blockIdx + 1;
  if (isBlockInVacation(vacations, fellow, blockNumber)) {
    setValidationWarning("Can't drag a vacation block. Toggle Vacation Mode to edit vacation.");
    return;
  }

  setDraggedCell({ fellow, blockIdx });
};


  const handleDragOver = (e) => {
    e.preventDefault();
  };

const handleDrop = (targetFellow, targetBlockIdx) => {
  if (vacMode) return;
  if (!draggedCell) return;

  const fromBlockNumber = draggedCell.blockIdx + 1;
  const toBlockNumber = targetBlockIdx + 1;

  const fromIsVac = isBlockInVacation(vacations, draggedCell.fellow, fromBlockNumber);
  const toIsVac = isBlockInVacation(vacations, targetFellow, toBlockNumber);

  if (fromIsVac || toIsVac) {
    setValidationWarning("Can't swap into or out of a vacation block. Toggle Vacation Mode to change vacation.");
    setDraggedCell(null);
    return;
  }

  const newSchedule = { ...schedule };

  newSchedule[draggedCell.fellow] = [...newSchedule[draggedCell.fellow]];
  newSchedule[targetFellow] = [...newSchedule[targetFellow]];

  const temp = newSchedule[draggedCell.fellow][draggedCell.blockIdx];
  newSchedule[draggedCell.fellow][draggedCell.blockIdx] = newSchedule[targetFellow][targetBlockIdx];
  newSchedule[targetFellow][targetBlockIdx] = temp;

  onScheduleChange(newSchedule);
  setDraggedCell(null);
  setValidationWarning(null);
};


  const paintVacation = (fellow, blockIdx) => {
    if (!onVacationsChange) {
      setValidationWarning("Vacation editing is not wired. Pass onVacationsChange from App.");
      return;
    }
    const blockNumber = blockIdx + 1; // 1-based
    const next = toggleVacationBlock(vacations, fellow, blockNumber);
    onVacationsChange(next);
  };

  const handleCellMouseDown = (fellow, idx) => {
    if (!vacMode) return;
    setMouseDown(true);
    paintVacation(fellow, idx);
  };

  const handleCellMouseEnter = (fellow, idx) => {
    if (!vacMode) return;
    if (!mouseDown) return;
    paintVacation(fellow, idx);
  };

  const handleMouseUpAnywhere = () => {
    if (mouseDown) setMouseDown(false);
  };

  return (
    <div className="space-y-2" onMouseUp={handleMouseUpAnywhere} onMouseLeave={handleMouseUpAnywhere}>
      {validationWarning && (
        <div className="bg-red-50 border-2 border-red-300 rounded p-2 text-xs text-red-800">
          ⚠️ {validationWarning}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-700 font-semibold">
          Drag to swap rotations. Toggle Vacation Mode to paint vacation blocks.
        </div>

        <button
          type="button"
          onClick={() => {
            setVacMode((v) => !v);
            setDraggedCell(null);
            setValidationWarning(null);
          }}
          className={`px-3 py-1 text-xs font-semibold rounded border ${
            vacMode ? "bg-red-600 text-white border-red-700" : "bg-white text-gray-800 border-gray-300"
          }`}
          title="When on, click-drag cells to mark vacation blocks"
        >
          {vacMode ? "Vacation Mode: ON" : "Vacation Mode: OFF"}
        </button>
      </div>

      <div className="bg-white rounded border-2 border-gray-400 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="sticky left-0 bg-gray-100 border-r-2 border-gray-400 px-2 py-0.5 w-20"></th>
                {rotationGroups.map((group, idx) => (
                  <th
                    key={idx}
                    colSpan={group.end - group.start + 1}
                    className="border-r-2 border-gray-400 px-1 py-0.5 text-center font-bold"
                  >
                    Rot {group.rotation}
                  </th>
                ))}
              </tr>

              <tr className="bg-gray-200 border-b-2 border-gray-400">
                <th className="sticky left-0 bg-gray-200 border-r-2 border-gray-400 px-2 py-0.5 text-left font-bold">
                  Fellow
                </th>
                {blockDates.map((bd, i) => (
                  <th key={i} className="border-r border-gray-300 px-1 py-0.5 text-center min-w-[65px]">
                    <div className="font-bold">{bd.block}</div>
                    <div className="text-[8px] text-gray-600 whitespace-nowrap">
                      {formatDate(bd.start)}-{formatDate(bd.end)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {fellows.map((fellow) => {
                const pgy = pgyLevels[fellow];

                return (
                  <tr key={fellow} className="border-b border-gray-300 hover:bg-gray-50">
                    <td
                      className={`sticky left-0 border-r-2 border-gray-400 px-2 py-0.5 font-semibold text-gray-800 border-l-4 ${getPGYColor(
                        pgy
                      )}`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{fellow}</span>
                        <span className="text-[8px] text-gray-600">PGY{pgy}</span>
                      </div>
                    </td>

                    {schedule[fellow]?.map((rot, idx) => {
                      const blockNumber = idx + 1;
                      const isVac = isBlockInVacation(vacations, fellow, blockNumber);

                      // When vacMode is on, show a clear overlay on cells that are currently vacation.
                      const vacOverlay = vacMode && isVac ? "ring-2 ring-red-600" : "";

                      return (
                        <td
                          key={idx}
                          className={`border-r border-gray-200 px-0.5 py-0.5 text-center ${
                            vacMode ? "cursor-crosshair" : (isVac ? "cursor-not-allowed" : "cursor-move")
                            }`}
                          draggable={!vacMode && !isVac}
                          onDragStart={() => handleDragStart(fellow, idx)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(fellow, idx)}
                          onMouseDown={() => handleCellMouseDown(fellow, idx)}
                          onMouseEnter={() => handleCellMouseEnter(fellow, idx)}
                        >
                          <div
                            className={`px-1 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap ${getRotationColor(
                              rot
                            )} ${vacOverlay}`}
                            title={
                              vacMode
                                ? "Click or click-drag to toggle vacation for this block"
                                : "Drag to swap"
                            }
                          >
                            {getBlockDisplay(fellow, idx, schedule, vacations)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {vacMode && (
          <div className="px-3 py-2 border-t border-gray-200 text-[10px] text-gray-700 bg-gray-50">
            Vacation Mode is ON. Click or click-drag blocks to toggle vacation. Vacation ranges will auto-compress.
          </div>
        )}
      </div>
    </div>
  );
}
