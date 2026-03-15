export default function SubViewTabs({ subView, setSubView, pendingTimeOff = 0, pendingDayOff = 0, pendingSwaps = 0 }) {
  const tab = (id, label, count = 0, border = true) => (
    <button
      type="button"
      onClick={() => setSubView(id)}
      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5${border ? ' border-l dark:border-gray-600' : ''} ${
        subView === id
          ? 'bg-blue-600 text-white'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
      }`}
    >
      <span>{label}</span>
      {count > 0 && (
        <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
          subView === id
            ? 'bg-white text-blue-600'
            : 'bg-yellow-500 text-white'
        }`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="inline-flex rounded border dark:border-gray-600 overflow-hidden">
      {tab('timeoff', 'Time Off', pendingTimeOff, false)}
      {tab('dayoff', 'Day Off', pendingDayOff)}
      {tab('swaps', 'Swaps', pendingSwaps)}
    </div>
  );
}
