// src/components/ClinicCoverageView.jsx
import React, { useMemo } from 'react';
import { Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

// PGY-4 fellows who can't cover clinic in blocks 1-4 (first 8 weeks)
const PGY4_FELLOWS = ['Selvam', 'Elkholy', 'Nor', 'Varga', 'Naeem'];
const FIRST_YEAR_EXCLUSION_BLOCKS = 4; // Blocks 1-4

export default function ClinicCoverageView({
  fellows,
  schedule,
  clinicDays,
  pgyLevels,
  blockDates
}) {
  // Rotations that CAN cover (not on these = can cover)
  const cannotCoverRotations = ['Cath', 'Cath 2', 'Cath 3', 'ICU', 'Floor A', 'Floor B', 'Nights', 'Vac', 'Vacation', ''];

  // Generate clinic coverage for all blocks
  const clinicCoverage = useMemo(() => {
    const coverage = [];
    const coverageCount = {};

    fellows.forEach(f => {
      coverageCount[f] = 0;
    });

    // For each block
    blockDates.forEach((blockInfo, blockIdx) => {
      const blockNum = blockIdx + 1;

      // Find who is on Nights this block (ONLY they need coverage)
      const nightsFellow = fellows.find(f => {
        const rot = schedule[f]?.[blockIdx];
        return rot?.toLowerCase() === 'nights';
      });

      // If no one on nights, skip this block
      if (!nightsFellow) return;

      const nightsClinicDay = clinicDays[nightsFellow];

      // Skip if nights fellow has no clinic day
      if (!nightsClinicDay || nightsClinicDay === 0) return;

      // Find eligible coverers
      const eligibleCoverers = fellows.filter(other => {
        if (other === nightsFellow) return false;

        const otherRot = schedule[other]?.[blockIdx] || '';
        const otherClinicDay = clinicDays[other];
        const otherPGY = pgyLevels[other];

        // 1. Cannot be on a rotation that prevents covering
        const onBadRotation = cannotCoverRotations.some(r =>
          r && otherRot.toLowerCase() === r.toLowerCase()
        );
        if (onBadRotation) return false;

        // 2. Cannot have same clinic day as nights fellow
        if (otherClinicDay === nightsClinicDay) return false;

        // 3. PGY-4s cannot cover in blocks 1-4
        if (otherPGY === 4 && blockNum <= FIRST_YEAR_EXCLUSION_BLOCKS) return false;

        return true;
      });

      // Sort by coverage count (prefer less loaded)
      const sortedCoverers = eligibleCoverers.sort((a, b) => {
        return coverageCount[a] - coverageCount[b];
      });

      if (sortedCoverers.length > 0) {
        const coverer = sortedCoverers[0];
        coverageCount[coverer]++;

        coverage.push({
          block: blockNum,
          blockStart: blockInfo.start,
          absent: nightsFellow,
          absentRotation: 'Nights',
          absentClinicDay: nightsClinicDay,
          absentPGY: pgyLevels[nightsFellow],
          coverer: coverer,
          covererRotation: schedule[coverer]?.[blockIdx],
          covererClinicDay: clinicDays[coverer],
          covererPGY: pgyLevels[coverer],
          coverCount: coverageCount[coverer]
        });
      } else {
        coverage.push({
          block: blockNum,
          blockStart: blockInfo.start,
          absent: nightsFellow,
          absentRotation: 'Nights',
          absentClinicDay: nightsClinicDay,
          absentPGY: pgyLevels[nightsFellow],
          coverer: null,
          status: 'NO_COVERAGE'
        });
      }
    });

    return { entries: coverage, counts: coverageCount };
  }, [fellows, schedule, clinicDays, pgyLevels, blockDates]);

  const { entries: coverageEntries, counts: coverageStats } = clinicCoverage;

  const clinicDayName = (day) => {
    const names = { 0: 'None', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
    return names[day] || '?';
  };

  const getRotationColor = (rot) => {
    if (!rot || rot === '') return 'bg-gray-200 text-gray-500';
    const r = rot.toLowerCase();
    if (r === 'nights') return 'bg-black text-white';
    if (r === 'icu') return 'bg-red-600 text-white';
    if (r.includes('floor')) return 'bg-orange-500 text-white';
    if (r.includes('cath')) return 'bg-blue-500 text-white';
    if (r.includes('echo')) return 'bg-cyan-500 text-white';
    if (r.includes('nuclear')) return 'bg-yellow-400 text-gray-900';
    if (r === 'ep') return 'bg-green-500 text-white';
    if (r.includes('ai')) return 'bg-purple-400 text-white';
    if (r.includes('research')) return 'bg-pink-300 text-gray-900';
    if (r === 'admin' || r === 'spc') return 'bg-gray-400 text-white';
    if (r === 'structural') return 'bg-teal-500 text-white';
    if (r === 'vascular') return 'bg-rose-500 text-white';
    if (r === 'cts') return 'bg-amber-600 text-white';
    return 'bg-blue-200 text-gray-800';
  };

  const getPGYColor = (pgy) => {
    if (pgy === 4) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (pgy === 5) return 'bg-green-100 text-green-800 border-green-300';
    if (pgy === 6) return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const noCoverageCount = coverageEntries.filter(e => !e.coverer).length;

  // Group by PGY for stats display
  const statsByPGY = {
    4: fellows.filter(f => pgyLevels[f] === 4),
    5: fellows.filter(f => pgyLevels[f] === 5),
    6: fellows.filter(f => pgyLevels[f] === 6)
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white rounded border-2 border-gray-400 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-bold">{coverageEntries.length}</span> Nights blocks need clinic coverage
            </div>
            {noCoverageCount > 0 ? (
              <div className="flex items-center gap-1 text-red-600 text-sm font-bold">
                <AlertTriangle className="w-4 h-4" />
                {noCoverageCount} missing coverage
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-600 text-sm font-bold">
                <CheckCircle className="w-4 h-4" />
                All Nights blocks covered
              </div>
            )}
          </div>
          <div className="text-[10px] text-gray-500">
            PGY-4s excluded from covering in blocks 1-4
          </div>
        </div>
      </div>

      {/* Coverage Table */}
      <div className="bg-white rounded border-2 border-gray-400 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 border-b-2 border-gray-400">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Clinic Coverage for Nights Rotation
          </h3>
          <p className="text-[10px] text-gray-600 mt-1">
            Fellows on Nights need someone to cover their clinic day
          </p>
        </div>

        <div className="p-2 overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-gray-200">
              <tr className="border-b border-gray-400">
                <th className="px-2 py-1 text-left font-bold">Blk</th>
                <th className="px-2 py-1 text-left font-bold">Date</th>
                <th className="px-2 py-1 text-left font-bold">On Nights</th>
                <th className="px-2 py-1 text-center font-bold">Clinic Day</th>
                <th className="px-2 py-1 text-center font-bold">→</th>
                <th className="px-2 py-1 text-left font-bold">Covered By</th>
                <th className="px-2 py-1 text-left font-bold">Their Rotation</th>
                <th className="px-2 py-1 text-center font-bold">PGY</th>
                <th className="px-2 py-1 text-center font-bold">#</th>
              </tr>
            </thead>
            <tbody>
              {coverageEntries.map((entry, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 ${
                    !entry.coverer ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="px-2 py-1 font-bold">{entry.block}</td>
                  <td className="px-2 py-1 text-gray-600 text-[9px]">
                    {new Date(entry.blockStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-2 py-1">
                    <span className="font-semibold">{entry.absent}</span>
                    <span className={`ml-1 px-1 py-0.5 rounded text-[8px] font-semibold ${getRotationColor('Nights')}`}>
                      Nts
                    </span>
                  </td>
                  <td className="px-2 py-1 text-center text-gray-700 font-semibold">
                    {clinicDayName(entry.absentClinicDay)}
                  </td>
                  <td className="px-2 py-1 text-center text-gray-400">→</td>
                  <td className="px-2 py-1">
                    {entry.coverer ? (
                        <span>
                            <span className="font-semibold">{entry.coverer}</span>
                                <span className="text-[8px] text-gray-400 ml-1">
                                    ({clinicDayName(entry.covererClinicDay)})
                            </span>
                        </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        NONE
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {entry.covererRotation ? (
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${getRotationColor(entry.covererRotation)}`}>
                        {entry.covererRotation}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {entry.covererPGY ? (
                      <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${getPGYColor(entry.covererPGY)}`}>
                        {entry.covererPGY}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-1 text-center font-bold text-gray-600">
                    {entry.coverCount || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage Stats by PGY */}
      <div className="bg-white rounded border-2 border-gray-400 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 border-b-2 border-gray-400">
          <h3 className="font-bold text-sm">Coverage Load Distribution</h3>
          <p className="text-[10px] text-gray-600">Times each fellow covers clinic for Nights</p>
        </div>

        <div className="p-3 space-y-3">
          {[4, 5, 6].map(pgy => (
            <div key={pgy}>
              <div className="text-[10px] font-bold text-gray-500 mb-1">PGY-{pgy}</div>
              <div className="flex flex-wrap gap-2">
                {statsByPGY[pgy].map(fellow => (
                  <div
                    key={fellow}
                    className={`px-3 py-2 rounded border-2 ${getPGYColor(pgy)} min-w-[100px]`}
                  >
                    <div className="font-semibold text-xs">{fellow}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold">{coverageStats[fellow] || 0}</span>
                      <span className="text-[9px] text-gray-500">covers</span>
                    </div>
                    <div className="text-[8px] text-gray-500">
                      Clinic: {clinicDayName(clinicDays[fellow])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Balance indicator */}
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="text-[10px] text-gray-600">
            <span className="font-bold">Note:</span> PGY-4s cannot cover in blocks 1-4. 
            Fellows on Cath, ICU, Floor, or Nights cannot cover.
          </div>
        </div>
      </div>
    </div>
  );
}