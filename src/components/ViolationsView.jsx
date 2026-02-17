// src/components/ViolationsView.jsx
import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle, Filter, X } from "lucide-react";

const RULE_LABELS = {
  '80hr_weekly_avg': '80h Weekly Avg',
  '24plus4_max_duty': '24+4 Max Duty',
  '8hr_between_shifts': '8h Rest',
  '1_day_off_in_7': '1-in-7 Day Off',
  '6_consecutive_nights': '6 Night Limit',
  '14hr_post_call_rest': '14h Post-Call',
};

const SEVERITY_STYLES = {
  error: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
    row: 'border-l-4 border-red-500',
  },
  warn: {
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    dot: 'bg-yellow-500',
    row: 'border-l-4 border-yellow-400',
  },
};

export default function ViolationsView({ violations = [] }) {
  const [fellowFilter, setFellowFilter] = useState(null);
  const [ruleFilter, setRuleFilter] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(null);

  const fellows = useMemo(() => {
    const set = new Set(violations.map(v => v.fellow));
    return Array.from(set).sort();
  }, [violations]);

  const rules = useMemo(() => {
    const set = new Set(violations.map(v => v.rule));
    return Array.from(set);
  }, [violations]);

  const filtered = useMemo(() => {
    return violations.filter(v => {
      if (fellowFilter && v.fellow !== fellowFilter) return false;
      if (ruleFilter && v.rule !== ruleFilter) return false;
      if (severityFilter && v.severity !== severityFilter) return false;
      return true;
    });
  }, [violations, fellowFilter, ruleFilter, severityFilter]);

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warnCount = violations.filter(v => v.severity === 'warn').length;

  const hasFilters = fellowFilter || ruleFilter || severityFilter;

  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">
          No ACGME Violations Detected
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          All fellows are currently within ACGME work-hour limits based on the current schedule,
          call, and night float assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <AlertTriangle className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-semibold dark:text-gray-200">
            {violations.length} Violation{violations.length !== 1 ? 's' : ''}
          </span>
        </div>
        {errorCount > 0 && (
          <button
            onClick={() => setSeverityFilter(severityFilter === 'error' ? null : 'error')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              severityFilter === 'error'
                ? 'ring-2 ring-red-500 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {errorCount} Error{errorCount !== 1 ? 's' : ''}
          </button>
        )}
        {warnCount > 0 && (
          <button
            onClick={() => setSeverityFilter(severityFilter === 'warn' ? null : 'warn')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              severityFilter === 'warn'
                ? 'ring-2 ring-yellow-500 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {warnCount} Warning{warnCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-gray-400" />

        {/* Fellow filter */}
        <select
          value={fellowFilter || ''}
          onChange={e => setFellowFilter(e.target.value || null)}
          className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">All Fellows</option>
          {fellows.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Rule filter */}
        <select
          value={ruleFilter || ''}
          onChange={e => setRuleFilter(e.target.value || null)}
          className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">All Rules</option>
          {rules.map(r => <option key={r} value={r}>{RULE_LABELS[r] || r}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFellowFilter(null); setRuleFilter(null); setSeverityFilter(null); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          Showing {filtered.length} of {violations.length}
        </span>
      </div>

      {/* Violations Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Fellow</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Rule</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Severity</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Block</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Dates</th>
              <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((v, i) => {
              const sev = SEVERITY_STYLES[v.severity] || SEVERITY_STYLES.warn;
              return (
                <tr key={i} className={`${sev.row} bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800`}>
                  <td className="px-3 py-2 font-medium dark:text-gray-200">{v.fellow}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${sev.badge}`}>
                      {RULE_LABELS[v.rule] || v.rule}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                      v.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                      {v.severity === 'error' ? 'Error' : 'Warning'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {v.block ? `B${v.block}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {v.startDate === v.endDate ? v.startDate : `${v.startDate} — ${v.endDate}`}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs">
                    {v.detail}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
