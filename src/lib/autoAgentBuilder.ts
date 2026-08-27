/**
 * AutoAgentBuilder Service for Prometheus
 *
 * Fully automatic creation pipeline:
 * User prompt -> Parse intent -> Derive Agent Definition -> Generate Personality ->
 * Assign Voice -> Create Private Memory -> Create Neural Map -> Attach Refly Skills ->
 * Generate Backend Config -> Run Verification & Repair Loop -> Auto-Register in Roundtable ->
 * Emit AGENT_READY.
 */

import { reflySkillAdapter, ReflySkill } from './reflyAdapter';

export interface AgentPersonality {
  temperament: string[]; // e.g. ['calm', 'careful', 'skeptical', 'direct']
  speakingStyle: string; // e.g. 'measured, confident, technical'
  humor: string; // e.g. 'subtle, analytical'
  disagreementPosture: string; // e.g. 'respectful but firm'
}

export interface AgentPermissions {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canExecuteCommands: boolean;
  canCreateAgents: boolean;
  canModifyFrontend: boolean;
  canModifyBackend: boolean;
}

export interface VoiceConfig {
  voiceId: string;
  pitch: number;
  rate: number;
  archetype: 'deep_calm' | 'analytical_clear' | 'grounded_engineer' | 'expressive_creative' | 'serious_guardian';
}

export interface NeuralNode {
  id: string;
  label: string;
  type: 'agent' | 'role' | 'capability' | 'tool' | 'project' | 'knowledge' | 'memory' | 'task';
}

export interface NeuralEdge {
  source: string;
  target: string;
  strength: number;
}

export interface NeuralMap {
  agentId: string;
  nodes: NeuralNode[];
  edges: NeuralEdge[];
}

export interface AutoAgentDefinition {
  id: string;
  name: string;
  roleTitle: string;
  glyph: string;
  color: string;
  intro: string;
  systemPrompt: string;
  version: string;
  status: 'planning' | 'building' | 'testing' | 'verifying' | 'ready' | 'failed';
  personality: AgentPersonality;
  permissions: AgentPermissions;
  voice: VoiceConfig;
  memoryNamespace: string;
  capabilities: string[];
  reflySkills: ReflySkill[];
  neuralMap: NeuralMap;
  createdAt: number;
  updatedAt: number;
  author: string;
  isCustom: boolean;
}

/**
 * Derives appropriate voice configuration based on role & personality
 */
export function assignVoiceForRole(roleTitle: string, personalityText: string): VoiceConfig {
  const lower = `${roleTitle} ${personalityText}`.toLowerCase();

  if (lower.includes('commander') || lower.includes('orchestrator') || lower.includes('ceo') || lower.includes('leader')) {
    return { voiceId: 'voice-commander-male', pitch: 0.85, rate: 0.95, archetype: 'deep_calm' };
  }
  if (lower.includes('security') || lower.includes('cyber') || lower.includes('guardian') || lower.includes('audit')) {
    return { voiceId: 'voice-guardian-male', pitch: 0.88, rate: 1.0, archetype: 'serious_guardian' };
  }
  if (lower.includes('game') || lower.includes('creative') || lower.includes('design') || lower.includes('art')) {
    return { voiceId: 'voice-creative-female', pitch: 1.12, rate: 1.05, archetype: 'expressive_creative' };
  }
  if (lower.includes('engineer') || lower.includes('code') || lower.includes('developer') || lower.includes('forge')) {
    return { voiceId: 'voice-engineer-male', pitch: 0.92, rate: 1.05, archetype: 'grounded_engineer' };
  }

  return { voiceId: 'voice-analytical-female', pitch: 1.05, rate: 0.98, archetype: 'analytical_clear' };
}

/**
 * Derives default role-based permissions
 */
export function assignPermissionsForRole(roleTitle: string): AgentPermissions {
  const lower = roleTitle.toLowerCase();

  if (lower.includes('builder') || lower.includes('engineer') || lower.includes('forge') || lower.includes('cto')) {
    return {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: true,
      canCreateAgents: true,
      canModifyFrontend: true,
      canModifyBackend: true
    };
  }
  if (lower.includes('game') || lower.includes('developer') || lower.includes('architect')) {
    return {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: true,
      canCreateAgents: false,
      canModifyFrontend: true,
      canModifyBackend: true
    };
  }
  if (lower.includes('research') || lower.includes('analyst') || lower.includes('sage')) {
    return {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: false,
      canCreateAgents: false,
      canModifyFrontend: false,
      canModifyBackend: false
    };
  }

  return {
    canReadFiles: true,
    canWriteFiles: true,
    canExecuteCommands: false,
    canCreateAgents: false,
    canModifyFrontend: true,
    canModifyBackend: false
  };
}

/**
 * Initializes default neural map for new agent
 */
export function createInitialNeuralMap(agentId: string, name: string, roleTitle: string, capabilities: string[]): NeuralMap {
  const nodes: NeuralNode[] = [
    { id: 'core', label: name, type: 'agent' },
    { id: 'role', label: roleTitle, type: 'role' },
    { id: 'memory', label: `memory/${agentId}`, type: 'memory' }
  ];

  const edges: NeuralEdge[] = [
    { source: 'core', target: 'role', strength: 1.0 },
    { source: 'core', target: 'memory', strength: 0.9 }
  ];

  capabilities.forEach((cap, i) => {
    const capId = `cap-${i}`;
    nodes.push({ id: capId, label: cap, type: 'capability' });
    edges.push({ source: 'core', target: capId, strength: 0.8 });
  });

  return { agentId, nodes, edges };
}
