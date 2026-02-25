// src/components/ViolationsView.jsx
import { useState, useMemo, useCallback, Fragment } from "react";
import { AlertTriangle, CheckCircle, Filter, X, Lightbulb, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { generateSuggestions } from "../engine/violationSuggester";

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

export default function ViolationsView({
  violations = [],
  schedule,
  setSchedule,
  callSchedule,
  setCallSchedule,
  nightFloatSchedule,
  setNightFloatSchedule,
  fellows,
  blockDates,
  vacations,
}) {
  const [fellowFilter, setFellowFilter] = useState(null);
  const [ruleFilter, setRuleFilter] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(null);

  // Track which violation row has suggestions expanded (by index in filtered list)
  const [expandedRow, setExpandedRow] = useState(null);
  // Cache generated suggestions per violation key
  const [suggestionsCache, setSuggestionsCache] = useState({});
  const [loadingRow, setLoadingRow] = useState(null);

  const canSuggest = schedule && fellows && blockDates;

  const uniqueFellows = useMemo(() => {
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

  // Build a unique key for a violation to use as cache key
  const violationKey = useCallback((v) =>
    `${v.fellow}|${v.rule}|${v.startDate}|${v.endDate}`, []);

  const handleSuggestFix = useCallback((v, rowIdx) => {
    if (expandedRow === rowIdx) {
      setExpandedRow(null);
      return;
    }

    const key = violationKey(v);
    if (suggestionsCache[key]) {
      setExpandedRow(rowIdx);
      return;
    }

    // Generate suggestions lazily
    setLoadingRow(rowIdx);
    setExpandedRow(rowIdx);

    // Use setTimeout to avoid blocking UI paint
    setTimeout(() => {
      const results = generateSuggestions(v, {
        fellows,
        schedule,
        callSchedule,
        nightFloatSchedule,
        blockDates,
        vacations,
      });
      setSuggestionsCache(prev => ({ ...prev, [key]: results }));
      setLoadingRow(null);
    }, 0);
  }, [expandedRow, suggestionsCache, violationKey, fellows, schedule, callSchedule, nightFloatSchedule, blockDates, vacations]);

  const handleApply = useCallback((suggestion) => {
    if (suggestion.type === 'rotationSwap') {
      const { fellowA, fellowB, blockIndex } = suggestion.apply;
      setSchedule(prev => {
        const next = {};
        for (const f of Object.keys(prev)) next[f] = [...prev[f]];
        const temp = next[fellowA][blockIndex];
        next[fellowA][blockIndex] = next[fellowB][blockIndex];
        next[fellowB][blockIndex] = temp;
        return next;
      });
    } else if (suggestion.type === 'callReassign') {
      const { weekendKey, toFellow } = suggestion.apply;
      setCallSchedule(prev => {
        const prevEntry = prev?.[weekendKey];
        const relaxed = (typeof prevEntry === 'object' && prevEntry?.relaxed) ? true : false;
        return { ...prev, [weekendKey]: { name: toFellow, relaxed } };
      });
    } else if (suggestion.type === 'floatReassign') {
      const { weekendKey, toFellow } = suggestion.apply;
      setNightFloatSchedule(prev => {
        const prevEntry = prev?.[weekendKey];
        const relaxed = (typeof prevEntry === 'object' && prevEntry?.relaxed) ? true : false;
        return { ...prev, [weekendKey]: { name: toFellow, relaxed } };
      });
    }
    // Clear cache and collapse since violations will recompute
    setSuggestionsCache({});
    setExpandedRow(null);
  }, [setSchedule, setCallSchedule, setNightFloatSchedule]);

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
          {uniqueFellows.map(f => <option key={f} value={f}>{f}</option>)}
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
              {canSuggest && (
                <th className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 w-24">Fix</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((v, i) => {
              const sev = SEVERITY_STYLES[v.severity] || SEVERITY_STYLES.warn;
              const isExpanded = expandedRow === i;
              const key = violationKey(v);
              const suggestions = suggestionsCache[key];
              const isLoading = loadingRow === i;

              return (
                <Fragment key={i}>
                  {/* Main violation row */}
                  <tr className={`${sev.row} bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800`}>
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
                      {v.block ? `B${v.block}` : '\u2014'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {v.startDate === v.endDate ? v.startDate : `${v.startDate} \u2014 ${v.endDate}`}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-xs">
                      {v.detail}
                    </td>
                    {canSuggest && (
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleSuggestFix(v, i)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            isExpanded
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-300'
                          }`}
                        >
                          <Lightbulb className="w-3 h-3" />
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Suggestions panel */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={canSuggest ? 7 : 6} className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20">
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing possible fixes...
                          </div>
                        ) : suggestions && suggestions.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Suggested Fixes
                            </div>
                            {suggestions.map((s, si) => (
                              <div
                                key={si}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    s.type === 'rotationSwap' ? 'bg-purple-500' :
                                    s.type === 'callReassign' ? 'bg-orange-500' : 'bg-indigo-500'
                                  }`} />
                                  {s.description}
                                  {s.netChange < 0 && (
                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                      ({s.netChange} violations)
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleApply(s)}
                                  className="shrink-0 px-2.5 py-1 rounded text-[10px] font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                                >
                                  Apply
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            No suggestions found. This violation may require manual schedule adjustments.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
