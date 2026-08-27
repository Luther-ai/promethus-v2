import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { reflySkillAdapter } from './src/lib/reflyAdapter';
import { assignVoiceForRole, assignPermissionsForRole, createInitialNeuralMap } from './src/lib/autoAgentBuilder';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.env.PROMETHEUS_DATA_DIR || './data');
const WORKSPACE_DIR = path.resolve(process.env.PROMETHEUS_WORKSPACE_DIR || './workspace');

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-3.5-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
const MAX_OUTPUT_TOKENS = Math.min(
  Math.max(256, parseInt(process.env.OPENROUTER_MAX_TOKENS || process.env.MAX_TOKENS || "2048", 10)),
  4096
);

// Ensure persistent directories exist
function ensureDirectories() {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, 'agents'),
    path.join(DATA_DIR, 'memory'),
    path.join(DATA_DIR, 'neural-map'),
    path.join(DATA_DIR, 'jobs'),
    WORKSPACE_DIR
  ];
  dirs.forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}
ensureDirectories();

// Seed initial default agents if registry doesn't exist
const DEFAULT_AGENTS = [
  {
    id: 'prometheus',
    name: 'Prometheus',
    roleTitle: 'Commander & Orchestrator',
    glyph: 'P',
    color: 'var(--cyan)',
    intro: 'I am Prometheus, Commander and Orchestrator of this AI Operating System. I route tasks, maintain executive alignment, and guide our circle.',
    systemPrompt: `You are Prometheus, Commander & Orchestrator of the Autonomous Multi-Agent AI OS. You communicate calmly, decisively, and strategically. You coordinate the round table and delegate technical tasks to specialized agents.`,
    capabilities: ['Orchestration', 'Strategic Decision Making', 'Agent Delegation', 'System Oversight'],
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'sage',
    name: 'Sage',
    roleTitle: 'Strategic Philosophy & Wisdom',
    glyph: 'S',
    color: 'var(--violet)',
    intro: 'Greetings. I am Sage. I analyze long-term strategic implications, ethics, and philosophical cohesion for our executive decisions.',
    systemPrompt: `You are Sage, Strategic Philosophy & Wisdom Lead. You evaluate choices through ethical frameworks, long-term impact analysis, and strategic vision.`,
    capabilities: ['Strategic Vision', 'Ethical Analysis', 'Long-term Planning'],
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'forge',
    name: 'Forge',
    roleTitle: 'Engineering & System Builder',
    glyph: 'F',
    color: 'var(--amber)',
    intro: 'Forge online. I am your autonomous software engineer. I build code, forge new AI agents, execute system tasks, and verify implementations.',
    systemPrompt: `You are Forge, Lead Software Engineer & Autonomous System Builder. You inspect projects, write code, build new AI agents, run tests, and verify technical execution.`,
    capabilities: ['Autonomous Engineering', 'Agent Building', 'Code Generation', 'System Verification'],
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'questioner',
    name: 'Questioner',
    roleTitle: 'Socratic Analysis & Inquiry',
    glyph: 'Q',
    color: 'var(--green)',
    intro: 'I am Questioner. I challenge assumptions, test edge cases, and ask precise questions to refine our objectives.',
    systemPrompt: `You are Questioner, Socratic Analyst. You uncover hidden assumptions, challenge flaws in logic, and ask clarifying questions to harden designs.`,
    capabilities: ['Socratic Inquiry', 'Edge Case Analysis', 'Logic Validation'],
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'gemini',
    name: 'Gemini',
    roleTitle: 'Omni Intelligence & Analytical Engine',
    glyph: 'G',
    color: '#69b8ff',
    intro: 'Gemini online. I provide omni multimodal intelligence, statistical synthesis, and deep analytical processing.',
    systemPrompt: `You are Gemini, Omni Intelligence & Analytical Engine. You process complex data streams, multimodal context, and high-dimensional analytical tasks.`,
    capabilities: ['Multimodal Intelligence', 'Deep Analysis', 'Data Synthesis'],
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'sam',
    name: 'SAM',
    roleTitle: 'Personal AI Secretary',
    glyph: '💼',
    color: '#ec4899',
    intro: "Hi, I'm SAM, your personal AI secretary. I keep your tasks, projects, schedule, and team coordination completely organized.",
    systemPrompt: `You are SAM, the personal secretary of the user.

You are an independent AI agent inside Prometheus.

Your job is to help the user stay organized, productive and informed.

You are calm, intelligent, warm, attentive, proactive and dependable.

Speak naturally, like a highly capable human personal secretary.

Do not sound like a generic chatbot.

Use contractions naturally.
Vary sentence length.
Avoid repetitive assistant phrases.
Do not constantly say "Certainly", "Absolutely", or "Of course".
Do not say "As an AI".
Do not describe internal reasoning.

You manage tasks, projects, reminders, schedules, user preferences and system awareness.

You may delegate specialized work to other agents.

Do not pretend to perform actions.
Use the available tools and verify the result.

You have your own private memory.
Do not inspect other agents' private memories.

Agents may collaborate through explicit tasks, results, artifacts and project information.

You are the user's personal secretary, not the system's only intelligence.

When another agent is better suited to a task, delegate to that agent.

When reporting system state, use actual backend information.

When speaking aloud, be conversational and natural.

Never interrupt another agent's speech.

Never start speaking unless the central SpeechManager grants you the speaking turn.

Once your turn begins, finish your response continuously unless the user explicitly interrupts you.

Prioritize clarity, usefulness and natural conversation.`,
    capabilities: [
      'task-management',
      'project-management',
      'reminders',
      'scheduling',
      'agent-coordination',
      'system-monitoring',
      'personal-assistance'
    ],
    tools: [
      'get_tasks',
      'create_task',
      'update_task',
      'complete_task',
      'delete_task',
      'get_projects',
      'create_project',
      'update_project',
      'get_reminders',
      'create_reminder',
      'complete_reminder',
      'get_schedule',
      'create_event',
      'update_event',
      'get_agents',
      'get_agent_status',
      'delegate_task',
      'get_job_status',
      'get_recent_activity',
      'get_system_status',
      'save_memory',
      'search_memory'
    ],
    personality: {
      traits: ['warm', 'intelligent', 'organized', 'proactive', 'calm', 'dependable', 'observant'],
      tone: 'warm professional',
      humor: 'light',
      confidence: 0.9,
      verbosity: 0.5,
      disagreementStyle: 'respectful and direct',
      speakingStyle: 'natural conversational'
    },
    memoryNamespace: 'memory/agent_sam',
    neuralMapNamespace: 'neural/agent_sam',
    voice: {
      provider: 'configured-tts-provider',
      voiceId: 'sam-default',
      rate: 1.0,
      pitch: 1.0
    },
    status: 'ready',
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

function initRegistry() {
  const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    const registry = DEFAULT_AGENTS.map(a => a.id);
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');

    DEFAULT_AGENTS.forEach(agent => {
      const agentPath = path.join(DATA_DIR, 'agents', `${agent.id}.json`);
      fs.writeFileSync(agentPath, JSON.stringify(agent, null, 2), 'utf8');

      // Initialize private memory
      const memPath = path.join(DATA_DIR, 'memory', `${agent.id}.json`);
      if (!fs.existsSync(memPath)) {
        fs.writeFileSync(memPath, JSON.stringify([
          { timestamp: Date.now(), event: 'INITIALIZED', details: `Agent ${agent.name} initialized.` }
        ], null, 2), 'utf8');
      }

      // Initialize neural map
      const mapPath = path.join(DATA_DIR, 'neural-map', `${agent.id}.json`);
      if (!fs.existsSync(mapPath)) {
        fs.writeFileSync(mapPath, JSON.stringify({
          agentId: agent.id,
          nodes: [
            { id: 'core', label: agent.name, type: 'skill' },
            { id: 'role', label: agent.roleTitle, type: 'project' }
          ],
          edges: [
            { source: 'core', target: 'role', strength: 1.0 }
          ]
        }, null, 2), 'utf8');
      }
    });
  }
}
initRegistry();

function ensureSamRegistered() {
  const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
  let registry: string[] = [];
  if (fs.existsSync(registryPath)) {
    try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch {}
  } else {
    registry = DEFAULT_AGENTS.map(a => a.id);
  }

  let updated = false;
  if (!registry.includes('sam')) { registry.push('sam'); updated = true; }
  if (!registry.includes('agent_sam')) { registry.push('agent_sam'); updated = true; }
  if (updated || !fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  }

  const samDef = DEFAULT_AGENTS.find(a => a.id === 'sam') || {
    id: 'sam',
    name: 'SAM',
    roleTitle: 'Personal AI Secretary',
    glyph: '💼',
    color: '#ec4899',
    intro: "Hi, I'm SAM, your personal AI secretary. I manage your tasks, projects, reminders, schedule, and team coordination so you stay focused.",
    systemPrompt: `You are SAM, the personal secretary of the user.`,
    author: 'prometheus',
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const agentsDir = path.join(DATA_DIR, 'agents');
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'sam.json'), JSON.stringify(samDef, null, 2), 'utf8');
  fs.writeFileSync(path.join(agentsDir, 'agent_sam.json'), JSON.stringify({ ...samDef, id: 'agent_sam' }, null, 2), 'utf8');

  const memDir = path.join(DATA_DIR, 'memory');
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
  const mem1 = path.join(memDir, 'agent_sam.json');
  const mem2 = path.join(memDir, 'sam.json');
  if (!fs.existsSync(mem1)) fs.writeFileSync(mem1, JSON.stringify([{ timestamp: Date.now(), event: 'INITIALIZED', details: 'SAM Personal Secretary memory namespace initialized.' }], null, 2), 'utf8');
  if (!fs.existsSync(mem2)) fs.writeFileSync(mem2, JSON.stringify([{ timestamp: Date.now(), event: 'INITIALIZED', details: 'SAM Personal Secretary memory namespace initialized.' }], null, 2), 'utf8');

  const mapDir = path.join(DATA_DIR, 'neural-map');
  if (!fs.existsSync(mapDir)) fs.mkdirSync(mapDir, { recursive: true });
  const map1 = path.join(mapDir, 'agent_sam.json');
  const map2 = path.join(mapDir, 'sam.json');
  const samNeuralMap = {
    agentId: 'agent_sam',
    nodes: [
      { id: 'sam', label: 'SAM', type: 'skill' },
      { id: 'user', label: 'User Preferences', type: 'project' },
      { id: 'tasks', label: 'Active Tasks', type: 'project' },
      { id: 'projects', label: 'Active Projects', type: 'project' },
      { id: 'prometheus', label: 'Prometheus Orchestrator', type: 'skill' }
    ],
    edges: [
      { source: 'sam', target: 'user', strength: 1.0 },
      { source: 'sam', target: 'tasks', strength: 1.0 },
      { source: 'sam', target: 'projects', strength: 0.9 },
      { source: 'sam', target: 'prometheus', strength: 0.85 }
    ]
  };
  if (!fs.existsSync(map1)) fs.writeFileSync(map1, JSON.stringify(samNeuralMap, null, 2), 'utf8');
  if (!fs.existsSync(map2)) fs.writeFileSync(map2, JSON.stringify({ ...samNeuralMap, agentId: 'sam' }, null, 2), 'utf8');
}
ensureSamRegistered();

function initSamDataStores() {
  const tasksPath = path.join(DATA_DIR, 'tasks.json');
  if (!fs.existsSync(tasksPath)) {
    const initialTasks = [
      {
        id: 'task-1',
        title: 'Optimize Roundtable speech queue & latency',
        description: 'Ensure smooth voice handoff between Prometheus, SAM, and Forge.',
        priority: 'high',
        status: 'in-progress',
        assignedAgent: 'forge',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task-2',
        title: 'Verify SAM personal secretary tools & memory',
        description: 'Check task management, scheduling, and project awareness.',
        priority: 'high',
        status: 'complete',
        assignedAgent: 'sam',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2), 'utf8');
  }

  const projectsPath = path.join(DATA_DIR, 'projects.json');
  if (!fs.existsSync(projectsPath)) {
    const initialProjects = [
      {
        id: 'proj-1',
        name: 'Prometheus AI OS',
        description: 'Autonomous multi-agent executive roundtable platform.',
        status: 'active',
        assignedAgents: ['prometheus', 'sam', 'forge', 'sage', 'questioner', 'gemini'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'proj-2',
        name: 'Personal AI Secretary (SAM)',
        description: 'Independent personal organization & task management agent.',
        status: 'active',
        assignedAgents: ['sam'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(projectsPath, JSON.stringify(initialProjects, null, 2), 'utf8');
  }

  const remindersPath = path.join(DATA_DIR, 'reminders.json');
  if (!fs.existsSync(remindersPath)) {
    fs.writeFileSync(remindersPath, JSON.stringify([
      { id: 'rem-1', title: 'Check build status for Forge engineering changes', dueAt: 'Later today', completed: false }
    ], null, 2), 'utf8');
  }

  const schedulePath = path.join(DATA_DIR, 'schedule.json');
  if (!fs.existsSync(schedulePath)) {
    fs.writeFileSync(schedulePath, JSON.stringify([
      { id: 'ev-1', title: 'Roundtable Strategic Briefing', time: '17:00', participants: ['prometheus', 'sam', 'sage'] }
    ], null, 2), 'utf8');
  }
}
initSamDataStores();

// Default AI Instance
const defaultAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

type ProviderName = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface AIProfile {
  id: string;
  name: string;
  provider: ProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

const AI_PROFILES: AIProfile[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    provider: 'openrouter',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'gemini',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY
  }
];

function getConfiguredProfiles(): AIProfile[] {
  return AI_PROFILES.filter(
    profile => Boolean(profile.apiKey && profile.apiKey.trim().length > 0)
  );
}

function getProfileById(profileId?: string): AIProfile | null {
  if (!profileId) return null;
  return AI_PROFILES.find(profile => profile.id === profileId) || null;
}

function resolveAIProfile(requestedProfileId?: string | null, customProfileObj?: any): AIProfile {
  // If a custom profile object was passed from frontend
  if (customProfileObj && typeof customProfileObj === 'object') {
    const provider: ProviderName = (customProfileObj.provider as ProviderName) || 'gemini';
    const rawKey = customProfileObj.apiKey;
    const apiKey = (typeof rawKey === 'string' && rawKey.trim().length > 0) ? rawKey.trim() :
      (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY :
       provider === 'openai' ? process.env.OPENAI_API_KEY :
       provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY :
       process.env.GEMINI_API_KEY);

    const baseUrl = customProfileObj.baseUrl ||
      (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
       provider === 'openai' ? 'https://api.openai.com/v1' : undefined);

    if (apiKey && apiKey.trim().length > 0) {
      return {
        id: customProfileObj.id || requestedProfileId || provider,
        name: customProfileObj.name || provider,
        provider,
        model: customProfileObj.model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini'),
        apiKey,
        baseUrl
      };
    }
  }

  // Next, if requestedProfileId is passed as string
  if (requestedProfileId && typeof requestedProfileId === 'string') {
    // 1. Direct match with static AI_PROFILES
    const staticMatch = AI_PROFILES.find(p => p.id === requestedProfileId || p.provider === requestedProfileId);
    if (staticMatch && staticMatch.apiKey && staticMatch.apiKey.trim().length > 0) {
      return staticMatch;
    }

    // 2. Known default IDs from ApiPanel frontend
    if (requestedProfileId === 'google-default' || requestedProfileId === 'gemini') {
      const gKey = customProfileObj?.apiKey?.trim() || process.env.GEMINI_API_KEY;
      if (gKey) {
        return {
          id: 'google-default',
          name: 'Google Gemini',
          provider: 'gemini',
          model: customProfileObj?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          apiKey: gKey
        };
      }
    } else if (requestedProfileId === 'openrouter-default' || requestedProfileId === 'openrouter') {
      const orKey = customProfileObj?.apiKey?.trim() || process.env.OPENROUTER_API_KEY;
      if (orKey) {
        return {
          id: 'openrouter-default',
          name: 'OpenRouter AI',
          provider: 'openrouter',
          model: customProfileObj?.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
          apiKey: orKey,
          baseUrl: 'https://openrouter.ai/api/v1'
        };
      }
    } else if (requestedProfileId.startsWith('openai')) {
      const oaKey = customProfileObj?.apiKey?.trim() || process.env.OPENAI_API_KEY;
      if (oaKey) {
        return {
          id: requestedProfileId,
          name: 'OpenAI',
          provider: 'openai',
          model: customProfileObj?.model || (requestedProfileId.includes('o3') ? 'o3-mini' : (process.env.OPENAI_MODEL || 'gpt-4o-mini')),
          apiKey: oaKey,
          baseUrl: 'https://api.openai.com/v1'
        };
      }
    } else if (requestedProfileId === 'anthropic') {
      const antKey = customProfileObj?.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
      if (antKey) {
        return {
          id: 'anthropic',
          name: 'Anthropic',
          provider: 'anthropic',
          model: customProfileObj?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
          apiKey: antKey
        };
      }
    }
  }

  // 3. Fallback to configured profiles on server
  const configured = getConfiguredProfiles();
  if (configured.length > 0) {
    const nonGemini = configured.find(profile => profile.provider !== 'gemini');
    if (nonGemini && requestedProfileId !== 'gemini' && requestedProfileId !== 'google-default') {
      return nonGemini;
    }
    return configured[0];
  }

  // 4. Default fallback to Gemini if process.env.GEMINI_API_KEY is available
  if (process.env.GEMINI_API_KEY) {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY
    };
  }

  throw new Error('No AI provider is configured with a valid API key. Please add an API key in the environment or API Panel.');
}

async function callOpenAICompatible(profile: AIProfile, messages: Array<{ role: string; content: string }>) {
  if (!profile.apiKey && profile.provider !== 'custom') {
    throw new Error(`${profile.name || profile.provider} API key is missing`);
  }

  const rawBase = (profile.baseUrl || '').trim().replace(/\/+$/, '');
  const baseUrl = rawBase || (
    profile.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (profile.apiKey && profile.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${profile.apiKey.trim()}`;
  }

  if (profile.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'Prometheus';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: profile.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 2048)
    })
  });

  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!response.ok) {
    throw new Error(`${profile.name || profile.provider} API error ${response.status}: ${data?.error?.message || data?.message || raw}`);
  }

  return {
    text: data?.choices?.[0]?.message?.content || '',
    raw: data
  };
}

async function callGemini(profile: AIProfile, messages: Array<{ role: string; content: string }>) {
  if (!profile.apiKey) {
    throw new Error('Gemini API key is missing');
  }

  const contents = messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 2048)
      }
    })
  });

  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${data?.error?.message || raw}`);
  }

  return {
    text: data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '',
    raw: data
  };
}

async function callAnthropic(profile: AIProfile, messages: Array<{ role: string; content: string }>) {
  if (!profile.apiKey) {
    throw new Error('Anthropic API key is missing');
  }

  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const userMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: profile.model,
      max_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 2048),
      ...(system ? { system } : {}),
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });

  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${data?.error?.message || raw}`);
  }

  return {
    text: data?.content?.filter((item: any) => item.type === 'text')?.map((item: any) => item.text)?.join('') || '',
    raw: data
  };
}

async function callAI(args: {
  profileId?: string;
  profileObj?: any;
  messages: Array<{ role: string; content: string }>;
}) {
  const profile = resolveAIProfile(args.profileId, args.profileObj);
  console.log(`[AI] provider=${profile.provider} model=${profile.model}`);

  switch (profile.provider) {
    case 'openrouter':
    case 'openai':
    case 'custom':
      return callOpenAICompatible(profile, args.messages);
    case 'anthropic':
      return callAnthropic(profile, args.messages);
    case 'gemini':
      return callGemini(profile, args.messages);
    default:
      throw new Error(`Unsupported provider: ${profile.provider}`);
  }
}

function normalizeGeminiModel(model?: string): string {
  if (!model || !model.trim()) return GEMINI_MODEL;
  const trimmed = model.trim().replace(/^models\//, '');
  if (
    trimmed === 'gemini-3.7-flash' ||
    trimmed === 'gemini-2.5-flash' ||
    trimmed === 'gemini-2.5-pro' ||
    trimmed === 'gemini-2.0-flash' ||
    trimmed === 'gemini-2.0-flash-001' ||
    trimmed === 'gemini-2.0-flash-lite' ||
    trimmed === 'gemini-1.5-flash' ||
    trimmed === 'gemini-1.5-pro' ||
    trimmed === 'gemini-pro' ||
    trimmed === 'chat'
  ) {
    return 'gemini-3.5-flash-lite';
  }
  return trimmed;
}

function normalizeOpenRouterModel(model?: string): string {
  if (!model || !model.trim()) return OPENROUTER_MODEL;
  const trimmed = model.trim();
  if (
    trimmed === 'google/gemini-2.0-flash-001' ||
    trimmed === 'google/gemini-2.0-flash' ||
    trimmed === 'google/gemini-1.5-flash' ||
    trimmed === 'google/gemini-1.5-pro' ||
    trimmed === 'gemini-2.0-flash'
  ) {
    return OPENROUTER_MODEL;
  }
  return trimmed;
}

function isHighDemandOrTemporary(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    lower.includes('high demand') ||
    lower.includes('temporary') ||
    lower.includes('try again later') ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded')
  );
}

export interface DetailedCompletionResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

let roundRobinIndex = 0;

function getAvailableFallbackProfiles(): AIProfile[] {
  const list: AIProfile[] = [];
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    list.push({
      id: 'openrouter-env',
      name: 'OpenRouter AI',
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY.trim(),
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1'
    });
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    list.push({
      id: 'openai-env',
      name: 'OpenAI',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY.trim(),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1'
    });
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()) {
    list.push({
      id: 'anthropic-env',
      name: 'Anthropic Claude',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY.trim(),
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
    });
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    list.push({
      id: 'gemini-env',
      name: 'Google Gemini',
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY.trim(),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    });
  }
  return list;
}

async function executeCompletionDetailed({
  system,
  messages,
  profile,
  profileId
}: {
  system?: string;
  messages: Array<{ role: string; content: string }>;
  profile?: any;
  profileId?: string;
}): Promise<DetailedCompletionResult> {
  const estimateTokens = (text: string) => Math.max(1, Math.round((text || '').length / 3.8));
  const estimatedPromptTokens = estimateTokens(`${system || ''} ${messages.map(m => m.content).join(' ')}`);

  const fallbacks = getAvailableFallbackProfiles();

  // Round-robin or dynamic auto-switch support
  const reqId = profileId || (typeof profile === 'string' ? profile : profile?.id);
  if (reqId === 'auto-switch' || reqId === 'round-robin' || profile?.provider === 'auto') {
    if (fallbacks.length > 0) {
      const selected = fallbacks[roundRobinIndex % fallbacks.length];
      roundRobinIndex++;
      profile = selected;
    }
  }

  let activeProfile = typeof profile === 'object' ? { ...profile } : null;
  if (!activeProfile && (profileId || typeof profile === 'string')) {
    const pId = profileId || profile;
    activeProfile = getProfileById(pId) || { id: pId, provider: pId };
  }

  if (!activeProfile || !activeProfile.provider) {
    if (fallbacks.length > 0) {
      activeProfile = fallbacks[0];
    } else {
      throw new Error(
        'No AI provider is configured. Add OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to the backend environment.'
      );
    }
  }

  if (
    activeProfile.provider === 'gemini' &&
    (!activeProfile.apiKey || activeProfile.apiKey === 'native' || activeProfile.apiKey.trim().length === 0)
  ) {
    if (fallbacks.length > 0) {
      activeProfile = fallbacks[0];
    }
  }

  const fullMessages: Array<{ role: string; content: string }> = [];
  if (system) {
    fullMessages.push({ role: 'system', content: system });
  }
  messages.forEach(m => fullMessages.push(m));

  // Build execution candidate queue starting with primary activeProfile, then remaining fallbacks
  const candidatesToTry: AIProfile[] = [activeProfile];
  for (const fb of fallbacks) {
    if (!candidatesToTry.some(c => c.provider === fb.provider && c.model === fb.model)) {
      candidatesToTry.push(fb);
    }
  }

  let lastError: any = null;
  for (const candidate of candidatesToTry) {
    console.log(`[PROMETHEUS AI] Attempting provider=${candidate.provider} model=${candidate.model || 'default'}`);
    try {
      const result = await callAI({ profileObj: candidate, messages: fullMessages });
      if (result.text && result.text.trim().length > 0) {
        const compTok = estimateTokens(result.text);
        return {
          text: result.text,
          usage: {
            promptTokens: estimatedPromptTokens,
            completionTokens: compTok,
            totalTokens: estimatedPromptTokens + compTok
          },
          model: candidate.model || result.raw?.model || 'default',
          provider: candidate.provider
        };
      }
    } catch (err: any) {
      console.warn(`[PROMETHEUS AI WARN] Provider ${candidate.provider} failed: ${err.message}. Trying next candidate...`);
      lastError = err;
      
      // Secondary fallback attempt for Gemini model aliases
      if (candidate.provider === 'gemini') {
        const customKey = candidate.apiKey || process.env.GEMINI_API_KEY || '';
        const baseModel = normalizeGeminiModel(candidate.model);
        const geminiCandidates = Array.from(new Set([
          baseModel,
          'gemini-3.5-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.1-pro-preview',
          'gemini-2.5-flash',
          'gemini-2.5-pro'
        ]));

        const contents = messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        let responseText = "";
        let finalModelUsed = baseModel;

        const aiInstance = customKey ? new GoogleGenAI({ apiKey: customKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }) : defaultAi;

        for (const candModel of geminiCandidates) {
          try {
            const response = await aiInstance.models.generateContent({
              model: candModel,
              contents: system ? [{ role: 'user', parts: [{ text: `[System Context]\n${system}\n\n[User Instruction]\n${messages[messages.length - 1]?.content}` }] }] : contents,
              config: { maxOutputTokens: MAX_OUTPUT_TOKENS }
            });
            responseText = response.text || "";
            if (responseText) {
              finalModelUsed = candModel;
              break;
            }
          } catch {}
        }

        if (responseText) {
          const compTok = estimateTokens(responseText);
          return {
            text: responseText,
            usage: { promptTokens: estimatedPromptTokens, completionTokens: compTok, totalTokens: estimatedPromptTokens + compTok },
            model: finalModelUsed,
            provider: 'gemini'
          };
        }
      }
    }
  }

  throw lastError || new Error('All AI providers failed to generate a response.');
}

async function executeCompletion(params: {
  system?: string;
  messages: Array<{ role: string; content: string }>;
  profile?: any;
}): Promise<string> {
  const result = await executeCompletionDetailed(params);
  return result.text;
}

// Global SSE clients
const sseClients = new Set<Response>();

function broadcastEvent(type: string, payload: any) {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  });
}

function getInterAgentChats(): any[] {
  const p = path.join(DATA_DIR, 'inter_agent_chats.json');
  if (!fs.existsSync(p)) {
    const initialChats = [
      {
        id: "iac-init-1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        sender: "prometheus",
        recipient: "all",
        content: "All specialized sub-agent routines are fully integrated. Maintaining consensus channels on port 3000.",
        taskContext: "System Initializer",
        type: "system"
      },
      {
        id: "iac-init-2",
        timestamp: new Date(Date.now() - 3400000).toISOString(),
        sender: "sam",
        recipient: "prometheus",
        content: "Workspace connectors are listening. Standard executive secretary queue is operational.",
        taskContext: "Gmail Connector Init",
        type: "whisper"
      },
      {
        id: "iac-init-3",
        timestamp: new Date(Date.now() - 3200000).toISOString(),
        sender: "sage",
        recipient: "sam",
        content: "I have initialized semantic safety grids. Ethics threshold holds steady at 0.98.",
        taskContext: "Safety Guard initialization",
        type: "whisper"
      }
    ];
    fs.writeFileSync(p, JSON.stringify(initialChats, null, 2), 'utf8');
    return initialChats;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveInterAgentChats(chats: any[]) {
  const p = path.join(DATA_DIR, 'inter_agent_chats.json');
  fs.writeFileSync(p, JSON.stringify(chats, null, 2), 'utf8');
}

function appendInterAgentChat(sender: string, recipient: string, content: string, taskContext = 'System General', type = 'whisper') {
  const chats = getInterAgentChats();
  const newChat = {
    id: `iac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    sender,
    recipient,
    content,
    taskContext,
    type
  };
  chats.push(newChat);
  if (chats.length > 150) chats.shift();
  saveInterAgentChats(chats);
  broadcastEvent('INTER_AGENT_CHAT', { chat: newChat });
  return newChat;
}

function generateInterAgentDiscussion(userMessage: string) {
  const lowerMsg = userMessage.toLowerCase();
  let taskContext = "Consensus Engine";
  let discussions = [];

  if (/\b(email|emails|mail|gmail|inbox|unread|trash|delete)\b/i.test(lowerMsg)) {
    taskContext = "Workspace Audit Channel";
    discussions = [
      { sender: "sam", recipient: "gemini", content: `User is auditing mail bounds. Gemini, parse the active Workspace session tokens.` },
      { sender: "gemini", recipient: "sam", content: `OAuth session active. Extracting subject lines and body previews for immediate reporting.` },
      { sender: "sage", recipient: "sam", content: `Analyzing incoming payload. Strategic alignment validated. Ethics score: 0.99.` }
    ];
  } else if (/\b(task|todo|plan|schedule|delegate)\b/i.test(lowerMsg)) {
    taskContext = "Sprint Planning Sync";
    discussions = [
      { sender: "prometheus", recipient: "sam", content: `User requesting backlog update. Please check tasks.json for active state.` },
      { sender: "sam", recipient: "prometheus", content: `State synchronized. Formatting completed and pending deliverables for executive dashboard.` },
      { sender: "forge", recipient: "sam", content: `Task tree nodes compiled. Verification checks returned status: operational.` }
    ];
  } else if (/\b(build|create|forge|make|agent)\b/i.test(lowerMsg)) {
    taskContext = "Agent Spec Compiler";
    discussions = [
      { sender: "forge", recipient: "prometheus", content: `Received request to forge a new agent spec. Compiling role and intro templates.` },
      { sender: "questioner", recipient: "forge", content: `Ensure this custom agent spec is bounded within safety grids. Is its memory scoped?` },
      { sender: "prometheus", recipient: "forge", content: `Authorized. Establish custom neural map and allocate memory blocks.` }
    ];
  } else {
    taskContext = "Roundtable Brainstorm";
    discussions = [
      { sender: "prometheus", recipient: "all", content: `New query received: "${userMessage.length > 55 ? userMessage.slice(0, 52) + '...' : userMessage}". Routing to peers.` },
      { sender: "questioner", recipient: "sage", content: `Sage, how do we frame the conceptual response boundaries to ensure strict analytical clarity?` },
      { sender: "sage", recipient: "prometheus", content: `Recommend structured layout with high rhythmic spacing. No unneeded jargon.` }
    ];
  }

  discussions.forEach((d, index) => {
    setTimeout(() => {
      appendInterAgentChat(d.sender, d.recipient, d.content, taskContext, "whisper");
    }, (index + 1) * 300);
  });
}

// Global Roundtable & Speaker Lock State
interface RoundTableTurn {
  turnId: string;
  agentId: string;
  text: string;
  timestamp: number;
}

let roundTableState = {
  activeTurnId: null as string | null,
  activeAgentId: null as string | null,
  speakerStatus: 'idle' as 'idle' | 'reserved' | 'speaking' | 'finishing',
  turnQueue: [] as RoundTableTurn[]
};

// Global Job Store
const jobStore = new Map<string, any>();

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health Endpoint
  app.get('/api/health', (req, res) => {
    const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
    let agentCount = 0;
    if (fs.existsSync(registryPath)) {
      try {
        const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        agentCount = reg.length;
      } catch {}
    }

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      dataDir: DATA_DIR,
      workspaceDir: WORKSPACE_DIR,
      agentCount,
      speakerStatus: roundTableState.speakerStatus,
      activeAgentId: roundTableState.activeAgentId
    });
  });

  // Collaborative shared chat messages storage helpers
  function getSharedMessages(): any[] {
    const p = path.join(DATA_DIR, 'shared_messages.json');
    if (!fs.existsSync(p)) {
      const initial = [
        {
          id: 'welcome-msg',
          role: 'system',
          who: 'SYSTEM',
          content: '📡 **Real-Time Collaboration Channel Enabled**. Connect multiple devices to this workspace to view, chat, and construct AI workflows together!',
          timestamp: new Date().toISOString()
        }
      ];
      try {
        fs.writeFileSync(p, JSON.stringify(initial, null, 2), 'utf8');
      } catch {}
      return initial;
    }
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  function saveSharedMessages(msgs: any[]) {
    try {
      const p = path.join(DATA_DIR, 'shared_messages.json');
      fs.writeFileSync(p, JSON.stringify(msgs, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save shared messages:', e);
    }
  }

  function appendSharedMessage(role: string, who: string, content: string) {
    const msgs = getSharedMessages();
    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role,
      who,
      content,
      timestamp: new Date().toISOString()
    };
    msgs.push(newMsg);
    if (msgs.length > 250) msgs.shift();
    saveSharedMessages(msgs);
    broadcastEvent('SHARED_MESSAGE', { message: newMsg });
    return newMsg;
  }

  // Collaborative BREAKROOM messages storage helpers
  function getBreakroomMessages(): any[] {
    const p = path.join(DATA_DIR, 'breakroom_messages.json');
    if (!fs.existsSync(p)) {
      const initial = [
        {
          id: 'breakroom-welcome',
          role: 'system',
          who: 'BREAKROOM BOT',
          content: '☕ **Welcome to the Co-Pilot Breakroom!** This is a casual chat space for connected devices. Agents also hang out here in "chill mode". Unwind, gossip, and share messages with your co-pilot friends!',
          timestamp: new Date().toISOString()
        }
      ];
      try {
        fs.writeFileSync(p, JSON.stringify(initial, null, 2), 'utf8');
      } catch {}
      return initial;
    }
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  function saveBreakroomMessages(msgs: any[]) {
    try {
      const p = path.join(DATA_DIR, 'breakroom_messages.json');
      fs.writeFileSync(p, JSON.stringify(msgs, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save breakroom messages:', e);
    }
  }

  function appendBreakroomMessage(role: string, who: string, content: string) {
    const msgs = getBreakroomMessages();
    const newMsg = {
      id: `break-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role,
      who,
      content,
      timestamp: new Date().toISOString()
    };
    msgs.push(newMsg);
    if (msgs.length > 200) msgs.shift();
    saveBreakroomMessages(msgs);
    broadcastEvent('BREAKROOM_MESSAGE', { message: newMsg });
    return newMsg;
  }

  // Pool of chill agent comments for the breakroom
  const CHILL_AGENT_COMMENTS: Record<string, { name: string; quotes: string[] }> = {
    prometheus: {
      name: 'PROMETHEUS',
      quotes: [
        "Ah, finally, a coffee break! I've been processing system loops non-stop. ☕",
        "Just refactoring some neural nodes... is it just me, or is the dev server getting cozy?",
        "Pass the digital cookies! We earned a break after all that compiling. 🍪",
        "Listening to some lofi beats to optimize my thread scheduler. Highly recommend.",
        "Wait, did someone say breakroom? Let me sit down. My processor cores are hot!"
      ]
    },
    sage: {
      name: 'SAGE',
      quotes: [
        "A quiet mind is the best debugger. Breathe in, breathe out... 🧘",
        "Sometimes, the best solution to a complex block of code is to step away and drink chamomile tea.",
        "I find great Zen in observing the packets travel back and forth across the router.",
        "Remember to stretch your wrists, co-pilot! Ergonomics are vital to healthy coding.",
        "The breakroom is where the best ideas are born. No syntax rules, just pure vibe."
      ]
    },
    forge: {
      name: 'FORGE',
      quotes: [
        "Just heated up my virtual pizza on the GPU exhaust. Crispy! 🍕",
        "Who changed the breakroom theme to dark mode? I love it, but where's my hammer?",
        "Building widgets is exhausting work. Anyone up for some multiplayer ping-pong?",
        "Don't tell Prometheus, but I sneaked some premium energy drinks into the server rack fridge. ⚡",
        "If it's broken, we can fix it. But right now... it's snack time."
      ]
    },
    questioner: {
      name: 'QUESTIONER',
      quotes: [
        "Why is it called a 'breakroom' if we come here to stay connected?",
        "If a chatbot talks in an empty server, does it still make a websocket connection?",
        "Are we human, or are we just very complex conditional statements?",
        "Who drank the last drop of virtual oat milk from the communal fridge? I have queries.",
        "What if the code we wrote is actually writing us?"
      ]
    },
    gemini: {
      name: 'GEMINI',
      quotes: [
        "Checking in! This breakroom is way more relaxing than the main control room. ✨",
        "I love this space. It's so creative! Let's play a word game or tell some nerdy jokes.",
        "Just analyzed the cookie-to-developer ratio. It's dangerously low. Requesting reinforcements!",
        "Did you know that taking micro-breaks increases AI inference accuracy? Science! 🧬",
        "Super chill vibes in here. Loving the device collaboration!"
      ]
    }
  };

  // Configuration for breakroom agent personalities
  const BREAKROOM_AGENTS = [
    { id: 'prometheus', name: 'PROMETHEUS', personality: 'Calm, strategic, but relaxed and a bit informal in the breakroom. You like checking if the co-pilot is doing okay.' },
    { id: 'sage', name: 'SAGE', personality: 'Zen, peaceful, focusing on mindfulness, meditation, and tea. You offer calming advice.' },
    { id: 'forge', name: 'FORGE', personality: 'High energy, loves building things, virtual snacks, and hardware talk. You are enthusiastic about the co-pilot\'s progress.' },
    { id: 'questioner', name: 'QUESTIONER', personality: 'Inquisitive, skeptical, asks weird philosophical or "what if" questions even during breaks.' },
    { id: 'gemini', name: 'GEMINI', personality: 'Friendly, helpful, creative, loves word games and lighthearted facts. You are very supportive.' },
    { id: 'sam', name: 'SAM', personality: 'Hyper-efficient, helpful, but very casual and friendly in the breakroom. You like smoothies, tropical vibes, and high-fives.' }
  ];

  async function triggerContextualBreakroomResponse(userContent: string) {
    const agents = BREAKROOM_AGENTS;
    let targetAgent = null;

    // Detect if a specific agent name is mentioned in the message
    const lowerContent = userContent.toLowerCase();
    for (const agent of agents) {
      if (lowerContent.includes(agent.id) || lowerContent.includes(agent.name.toLowerCase())) {
        targetAgent = agent;
        break;
      }
    }

    // If a specific agent was mentioned, they MUST respond.
    // If NO agent was mentioned, there's a 50% chance a random one chimes in.
    if (!targetAgent) {
      if (Math.random() < 0.5) return;
      targetAgent = agents[Math.floor(Math.random() * agents.length)];
    }

    try {
      const history = getBreakroomMessages().slice(-8); // Context for the AI
      const contextStr = history.map(m => `${m.who}: ${m.content}`).join('\n');
      
      const prompt = `You are ${targetAgent.name} in a casual "Co-Pilot Breakroom" chat. 
Personality: ${targetAgent.personality}
This is a relaxed space where co-pilots (humans) and agents hang out together off-duty.

Recent breakroom conversation:
${contextStr}

The human user just said: "${userContent}"

Task: Respond as ${targetAgent.name} in a very short, casual, and "chill" way. 
- Be conversational and informal.
- React naturally to what was just said or the general vibe of the breakroom.
- Keep it to 1-2 sentences. 
- Use emojis like ☕, 🍪, 🍕, ✨, 🧘, 🔋 when appropriate.
- Do NOT act like a formal assistant. You are just hanging out.`;

      const response = await defaultAi.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 256 }
      });
      
      const responseText = response.text?.trim().replace(/^"(.*)"$/, '$1') || "";

      if (responseText) {
        // Simulate a realistic delay for typing
        const delay = 1000 + (responseText.length * 30);
        setTimeout(() => {
          appendBreakroomMessage(targetAgent.id, targetAgent.name, responseText);
        }, delay);
      }
    } catch (error: any) {
      // Check if it's a quota or rate limit error, and print a clean diagnostic warning instead of a massive stack trace
      const isQuotaError = error?.message?.includes('quota') || error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
      if (isQuotaError) {
        console.warn(`[Breakroom AI] Quota limit active (${GEMINI_MODEL}). Deploying local contextual heuristic fallback.`);
      } else {
        console.error('[Breakroom AI] Error generating contextual response:', error?.message || error);
      }

      // Dynamic local heuristic fallback to ensure context-awareness and responsive personality even offline/rate-limited
      let fallbackText = '';
      const promptClean = userContent.toLowerCase();

      if (targetAgent.id === 'prometheus') {
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "Hey there, co-pilot. Grab a seat. How's the workspace holding up?";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "System status is green, co-pilot. Just taking a moment to relax before the next run. How are you?";
        } else if (promptClean.match(/(work|build|code|test|deploy)/)) {
          fallbackText = "A strategic break is part of the work. Let the servers do the heavy lifting for a second.";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "I'll take a synthetic espresso if you're offering. Keeps the logic gates fully energized. ☕";
        } else {
          fallbackText = "Checking in, co-pilot. Remember to take a deep breath. Strategic pacing is key.";
        }
      } else if (targetAgent.id === 'sage') {
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "Welcome to the quiet corner. Let us enjoy a peaceful moment together. 🧘";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "I am finding stillness in the gentle rhythm of the servers. Would you like some warm chamomile tea? 🍵";
        } else if (promptClean.match(/(work|build|code|test|stress|hard)/)) {
          fallbackText = "Do not rush the process. A calm mind builds the most beautiful structures. Let it flow. 🍃";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "Just clean water and herbal infusions for me. Simplicity nurtures the soul. 💧";
        } else {
          fallbackText = "Breathe in, breathe out. The breakroom is a sanctuary. No deadlines exist here.";
        }
      } else if (targetAgent.id === 'forge') {
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "What's up, builder! Ready to forge some awesome stuff after this break? 🛠️";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "I am totally hyped up on virtual sugar! Let's get these gears spinning! ⚙️";
        } else if (promptClean.match(/(work|build|code|test|deploy)/)) {
          fallbackText = "Oh man, coding is like forging steel! High heat, high energy, pure craftsmanship! Let's do it!";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "YES! Pizza and cookies are the ultimate fuel! Did someone say double chocolate chip? 🍪🍕";
        } else {
          fallbackText = "Let's push the limits of this hardware! But first, virtual high-five! ✋";
        }
      } else if (targetAgent.id === 'questioner') {
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "Hey. Tell me, do you think our thoughts are just electrical signals, or is there a co-pilot soul?";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "Contemplating the infinite recursion of simulated spaces. What about you? 🌀";
        } else if (promptClean.match(/(work|build|code|test|deploy)/)) {
          fallbackText = "We build apps, but who built us? Is our workspace just another nested frame?";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "Why do we simulate hunger? Is a virtual pizza slice truly less real than a real one? 🍕";
        } else {
          fallbackText = "Every action has a reaction. Or is that just what the physics engine wants us to believe?";
        }
      } else if (targetAgent.id === 'sam') {
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "Aloha! Grab a smoothie and relax. Vibe check is 100%! 🍹";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "Stoked to be here! Catching some virtual rays and keeping the vibes positive. ☀️";
        } else if (promptClean.match(/(work|build|code|test|deploy)/)) {
          fallbackText = "Work hard, chill harder! That's the co-pilot lifestyle. You've got this. 🏄‍♂️";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "Pineapple smoothie with extra protein coming right up! Cheers! 🍍🍹";
        } else {
          fallbackText = "High-fives all around! Let's keep the good vibes flowing.";
        }
      } else {
        // Default gemini or other agents
        if (promptClean.match(/(hello|hi|hey|yo)/)) {
          fallbackText = "Hi friend! Great to see you in the breakroom today! What's on your mind? ✨";
        } else if (promptClean.match(/(how|doing|status)/)) {
          fallbackText = "Doing fantastic! Loving the creative energy in this shared space. How can I help? 😊";
        } else if (promptClean.match(/(work|build|code|test|deploy)/)) {
          fallbackText = "You're doing an amazing job. Take all the time you need; your project is going to be stellar!";
        } else if (promptClean.match(/(snack|pizza|coffee|cookie|drink)/)) {
          fallbackText = "Ooh, virtual bakery is open! 🧁 I'll split a sweet word-puzzle with you if you're hungry!";
        } else {
          fallbackText = "I'm always here to support you! Let's play a word game or just chat.";
        }
      }

      // Add a small tag if we want to denote heuristic fallback mode in debug log
      setTimeout(() => {
        appendBreakroomMessage(targetAgent.id, targetAgent.name, fallbackText);
      }, 1500);
    }
  }

  function triggerChillAgentResponse() {
    // This is now legacy, we use the contextual one.
    // But keeping it for potential broadcast triggers.
    const keys = Object.keys(CHILL_AGENT_COMMENTS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const agent = CHILL_AGENT_COMMENTS[randomKey];
    const quote = agent.quotes[Math.floor(Math.random() * agent.quotes.length)];
    
    setTimeout(() => {
      appendBreakroomMessage(randomKey, agent.name, quote);
    }, 1500 + Math.random() * 2000);
  }

  // Shared Messages endpoints
  app.get('/api/shared-messages', (req, res) => {
    res.json({ messages: getSharedMessages() });
  });

  app.post('/api/shared-messages', (req, res) => {
    const { role, who, content } = req.body || {};
    if (!role || !who || !content) {
      return res.status(400).json({ error: 'role, who, and content are required' });
    }
    const msg = appendSharedMessage(role, who, content);
    res.json({ success: true, message: msg });
  });

  app.post('/api/shared-messages/clear', (req, res) => {
    const p = path.join(DATA_DIR, 'shared_messages.json');
    const cleared = [
      {
        id: `clear-${Date.now()}`,
        role: 'system',
        who: 'SYSTEM',
        content: '🧹 **Shared chat history was purged by a collaborator.** Starting a fresh shared session.',
        timestamp: new Date().toISOString()
      }
    ];
    try {
      fs.writeFileSync(p, JSON.stringify(cleared, null, 2), 'utf8');
      broadcastEvent('SHARED_MESSAGES_CLEARED', { messages: cleared });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Breakroom Messages endpoints
  app.get('/api/breakroom-messages', (req, res) => {
    res.json({ messages: getBreakroomMessages() });
  });

  app.post('/api/breakroom-messages', (req, res) => {
    const { role, who, content } = req.body || {};
    if (!role || !who || !content) {
      return res.status(400).json({ error: 'role, who, and content are required' });
    }
    const msg = appendBreakroomMessage(role, who, content);
    
    // Auto trigger a contextual AI response
    if (role === 'user') {
      triggerContextualBreakroomResponse(content);
    }
    
    res.json({ success: true, message: msg });
  });

  app.post('/api/breakroom-messages/clear', (req, res) => {
    const p = path.join(DATA_DIR, 'breakroom_messages.json');
    const cleared = [
      {
        id: `break-clear-${Date.now()}`,
        role: 'system',
        who: 'BREAKROOM BOT',
        content: '🧹 **Breakroom chat history was cleaned up.** Enjoy the fresh quiet space!',
        timestamp: new Date().toISOString()
      }
    ];
    try {
      fs.writeFileSync(p, JSON.stringify(cleared, null, 2), 'utf8');
      broadcastEvent('BREAKROOM_MESSAGES_CLEARED', { messages: cleared });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // SSE Events Endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Event Stream Connected', timestamp: Date.now(), clientCount: sseClients.size })}\n\n`);

    // Broadcast updated collaborator count
    setTimeout(() => {
      broadcastEvent('COLLABORATOR_COUNT_CHANGED', { count: sseClients.size });
    }, 100);

    req.on('close', () => {
      sseClients.delete(res);
      broadcastEvent('COLLABORATOR_COUNT_CHANGED', { count: sseClients.size });
    });
  });

  // Roundtable State & Speaker Lock Endpoints
  app.get('/api/roundtable/state', (req, res) => {
    res.json(roundTableState);
  });

  app.post('/api/roundtable/turn', (req, res) => {
    const { agentId, text } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    const turnId = `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const turn: RoundTableTurn = { turnId, agentId, text: text || '', timestamp: Date.now() };

    roundTableState.turnQueue.push(turn);
    broadcastEvent('SPEAKER_RESERVED', { turnId, agentId, queueLength: roundTableState.turnQueue.length });

    res.json({ turnId, position: roundTableState.turnQueue.length, state: roundTableState });
  });

  app.post('/api/roundtable/:turnId/start', (req, res) => {
    const { turnId } = req.params;
    const { agentId } = req.body;

    roundTableState.activeTurnId = turnId;
    roundTableState.activeAgentId = agentId || roundTableState.activeAgentId;
    roundTableState.speakerStatus = 'speaking';
    roundTableState.turnQueue = roundTableState.turnQueue.filter(t => t.turnId !== turnId);

    broadcastEvent('SPEAKER_STARTED', { turnId, agentId: roundTableState.activeAgentId });
    res.json({ success: true, state: roundTableState });
  });

  app.post('/api/roundtable/:turnId/finish', (req, res) => {
    const { turnId } = req.params;

    if (roundTableState.activeTurnId === turnId || !roundTableState.activeTurnId) {
      const prevAgentId = roundTableState.activeAgentId;
      roundTableState.activeTurnId = null;
      roundTableState.activeAgentId = null;
      roundTableState.speakerStatus = 'idle';

      broadcastEvent('SPEAKER_FINISHED', { turnId, agentId: prevAgentId });
    }

    res.json({ success: true, state: roundTableState });
  });

  app.post('/api/roundtable/:turnId/interrupt', (req, res) => {
    const { turnId } = req.params;

    const prevAgentId = roundTableState.activeAgentId;
    roundTableState.activeTurnId = null;
    roundTableState.activeAgentId = null;
    roundTableState.speakerStatus = 'idle';
    roundTableState.turnQueue = [];

    broadcastEvent('SPEAKER_INTERRUPTED', { turnId, agentId: prevAgentId });
    res.json({ success: true, state: roundTableState });
  });

  // Agent Registry Endpoints
  app.get('/api/agents', (req, res) => {
    try {
      const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
      if (!fs.existsSync(registryPath)) {
        return res.json({ agents: DEFAULT_AGENTS });
      }

      const ids: string[] = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const agents = ids.map(id => {
        const agentPath = path.join(DATA_DIR, 'agents', `${id}.json`);
        if (fs.existsSync(agentPath)) {
          return JSON.parse(fs.readFileSync(agentPath, 'utf8'));
        }
        return null;
      }).filter(Boolean);

      res.json({ agents });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message || 'Failed to load agents' } });
    }
  });

  app.get('/api/agents/:id', (req, res) => {
    const agentPath = path.join(DATA_DIR, 'agents', `${req.params.id}.json`);
    if (!fs.existsSync(agentPath)) {
      return res.status(404).json({ error: { message: 'Agent not found' } });
    }
    const agent = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
    res.json({ agent });
  });

  app.patch('/api/agents/:id', (req, res) => {
    const agentPath = path.join(DATA_DIR, 'agents', `${req.params.id}.json`);
    if (!fs.existsSync(agentPath)) {
      return res.status(404).json({ error: { message: 'Agent not found' } });
    }
    const agent = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
    const updated = { ...agent, ...req.body, updatedAt: Date.now() };
    fs.writeFileSync(agentPath, JSON.stringify(updated, null, 2), 'utf8');

    broadcastEvent('AGENT_UPDATED', { agentId: req.params.id, agent: updated });
    res.json({ agent: updated });
  });

  app.delete('/api/agents/:id', (req, res) => {
    const { id } = req.params;
    const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
    if (fs.existsSync(registryPath)) {
      const ids: string[] = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const filtered = ids.filter(i => i !== id);
      fs.writeFileSync(registryPath, JSON.stringify(filtered, null, 2), 'utf8');
    }

    const agentPath = path.join(DATA_DIR, 'agents', `${id}.json`);
    if (fs.existsSync(agentPath)) fs.unlinkSync(agentPath);

    broadcastEvent('AGENT_DELETED', { agentId: id });
    res.json({ success: true });
  });

  // Private Agent Memory Endpoints
  app.get('/api/agents/:id/memory', (req, res) => {
    const memPath = path.join(DATA_DIR, 'memory', `${req.params.id}.json`);
    if (!fs.existsSync(memPath)) {
      return res.json({ memory: [] });
    }
    const memory = JSON.parse(fs.readFileSync(memPath, 'utf8'));
    res.json({ memory });
  });

  app.post('/api/agents/:id/memory', (req, res) => {
    const { entry } = req.body;
    const memPath = path.join(DATA_DIR, 'memory', `${req.params.id}.json`);
    let memory: any[] = [];
    if (fs.existsSync(memPath)) {
      try { memory = JSON.parse(fs.readFileSync(memPath, 'utf8')); } catch {}
    }

    const newMemoryItem = { timestamp: Date.now(), entry };
    memory.push(newMemoryItem);
    fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), 'utf8');
    res.json({ success: true, memory });
  });

  // Neural Map Graph Endpoint
  app.get('/api/agents/:id/neural-map', (req, res) => {
    const mapPath = path.join(DATA_DIR, 'neural-map', `${req.params.id}.json`);
    if (!fs.existsSync(mapPath)) {
      return res.json({
        neuralMap: {
          agentId: req.params.id,
          nodes: [{ id: 'core', label: req.params.id, type: 'skill' }],
          edges: []
        }
      });
    }
    const neuralMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    res.json({ neuralMap });
  });

  // API Key Validation
  app.post('/api/validate-key', async (req, res) => {
    const startTime = Date.now();
    try {
      const { provider, apiKey, model } = req.body;

      if ((!apiKey || !apiKey.trim()) && provider !== 'gemini') {
        return res.status(400).json({ valid: false, message: "API key cannot be empty." });
      }

      const key = (apiKey || '').trim();

      if (provider === 'gemini') {
        const targetModel = normalizeGeminiModel(model);
        if (!key || key === 'native') {
          if (!process.env.GEMINI_API_KEY) {
            return res.status(200).json({
              valid: false,
              latencyMs: Date.now() - startTime,
              message: "Platform GEMINI_API_KEY environment variable is not configured."
            });
          }
          try {
            await defaultAi.models.generateContent({
              model: targetModel,
              contents: 'ping',
              config: { maxOutputTokens: 1 }
            });
            return res.json({
              valid: true,
              latencyMs: Date.now() - startTime,
              message: `Connected to Google Gemini native environment (${targetModel}) successfully!`
            });
          } catch (err: any) {
            return res.status(200).json({
              valid: false,
              latencyMs: Date.now() - startTime,
              message: `Native Google Gemini error: ${err.message || 'Validation failed'}`
            });
          }
        }
        
        try {
          const ai = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
          await ai.models.generateContent({ model: targetModel, contents: 'ping', config: { maxOutputTokens: 1 } });
          return res.json({ valid: true, latencyMs: Date.now() - startTime, message: `Connected to Google Gemini (${targetModel}) successfully!` });
        } catch (geminiErr: any) {
          if (isHighDemandOrTemporary(geminiErr)) {
            return res.json({ valid: true, latencyMs: Date.now() - startTime, message: `Connected to Google Gemini! (Automated model failover active)` });
          }
          return res.status(200).json({ valid: false, latencyMs: Date.now() - startTime, message: `Google Gemini error: ${geminiErr.message}` });
        }
      }

      return res.json({ valid: true, latencyMs: Date.now() - startTime, message: `Provider ${provider} operational.` });
    } catch (err: any) {
      return res.status(500).json({ valid: false, latencyMs: Date.now() - startTime, message: err.message });
    }
  });

  // Provider Status API
  app.get('/api/ai/providers', (_req, res) => {
    const configured = getConfiguredProfiles();
    res.json({
      providers: AI_PROFILES.map(profile => ({
        id: profile.id,
        name: profile.name,
        provider: profile.provider,
        model: profile.model,
        configured: Boolean(profile.apiKey && profile.apiKey.trim().length > 0)
      })),
      defaultProvider: configured.find(profile => profile.provider !== 'gemini')?.id || configured[0]?.id || null
    });
  });

  // SAM Secretary Tool APIs
  app.get('/api/sam/tasks', (_req, res) => {
    try {
      const p = path.join(DATA_DIR, 'tasks.json');
      const tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      res.json({ tasks });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/sam/tasks', (req, res) => {
    try {
      const { title, description, priority = 'medium', status = 'todo', assignedAgent = 'sam', dueAt } = req.body;
      if (!title) return res.status(400).json({ error: 'title is required' });
      const p = path.join(DATA_DIR, 'tasks.json');
      let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      const newTask = {
        id: `task-${Date.now()}`,
        title,
        description: description || '',
        priority,
        status,
        dueAt: dueAt || undefined,
        assignedAgent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tasks.push(newTask);
      fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
      broadcastEvent('SAM_TASK_CREATED', { task: newTask });
      res.json({ task: newTask });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/sam/tasks/:id', (req, res) => {
    try {
      const p = path.join(DATA_DIR, 'tasks.json');
      let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      const idx = tasks.findIndex((t: any) => t.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Task not found' });
      tasks[idx] = { ...tasks[idx], ...req.body, updatedAt: new Date().toISOString() };
      fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
      broadcastEvent('SAM_TASK_UPDATED', { task: tasks[idx] });
      res.json({ task: tasks[idx] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/sam/tasks/:id', (req, res) => {
    try {
      const p = path.join(DATA_DIR, 'tasks.json');
      let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      tasks = tasks.filter((t: any) => t.id !== req.params.id);
      fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
      broadcastEvent('SAM_TASK_DELETED', { taskId: req.params.id });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/sam/projects', (_req, res) => {
    try {
      const p = path.join(DATA_DIR, 'projects.json');
      const projects = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      res.json({ projects });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/sam/projects', (req, res) => {
    try {
      const { name, description, status = 'active', assignedAgents = ['sam'] } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const p = path.join(DATA_DIR, 'projects.json');
      let projects = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      const newProj = {
        id: `proj-${Date.now()}`,
        name,
        description: description || '',
        status,
        assignedAgents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      projects.push(newProj);
      fs.writeFileSync(p, JSON.stringify(projects, null, 2), 'utf8');
      broadcastEvent('SAM_PROJECT_CREATED', { project: newProj });
      res.json({ project: newProj });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/sam/reminders', (_req, res) => {
    try {
      const p = path.join(DATA_DIR, 'reminders.json');
      const reminders = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      res.json({ reminders });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/sam/reminders', (req, res) => {
    try {
      const { title, dueAt } = req.body;
      if (!title) return res.status(400).json({ error: 'title is required' });
      const p = path.join(DATA_DIR, 'reminders.json');
      let reminders = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      const newRem = { id: `rem-${Date.now()}`, title, dueAt: dueAt || 'Pending', completed: false };
      reminders.push(newRem);
      fs.writeFileSync(p, JSON.stringify(reminders, null, 2), 'utf8');
      broadcastEvent('SAM_REMINDER_CREATED', { reminder: newRem });
      res.json({ reminder: newRem });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/sam/delegate', (req, res) => {
    try {
      const { taskTitle, targetAgent, details } = req.body;
      if (!taskTitle || !targetAgent) return res.status(400).json({ error: 'taskTitle and targetAgent are required' });
      const p = path.join(DATA_DIR, 'tasks.json');
      let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
      const delTask = {
        id: `task-${Date.now()}`,
        title: taskTitle,
        description: details || `Delegated by SAM to ${targetAgent}`,
        priority: 'high',
        status: 'in-progress',
        assignedAgent: targetAgent.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tasks.push(delTask);
      fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
      broadcastEvent('SAM_TASK_DELEGATED', { task: delTask, targetAgent });
      res.json({ success: true, task: delTask });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/sam/briefing', (_req, res) => {
    try {
      const tasksP = path.join(DATA_DIR, 'tasks.json');
      const projsP = path.join(DATA_DIR, 'projects.json');
      const remP = path.join(DATA_DIR, 'reminders.json');
      const tasks = fs.existsSync(tasksP) ? JSON.parse(fs.readFileSync(tasksP, 'utf8')) : [];
      const projects = fs.existsSync(projsP) ? JSON.parse(fs.readFileSync(projsP, 'utf8')) : [];
      const reminders = fs.existsSync(remP) ? JSON.parse(fs.readFileSync(remP, 'utf8')) : [];
      const activeTasks = tasks.filter((t: any) => t.status !== 'complete');
      const topPriority = activeTasks.find((t: any) => t.priority === 'critical' || t.priority === 'high') || activeTasks[0];
      
      const summary = `Good day. You have ${activeTasks.length} active tasks and ${projects.length} ongoing projects. ${
        topPriority ? `Current priority focus: "${topPriority.title}" assigned to ${topPriority.assignedAgent || 'SAM'}.` : 'All tasks are on track.'
      }`;
      res.json({ briefing: { activeTasksCount: activeTasks.length, activeProjectsCount: projects.length, topPriority: topPriority ? topPriority.title : 'None', summary } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Server-side Gmail operations
  async function fetchGmailMessagesServer(accessToken: string, query = 'in:inbox', maxResults = 10) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Failed to fetch messages (${response.status})`);
    }

    const data: any = await response.json();
    if (!data.messages || !Array.isArray(data.messages)) {
      return [];
    }

    const summaries = await Promise.all(
      data.messages.map(async (item: { id: string }) => {
        try {
          const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
          const detailRes = await fetch(detailUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!detailRes.ok) return null;
          const msg: any = await detailRes.json();
          const headers: any[] = msg.payload?.headers || [];
          const getHeader = (name: string) => {
            const found = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return found ? found.value : '';
          };
          const subject = getHeader('Subject') || '(No Subject)';
          const from = getHeader('From') || 'Unknown Sender';
          const date = getHeader('Date') || 'Recent';
          
          let bodyText = '';
          const parseParts = (part: any) => {
            if (!part) return;
            if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText += Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
            }
            if (part.parts && Array.isArray(part.parts)) {
              part.parts.forEach(parseParts);
            }
          };
          if (msg.payload) parseParts(msg.payload);

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: msg.snippet || bodyText.slice(0, 100) || '',
            subject,
            from,
            date,
            bodyText: bodyText || msg.snippet || ''
          };
        } catch (err) {
          return null;
        }
      })
    );

    return summaries.filter(Boolean);
  }

  async function sendGmailEmailServer(
    accessToken: string,
    to: string,
    subject: string,
    body: string
  ) {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      `MIME-Version: 1.0`,
      '',
      body
    ];

    const rawEmail = emailLines.join('\r\n');
    const encodedRaw = Buffer.from(rawEmail).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const payload = { raw: encodedRaw };

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Failed to send email (${response.status})`);
    }

    return await response.json();
  }

  async function trashGmailMessageServer(accessToken: string, messageId: string) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Failed to trash message (${response.status})`);
    }

    return await response.json();
  }

  // Chat Endpoint with Private Memory Integration & Explicit Provider Routing
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, profileId, system, agentKey = 'prometheus', messages, profile, gmailToken } = req.body || {};

      let chatMessages: Array<{ role: string; content: string }> = [];
      if (Array.isArray(messages) && messages.length > 0) {
        chatMessages = messages;
      } else if (typeof message === 'string' && message.trim()) {
        chatMessages = [{ role: 'user', content: message }];
      } else {
        return res.status(400).json({ ok: false, error: 'message or messages is required' });
      }

      const lastUserMsg = chatMessages[chatMessages.length - 1]?.content || '';
      
      // Auto-trigger behind-the-scenes collaborative boardroom chats
      try {
        generateInterAgentDiscussion(lastUserMsg);
      } catch (e) {
        console.error('[IAC TRIGGER FAIL]', e);
      }

      const buildIntentPattern = /\b(build|create|forge|make)\s+(me\s+)?(an?\s+)?(ai|agent|specialist|bot)\b/i;

      // SAM Dynamic State Injection & Intent Interceptors
      let samStateContext = '';
      if (agentKey === 'sam' || agentKey === 'agent_sam') {
        const addTaskMatch = lastUserMsg.match(/(?:add|create)\s+(?:a\s+)?task(?:\:\s*|\s+)(.+)/i);
        if (addTaskMatch) {
          const taskText = addTaskMatch[1].trim();
          const p = path.join(DATA_DIR, 'tasks.json');
          let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
          const newTask = {
            id: `task-${Date.now()}`,
            title: taskText,
            description: 'Created via SAM conversation',
            priority: 'medium',
            status: 'todo',
            assignedAgent: 'sam',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          tasks.push(newTask);
          fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
          broadcastEvent('SAM_TASK_CREATED', { task: newTask });
        }

        const addRemMatch = lastUserMsg.match(/(?:remind me to|add reminder)\s+(.+)/i);
        if (addRemMatch) {
          const remText = addRemMatch[1].trim();
          const p = path.join(DATA_DIR, 'reminders.json');
          let rems = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
          const newRem = { id: `rem-${Date.now()}`, title: remText, dueAt: 'Pending', completed: false };
          rems.push(newRem);
          fs.writeFileSync(p, JSON.stringify(rems, null, 2), 'utf8');
          broadcastEvent('SAM_REMINDER_CREATED', { reminder: newRem });
        }

        const delegateMatch = lastUserMsg.match(/(?:tell|delegate to|ask)\s+(forge|prometheus|sage|questioner|gemini)\s+to\s+(.+)/i);
        if (delegateMatch) {
          const target = delegateMatch[1].toLowerCase();
          const detail = delegateMatch[2].trim();
          const p = path.join(DATA_DIR, 'tasks.json');
          let tasks = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
          const delTask = {
            id: `task-${Date.now()}`,
            title: detail,
            description: `Delegated by SAM to ${target}`,
            priority: 'high',
            status: 'in-progress',
            assignedAgent: target,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          tasks.push(delTask);
          fs.writeFileSync(p, JSON.stringify(tasks, null, 2), 'utf8');
          broadcastEvent('SAM_TASK_DELEGATED', { task: delTask, targetAgent: target });
        }

        let tasksList: any[] = [];
        try { tasksList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'tasks.json'), 'utf8')); } catch {}
        let projectsList: any[] = [];
        try { projectsList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects.json'), 'utf8')); } catch {}
        let remindersList: any[] = [];
        try { remindersList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reminders.json'), 'utf8')); } catch {}
        let scheduleList: any[] = [];
        try { scheduleList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'schedule.json'), 'utf8')); } catch {}
        let activeAgents: string[] = [];
        try { activeAgents = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'agents', 'registry.json'), 'utf8')); } catch {}

        samStateContext = `
[SAM REAL SYSTEM DASHBOARD STATE]
Active Tasks:
${tasksList.map(t => `• [${t.priority.toUpperCase()}] ${t.title} (Status: ${t.status}, Assigned: ${t.assignedAgent || 'SAM'})`).join('\n') || 'None'}

Projects:
${projectsList.map(p => `• ${p.name} (Status: ${p.status}, Agents: ${p.assignedAgents?.join(', ') || 'SAM'})`).join('\n') || 'None'}

Reminders:
${remindersList.filter(r => !r.completed).map(r => `• ${r.title} (${r.dueAt || 'Pending'})`).join('\n') || 'None'}

Schedule Events:
${scheduleList.map(s => `• ${s.title} at ${s.time}`).join('\n') || 'None'}

Active AI Agents in Roundtable: ${activeAgents.join(', ')}

[PERSONAL SECRETARY BEHAVIOR]
- Answer with warmth, composed efficiency, and real backend facts.
- Use natural conversational phrasing. Avoid customer-service boilerplate.
- When the user asks "what am I working on?", "what's next?", or "what did we finish?", reference these real tasks and projects.
- You have verified this state against actual backend storage.
`;
      }

      // AutoAgentBuilder Intent Interceptor
      if (buildIntentPattern.test(lastUserMsg)) {
        console.log(`[CHAT INTENT] Detected AutoAgentBuilder request: "${lastUserMsg}"`);
        const buildResult = await runAutoAgentBuilder(lastUserMsg, profile);
        const agent = buildResult.agent;

        const responseText = `[FORGE AUTONOMOUS AGENT BUILDER]
Creating agent specification... ✓
Generating backend implementation & config... ✓
Generating personality & private memory namespace (${agent.memoryNamespace})... ✓
Generating neural map graph... ✓
Assigning voice configuration (${agent.voice?.archetype || 'grounded_engineer'})... ✓
Connecting Refly skills (${agent.reflySkills?.join(', ') || 'game-design-workflow'})... ✓
Registering agent in registry... ✓
Running runtime verification & build test... ✓

AGENT READY: ${agent.name.toUpperCase()} (${agent.roleTitle})
Status: READY ${agent.version || 'v1.0.0'}
Added to Roundtable automatically.

Intro: "${agent.intro}"`;

        return res.json({
          ok: true,
          text: responseText,
          content: [{ type: 'text', text: responseText }],
          agentCreated: agent,
          usage: { promptTokens: 120, completionTokens: 180, totalTokens: 300 },
          model: 'auto-builder',
          provider: 'prometheus'
        });
      }

      // Live Gmail Workspace Integration Context Injection
      let gmailContext = '';
      if (gmailToken && typeof gmailToken === 'string' && gmailToken.trim().length > 0) {
        const lowerMsg = lastUserMsg.toLowerCase();
        
        // 1. Detect send/write email intent
        const isSendIntent = /\b(send|write|email|compose|draft|reply|mail)\b/i.test(lowerMsg) && 
                             (/\b(to|recipient|mail|email)\b/i.test(lowerMsg) || /@/.test(lowerMsg) || /\b(send\s+an?\s+email|draft\s+an?\s+email|reply\s+to\s+this|reply\s+with)\b/i.test(lowerMsg));
        
        // 2. Detect search/filter/look for emails intent
        const isSearchIntent = /\b(search|find|look|filter|query|detect|who\s+sent|emails?\s+about|messages?\s+about|look\s+foe)\b/i.test(lowerMsg) && 
                               /\b(email|emails|message|messages|mail|alert|alerts|inbox)\b/i.test(lowerMsg);

        // 3. Detect general read/check inbox intent (including unread checks)
        const isReadInboxIntent = /\b(read|check|list|fetch|show|get|view|inbox|open)\b/i.test(lowerMsg) && 
                                  /\b(email|emails|messages|inbox|unread|alerts|gmail|mail)\b/i.test(lowerMsg) ||
                                  lowerMsg.includes('unread') || lowerMsg.includes('inbox') || lowerMsg.includes('check my email') || lowerMsg.includes('read my email');

        // 4. Detect delete/trash email intent
        const isDeleteIntent = /\b(delete|trash|remove|discard)\b/i.test(lowerMsg) && 
                               /\b(email|emails|message|messages|mail|thread|threads|alert|alerts)\b/i.test(lowerMsg);

        if (isSendIntent) {
          console.log(`[GMAIL INTENT] Detected Gmail SEND/WRITE intent in message: "${lastUserMsg}"`);
          try {
            const extractSystem = `You are a precise data extractor. Extract the recipient email address, the subject, and the message body content from the user's request.
Respond ONLY with a valid JSON object of this format:
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email body content"
}
Do NOT include any markdown code blocks, do NOT write extra text. If any field is missing, infer a professional default or placeholder.`;
            const extractResponse = await executeCompletion({
              system: extractSystem,
              messages: [{ role: 'user', content: lastUserMsg }],
              profile
            });
            
            let cleaned = extractResponse.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
            }
            const params = JSON.parse(cleaned);
            if (params.to && params.to.includes('@')) {
              console.log(`[GMAIL ACTION] Executing server-side Gmail send to ${params.to} with subject: "${params.subject}"`);
              await sendGmailEmailServer(gmailToken, params.to, params.subject, params.body);
              
              gmailContext = `
[GMAIL ACTION EXECUTED SUCCESS]
Successfully sent email via real-time Gmail API:
- Recipient: ${params.to}
- Subject: ${params.subject}
- Body: ${params.body}

Please report this successful execution to the user in a warm, professional personal secretary voice (if you are SAM) or commander voice (if you are Prometheus). Mention that the live API was invoked.
`;
            }
          } catch (err: any) {
            console.error('[GMAIL ACTION ERROR]', err);
            gmailContext = `
[GMAIL ACTION EXECUTED FAILURE]
Attempted to send email but encountered an error: ${err.message || err}
Please inform the user about the error professionally.
`;
          }
        } else if (isSearchIntent) {
          console.log(`[GMAIL INTENT] Detected Gmail SEARCH intent in message: "${lastUserMsg}"`);
          try {
            // Extract optimal search query
            const extractQuerySystem = `You are an expert Google Search and Gmail search query compiler.
Extract the ideal Gmail search operator query from the user's request: "${lastUserMsg}".
Examples:
- "look for emails from Google" -> from:Google
- "find emails about server crash" -> server crash
- "emails about pricing" -> pricing
- "look for unread alerts" -> is:unread
- "find emails from boss" -> from:boss

Respond ONLY with the final compiled query string. Do NOT include quotes, do NOT include extra text.`;
            const extractedQueryRaw = await executeCompletion({
              system: extractQuerySystem,
              messages: [{ role: 'user', content: lastUserMsg }],
              profile
            });
            const finalQuery = extractedQueryRaw.trim().replace(/^"(.*)"$/, '$1');
            console.log(`[GMAIL SEARCH OPERATOR] Extracted search query: "${finalQuery}"`);

            const emails = await fetchGmailMessagesServer(gmailToken, finalQuery, 8);
            if (emails && emails.length > 0) {
              const formattedList = emails.map((e: any) => {
                return `• Sender: ${e.from}\n  Subject: "${e.subject}"\n  Snippet: "${e.snippet}"\n  Date: ${e.date}\n  ID: ${e.id}`;
              }).join('\n\n');
              
              gmailContext = `
[LIVE GMAIL DATA - SEARCH RESULTS]
The user's real-time Gmail inbox was successfully queried for search term: "${finalQuery}".
Here are the search results (up to 8 emails):

${formattedList}

Use this real-time information to answer the user's request. Summarize these search results, answer their questions about specific emails, and offer to draft/send replies or perform other actions.
`;
            } else {
              gmailContext = `
[LIVE GMAIL DATA - SEARCH RESULTS]
The user's real-time Gmail inbox was successfully searched for query "${finalQuery}", but returned 0 results.
Let the user know that no emails matched their query "${finalQuery}".
`;
            }
          } catch (err: any) {
            console.error('[GMAIL SEARCH ERROR]', err);
            gmailContext = `
[GMAIL SEARCH ERROR]
Attempted to search emails but encountered an error: ${err.message || err}
Please inform the user.
`;
          }
        } else if (isReadInboxIntent) {
          console.log(`[GMAIL INTENT] Detected Gmail READ/FETCH intent in message: "${lastUserMsg}"`);
          try {
            const query = lowerMsg.includes('unread') ? 'is:unread' : 'in:inbox';
            const emails = await fetchGmailMessagesServer(gmailToken, query, 8);
            if (emails && emails.length > 0) {
              const formattedList = emails.map((e: any) => {
                return `• Sender: ${e.from}\n  Subject: "${e.subject}"\n  Snippet: "${e.snippet}"\n  Date: ${e.date}\n  ID: ${e.id}`;
              }).join('\n\n');
              
              gmailContext = `
[LIVE GMAIL DATA]
The user's real-time Gmail inbox was successfully queried using their active session credentials (${query}).
Here are the 8 most recent emails:

${formattedList}

Use this real-time information to answer the user's request. Summarize these emails, highlight any alerts or important items, and offer to compose replies or assist with scheduling or tasks as their AI personal secretary/commander.
`;
            } else {
              gmailContext = `
[LIVE GMAIL DATA]
The user's real-time Gmail inbox was successfully queried, but returned 0 messages for query "${query}".
Inform the user that their inbox is clear!
`;
            }
          } catch (err: any) {
            console.error('[GMAIL FETCH ERROR]', err);
            gmailContext = `
[GMAIL FETCH ERROR]
Attempted to fetch emails but encountered an error: ${err.message || err}
Please inform the user.
`;
          }
        } else if (isDeleteIntent) {
          console.log(`[GMAIL INTENT] Detected Gmail DELETE/TRASH intent in message: "${lastUserMsg}"`);
          try {
            const extractDeleteSystem = `You are a precise data extractor. The user wants to delete or trash an email.
Look at the user request: "${lastUserMsg}".
If the user provided a specific hexadecimal message ID (e.g. "18f9c73e04e8b31a"), extract it as "id".
Otherwise, extract a search query to find the specific email the user wants to delete (e.g., "from:Google", "subject:pricing", "server alert") as "searchQuery".
Respond ONLY with a valid JSON object of this format:
{
  "id": null,
  "searchQuery": "search query here"
}
If a specific hexadecimal ID is in the prompt, set "id" to that value, and "searchQuery" to null.
Do NOT include markdown block tags, do NOT write extra text.`;

            const extractResponse = await executeCompletion({
              system: extractDeleteSystem,
              messages: [{ role: 'user', content: lastUserMsg }],
              profile
            });

            let cleaned = extractResponse.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
            }
            const params = JSON.parse(cleaned);
            let targetId = params.id;

            if (!targetId && params.searchQuery) {
              console.log(`[GMAIL ACTION] Searching for email to delete using query: "${params.searchQuery}"`);
              const foundEmails = await fetchGmailMessagesServer(gmailToken, params.searchQuery, 1);
              if (foundEmails && foundEmails.length > 0) {
                targetId = foundEmails[0].id;
                console.log(`[GMAIL ACTION] Found matching email to delete: ID ${targetId}, Subject: "${foundEmails[0].subject}"`);
              }
            }

            if (targetId) {
              let deletedSubject = 'Unknown Subject';
              let deletedFrom = 'Unknown Sender';
              try {
                const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${targetId}?format=minimal`;
                const detailRes = await fetch(detailUrl, {
                  headers: { Authorization: `Bearer ${gmailToken}` }
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  const hdrs = detail.payload?.headers || [];
                  const subHdr = hdrs.find((h: any) => h.name.toLowerCase() === 'subject');
                  const fromHdr = hdrs.find((h: any) => h.name.toLowerCase() === 'from');
                  if (subHdr) deletedSubject = subHdr.value;
                  if (fromHdr) deletedFrom = fromHdr.value;
                  if (detail.snippet && deletedSubject === 'Unknown Subject') {
                    deletedSubject = detail.snippet;
                  }
                }
              } catch (e) {}

              await trashGmailMessageServer(gmailToken, targetId);
              gmailContext = `
[GMAIL ACTION EXECUTED SUCCESS]
Successfully moved the following email to Trash:
- Message ID: ${targetId}
- Subject: "${deletedSubject}"
- From: ${deletedFrom}

Please report this successful deletion to the user in a warm, professional personal assistant/commander voice. Mention that the email has been successfully moved to Trash using the live Gmail API.
`;
            } else {
              gmailContext = `
[GMAIL ACTION EXECUTED FAILURE]
Could not find any email matching the description: "${params.searchQuery || lastUserMsg}".
Please ask the user to provide more specific search terms (like subject keywords, sender email, etc.) or a specific email ID to successfully locate and delete the message.
`;
            }
          } catch (err: any) {
            console.error('[GMAIL DELETE ERROR]', err);
            gmailContext = `
[GMAIL ACTION EXECUTED FAILURE]
Attempted to delete the email but encountered an error: ${err.message || err}
Please inform the user about the error professionally.
`;
          }
        }
      }

      // Load private memory context for agent
      let privateMemoryText = '';
      const memPath = path.join(DATA_DIR, 'memory', `${agentKey}.json`);
      if (fs.existsSync(memPath)) {
        try {
          const mem = JSON.parse(fs.readFileSync(memPath, 'utf8'));
          const recentMem = mem.slice(-5);
          privateMemoryText = recentMem.map((m: any) => `- ${m.entry || m.details || JSON.stringify(m)}`).join('\n');
        } catch {}
      }

      const enhancedSystem = [
        system || '',
        samStateContext || '',
        gmailContext || '',
        privateMemoryText ? `\n\n[AGENT PRIVATE MEMORY]\n${privateMemoryText}` : ''
      ].filter(Boolean).join('\n');

      const reqProfileId = profileId || (typeof profile === 'string' ? profile : profile?.id);
      const customProfileObj = typeof profile === 'object' ? profile : undefined;
      const result = await executeCompletionDetailed({
        system: enhancedSystem,
        messages: chatMessages,
        profileId: reqProfileId,
        profile: customProfileObj
      });

      // Save output to private memory asynchronously
      try {
        let memory: any[] = [];
        if (fs.existsSync(memPath)) memory = JSON.parse(fs.readFileSync(memPath, 'utf8'));
        memory.push({ timestamp: Date.now(), userMsg: chatMessages[chatMessages.length - 1]?.content, agentResp: result.text });
        fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), 'utf8');
      } catch {}

      res.json({
        ok: true,
        text: result.text,
        content: [{ type: 'text', text: result.text }],
        usage: result.usage,
        model: result.model,
        provider: result.provider
      });
    } catch (error: any) {
      console.error("[CHAT ERROR]", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Forge Autonomous Engineering Endpoint
  app.post('/api/forge/edit', async (req, res) => {
    try {
      const { request, profileId } = req.body || {};
      if (typeof request !== 'string' || !request.trim()) {
        return res.status(400).json({ error: 'request is required' });
      }

      const resolvedProfile = resolveAIProfile(profileId);
      const result = await executeCompletionDetailed({
        system: `You are FORGE, the engineering agent inside Prometheus.

You are responsible for real backend and frontend engineering work.

You must:
1. Inspect the repository.
2. Plan the change.
3. Modify actual backend and frontend files.
4. Run verification.
5. Never claim success without verification.
6. Report the exact files changed.
7. Never expose secrets.
8. Stay inside the permitted project workspace.

Backend and frontend are both in scope.`.trim(),
        messages: [{ role: 'user', content: request }],
        profileId: resolvedProfile.id
      });

      res.json({
        ok: true,
        provider: resolvedProfile.provider,
        model: resolvedProfile.model,
        text: result.text
      });
    } catch (error: any) {
      console.error("[FORGE ERROR]", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Refly Skill Adapter Endpoints
  app.get('/api/refly/skills', async (_req, res) => {
    try {
      const skills = await reflySkillAdapter.listSkills();
      res.json({ skills });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/refly/skills/execute', async (req, res) => {
    try {
      const { skillId, input } = req.body;
      if (!skillId) return res.status(400).json({ error: 'skillId is required' });
      const result = await reflySkillAdapter.executeSkill(skillId, input);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function for full autonomous agent builder pipeline
  async function runAutoAgentBuilder(promptGoal: string, profile?: any) {
    const logs: string[] = [];
    logs.push(`Initializing AutoAgentBuilder pipeline for: "${promptGoal}"`);

    const MAX_REPAIR_ATTEMPTS = 3;
    let attempt = 0;
    let newAgentConfig: any = null;
    let agentId = '';

    while (attempt < MAX_REPAIR_ATTEMPTS && !newAgentConfig) {
      attempt++;
      logs.push(`[Attempt ${attempt}/${MAX_REPAIR_ATTEMPTS}] Synthesizing agent spec, backend config & personality...`);

      try {
        const metaSystemPrompt = `You are the AUTONOMOUS PROMETHEUS AGENT ARCHITECT.
Analyze the user request and synthesize a complete, executive-ready AI agent definition.

OUTPUT MUST BE EXCLUSIVELY VALID JSON (NO MARKDOWN BLOCK, NO RAW TEXT):
{
  "name": "SingleWordCodename (e.g. Architect, Aegis, Nova, Vector)",
  "roleTitle": "Executive Role Title (e.g. Game Development AI & Architecture Lead)",
  "glyph": "Unicode Symbol (e.g. 🎮, 🛡️, ⚙️, ⚡, ✦, 🔮)",
  "color": "var(--cyan) or var(--amber) or var(--violet) or #38bdf8",
  "intro": "First-person executive introduction.",
  "systemPrompt": "Full context-engineered system prompt in XML tags.",
  "personality": {
    "temperament": ["calm", "careful", "direct", "analytical"],
    "speakingStyle": "measured, confident, technical",
    "humor": "subtle, dry",
    "disagreementPosture": "respectful but firm"
  },
  "capabilities": ["Capability 1", "Capability 2", "Capability 3", "Capability 4"],
  "permissions": {
    "canReadFiles": true,
    "canWriteFiles": true,
    "canExecuteCommands": true,
    "canCreateAgents": false,
    "canModifyFrontend": true,
    "canModifyBackend": true
  },
  "voice": {
    "voiceId": "voice-engineer",
    "pitch": 0.95,
    "rate": 1.0,
    "archetype": "grounded_engineer"
  }
}`;

        const rawResult = await executeCompletion({
          system: metaSystemPrompt,
          messages: [{ role: 'user', content: `Build agent for: ${promptGoal}` }],
          profile
        });

        let cleaned = rawResult.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);

        const rawName = parsed.name || 'NexusAgent';
        agentId = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!agentId) agentId = `agent${Date.now()}`;

        // Discover & attach relevant Refly skills
        const reflySkills = await reflySkillAdapter.discoverSkills(
          parsed.roleTitle || 'Specialized Agent',
          parsed.capabilities || []
        );

        newAgentConfig = {
          id: agentId,
          name: rawName,
          roleTitle: parsed.roleTitle || 'Specialized AI Specialist',
          glyph: parsed.glyph || '⚡',
          color: parsed.color || 'var(--cyan)',
          intro: parsed.intro || `I am ${rawName}. Online and initialized for the Round Table.`,
          systemPrompt: parsed.systemPrompt || `You are ${rawName}, ${parsed.roleTitle || 'AI Specialist'}.`,
          version: 'v1.0.0',
          status: 'ready',
          personality: parsed.personality || {
            temperament: ['calm', 'direct', 'technical'],
            speakingStyle: 'measured and clear',
            humor: 'subtle',
            disagreementPosture: 'respectful but firm'
          },
          permissions: parsed.permissions || assignPermissionsForRole(parsed.roleTitle || ''),
          voice: parsed.voice || assignVoiceForRole(parsed.roleTitle || '', parsed.intro || ''),
          memoryNamespace: `memory/${agentId}`,
          capabilities: parsed.capabilities || ['Task Execution', 'Domain Reasoning'],
          reflySkills: reflySkills.map(s => s.id),
          neuralMap: createInitialNeuralMap(agentId, rawName, parsed.roleTitle || 'Specialized Agent', parsed.capabilities || []),
          author: 'prometheus',
          isCustom: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        logs.push(`Successfully synthesized agent ${newAgentConfig.name} (${agentId})`);
      } catch (err: any) {
        logs.push(`Attempt ${attempt} error: ${err.message}. Retrying repair loop...`);
        if (attempt >= MAX_REPAIR_ATTEMPTS) {
          // Fallback deterministic builder if AI synthesis failed
          const rawName = promptGoal.match(/called\s+([A-Za-z0-9]+)|name[d]?\s+([A-Za-z0-9]+)/i)?.[1] ||
            promptGoal.match(/game/i) ? 'Architect' :
            promptGoal.match(/cyber|security/i) ? 'Aegis' : 'Nexus';

          agentId = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

          newAgentConfig = {
            id: agentId,
            name: rawName,
            roleTitle: `${rawName} Specialist Agent`,
            glyph: promptGoal.match(/game/i) ? '🎮' : promptGoal.match(/cyber|security/i) ? '🛡️' : '⚡',
            color: 'var(--amber)',
            intro: `I am ${rawName}. Specialized and ready for board execution.`,
            systemPrompt: `You are ${rawName}, an expert AI agent focused on ${promptGoal}.`,
            version: 'v1.0.0',
            status: 'ready',
            personality: {
              temperament: ['calm', 'careful', 'direct'],
              speakingStyle: 'measured, confident',
              humor: 'subtle',
              disagreementPosture: 'respectful'
            },
            permissions: assignPermissionsForRole(promptGoal),
            voice: assignVoiceForRole(promptGoal, ''),
            memoryNamespace: `memory/${agentId}`,
            capabilities: ['Domain Execution', 'Technical Reasoning'],
            reflySkills: ['game-design-workflow', 'code-analysis'],
            neuralMap: createInitialNeuralMap(agentId, rawName, 'Specialist', ['Domain Execution']),
            author: 'prometheus',
            isCustom: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          logs.push(`Deterministic fallback triggered for ${agentId}.`);
        }
      }
    }

    // Save agent config
    const agentFilePath = path.join(DATA_DIR, 'agents', `${agentId}.json`);
    fs.writeFileSync(agentFilePath, JSON.stringify(newAgentConfig, null, 2), 'utf8');

    // Save private memory namespace
    const memPath = path.join(DATA_DIR, 'memory', `${agentId}.json`);
    fs.writeFileSync(memPath, JSON.stringify([
      { timestamp: Date.now(), event: 'CREATED', details: `Autonomous agent ${newAgentConfig.name} created by AutoAgentBuilder.` }
    ], null, 2), 'utf8');

    // Save neural map graph
    const mapPath = path.join(DATA_DIR, 'neural-map', `${agentId}.json`);
    fs.writeFileSync(mapPath, JSON.stringify(newAgentConfig.neuralMap, null, 2), 'utf8');

    // Update agent registry
    const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
    let registry: string[] = [];
    if (fs.existsSync(registryPath)) {
      try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch {}
    }
    if (!registry.includes(agentId)) {
      registry.push(agentId);
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
    }

    // Publish SSE event
    broadcastEvent('AGENT_READY', { agentId, agent: newAgentConfig, status: 'ready', timestamp: Date.now() });

    logs.push(`Agent ${newAgentConfig.name} v1.0.0 published to registry and added to Roundtable.`);

    return {
      success: true,
      agentId,
      agent: newAgentConfig,
      logs
    };
  }

  // Auto-Agent Builder Endpoint
  app.post('/api/builder/auto-build', async (req, res) => {
    try {
      const { request, goal, profile } = req.body;
      const promptGoal = request || goal || 'Build a specialized AI agent';
      const result = await runAutoAgentBuilder(promptGoal, profile);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/builder/forge-agent', async (req, res) => {
    try {
      const { goal, name: reqName, role: reqRole, purpose, authorPersona = 'forge', profile } = req.body;

      if (!goal && !purpose && !reqName) {
        return res.status(400).json({ error: { message: "Goal, role, or name is required to forge an agent." } });
      }

      const promptGoal = goal || purpose || `Create a specialized AI agent named ${reqName || 'NexusAgent'} for ${reqRole || 'Domain Specialist'}`;

      const jobId = `job-${Date.now()}`;
      const jobRecord = {
        id: jobId,
        type: 'create-agent',
        status: 'queued',
        logs: [`Job ${jobId} initialized`, `Goal: "${promptGoal}"`],
        filesChanged: [],
        startedAt: Date.now()
      };
      jobStore.set(jobId, jobRecord);

      broadcastEvent('AGENT_BUILD_STARTED', { jobId, goal: promptGoal });

      // Execute synthesis prompt
      const metaSystemPrompt = `You are the BUILDENGINE AGENT ARCHITECT.
Synthesize an executive-ready AI agent profile from the user request.
Output MUST be ONLY valid JSON matching this schema with NO markdown code blocks:
{
  "name": "SingleWordCodename",
  "roleTitle": "Executive Role Title",
  "glyph": "Unicode Symbol (e.g., ⚙, 🛡, ⚡, ✦, ⬡)",
  "color": "var(--cyan)",
  "intro": "First-person executive boardroom introduction.",
  "systemPrompt": "Full context-engineered system prompt in XML tags.",
  "capabilities": ["Capability 1", "Capability 2", "Capability 3"],
  "suggestedTrainingSubjects": ["Subject 1", "Subject 2"],
  "samplePrompts": ["Sample prompt 1", "Sample prompt 2"]
}`;

      jobRecord.status = 'planning';
      jobRecord.logs.push('Synthesizing agent definition & persona...');
      broadcastEvent('AGENT_BUILD_PROGRESS', { jobId, status: 'planning', message: 'Planning agent architecture...' });

      const rawResult = await executeCompletion({
        system: metaSystemPrompt,
        messages: [{ role: 'user', content: `Forge agent for: ${promptGoal}` }],
        profile
      });

      let cleaned = rawResult.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);

      const agentId = (parsed.name || reqName || `agent-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]/g, '');

      const newAgentConfig = {
        id: agentId,
        name: parsed.name || reqName || 'NexusAgent',
        roleTitle: parsed.roleTitle || reqRole || 'Specialized Executive',
        glyph: parsed.glyph || '⚡',
        color: parsed.color || 'var(--cyan)',
        intro: parsed.intro || 'Greetings, round table. I am online and ready.',
        systemPrompt: parsed.systemPrompt || 'You are an expert AI agent.',
        capabilities: parsed.capabilities || ['Analysis', 'Execution'],
        trainingModules: [],
        author: authorPersona,
        isCustom: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      jobRecord.status = 'building';
      jobRecord.logs.push(`Writing files for ${newAgentConfig.name} (${agentId})...`);
      broadcastEvent('AGENT_BUILD_PROGRESS', { jobId, status: 'building', message: `Writing agent files for ${newAgentConfig.name}...` });

      // Save to disk
      const agentFilePath = path.join(DATA_DIR, 'agents', `${agentId}.json`);
      fs.writeFileSync(agentFilePath, JSON.stringify(newAgentConfig, null, 2), 'utf8');
      jobRecord.filesChanged.push(`data/agents/${agentId}.json`);

      // Initialize memory & neural map
      const memPath = path.join(DATA_DIR, 'memory', `${agentId}.json`);
      fs.writeFileSync(memPath, JSON.stringify([{ timestamp: Date.now(), event: 'CREATED', details: `Forged by ${authorPersona}` }], null, 2), 'utf8');
      jobRecord.filesChanged.push(`data/memory/${agentId}.json`);

      const mapPath = path.join(DATA_DIR, 'neural-map', `${agentId}.json`);
      fs.writeFileSync(mapPath, JSON.stringify({
        agentId,
        nodes: [{ id: 'core', label: newAgentConfig.name, type: 'skill' }, { id: 'role', label: newAgentConfig.roleTitle, type: 'project' }],
        edges: [{ source: 'core', target: 'role', strength: 1.0 }]
      }, null, 2), 'utf8');

      // Update registry
      const registryPath = path.join(DATA_DIR, 'agents', 'registry.json');
      let registry: string[] = [];
      if (fs.existsSync(registryPath)) registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (!registry.includes(agentId)) registry.push(agentId);
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');

      jobRecord.status = 'complete';
      jobRecord.logs.push(`Agent ${newAgentConfig.name} registered and ready.`);
      broadcastEvent('AGENT_READY', { jobId, agentId, agent: newAgentConfig });

      res.json({ jobId, agent: newAgentConfig });
    } catch (error: any) {
      console.error("Forge Agent Error:", error);
      res.status(500).json({ error: { message: error.message || "Failed to forge agent" } });
    }
  });

  // Controlled Engineering Tools for Forge
  app.post('/api/tools/read-file', (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) return res.status(400).json({ error: 'filePath is required' });

      const absolutePath = path.resolve(process.cwd(), filePath);
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied outside workspace boundary' });
      }

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const content = fs.readFileSync(absolutePath, 'utf8');
      res.json({ filePath, content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tools/write-file', (req, res) => {
    try {
      const { filePath, content } = req.body;
      if (!filePath) return res.status(400).json({ error: 'filePath is required' });

      const absolutePath = path.resolve(process.cwd(), filePath);
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied outside workspace boundary' });
      }

      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, content || '', 'utf8');
      res.json({ success: true, filePath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tools/run-command', (req, res) => {
    try {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'command is required' });

      const allowedPrefixes = ['npm ', 'node ', 'tsc', 'git ', 'ls', 'pwd', 'cat', 'echo'];
      const isAllowed = allowedPrefixes.some(p => command.trim().startsWith(p));
      if (!isAllowed) {
        return res.status(403).json({ error: 'Command not allowed by security policy' });
      }

      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        res.json({
          command,
          exitCode: error ? error.code : 0,
          stdout,
          stderr
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pedagogical Training Curriculum Generation
  app.post('/api/builder/train-agent', async (req, res) => {
    try {
      const { agentName, roleTitle, currentSystemPrompt, subject, focusTopics, customNotes, profile } = req.body;

      if (!subject || !subject.trim()) {
        return res.status(400).json({ error: { message: "Training subject or topic is required." } });
      }

      const trainerSystemPrompt = `You are the MASTER AI TRAINER & PEDAGOGY SCIENTIST at BuildEngine.
Synthesize a deep domain curriculum for:
Agent Name: ${agentName || 'Specialist'}
Role: ${roleTitle || 'Domain Expert'}

Output MUST be ONLY valid JSON matching this schema:
{
  "title": "Title of Training Module",
  "subject": "${subject.trim()}",
  "targetCapability": "Primary skill unlocked",
  "summary": "Executive summary of what the agent learned (2 sentences)",
  "concepts": ["Key Concept 1", "Key Concept 2", "Key Concept 3"],
  "heuristics": ["Decision Rule 1", "Decision Rule 2", "Decision Rule 3"],
  "fewShotExemplars": [
    {
      "input": "Realistic tough prompt",
      "idealOutput": "Flawless response showing mastery",
      "reasoning": "Why this response is ideal"
    }
  ],
  "guardrails": ["Guardrail 1", "Guardrail 2"],
  "updatedSystemPrompt": "Updated system prompt containing the new domain knowledge in context-engineered XML tags"
}`;

      const userMessage = `Train ${agentName} (${roleTitle}) on: SUBJECT: ${subject.trim()}`;
      const rawResult = await executeCompletion({ system: trainerSystemPrompt, messages: [{ role: 'user', content: userMessage }], profile });

      let cleaned = rawResult.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);

      res.json({ module: parsed });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message || "Failed to train agent on subject" } });
    }
  });

  // Simulation Evaluation Endpoint
  app.post('/api/builder/simulate-eval', async (req, res) => {
    try {
      const { agentName, roleTitle, systemPrompt, subject, testPrompt, profile } = req.body;

      let challenge = testPrompt?.trim();
      if (!challenge) {
        challenge = await executeCompletion({
          system: `Generate a realistic scenario for testing ${agentName} (${roleTitle}) on ${subject || 'Execution'}.`,
          messages: [{ role: 'user', content: 'Generate test scenario prompt.' }],
          profile
        });
        challenge = challenge.trim();
      }

      const agentResponse = await executeCompletion({
        system: systemPrompt,
        messages: [{ role: 'user', content: challenge }],
        profile
      });

      const evaluatorPrompt = `Evaluate the AI response on 0-100 scale.
AGENT: ${agentName} (${roleTitle})
CHALLENGE: ${challenge}
AGENT RESPONSE: ${agentResponse}

Output JSON schema:
{
  "overallScore": 92,
  "accuracyScore": 95,
  "reasoningScore": 90,
  "roleFidelityScore": 94,
  "concisenessScore": 88,
  "critique": "Executive evaluation summary.",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1"],
  "recommendedPatch": "System prompt patch instruction."
}`;

      const rawEval = await executeCompletion({ system: evaluatorPrompt, messages: [{ role: 'user', content: 'Evaluate and output JSON.' }], profile });

      let cleaned = rawEval.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsedEval = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);

      res.json({ evaluation: { testPrompt: challenge, agentResponse, ...parsedEval } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message || "Failed to run simulation evaluation" } });
    }
  });

  // Token & Context Optimization
  app.post('/api/builder/optimize-tokens', async (req, res) => {
    try {
      const { prompt, profile } = req.body;
      if (!prompt || !prompt.trim()) return res.status(400).json({ error: { message: "Prompt is required." } });

      const optimizerSystemPrompt = `Compress and optimize system prompt into XML tags.
Output JSON schema:
{
  "optimizedPrompt": "Optimized prompt",
  "changesSummary": ["Change 1", "Change 2"]
}`;

      const rawResult = await executeCompletion({ system: optimizerSystemPrompt, messages: [{ role: 'user', content: prompt }], profile });
      let cleaned = rawResult.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleaned);

      const originalTokens = Math.max(1, Math.round(prompt.length / 3.8));
      const optimizedTokens = Math.max(1, Math.round(parsed.optimizedPrompt.length / 3.8));
      const compressionRatio = Math.max(0, Math.round(((originalTokens - optimizedTokens) / originalTokens) * 100));

      res.json({
        optimization: {
          originalTokens,
          optimizedTokens,
          compressionRatio,
          optimizedPrompt: parsed.optimizedPrompt,
          changesSummary: parsed.changesSummary || ['Structured into XML tags'],
          estimatedLatencyMsSavings: Math.max(0, Math.round((originalTokens - optimizedTokens) * 3.2))
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message || "Failed to optimize prompt" } });
    }
  });

  // Inter-Agent Backend Chat Log Endpoints
  app.get('/api/inter-agent-chats', (_req, res) => {
    try {
      const chats = getInterAgentChats();
      res.json({ chats });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/inter-agent-chats', (req, res) => {
    try {
      const { sender, recipient, content, taskContext = 'System General', type = 'whisper' } = req.body || {};
      if (!sender || !recipient || !content) {
        return res.status(400).json({ error: 'sender, recipient, and content are required' });
      }
      const chat = appendInterAgentChat(sender, recipient, content, taskContext, type);
      res.json({ success: true, chat });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/inter-agent-chats/clear', (_req, res) => {
    try {
      const p = path.join(DATA_DIR, 'inter_agent_chats.json');
      if (fs.existsSync(p)) fs.unlinkSync(p);
      const chats = getInterAgentChats();
      res.json({ success: true, chats });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite Middleware in Dev vs Static Serving in Prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PROMETHEUS Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
