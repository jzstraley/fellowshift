export default function SwapPreview({ requester, target, block, getBlockDetails }) {
  if (!requester || !target || requester === target) return null;
  const reqDetails = getBlockDetails(requester, block);
  const tgtDetails = getBlockDetails(target, block);

  return (
    <div className="mt-2 p-2 rounded border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-xs">
      <div className="font-semibold mb-1 dark:text-blue-200">Swap Preview - Block {block}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-medium dark:text-gray-200">{requester}</div>
          {reqDetails.map(d => (
            <div key={d.label} className="text-gray-600 dark:text-gray-400 text-xs">
              {d.label}: <span className="font-medium dark:text-gray-200">{d.value}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-medium dark:text-gray-200">{target}</div>
          {tgtDetails.map(d => (
            <div key={d.label} className="text-gray-600 dark:text-gray-400 text-xs">
              {d.label}: <span className="font-medium dark:text-gray-200">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
