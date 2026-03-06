// src/utils/scheduleUtils.js

export const getRotationColor = (rot) => {
  if (!rot) return 'bg-gray-100 text-gray-400';
  if (rot === 'Nights') return 'bg-black text-white';
  if (rot === 'ICU') return 'bg-red-600 text-white';
  if (rot === 'Floor A') return 'bg-green-600 text-white';
  if (rot === 'Floor B') return 'bg-blue-900 text-white';
  if (rot.includes('Cath')) return 'bg-blue-400 text-white';
  if (rot.includes('Echo')) return 'bg-cyan-400 text-white';
  if (rot.includes('Nuclear')) return 'bg-yellow-300 text-gray-800';
  if (rot === 'EP') return 'bg-green-400 text-white';
  if (rot.includes('AI')) return 'bg-purple-300 text-gray-800';
  if (rot.includes('Research')) return 'bg-pink-200 text-gray-800';
  if (rot === 'Admin') return 'bg-gray-300 text-gray-800';
  if (rot === 'Vascular') return 'bg-rose-300 text-gray-800';
  if (rot === 'Structural') return 'bg-amber-300 text-gray-800';
  if (rot === 'CTS') return 'bg-indigo-400 text-white';
  return 'bg-blue-100 text-gray-800';
};

export const getPGYColor = (pgy) => {
  if (pgy === 4) return 'bg-blue-100 border-blue-400';
  if (pgy === 5) return 'bg-green-100 border-green-400';
  if (pgy === 6) return 'bg-purple-100 border-purple-400';
  return 'bg-gray-100 border-gray-400';
};

// Abbreviate rotation names for vacation display
const abbreviateRotation = (rot) => {
  if (!rot) return '';
  if (rot === 'Nuclear 2') return 'Nuc2';
  if (rot === 'Nuclear') return 'Nuc';
  if (rot === 'Floor A') return 'FlA';
  if (rot === 'Floor B') return 'FlB';
  if (rot.includes('Cath')) return rot.replace('Cath', 'C');
  if (rot.includes('Echo')) return rot.replace('Echo', 'E');
  return rot;
};

export const getBlockDisplay = (fellow, blockIdx, schedule, vacations, blockDates = []) => {
  const rotation = schedule[fellow]?.[blockIdx];
  const currentBlock = blockIdx + 1;

  // Only approved vacations affect the schedule view
  const vacation = vacations.find(v =>
    v.fellow === fellow &&
    v.status === 'approved' &&
    v.startBlock <= currentBlock &&
    v.endBlock >= currentBlock
  );

  if (!vacation) return rotation || '-';

  const vacStart = vacation.startBlock;
  const vacEnd = vacation.endBlock;
  const weekPart = vacation.weekPart ?? null;

  // Multi-block vacation: entire block is vacation
  if (vacEnd - vacStart >= 1) {
    return 'VAC';
  }

  // Single-block vacation: use weekPart if present
  const abbrev = abbreviateRotation(rotation);

  if (weekPart === 1) return abbrev ? `VAC/${abbrev}` : 'VAC';
  if (weekPart === 2) return abbrev ? `${abbrev}/VAC` : 'VAC';

  // No weekPart: full block is vacation
  return 'VAC';
};

export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
};
