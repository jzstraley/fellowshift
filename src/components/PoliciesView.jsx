// src/components/PoliciesView.jsx
import { FileText, ExternalLink } from "lucide-react";
import { policies } from "../data/policies";

export default function PoliciesView() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Policies & Documents
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Program policies and reference documents
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {policy.title}
                </span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 italic flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
