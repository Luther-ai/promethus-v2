import React, { useState, useEffect } from 'react';
import { BudgetSessionSummary, BudgetWatcherConfig } from '../types';
import {
  subscribeBudget,
  updateBudgetConfig,
  resetSessionBudget,
  calculateBudgetStatus,
  formatTokens,
  formatUsd,
  MODEL_PRICING
} from '../lib/budgetStore';

interface BudgetWatcherModalProps {
  open: boolean;
  onClose: () => void;
  onOpenApiConfig?: () => void;
  onOpenOptimizer?: () => void;
}

export function BudgetWatcherModal({
  open,
  onClose,
  onOpenApiConfig,
  onOpenOptimizer
}: BudgetWatcherModalProps) {
  const [summary, setSummary] = useState<BudgetSessionSummary>({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    requestCount: 0,
    lastUpdated: Date.now(),
    history: []
  });

  const [config, setConfig] = useState<BudgetWatcherConfig>({
    enabled: true,
    thresholdMode: 'tokens',
    tokenThreshold: 50000,
    costThresholdUsd: 0.50,
    warningPercentage: 80,
    soundAlerts: true,
    autoPauseAtLimit: false
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'history' | 'pricing'>('overview');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeBudget((newSummary, newConfig) => {
      setSummary(newSummary);
      setConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  if (!open) return null;

  const status = calculateBudgetStatus(summary, config);

  // Group usage by Agent
  const agentUsageMap = summary.history.reduce((acc, curr) => {
    const key = curr.agentKey || 'general';
    if (!acc[key]) {
      acc[key] = { tokens: 0, cost: 0, count: 0 };
    }
    acc[key].tokens += curr.totalTokens;
    acc[key].cost += curr.estimatedCostUsd;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { tokens: number; cost: number; count: number }>);

  // Group usage by Model
  const modelUsageMap = summary.history.reduce((acc, curr) => {
    const key = curr.model || 'gemini-3.7-flash';
    if (!acc[key]) {
      acc[key] = { tokens: 0, cost: 0, count: 0 };
    }
    acc[key].tokens += curr.totalTokens;
    acc[key].cost += curr.estimatedCostUsd;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { tokens: number; cost: number; count: number }>);

  const handleConfigChange = async (updates: Partial<BudgetWatcherConfig>) => {
    const updated = await updateBudgetConfig(updates);
    setConfig(updated);
    setSaveToast('✓ Budget preferences saved');
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleReset = async () => {
    await resetSessionBudget();
    setResetConfirm(false);
    setSaveToast('✓ Session budget metrics reset to zero');
    setTimeout(() => setSaveToast(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl h-[90vh] max-h-[820px] flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl overflow-hidden text-[var(--ink)]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(251, 191, 36, 0.08)'
        }}
      >
        {/* HEADER */}
        <header className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div 
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border ${
                status.isExceeded
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 animate-pulse'
                  : status.isWarning
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                  : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
              }`}
            >
              {status.isExceeded ? '🚨' : status.isWarning ? '⚠️' : '⚡'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Global Budget Watcher</span>
                  <span 
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                      status.isExceeded
                        ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                        : status.isWarning
                        ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {status.isExceeded ? 'Limit Exceeded' : status.isWarning ? 'Approaching Limit' : 'Budget Optimal'}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Real-time session token meter, cost estimation, and threshold alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveToast && (
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-medium">
                {saveToast}
              </span>
            )}
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--line)] transition-colors cursor-pointer"
              title="Close Budget Watcher"
            >
              ✕
            </button>
          </div>
        </header>

        {/* TABS */}
        <div className="px-6 py-2.5 border-b border-[var(--line)] bg-slate-900/30 flex items-center justify-between overflow-x-auto gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>📊</span>
              <span>Session Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>⚙</span>
              <span>Threshold & Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>📜</span>
              <span>Usage Log ({summary.history.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>🏷️</span>
              <span>Model Pricing Reference</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/30 text-[var(--muted)] border border-[var(--line)] transition-all cursor-pointer"
              >
                ↺ Reset Session
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-rose-300 font-mono">Reset metrics?</span>
                <button
                  onClick={handleReset}
                  className="px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-[var(--muted)] text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/20 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* STATUS GAUGE BAR CARD */}
              <div 
                className={`p-5 rounded-2xl border transition-all ${
                  status.isExceeded
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                    : status.isWarning
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                    : 'bg-slate-900/60 border-[var(--line)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Threshold Consumption Meter</span>
                      <span className="text-[10px] font-mono text-[var(--muted)]">
                        Mode: {config.thresholdMode === 'tokens' ? 'Token Cap' : 'Cost Cap ($)'}
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                      {status.currentValueFormatted}{' '}
                      <span className="text-sm font-normal text-[var(--muted)]">
                        / {status.thresholdFormatted}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-black font-mono"
                      style={{
                        color: status.isExceeded ? '#f43f5e' : status.isWarning ? '#f59e0b' : '#34d399'
                      }}
                    >
                      {status.percentage}%
                    </div>
                    <div className="text-[10px] text-[var(--muted)] uppercase font-mono">
                      Alert Trigger: {config.warningPercentage}%
                    </div>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-3.5 rounded-full bg-slate-950 border border-[var(--line)] overflow-hidden p-0.5">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(2, status.percentage))}%`,
                      backgroundColor: status.isExceeded 
                        ? '#f43f5e' 
                        : status.isWarning 
                        ? '#f59e0b' 
                        : '#10b981',
                      boxShadow: status.isExceeded 
                        ? '0 0 12px #f43f5e' 
                        : status.isWarning 
                        ? '0 0 12px #f59e0b' 
                        : '0 0 10px #10b981'
                    }}
                  />
                </div>

                {/* STATUS FOOTER NOTICE */}
                {status.isExceeded && (
                  <div className="mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚨</span>
                      <span><strong>Budget Limit Reached!</strong> Reset token usage or optimize prompts to continue.</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleReset}
                        className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                      >
                        🔄 Reset Token Usage
                      </button>
                      {onOpenOptimizer && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenOptimizer();
                          }}
                          className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs cursor-pointer border border-rose-500/30"
                        >
                          Optimize
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {status.isWarning && !status.isExceeded && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>Approaching your budget threshold ({status.percentage}% of {status.thresholdFormatted} used).</span>
                  </div>
                )}
              </div>

              {/* 4 KPI METRIC CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">
                    Total Tokens
                  </div>
                  <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                    {formatTokens(summary.totalTokens)}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    {summary.totalTokens.toLocaleString()} tokens
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">
                    Est. Session Cost
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                    {formatUsd(summary.totalCostUsd)}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    Live USD Calculation
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">
                    Prompt vs Completion
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-200 mt-1.5 flex items-center gap-1.5">
                    <span className="text-cyan-400 font-mono">{formatTokens(summary.totalPromptTokens)}</span>
                    <span className="text-[var(--muted)]">/</span>
                    <span className="text-purple-400 font-mono">{formatTokens(summary.totalCompletionTokens)}</span>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    Input / Output ratio
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/50 border border-[var(--line)]">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-semibold">
                    API Calls Made
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {summary.requestCount}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    Active session requests
                  </div>
                </div>
              </div>

              {/* BREAKDOWN BY AGENT & MODEL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BY AGENT */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-[var(--line)] space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Consumption by Executive Agent</span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {Object.keys(agentUsageMap).length} Active
                    </span>
                  </h3>

                  <div className="space-y-2">
                    {Object.keys(agentUsageMap).length === 0 ? (
                      <p className="text-xs text-[var(--muted)] py-4 text-center">
                        No requests recorded yet in this session.
                      </p>
                    ) : (
                      Object.entries(agentUsageMap).map(([agentKey, val]: [string, { tokens: number; cost: number; count: number }]) => (
                        <div key={agentKey} className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            <span className="font-bold text-white capitalize">{agentKey}</span>
                            <span className="text-[10px] text-[var(--muted)]">({val.count} calls)</span>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-cyan-300 font-bold">{formatTokens(val.tokens)} tok</div>
                            <div className="text-[10px] text-emerald-400">{formatUsd(val.cost)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* BY MODEL */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-[var(--line)] space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Consumption by AI Model</span>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {Object.keys(modelUsageMap).length} Models
                    </span>
                  </h3>

                  <div className="space-y-2">
                    {Object.keys(modelUsageMap).length === 0 ? (
                      <p className="text-xs text-[var(--muted)] py-4 text-center">
                        No requests recorded yet in this session.
                      </p>
                    ) : (
                      Object.entries(modelUsageMap).map(([modelKey, val]: [string, { tokens: number; cost: number; count: number }]) => (
                        <div key={modelKey} className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                            <span className="font-mono text-slate-200 truncate">{modelKey}</span>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="text-purple-300 font-bold">{formatTokens(val.tokens)} tok</div>
                            <div className="text-[10px] text-emerald-400">{formatUsd(val.cost)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* COST OPTIMIZATION ACTIONS */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                    <span>💡</span>
                    <span>Cost Optimization Heuristic</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] max-w-xl">
                    Gemini 3.7 Flash offers the lowest latency and cost ($0.075/1M input). You can also run the Context Engineering Token Optimizer to reduce prompt sizes by 25-50%.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onOpenOptimizer && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenOptimizer();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Compress Prompts
                    </button>
                  )}
                  {onOpenApiConfig && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenApiConfig();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer border border-slate-600"
                    >
                      Switch Model
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-5 rounded-xl bg-slate-900/60 border border-[var(--line)] space-y-5">
                <div className="border-b border-[var(--line)] pb-3">
                  <h3 className="text-sm font-bold text-white">Threshold & Alert Configuration</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Customize your session budget limits, warning thresholds, and notification sounds.
                  </p>
                </div>

                {/* TOGGLE ENABLED */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Enable Budget Watcher</div>
                    <div className="text-[11px] text-[var(--muted)]">Track token consumption and display warnings in the top bar</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* THRESHOLD MODE */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-2">Threshold Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleConfigChange({ thresholdMode: 'tokens' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        config.thresholdMode === 'tokens'
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950 border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      <div className="font-bold text-xs">🔢 By Token Count</div>
                      <div className="text-[10px] mt-0.5 opacity-80">Track total prompt + completion tokens</div>
                    </button>

                    <button
                      onClick={() => handleConfigChange({ thresholdMode: 'cost' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        config.thresholdMode === 'cost'
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950 border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      <div className="font-bold text-xs">💵 By Estimated USD ($)</div>
                      <div className="text-[10px] mt-0.5 opacity-80">Track estimated API dollar spending</div>
                    </button>
                  </div>
                </div>

                {/* TOKEN LIMIT SETTINGS */}
                {config.thresholdMode === 'tokens' && (
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1.5">
                      Session Token Limit: <span className="font-mono text-amber-300 font-bold">{config.tokenThreshold.toLocaleString()} tokens</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[25000, 50000, 100000, 250000].map((tVal) => (
                        <button
                          key={tVal}
                          onClick={() => handleConfigChange({ tokenThreshold: tVal })}
                          className={`py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                            config.tokenThreshold === tVal
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                              : 'bg-slate-950 text-slate-300 border-[var(--line)] hover:bg-slate-900'
                          }`}
                        >
                          {formatTokens(tVal)}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={config.tokenThreshold}
                      onChange={(e) => handleConfigChange({ tokenThreshold: Math.max(1000, parseInt(e.target.value) || 1000) })}
                      className="w-full bg-slate-950 border border-[var(--line)] text-xs text-white rounded-lg p-2.5 font-mono"
                      placeholder="Custom token threshold..."
                    />
                  </div>
                )}

                {/* COST LIMIT SETTINGS */}
                {config.thresholdMode === 'cost' && (
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1.5">
                      Session Cost Limit: <span className="font-mono text-emerald-300 font-bold">${config.costThresholdUsd.toFixed(2)} USD</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[0.25, 0.50, 1.00, 5.00].map((cVal) => (
                        <button
                          key={cVal}
                          onClick={() => handleConfigChange({ costThresholdUsd: cVal })}
                          className={`py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                            config.costThresholdUsd === cVal
                              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                              : 'bg-slate-950 text-slate-300 border-[var(--line)] hover:bg-slate-900'
                          }`}
                        >
                          ${cVal.toFixed(2)}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      step="0.05"
                      value={config.costThresholdUsd}
                      onChange={(e) => handleConfigChange({ costThresholdUsd: Math.max(0.01, parseFloat(e.target.value) || 0.01) })}
                      className="w-full bg-slate-950 border border-[var(--line)] text-xs text-white rounded-lg p-2.5 font-mono"
                      placeholder="Custom dollar threshold..."
                    />
                  </div>
                )}

                {/* WARNING TRIGGER PERCENTAGE */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-white">
                      Warning Alert Trigger: <span className="font-mono text-amber-300">{config.warningPercentage}%</span>
                    </label>
                    <span className="text-[10px] text-[var(--muted)]">Top bar turns amber</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={config.warningPercentage}
                    onChange={(e) => handleConfigChange({ warningPercentage: parseInt(e.target.value) || 80 })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--muted)] font-mono mt-1">
                    <span>50% (Early warning)</span>
                    <span>80% (Recommended)</span>
                    <span>95% (Strict)</span>
                  </div>
                </div>

                {/* SOUND ALERTS */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                  <div>
                    <div className="text-xs font-bold text-white">Audio Chime Alerts</div>
                    <div className="text-[11px] text-[var(--muted)]">Play a harmonic sound when warning or limit is reached</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.soundAlerts}
                      onChange={(e) => handleConfigChange({ soundAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USAGE LOG HISTORY */}
          {activeTab === 'history' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recent API Calls & Token Deltas
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">Last 50 requests in this session</p>
                </div>
                <span className="text-xs font-mono text-cyan-300">
                  {summary.history.length} events logged
                </span>
              </div>

              {summary.history.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900/40 border border-[var(--line)] text-center text-xs text-[var(--muted)]">
                  No API requests have been recorded yet in this session.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {summary.history.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 rounded-xl bg-slate-900/60 border border-[var(--line)] flex items-center justify-between text-xs hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white capitalize px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                            {record.agentKey}
                          </span>
                          <span className="font-mono text-[11px] text-cyan-300 truncate">
                            {record.model}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {new Date(record.timestamp).toLocaleTimeString()} · Prompt: {record.promptTokens} tok · Completion: {record.completionTokens} tok
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <div className="font-bold text-amber-300">+{formatTokens(record.totalTokens)} tok</div>
                        <div className="text-[10px] text-emerald-400">{formatUsd(record.estimatedCostUsd)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRICING REFERENCE */}
          {activeTab === 'pricing' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Model Pricing Benchmarks (Per 1 Million Tokens)
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Standard public rates used by the Budget Watcher to compute estimated costs.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-[var(--muted)] uppercase text-[10px] font-mono border-b border-[var(--line)]">
                    <tr>
                      <th className="p-3">Model</th>
                      <th className="p-3">Input / 1M</th>
                      <th className="p-3">Output / 1M</th>
                      <th className="p-3 text-right">Cost Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] bg-slate-950/60 font-mono">
                    {Object.entries(MODEL_PRICING).map(([mKey, p]) => (
                      <tr key={mKey} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-semibold text-white">
                          <div>{p.label}</div>
                          <div className="text-[10px] text-[var(--muted)] font-mono">{mKey}</div>
                        </td>
                        <td className="p-3 text-cyan-300">${p.inputPer1M.toFixed(3)}</td>
                        <td className="p-3 text-purple-300">${p.outputPer1M.toFixed(3)}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                            p.inputPer1M <= 0.10
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : p.inputPer1M <= 1.50
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                          }`}>
                            {p.inputPer1M <= 0.10 ? 'Ultra Low' : p.inputPer1M <= 1.50 ? 'Standard' : 'Premium'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
