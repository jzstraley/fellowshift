import React, { useState, useEffect } from 'react';
import { Download, Plus, X, AlertTriangle, CheckCircle, TrendingUp, Calendar } from 'lucide-react';

export default function FellowshipScheduler() {
  const [activeView, setActiveView] = useState('schedule');
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  
  const pgyLevels = {
    'Elkholy': 4, 'Naeem': 4, 'Nor': 4, 'Selvam': 4, 'Varga': 4,
    'Alkhawlani': 5, 'Ali': 5, 'Elsayed': 5, 'Ezaldin': 5, 'Sharma': 5,
    'Mahmoud': 6, 'Straley': 6, 'Yousafzai': 6
  };

  const initialSchedule = {
    'Elkholy': ['Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'E', 'Nights'],
    'Naeem': ['Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'E', 'Nights', 'AI', 'AI'],
    'Nor': ['EP', 'EP', 'Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'Nights', 'E', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU'],
    'Selvam': ['Floor A', 'Floor A', 'Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'Nuclear', 'Nights', 'SPC', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'Research', 'Nights', 'AI', 'AI', 'Echo', 'Echo'],
    'Varga': ['Nuclear', 'Nuclear', 'EP', 'EP', 'Cath', 'Cath', 'Echo', 'Echo', 'Floor A', 'Floor A', 'Nuclear', 'ICU', 'Nuclear', 'Nights', 'AI', 'AI', 'Floor B', 'Floor B', 'Echo', 'Echo', 'ICU', 'AI', 'Nights', 'SPC', 'Floor A', 'Floor A'],
    'Alkhawlani': ['Nights', 'Floor B', 'Nuclear 2', 'Nuclear 2', 'ICU', 'Cath 2', 'Floor B', 'Cath 2', 'ICU', 'AI', 'Nuclear 2', 'Nuclear 2', 'Floor A', 'Cath 2', 'EP', 'EP', 'Echo 2', 'Echo 2', 'AI', 'Floor B', 'Echo 2', 'Echo 2', 'ICU', 'Cath 2', 'Nights', 'AI 2'],
    'Ali': ['Floor B', 'Nights', 'Cath 2', 'ICU', 'Nuclear 2', 'Floor B', 'Cath 2', 'Floor B', 'AI', 'ICU', 'AI 2', 'AI 2', 'Nuclear 2', 'Nuclear 2', 'Floor A', 'Cath 2', 'Nuclear 2', 'Nights', 'Echo 2', 'Echo 2', 'EP', 'EP', 'Echo 2', 'Echo 2', 'ICU', 'Cath 2'],
    'Elsayed': ['AI', 'ICU', 'AI', 'Nights', 'Floor B', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'Cath 2', 'Cath 2', 'Floor A', 'Echo 2', 'Cath 2', 'ICU', 'Echo 2', 'Echo 2', 'Cath 2', 'ICU', 'AI 2', 'Nights', 'Nuclear 2', 'Floor B', 'EP', 'EP', 'Nuclear 2', 'Floor B'],
    'Ezaldin': ['Cath 2', 'Cath 2', 'ICU', 'AI', 'Nights', 'AI 2', 'ICU', 'Echo 2', 'Nights', 'Echo 2', 'ICU', 'Floor A', 'Echo 2', 'Echo 2', 'Nuclear 2', 'Nuclear 2', 'EP', 'EP', 'Floor B', 'AI', 'Cath 2', 'Cath 2', 'Floor B', 'Nuclear 2', 'Floor B', 'Nuclear 2'],
    'Sharma': ['ICU', 'Echo 2', 'Echo 2', 'Floor B', 'Cath 2', 'ICU', 'AI', 'Nights', 'Nuclear 2', 'Nuclear 2', 'EP', 'Nights', 'EP', 'Floor A', 'Cath 2', 'ICU', 'AI', 'AI', 'Cath 2', 'Cath 2', 'Floor B', 'Nuclear 2', 'Nuclear 2', 'Floor B', 'Echo 2', 'Echo 2'],
    'Mahmoud': ['Nuclear 2', 'Nuclear 2', 'AI 2', 'AI 2', '', '', 'Echo 2', 'ICU', 'Echo 2', 'Nights', 'Research', 'Structural', 'Nights', 'Vascular', 'Cath', 'Cath', 'AI 2', 'AI 2', 'CTS', '', '', '', 'AI 2', 'AI 2', 'Research', 'Research'],
    'Straley': ['Echo 2', 'Vascular', 'Nights', 'Cath 2', 'Cath 3', 'Cath 3', 'Nights', 'Structural', 'AI 2', 'AI 2', 'Echo 2', '', 'AI 2', 'AI 2', 'AI 2', 'Floor A', '', 'CTS', 'Nuclear 2', 'Nuclear 2', '', '', '', 'Admin', 'Admin', 'AI 2'],
    'Yousafzai': ['AI 2', 'AI 2', 'Floor B', 'Echo 2', 'Echo 2', 'Nights', 'AI 2', 'AI 2', '', '', 'Cath 2', 'Cath 2', 'Vascular', '', 'CTS', 'Nights', '', 'Admin', 'Structural', '', 'AI 2', 'AI 2', 'SPC', '', 'Research 2', 'Research 2']
  };

  const clinicDays = {
    'Elkholy': 0, 'Naeem': 2, 'Nor': 2, 'Selvam': 1, 'Varga': 3,
    'Alkhawlani': 2, 'Ali': 2, 'Elsayed': 0, 'Ezaldin': 1, 'Sharma': 3,
    'Mahmoud': 2, 'Straley': 1, 'Yousafzai': 0
  };

  // Block dates (2 weeks each)
  const blockDates = [
    { start: '2026-07-01', end: '2026-07-12', rotation: 1 },
    { start: '2026-07-13', end: '2026-07-26', rotation: 1 },
    { start: '2026-07-27', end: '2026-08-09', rotation: 2 },
    { start: '2026-08-10', end: '2026-08-23', rotation: 2 },
    { start: '2026-08-24', end: '2026-09-06', rotation: 3 },
    { start: '2026-09-07', end: '2026-09-20', rotation: 3 },
    { start: '2026-09-21', end: '2026-10-04', rotation: 4 },
    { start: '2026-10-05', end: '2026-10-18', rotation: 4 },
    { start: '2026-10-19', end: '2026-11-01', rotation: 5 },
    { start: '2026-11-02', end: '2026-11-15', rotation: 5 },
    { start: '2026-11-16', end: '2026-11-29', rotation: 6 },
    { start: '2026-11-30', end: '2026-12-13', rotation: 6 },
    { start: '2026-12-14', end: '2026-12-27', rotation: 7 },
    { start: '2026-12-28', end: '2027-01-10', rotation: 7 },
    { start: '2027-01-11', end: '2027-01-24', rotation: 8 },
    { start: '2027-01-25', end: '2027-02-07', rotation: 8 },
    { start: '2027-02-08', end: '2027-02-21', rotation: 9 },
    { start: '2027-02-22', end: '2027-03-07', rotation: 9 },
    { start: '2027-03-08', end: '2027-03-21', rotation: 10 },
    { start: '2027-03-22', end: '2027-04-04', rotation: 10 },
    { start: '2027-04-05', end: '2027-04-18', rotation: 11 },
    { start: '2027-04-19', end: '2027-05-02', rotation: 11 },
    { start: '2027-05-03', end: '2027-05-16', rotation: 12 },
    { start: '2027-05-17', end: '2027-05-30', rotation: 12 },
    { start: '2027-05-31', end: '2027-06-13', rotation: 13 },
    { start: '2027-06-14', end: '2027-06-27', rotation: 13 }
  ];

  const [fellows] = useState(Object.keys(initialSchedule));
  const [schedule, setSchedule] = useState(initialSchedule);
  const [callSchedule, setCallSchedule] = useState({});
  const [nightFloatSchedule, setNightFloatSchedule] = useState({});
  const [vacations, setVacations] = useState([
    { fellow: 'Alkhawlani', startBlock: 3, endBlock: 4, reason: 'Vacation' }
  ]);
  const [stats, setStats] = useState(null);

  const echoBoards = new Date('2026-07-14');

  useEffect(() => {
    calculateStats();
    generateCallAndFloat();
  }, [schedule, vacations]);

  const calculateStats = () => {
    const counts = {};
    fellows.forEach(f => {
      const pgy = pgyLevels[f];
      counts[f] = { 
        ai: 0, ai2: 0, cath: 0, cath2: 0, echo: 0, echo2: 0, ep: 0,
        floorA: 0, floorB: 0, icu: 0, nights: 0, nuclear: 0, nuclear2: 0,
        cts: 0, research: 0, structural: 0, vascular: 0, admin: 0, spc: 0, sum: 0,
        call: 0, float: 0, pgy: pgy
      };
      
      schedule[f]?.forEach((rot, idx) => {
        if (!rot) return;
        counts[f].sum++;
        
        // Count by rotation type
        if (rot === 'AI') counts[f].ai++;
        else if (rot === 'AI 2' || rot === 'AI 3') counts[f].ai2++;
        else if (rot === 'Cath') counts[f].cath++;
        else if (rot.includes('Cath 2') || rot.includes('Cath 3')) counts[f].cath2++;
        else if (rot === 'Echo') counts[f].echo++;
        else if (rot === 'Echo 2') counts[f].echo2++;
        else if (rot === 'EP') counts[f].ep++;
        else if (rot === 'Floor A') counts[f].floorA++;
        else if (rot === 'Floor B') counts[f].floorB++;
        else if (rot === 'ICU') counts[f].icu++;
        else if (rot === 'Nights') counts[f].nights++;
        else if (rot === 'Nuclear') counts[f].nuclear++;
        else if (rot === 'Nuclear 2') counts[f].nuclear2++;
        else if (rot === 'CTS') counts[f].cts++;
        else if (rot.includes('Research')) counts[f].research++;
        else if (rot === 'Structural') counts[f].structural++;
        else if (rot === 'Vascular') counts[f].vascular++;
        else if (rot === 'Admin') counts[f].admin++;
        else if (rot === 'SPC') counts[f].spc++;
      });
    });
    setStats(counts);
  };

  const isEligibleForCall = (fellow, blockIdx) => {
    const rotation = schedule[fellow][blockIdx];
    const pgy = pgyLevels[fellow];
    const blockDate = new Date(blockDates[blockIdx].start);
    
    // Not on Nights
    if (rotation === 'Nights') return false;
    
    // Not on Floor
    if (rotation === 'Floor A' || rotation === 'Floor B') return false;
    
    // PGY-6: No call until after 7/14/26
    if (pgy === 6 && blockDate < echoBoards) return false;
    
    // PGY-4: Must be during/after ICU block
    if (pgy === 4 && rotation === 'ICU') return true;
    if (pgy === 4) {
      const hasDoneICU = schedule[fellow].slice(0, blockIdx).some(r => r === 'ICU');
      if (!hasDoneICU) return false;
    }
    
    // Check next block for Nights (can't do end-of-block call if next is Nights)
    if (blockIdx < 25 && schedule[fellow][blockIdx + 1] === 'Nights') return false;
    
    return true;
  };

  const isEligibleForFloat = (fellow, blockIdx) => {
    const rotation = schedule[fellow][blockIdx];
    const pgy = pgyLevels[fellow];
    
    // Not on Nights (unless it's their 2nd week of nights - preferred)
    if (rotation === 'Nights') return 'preferred'; // Will assign to 2nd Saturday
    
    // Not on Floor
    if (rotation === 'Floor A' || rotation === 'Floor B') return false;
    
    // Not on ICU
    if (rotation === 'ICU') return false;
    
    // PGY-4: Must be after 1st Floor block
    if (pgy === 4) {
      const hasDoneFloor = schedule[fellow].slice(0, blockIdx).some(r => 
        r === 'Floor A' || r === 'Floor B'
      );
      if (!hasDoneFloor) return false;
    }
    
    return true;
  };

  const generateCallAndFloat = () => {
    const newCallSchedule = {};
    const newFloatSchedule = {};
    
    const callCounts = {};
    const floatCounts = {};
    fellows.forEach(f => {
      callCounts[f] = 0;
      floatCounts[f] = 0;
    });
    
    // Target counts based on PGY
    const callTargets = { 4: 5, 5: 4, 6: 2 };
    const floatTargets = { 4: 5, 5: 4, 6: 3 };
    
    // Assign floats first (prioritize nights fellows on 2nd Saturday)
    for (let blockIdx = 0; blockIdx < 26; blockIdx++) {
      // Check who's on nights
      const onNights = fellows.filter(f => schedule[f][blockIdx] === 'Nights');
      
      if (onNights.length > 0 && floatCounts[onNights[0]] < floatTargets[pgyLevels[onNights[0]]]) {
        // Assign 2nd Saturday to person on nights
        const blockDates = getBlockWeekends(blockIdx);
        newFloatSchedule[`B${blockIdx + 1}-W2`] = onNights[0];
        floatCounts[onNights[0]]++;
      } else {
        // Assign to eligible person with lowest count
        const eligible = fellows
          .filter(f => {
            const eligibility = isEligibleForFloat(f, blockIdx);
            return eligibility === true || eligibility === 'preferred';
          })
          .filter(f => floatCounts[f] < floatTargets[pgyLevels[f]])
          .sort((a, b) => floatCounts[a] - floatCounts[b]);
        
        if (eligible.length > 0) {
          newFloatSchedule[`B${blockIdx + 1}-W2`] = eligible[0];
          floatCounts[eligible[0]]++;
        }
      }
    }
    
    // Assign calls
    for (let blockIdx = 0; blockIdx < 26; blockIdx++) {
      const eligible = fellows
        .filter(f => isEligibleForCall(f, blockIdx))
        .filter(f => callCounts[f] < callTargets[pgyLevels[f]])
        .sort((a, b) => callCounts[a] - callCounts[b]);
      
      // Weekend 1
      if (eligible.length > 0) {
        newCallSchedule[`B${blockIdx + 1}-W1`] = eligible[0];
        callCounts[eligible[0]]++;
      }
      
      // Weekend 2
      const eligible2 = fellows
        .filter(f => isEligibleForCall(f, blockIdx))
        .filter(f => callCounts[f] < callTargets[pgyLevels[f]])
        .sort((a, b) => callCounts[a] - callCounts[b]);
      
      if (eligible2.length > 0) {
        newCallSchedule[`B${blockIdx + 1}-W2`] = eligible2[0];
        callCounts[eligible2[0]]++;
      }
    }
    
    setCallSchedule(newCallSchedule);
    setNightFloatSchedule(newFloatSchedule);
    
    // Update stats with call/float counts
    if (stats) {
      const newStats = { ...stats };
      fellows.forEach(f => {
        newStats[f] = { ...newStats[f], call: callCounts[f], float: floatCounts[f] };
      });
      setStats(newStats);
    }
  };

  const getBlockWeekends = (blockIdx) => {
    const startDate = new Date(blockDates[blockIdx].start);
    const weekends = [];
    
    for (let d = 0; d < 14; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      if (date.getDay() === 6) { // Saturday
        weekends.push(date);
      }
    }
    
    return weekends;
  };

  const getRotationColor = (rot) => {
    if (!rot) return 'bg-gray-100 text-gray-400';
    if (rot === 'Nights') return 'bg-black text-white';
    if (rot === 'ICU') return 'bg-red-600 text-white';
    if (rot === 'Floor A' || rot === 'Floor B') return 'bg-orange-400 text-white';
    if (rot.includes('Cath')) return 'bg-blue-400 text-white';
    if (rot.includes('Echo')) return 'bg-cyan-400 text-white';
    if (rot.includes('Nuclear')) return 'bg-yellow-300 text-gray-800';
    if (rot === 'EP') return 'bg-green-400 text-white';
    if (rot.includes('AI')) return 'bg-purple-300 text-gray-800';
    if (rot.includes('Research')) return 'bg-pink-200 text-gray-800';
    if (rot === 'Admin') return 'bg-gray-300 text-gray-800';
    return 'bg-blue-100 text-gray-800';
  };

  const getPGYColor = (pgy) => {
    if (pgy === 4) return 'bg-blue-100 border-blue-400';
    if (pgy === 5) return 'bg-green-100 border-green-400';
    if (pgy === 6) return 'bg-purple-100 border-purple-400';
    return 'bg-gray-100 border-gray-400';
  };

  const getBlockDisplay = (fellow, blockIdx) => {
    const rotation = schedule[fellow]?.[blockIdx];
    
    // Check vacation
    const vacation = vacations.find(v => 
      v.fellow === fellow && 
      v.startBlock <= blockIdx + 1 && 
      v.endBlock >= blockIdx + 1
    );
    
    if (!vacation) return rotation || '-';
    
    // Determine which week(s) have vacation
    const vacStart = vacation.startBlock;
    const vacEnd = vacation.endBlock;
    const currentBlock = blockIdx + 1;
    
    // If entire block is vacation
    if (vacStart === currentBlock && vacEnd === currentBlock) {
      return 'VAC/VAC';
    }
    
    // If vacation starts in this block, show rotation/VAC (week 2 is vacation)
    // If vacation continues from previous, show VAC/rotation (week 1 is vacation)
    if (vacStart === currentBlock) {
      return `${rotation}/VAC`;
    } else {
      return `VAC/${rotation}`;
    }
  };

  const checkCallBalance = () => {
    if (!stats) return;
    
    const issues = [];
    const callTargets = { 4: 5, 5: 4, 6: 2 };
    const floatTargets = { 4: 5, 5: 4, 6: 3 };
    
    fellows.forEach(f => {
      const pgy = pgyLevels[f];
      const callCount = stats[f]?.call || 0;
      const floatCount = stats[f]?.float || 0;
      
      if (callCount !== callTargets[pgy]) {
        issues.push(`${f} (PGY-${pgy}): ${callCount}/${callTargets[pgy]} calls`);
      }
      if (floatCount !== floatTargets[pgy]) {
        issues.push(`${f} (PGY-${pgy}): ${floatCount}/${floatTargets[pgy]} floats`);
      }
    });
    
    if (issues.length === 0) {
      alert('✅ Call and Float perfectly balanced!\n\n' +
            'PGY-4: 5 calls, 5 floats\n' +
            'PGY-5: 4 calls, 4 floats\n' +
            'PGY-6: 2 calls, 3 floats');
    } else {
      alert('⚠️ Call/Float Balance Issues:\n\n' + issues.join('\n'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-400 sticky top-0 z-50">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-800">Fellowship Scheduler</h1>
            <div className="flex gap-1">
              {[
                { id: 'schedule', label: 'Schedule' },
                { id: 'stats', label: 'Stats' },
                { id: 'calendar', label: 'Calendar' },
                { id: 'call', label: 'Call' },
                { id: 'vacations', label: 'Vacations' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    activeView === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={checkCallBalance}
            className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded"
          >
            Check Call Balance
          </button>
        </div>
      </div>

      <div className="p-3">
        {/* Schedule View */}
        {activeView === 'schedule' && (
          <div className="bg-white rounded border-2 border-gray-400">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 bg-gray-100 border-r-2 border-gray-400 px-2 py-0.5 text-left font-bold w-20"></th>
                    {blockDates.map((bd, i) => (
                      <th key={i} className="border-r border-gray-300 px-1 py-0.5 text-center min-w-[55px]">
                        <div className="font-bold">Rot {bd.rotation}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-200 border-b-2 border-gray-400">
                    <th className="sticky left-0 bg-gray-200 border-r-2 border-gray-400 px-2 py-0.5 text-left font-bold">Fellow</th>
                    {blockDates.map((bd, i) => (
                      <th key={i} className="border-r border-gray-300 px-1 py-0.5 text-center">
                        <div className="font-bold">{i + 1}</div>
                        <div className="text-[8px] text-gray-600">{bd.start.slice(5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fellows.map((fellow) => {
                    const pgy = pgyLevels[fellow];
                    return (
                      <tr key={fellow} className="border-b border-gray-300">
                        <td className={`sticky left-0 border-r-2 border-gray-400 px-2 py-0.5 font-semibold border-l-4 ${getPGYColor(pgy)}`}>
                          {fellow}
                        </td>
                        {schedule[fellow]?.map((rot, idx) => (
                          <td key={idx} className="border-r border-gray-200 px-0.5 py-0.5 text-center">
                            <div className={`px-1 py-0.5 rounded text-[9px] font-semibold ${getRotationColor(rot)}`}>
                              {getBlockDisplay(fellow, idx)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats View */}
        {activeView === 'stats' && stats && (
          <div className="bg-white rounded border-2 border-gray-400">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-gray-200 border-b-2 border-gray-400">
                  <th className="px-2 py-1 text-left font-bold">Fellow</th>
                  <th className="px-1 py-1 text-center font-bold">AI</th>
                  <th className="px-1 py-1 text-center font-bold">AI 2</th>
                  <th className="px-1 py-1 text-center font-bold">Cath</th>
                  <th className="px-1 py-1 text-center font-bold">Cath 2</th>
                  <th className="px-1 py-1 text-center font-bold">Echo</th>
                  <th className="px-1 py-1 text-center font-bold">Echo 2</th>
                  <th className="px-1 py-1 text-center font-bold">EP</th>
                  <th className="px-1 py-1 text-center font-bold">Floor A</th>
                  <th className="px-1 py-1 text-center font-bold">Floor B</th>
                  <th className="px-1 py-1 text-center font-bold">ICU</th>
                  <th className="px-1 py-1 text-center font-bold bg-black text-white">Nights</th>
                  <th className="px-1 py-1 text-center font-bold">Nuclear</th>
                  <th className="px-1 py-1 text-center font-bold">Nuclear 2</th>
                  <th className="px-1 py-1 text-center font-bold">CTS</th>
                  <th className="px-1 py-1 text-center font-bold">Research</th>
                  <th className="px-1 py-1 text-center font-bold">Structural</th>
                  <th className="px-1 py-1 text-center font-bold">Vascular</th>
                  <th className="px-1 py-1 text-center font-bold">Admin</th>
                  <th className="px-1 py-1 text-center font-bold">SPC</th>
                  <th className="px-1 py-1 text-center font-bold bg-blue-50">Sum</th>
                </tr>
              </thead>
              <tbody>
                {fellows.map((f, idx) => (
                  <tr key={f} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-1 font-semibold">{f}</td>
                    <td className="px-1 py-1 text-center">{stats[f].ai}</td>
                    <td className="px-1 py-1 text-center">{stats[f].ai2}</td>
                    <td className="px-1 py-1 text-center">{stats[f].cath}</td>
                    <td className="px-1 py-1 text-center">{stats[f].cath2}</td>
                    <td className="px-1 py-1 text-center">{stats[f].echo}</td>
                    <td className="px-1 py-1 text-center">{stats[f].echo2}</td>
                    <td className="px-1 py-1 text-center">{stats[f].ep}</td>
                    <td className="px-1 py-1 text-center">{stats[f].floorA}</td>
                    <td className="px-1 py-1 text-center">{stats[f].floorB}</td>
                    <td className="px-1 py-1 text-center">{stats[f].icu}</td>
                    <td className="px-1 py-1 text-center bg-black text-white font-bold">{stats[f].nights}</td>
                    <td className="px-1 py-1 text-center">{stats[f].nuclear}</td>
                    <td className="px-1 py-1 text-center">{stats[f].nuclear2}</td>
                    <td className="px-1 py-1 text-center">{stats[f].cts}</td>
                    <td className="px-1 py-1 text-center">{stats[f].research}</td>
                    <td className="px-1 py-1 text-center">{stats[f].structural}</td>
                    <td className="px-1 py-1 text-center">{stats[f].vascular}</td>
                    <td className="px-1 py-1 text-center">{stats[f].admin}</td>
                    <td className="px-1 py-1 text-center">{stats[f].spc}</td>
                    <td className="px-1 py-1 text-center bg-blue-50 font-bold">{stats[f].sum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Call View */}
        {activeView === 'call' && (
          <div className="space-y-3">
            <div className="bg-white rounded border-2 border-gray-400 p-2">
              <h3 className="font-bold text-sm mb-2">Call Weekend Assignments</h3>
              <div className="text-[10px] space-y-1">
                {Array.from({length: 26}, (_, i) => (
                  <div key={i} className="flex gap-2 items-center border-b border-gray-200 pb-1">
                    <span className="w-16 font-semibold">Block {i + 1}</span>
                    <span className="flex-1">W1: {callSchedule[`B${i + 1}-W1`] || '-'}</span>
                    <span className="flex-1">W2: {callSchedule[`B${i + 1}-W2`] || '-'}</span>
                    <span className="flex-1">Float: {nightFloatSchedule[`B${i + 1}-W2`] || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {stats && (
              <div className="bg-white rounded border-2 border-gray-400 p-2">
                <h3 className="font-bold text-sm mb-2">Call/Float Balance</h3>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-2 py-1 text-left">Fellow</th>
                      <th className="px-2 py-1 text-center">PGY</th>
                      <th className="px-2 py-1 text-center">Call Target</th>
                      <th className="px-2 py-1 text-center">Call Actual</th>
                      <th className="px-2 py-1 text-center">Float Target</th>
                      <th className="px-2 py-1 text-center">Float Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fellows.map(f => {
                      const pgy = pgyLevels[f];
                      const callTarget = { 4: 5, 5: 4, 6: 2 }[pgy];
                      const floatTarget = { 4: 5, 5: 4, 6: 3 }[pgy];
                      return (
                        <tr key={f} className="border-b border-gray-200">
                          <td className="px-2 py-1">{f}</td>
                          <td className="px-2 py-1 text-center">{pgy}</td>
                          <td className="px-2 py-1 text-center">{callTarget}</td>
                          <td className={`px-2 py-1 text-center font-bold ${
                            stats[f].call === callTarget ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {stats[f].call || 0}
                          </td>
                          <td className="px-2 py-1 text-center">{floatTarget}</td>
                          <td className={`px-2 py-1 text-center font-bold ${
                            stats[f].float === floatTarget ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {stats[f].float || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Calendar View - Placeholder */}
        {activeView === 'calendar' && (
          <div className="bg-white rounded border-2 border-gray-400 p-4">
            <h3 className="font-bold mb-2">365-Day Calendar</h3>
            <p className="text-sm text-gray-600">
              Day-by-day view coming next - will show all rotations, call, float assignments across full year
            </p>
          </div>
        )}

        {/* Vacations */}
        {activeView === 'vacations' && (
          <div className="bg-white rounded border-2 border-gray-400 p-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">Vacations</h3>
              <button
                onClick={() => setVacations([...vacations, { fellow: fellows[0], startBlock: 1, endBlock: 1, reason: '' }])}
                className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded"
              >
                <Plus className="w-3 h-3 inline" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {vacations.map((vac, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-300 rounded text-xs">
                  <select
                    value={vac.fellow}
                    onChange={(e) => {
                      const newVacs = [...vacations];
                      newVacs[idx].fellow = e.target.value;
                      setVacations(newVacs);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  >
                    {fellows.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="26"
                    value={vac.startBlock}
                    onChange={(e) => {
                      const newVacs = [...vacations];
                      newVacs[idx].startBlock = parseInt(e.target.value);
                      setVacations(newVacs);
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    min="1"
                    max="26"
                    value={vac.endBlock}
                    onChange={(e) => {
                      const newVacs = [...vacations];
                      newVacs[idx].endBlock = parseInt(e.target.value);
                      setVacations(newVacs);
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    value={vac.reason}
                    onChange={(e) => {
                      const newVacs = [...vacations];
                      newVacs[idx].reason = e.target.value;
                      setVacations(newVacs);
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded"
                    placeholder="Reason"
                  />
                  <button
                    onClick={() => setVacations(vacations.filter((_, i) => i !== idx))}
                    className="p-1 text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
