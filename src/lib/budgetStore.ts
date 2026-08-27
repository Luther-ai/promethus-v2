import { BudgetUsageRecord, BudgetWatcherConfig, BudgetSessionSummary } from '../types';
import { storage } from '../storage';

// Pricing per 1 Million Tokens (USD)
export const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number; label: string }> = {
  // Google Gemini Models
  'gemini-3.7-flash': { inputPer1M: 0.075, outputPer1M: 0.30, label: 'Gemini 3.7 Flash' },
  'gemini-2.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30, label: 'Gemini 2.5 Flash' },
  'gemini-2.0-flash': { inputPer1M: 0.075, outputPer1M: 0.30, label: 'Gemini 2.0 Flash' },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30, label: 'Gemini 1.5 Flash' },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00, label: 'Gemini 1.5 Pro' },
  'gemini-pro': { inputPer1M: 0.50, outputPer1M: 1.50, label: 'Gemini Pro' },

  // OpenAI Models
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00, label: 'GPT-4o' },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60, label: 'GPT-4o mini' },
  'o1': { inputPer1M: 15.00, outputPer1M: 60.00, label: 'OpenAI o1' },
  'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40, label: 'OpenAI o3-mini' },
  'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00, label: 'GPT-4 Turbo' },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50, label: 'GPT-3.5 Turbo' },

  // Anthropic Models
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00, label: 'Claude 3.5 Sonnet' },
  'claude-3-5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00, label: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.00, label: 'Claude 3.5 Haiku' },
  'claude-3-opus': { inputPer1M: 15.00, outputPer1M: 75.00, label: 'Claude 3 Opus' },

  // Fallback
  'default': { inputPer1M: 0.10, outputPer1M: 0.40, label: 'Standard AI Model' }
};

export const DEFAULT_BUDGET_CONFIG: BudgetWatcherConfig = {
  enabled: true,
  thresholdMode: 'tokens',
  tokenThreshold: 50000,       // Default 50,000 tokens threshold
  costThresholdUsd: 0.50,      // Default $0.50 threshold
  warningPercentage: 80,       // Warn at 80%
  soundAlerts: true,
  autoPauseAtLimit: false
};

const STORAGE_KEY_CONFIG = 'buildengine_budget_config';
const STORAGE_KEY_SUMMARY = 'buildengine_budget_summary';

// In-memory state for immediate high-frequency UI updates
let currentSummary: BudgetSessionSummary = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  totalCostUsd: 0,
  requestCount: 0,
  lastUpdated: Date.now(),
  history: []
};

let currentConfig: BudgetWatcherConfig = { ...DEFAULT_BUDGET_CONFIG };
let hasLoadedFromStorage = false;

// Subscriptions
type BudgetListener = (summary: BudgetSessionSummary, config: BudgetWatcherConfig) => void;
const listeners = new Set<BudgetListener>();

export function subscribeBudget(listener: BudgetListener): () => void {
  listeners.add(listener);
  // Emit current state immediately
  listener(currentSummary, currentConfig);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(currentSummary, currentConfig);
    } catch (e) {
      console.warn('Error in budget listener:', e);
    }
  });
}

// Calculate cost based on model and token counts
export function calculateTokenCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const cleanModelKey = model?.toLowerCase()?.trim() || 'default';
  
  // Lookup pricing or find closest match
  let pricing = MODEL_PRICING[cleanModelKey];
  if (!pricing) {
    if (cleanModelKey.includes('flash')) pricing = MODEL_PRICING['gemini-3.7-flash'];
    else if (cleanModelKey.includes('gpt-4o-mini')) pricing = MODEL_PRICING['gpt-4o-mini'];
    else if (cleanModelKey.includes('gpt-4o') || cleanModelKey.includes('gpt-4')) pricing = MODEL_PRICING['gpt-4o'];
    else if (cleanModelKey.includes('claude-3-5-sonnet') || cleanModelKey.includes('sonnet')) pricing = MODEL_PRICING['claude-3-5-sonnet'];
    else if (cleanModelKey.includes('haiku')) pricing = MODEL_PRICING['claude-3-5-haiku'];
    else if (cleanModelKey.includes('o1') || cleanModelKey.includes('o3')) pricing = MODEL_PRICING['o3-mini'];
    else pricing = MODEL_PRICING['default'];
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const completionCost = (completionTokens / 1_000_000) * pricing.outputPer1M;

  return promptCost + completionCost;
}

// Format token count (e.g., "1.2k", "45.8k", "1.2M")
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toLocaleString();
}

// Format USD cost
export function formatUsd(amount: number): string {
  if (amount < 0.0001 && amount > 0) {
    return `< $0.0001`;
  }
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toFixed(3)}`;
}

// Initialize from storage on app startup
export async function initBudgetStore(): Promise<{ summary: BudgetSessionSummary; config: BudgetWatcherConfig }> {
  if (hasLoadedFromStorage) {
    return { summary: currentSummary, config: currentConfig };
  }

  try {
    const configRes = await storage.get(STORAGE_KEY_CONFIG);
    if (configRes && configRes.value) {
      const parsedConfig = JSON.parse(configRes.value);
      currentConfig = { ...DEFAULT_BUDGET_CONFIG, ...parsedConfig };
    }
  } catch (e: any) {
    // Normal when no custom config has been saved yet
    if (e?.message !== 'Not found') {
      console.debug('Budget config note:', e?.message || e);
    }
  }

  try {
    const summaryRes = await storage.get(STORAGE_KEY_SUMMARY);
    if (summaryRes && summaryRes.value) {
      const parsedSummary = JSON.parse(summaryRes.value);
      if (parsedSummary && typeof parsedSummary.totalTokens === 'number') {
        currentSummary = parsedSummary;
      }
    }
  } catch (e: any) {
    // Normal when no session summary has been recorded yet
    if (e?.message !== 'Not found') {
      console.debug('Budget summary note:', e?.message || e);
    }
  }

  hasLoadedFromStorage = true;
  notifyListeners();
  return { summary: currentSummary, config: currentConfig };
}

// Record a new API request token usage
export function recordTokenUsage(params: {
  agentKey: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  note?: string;
}): BudgetUsageRecord {
  const promptTokens = Math.max(0, Math.round(params.promptTokens || 0));
  const completionTokens = Math.max(0, Math.round(params.completionTokens || 0));
  const totalTokens = Math.max(promptTokens + completionTokens, Math.round(params.totalTokens || (promptTokens + completionTokens)));
  
  const estimatedCostUsd = calculateTokenCost(params.model, promptTokens, completionTokens);

  const record: BudgetUsageRecord = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    agentKey: params.agentKey,
    model: params.model,
    provider: params.provider || 'gemini',
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
    note: params.note
  };

  currentSummary = {
    totalPromptTokens: currentSummary.totalPromptTokens + promptTokens,
    totalCompletionTokens: currentSummary.totalCompletionTokens + completionTokens,
    totalTokens: currentSummary.totalTokens + totalTokens,
    totalCostUsd: currentSummary.totalCostUsd + estimatedCostUsd,
    requestCount: currentSummary.requestCount + 1,
    lastUpdated: Date.now(),
    history: [record, ...currentSummary.history.slice(0, 49)] // Keep last 50 records
  };

  // Persist asynchronously
  storage.set(STORAGE_KEY_SUMMARY, JSON.stringify(currentSummary)).catch(() => {});
  
  notifyListeners();

  // Play audio chime if configured and approaching threshold
  checkAndTriggerAudioAlert(currentSummary, currentConfig);

  return record;
}

// Update and persist config
export async function updateBudgetConfig(newConfig: Partial<BudgetWatcherConfig>): Promise<BudgetWatcherConfig> {
  currentConfig = { ...currentConfig, ...newConfig };
  try {
    await storage.set(STORAGE_KEY_CONFIG, JSON.stringify(currentConfig));
  } catch (e) {
    console.warn('Failed to persist budget config:', e);
  }
  notifyListeners();
  return currentConfig;
}

// Reset session metrics
export async function resetSessionBudget(): Promise<void> {
  currentSummary = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    requestCount: 0,
    lastUpdated: Date.now(),
    history: []
  };

  try {
    await storage.set(STORAGE_KEY_SUMMARY, JSON.stringify(currentSummary));
  } catch (e) {
    console.warn('Failed to reset budget in storage:', e);
  }

  notifyListeners();
}

// Get current state snapshot synchronously
export function getBudgetSnapshot(): { summary: BudgetSessionSummary; config: BudgetWatcherConfig } {
  return { summary: currentSummary, config: currentConfig };
}

// Calculate threshold progress stats
export function calculateBudgetStatus(
  summary: BudgetSessionSummary,
  config: BudgetWatcherConfig
): {
  percentage: number;
  isWarning: boolean;
  isCritical: boolean;
  isExceeded: boolean;
  currentValueFormatted: string;
  thresholdFormatted: string;
} {
  if (!config.enabled) {
    return {
      percentage: 0,
      isWarning: false,
      isCritical: false,
      isExceeded: false,
      currentValueFormatted: `${formatTokens(summary.totalTokens)} tok`,
      thresholdFormatted: 'Uncapped'
    };
  }

  let percentage = 0;
  let currentValueFormatted = '';
  let thresholdFormatted = '';

  if (config.thresholdMode === 'tokens') {
    percentage = (summary.totalTokens / (config.tokenThreshold || 1)) * 100;
    currentValueFormatted = `${formatTokens(summary.totalTokens)} tok`;
    thresholdFormatted = `${formatTokens(config.tokenThreshold)} tok`;
  } else {
    percentage = (summary.totalCostUsd / (config.costThresholdUsd || 0.01)) * 100;
    currentValueFormatted = formatUsd(summary.totalCostUsd);
    thresholdFormatted = formatUsd(config.costThresholdUsd);
  }

  const roundedPct = Math.round(percentage);
  const isWarning = roundedPct >= config.warningPercentage && roundedPct < 100;
  const isCritical = roundedPct >= 90 && roundedPct < 100;
  const isExceeded = roundedPct >= 100;

  return {
    percentage: roundedPct,
    isWarning,
    isCritical,
    isExceeded,
    currentValueFormatted,
    thresholdFormatted
  };
}

let lastAlertTimestamp = 0;

function checkAndTriggerAudioAlert(summary: BudgetSessionSummary, config: BudgetWatcherConfig) {
  if (!config.enabled || !config.soundAlerts) return;
  const status = calculateBudgetStatus(summary, config);
  
  // Throttle sound alerts to at most once every 60 seconds
  if ((status.isWarning || status.isExceeded) && Date.now() - lastAlertTimestamp > 60000) {
    lastAlertTimestamp = Date.now();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = status.isExceeded ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(status.isExceeded ? 440 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(status.isExceeded ? 220 : 880, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Audio autoplay restrictions, safe to ignore
    }
  }
}
