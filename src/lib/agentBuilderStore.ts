import { CustomAgentConfig, TrainingModule, BenchmarkEvaluation, TokenOptimizationResult, FORGE_AGENT_TEMPLATES } from '../types';

const STORAGE_KEY = 'buildengine_custom_agents';

export function getCustomAgents(): CustomAgentConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const seededTemplates = FORGE_AGENT_TEMPLATES.map((tmpl, idx) => ({
      ...tmpl,
      id: `template-${tmpl.name.toLowerCase()}-${idx}`,
      createdAt: Date.now() - (idx * 3600000),
      updatedAt: Date.now() - (idx * 3600000),
      benchmarks: []
    }));

    if (!raw) {
      saveCustomAgents(seededTemplates);
      return seededTemplates;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge any missing default templates (e.g. Reflo)
      const existingNames = new Set(parsed.map((a: any) => a.name.toLowerCase()));
      const missing = seededTemplates.filter((t) => !existingNames.has(t.name.toLowerCase()));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        saveCustomAgents(merged);
        return merged;
      }
      return parsed;
    }
    saveCustomAgents(seededTemplates);
    return seededTemplates;
  } catch (e) {
    console.error('Failed to load custom agents from localStorage:', e);
    return initDefaultTemplates();
  }
}

export function saveCustomAgents(agents: CustomAgentConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch (e) {
    console.error('Failed to save custom agents to localStorage:', e);
  }
}

export function saveCustomAgent(agent: CustomAgentConfig): CustomAgentConfig[] {
  const current = getCustomAgents();
  const index = current.findIndex((a) => a.id === agent.id);
  let updated: CustomAgentConfig[];
  
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...agent, updatedAt: Date.now() };
  } else {
    updated = [agent, ...current];
  }
  
  saveCustomAgents(updated);
  return updated;
}

export function deleteCustomAgent(id: string): CustomAgentConfig[] {
  const current = getCustomAgents();
  const updated = current.filter((a) => a.id !== id);
  saveCustomAgents(updated);
  return updated;
}

export function addTrainingModule(agentId: string, module: TrainingModule): CustomAgentConfig | null {
  const current = getCustomAgents();
  const target = current.find((a) => a.id === agentId);
  if (!target) return null;

  const existingModules = target.trainingModules || [];
  const updatedModules = [module, ...existingModules.filter((m) => m.id !== module.id)];
  
  const updatedAgent: CustomAgentConfig = {
    ...target,
    trainingModules: updatedModules,
    updatedAt: Date.now()
  };

  saveCustomAgent(updatedAgent);
  return updatedAgent;
}

export function addBenchmarkEvaluation(agentId: string, evaluation: BenchmarkEvaluation): CustomAgentConfig | null {
  const current = getCustomAgents();
  const target = current.find((a) => a.id === agentId);
  if (!target) return null;

  const existingBenchmarks = target.benchmarks || [];
  const updatedBenchmarks = [evaluation, ...existingBenchmarks];

  const updatedAgent: CustomAgentConfig = {
    ...target,
    benchmarks: updatedBenchmarks,
    updatedAt: Date.now()
  };

  saveCustomAgent(updatedAgent);
  return updatedAgent;
}

export function initDefaultTemplates(): CustomAgentConfig[] {
  const seeded: CustomAgentConfig[] = FORGE_AGENT_TEMPLATES.map((tmpl, idx) => ({
    ...tmpl,
    id: `template-${tmpl.name.toLowerCase()}-${idx}`,
    createdAt: Date.now() - (idx * 3600000),
    updatedAt: Date.now() - (idx * 3600000),
    benchmarks: []
  }));

  saveCustomAgents(seeded);
  return seeded;
}

// API CALLERS
export async function apiAutoBuildAgent(payload: {
  request: string;
  profile?: any;
}): Promise<{ success: boolean; agentId: string; agent: CustomAgentConfig; logs: string[] }> {
  const resp = await fetch('/api/builder/auto-build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to auto-build agent (${resp.status})`);
  }

  return resp.json();
}

export async function apiForgeAgent(payload: {
  goal: string;
  authorPersona?: string;
  capabilitiesHint?: string;
  profile?: any;
}): Promise<{ agent: Partial<CustomAgentConfig> }> {
  const resp = await fetch('/api/builder/forge-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to forge agent (${resp.status})`);
  }

  return resp.json();
}

export async function apiTrainAgent(payload: {
  agentName: string;
  roleTitle: string;
  currentSystemPrompt?: string;
  subject: string;
  focusTopics?: string;
  customNotes?: string;
  profile?: any;
}): Promise<{ module: TrainingModule }> {
  const resp = await fetch('/api/builder/train-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to train agent (${resp.status})`);
  }

  return resp.json();
}

export async function apiSimulateEval(payload: {
  agentName: string;
  roleTitle: string;
  systemPrompt: string;
  subject?: string;
  testPrompt?: string;
  profile?: any;
}): Promise<{ evaluation: BenchmarkEvaluation }> {
  const resp = await fetch('/api/builder/simulate-eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to evaluate agent (${resp.status})`);
  }

  return resp.json();
}

export async function apiOptimizeTokens(payload: {
  prompt: string;
  profile?: any;
}): Promise<{ optimization: TokenOptimizationResult }> {
  const resp = await fetch('/api/builder/optimize-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to optimize tokens (${resp.status})`);
  }

  return resp.json();
}
