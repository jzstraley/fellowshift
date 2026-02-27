export default function SubViewTabs({ subView, setSubView }) {
  const tab = (id, label, border = true) => (
    <button
      type="button"
      onClick={() => setSubView(id)}
      className={`px-3 py-1 text-xs font-medium${border ? ' border-l dark:border-gray-600' : ''} ${
        subView === id
          ? 'bg-blue-600 text-white'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded border dark:border-gray-600 overflow-hidden">
      {tab('timeoff', 'Time Off', false)}
      {tab('dayoff', 'Day Off')}
      {tab('swaps', 'Swaps')}
    </div>
  );
}
