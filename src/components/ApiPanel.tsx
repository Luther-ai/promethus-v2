import React, { useState, useEffect } from 'react';
import { storage } from '../storage';
import { 
  AgentKey, 
  AGENTS, 
  ORDER, 
  AgentPersona, 
  DEFAULT_AGENT_PERSONAS, 
  PERSONA_PRESETS, 
  PersonaPreset 
} from '../types';

export interface ApiProfile {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'openrouter' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const DEFAULT_PROFILES: ApiProfile[] = [
  {
    id: 'openrouter-default',
    name: 'OpenRouter AI (Multi-Model)',
    provider: 'openrouter',
    apiKey: '',
    model: 'google/gemini-3.7-flash',
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    id: 'google-default',
    name: 'Google Gemini (Native)',
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3.7-flash'
  },
  {
    id: 'openai-default',
    name: 'OpenAI GPT-4o-mini',
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: 'openai-o3-mini',
    name: 'OpenAI Reasoning (o3-mini)',
    provider: 'openai',
    apiKey: '',
    model: 'o3-mini',
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic Claude 3.5 Sonnet',
    provider: 'anthropic',
    apiKey: '',
    model: 'claude-3-5-sonnet-latest'
  },
  {
    id: 'custom-openai-default',
    name: 'Local / Custom Endpoint (Ollama/LM Studio)',
    provider: 'custom',
    apiKey: '',
    model: 'llama3',
    baseUrl: 'http://localhost:11434/v1'
  }
];

interface ValidationState {
  status: 'idle' | 'testing' | 'valid' | 'invalid';
  message: string;
  latencyMs?: number;
  statusCode?: number;
}

export function ApiPanel({ 
  open, 
  onClose,
  activeProfileId,
  onSelectProfile,
  personas,
  onUpdatePersonas,
  initialTab = 'apis'
}: { 
  open: boolean; 
  onClose: () => void;
  activeProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
  personas?: Record<AgentKey, AgentPersona>;
  onUpdatePersonas?: (personas: Record<AgentKey, AgentPersona>) => void;
  initialTab?: 'apis' | 'personas';
}) {
  const [activeTab, setActiveTab] = useState<'apis' | 'personas'>(initialTab);
  
  // API Profiles state
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // form state for API
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ApiProfile['provider']>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('google/gemini-3.7-flash');
  const [baseUrl, setBaseUrl] = useState('');

  // validation state
  const [validation, setValidation] = useState<ValidationState>({
    status: 'idle',
    message: ''
  });
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [profileHealthMap, setProfileHealthMap] = useState<Record<string, { status: 'valid' | 'invalid'; latencyMs?: number; message?: string }>>({});

  // Persona editing state
  const [selectedAgentForPersona, setSelectedAgentForPersona] = useState<AgentKey>('sage');
  const [currentPersonas, setCurrentPersonas] = useState<Record<AgentKey, AgentPersona>>(DEFAULT_AGENT_PERSONAS);
  const [personaRoleTitle, setPersonaRoleTitle] = useState('');
  const [personaSystemPrompt, setPersonaSystemPrompt] = useState('');
  const [personaSavedNotice, setPersonaSavedNotice] = useState(false);
  
  // Persona test state
  const [testPromptInput, setTestPromptInput] = useState('Explain your approach to problem-solving and give me a 2-sentence introduction in your current persona.');
  const [testingPersona, setTestingPersona] = useState(false);
  const [personaTestOutput, setPersonaTestOutput] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadPersonas();
      setValidation({ status: 'idle', message: '' });
      if (initialTab) setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Sync current agent persona into edit fields
  useEffect(() => {
    const p = currentPersonas[selectedAgentForPersona] || DEFAULT_AGENT_PERSONAS[selectedAgentForPersona];
    setPersonaRoleTitle(p.roleTitle || AGENTS[selectedAgentForPersona].role);
    setPersonaSystemPrompt(p.systemPrompt || AGENTS[selectedAgentForPersona].system);
    setPersonaTestOutput(null);
  }, [selectedAgentForPersona, currentPersonas]);

  const loadPersonas = async () => {
    if (personas) {
      setCurrentPersonas(personas);
      return;
    }
    try {
      const data = await storage.get('agent_personas');
      if (data && data.value) {
        const parsed = JSON.parse(data.value);
        if (parsed && typeof parsed === 'object') {
          setCurrentPersonas({ ...DEFAULT_AGENT_PERSONAS, ...parsed });
          return;
        }
      }
    } catch {
      // ignore
    }
    setCurrentPersonas(DEFAULT_AGENT_PERSONAS);
  };

  const loadProfiles = async () => {
    try {
      const data = await storage.get('api_profiles');
      if (data && data.value) {
        let parsed: ApiProfile[] = JSON.parse(data.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize old placeholder or invalid keys
          parsed = parsed.map(p => {
            if (p.provider === 'gemini' && p.apiKey && (p.apiKey.startsWith('AQ.') || p.apiKey.startsWith('ya29.'))) {
              return { ...p, apiKey: '' };
            }
            return p;
          });
          setProfiles(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setProfiles(DEFAULT_PROFILES);
    await storage.set('api_profiles', JSON.stringify(DEFAULT_PROFILES));
    if (!activeProfileId) {
      onSelectProfile(DEFAULT_PROFILES[0].id);
    }
  };

  const saveProfiles = async (newProfiles: ApiProfile[]) => {
    setProfiles(newProfiles);
    await storage.set('api_profiles', JSON.stringify(newProfiles));
  };

  const runValidation = async (targetProvider: ApiProfile['provider'], targetKey: string, targetModel: string, targetUrl?: string): Promise<{ valid: boolean; message: string; latencyMs?: number; status?: number }> => {
    try {
      const resp = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: targetProvider,
          apiKey: targetKey,
          model: targetModel,
          baseUrl: targetUrl
        })
      });
      const data = await resp.json();
      return {
        valid: Boolean(data.valid),
        message: data.message || (data.valid ? 'Key valid and model responsive' : 'Key validation failed'),
        latencyMs: data.latencyMs,
        status: data.status || resp.status
      };
    } catch (err: any) {
      return {
        valid: false,
        message: `Network failure testing key: ${err.message}`,
        status: 500
      };
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setValidation({
        status: 'invalid',
        message: 'Please provide an API key before testing connection.'
      });
      return;
    }

    setValidation({
      status: 'testing',
      message: `Connecting to ${provider.toUpperCase()} (${model || 'default'})...`
    });

    const res = await runValidation(provider, apiKey, model, baseUrl);
    if (res.valid) {
      setValidation({
        status: 'valid',
        message: res.message,
        latencyMs: res.latencyMs
      });
    } else {
      setValidation({
        status: 'invalid',
        message: res.message,
        statusCode: res.status,
        latencyMs: res.latencyMs
      });
    }
  };

  const testSingleSavedProfile = async (profile: ApiProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingProfileId(profile.id);
    const res = await runValidation(profile.provider, profile.apiKey, profile.model, profile.baseUrl);
    setProfileHealthMap(prev => ({
      ...prev,
      [profile.id]: {
        status: res.valid ? 'valid' : 'invalid',
        latencyMs: res.latencyMs,
        message: res.message
      }
    }));
    setTestingProfileId(null);
  };

  const handleSaveProfile = async (forceBypass = false) => {
    if (!name.trim() || !apiKey.trim() || !model.trim()) return;

    if (!forceBypass && validation.status !== 'valid') {
      setValidation({
        status: 'testing',
        message: `Validating ${provider.toUpperCase()} credentials before saving...`
      });
      const testRes = await runValidation(provider, apiKey, model, baseUrl);
      if (!testRes.valid) {
        setValidation({
          status: 'invalid',
          message: testRes.message,
          statusCode: testRes.status,
          latencyMs: testRes.latencyMs
        });
        return;
      }
      setValidation({
        status: 'valid',
        message: testRes.message,
        latencyMs: testRes.latencyMs
      });
    }
    
    const newProfile: ApiProfile = {
      id: editingId || Date.now().toString(),
      name: name.trim(),
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      baseUrl: baseUrl.trim()
    };

    let updated;
    if (editingId) {
      updated = profiles.map(p => p.id === editingId ? newProfile : p);
    } else {
      updated = [...profiles, newProfile];
    }
    
    await saveProfiles(updated);
    if (!activeProfileId || editingId === activeProfileId) {
      onSelectProfile(newProfile.id);
    }
    resetProfileForm();
  };

  const resetProfileForm = () => {
    setEditingId(null);
    setName('');
    setProvider('openrouter');
    setApiKey('');
    setModel('google/gemini-3.7-flash');
    setBaseUrl('');
    setValidation({ status: 'idle', message: '' });
  };

  const handleEditProfile = (p: ApiProfile) => {
    setEditingId(p.id);
    setName(p.name);
    setProvider(p.provider);
    setApiKey(p.apiKey);
    setModel(p.model);
    setBaseUrl(p.baseUrl || '');
    setValidation({ status: 'idle', message: '' });
  };

  const handleDeleteProfile = (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    saveProfiles(updated);
    if (activeProfileId === id) {
      onSelectProfile(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleRestoreDefaultProfiles = () => {
    saveProfiles(DEFAULT_PROFILES);
    onSelectProfile(DEFAULT_PROFILES[0].id);
    setProfileHealthMap({});
  };

  // Persona Handlers
  const handleApplyPreset = (preset: PersonaPreset) => {
    setPersonaRoleTitle(preset.roleTitle);
    setPersonaSystemPrompt(preset.systemPrompt);
  };

  const handleResetAgentToDefault = () => {
    const defaultP = DEFAULT_AGENT_PERSONAS[selectedAgentForPersona];
    setPersonaRoleTitle(defaultP.roleTitle);
    setPersonaSystemPrompt(defaultP.systemPrompt);
  };

  const handleResetAllPersonas = async () => {
    setCurrentPersonas(DEFAULT_AGENT_PERSONAS);
    await storage.set('agent_personas', JSON.stringify(DEFAULT_AGENT_PERSONAS));
    if (onUpdatePersonas) {
      onUpdatePersonas(DEFAULT_AGENT_PERSONAS);
    }
    const def = DEFAULT_AGENT_PERSONAS[selectedAgentForPersona];
    setPersonaRoleTitle(def.roleTitle);
    setPersonaSystemPrompt(def.systemPrompt);
  };

  const handleSaveCurrentPersona = async () => {
    const updated: Record<AgentKey, AgentPersona> = {
      ...currentPersonas,
      [selectedAgentForPersona]: {
        roleTitle: personaRoleTitle.trim() || AGENTS[selectedAgentForPersona].role,
        systemPrompt: personaSystemPrompt.trim() || AGENTS[selectedAgentForPersona].system,
        lastUpdated: Date.now()
      }
    };

    setCurrentPersonas(updated);
    await storage.set('agent_personas', JSON.stringify(updated));
    if (onUpdatePersonas) {
      onUpdatePersonas(updated);
    }

    setPersonaSavedNotice(true);
    setTimeout(() => setPersonaSavedNotice(false), 3000);
  };

  const handleTestPersonaPrompt = async () => {
    if (!personaSystemPrompt.trim()) return;
    setTestingPersona(true);
    setPersonaTestOutput(null);

    try {
      let profileData = null;
      if (activeProfileId) {
        const found = profiles.find(p => p.id === activeProfileId);
        if (found) profileData = found;
      }

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentKey: selectedAgentForPersona,
          system: personaSystemPrompt,
          messages: [{ role: 'user', content: testPromptInput }],
          profile: profileData
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setPersonaTestOutput(data.content?.[0]?.text || 'No response generated.');
    } catch (err: any) {
      setPersonaTestOutput(`[Error testing persona]: ${err.message}`);
    } finally {
      setTestingPersona(false);
    }
  };

  // Provider presets for model selector
  const providerPresets: Record<ApiProfile['provider'], { label: string; models: string[]; keyHint: string }> = {
    openrouter: {
      label: 'OpenRouter Hub',
      models: [
        'google/gemini-3.7-flash',
        'google/gemini-3.6-flash',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/o3-mini',
        'openai/o1',
        'openai/o1-mini',
        'openai/gpt-4.5-preview',
        'anthropic/claude-3.7-sonnet',
        'anthropic/claude-3.5-sonnet',
        'meta-llama/llama-3.3-70b-instruct',
        'deepseek/deepseek-r1'
      ],
      keyHint: 'Standard OpenRouter API key (sk-or-v1-...)'
    },
    openai: {
      label: 'OpenAI API',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'o3-mini',
        'o1',
        'o1-mini',
        'gpt-4.5-preview',
        'gpt-4-turbo',
        'chatgpt-4o-latest'
      ],
      keyHint: 'Official OpenAI secret key (sk-proj-... or sk-...)'
    },
    gemini: {
      label: 'Google Gemini',
      models: ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.1-pro-preview'],
      keyHint: 'Google AI Studio API key (AIzaSy...) or Cloud Access Token'
    },
    anthropic: {
      label: 'Anthropic Claude',
      models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      keyHint: 'Anthropic API key (sk-ant-...)'
    },
    custom: {
      label: 'Custom / OpenAI Compatible',
      models: ['llama3.2', 'mixtral-8x7b-32768', 'qwen-2.5-72b', 'deepseek-r1'],
      keyHint: 'API key for your custom provider (Groq, Together, vLLM, Ollama)'
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#05120f] border border-[var(--cyan)] rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-hidden shadow-[0_0_70px_rgba(53,242,223,0.22)] flex flex-col">
        {/* Top Header & Tab Navigation */}
        <div className="p-5 md:p-6 pb-0 border-b border-[var(--line)] shrink-0 bg-[#071915]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl text-[var(--cyan)]">⚡</span>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-wider font-mono">
                  ENGINE CONFIGURATION & PERSONAS
                </h2>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Customize live API providers, model routing, and role personas for the entire executive agent circle.
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-white hover:border-white transition-colors flex items-center justify-center cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2">
            <button
              id="tab-apis"
              onClick={() => setActiveTab('apis')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-t-xl transition-all border-t border-x cursor-pointer flex items-center gap-2 ${
                activeTab === 'apis'
                  ? 'bg-[#05120f] text-[var(--cyan)] border-[var(--cyan)] border-b-transparent shadow-[0_-5px_15px_rgba(53,242,223,0.1)]'
                  : 'bg-transparent text-[var(--muted)] border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <span>⚡ API Providers & Models</span>
              <span className="text-[10px] bg-[var(--line)] text-[var(--muted)] px-1.5 py-0.2 rounded-full">
                {profiles.length}
              </span>
            </button>
            <button
              id="tab-personas"
              onClick={() => setActiveTab('personas')}
              className={`px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-t-xl transition-all border-t border-x cursor-pointer flex items-center gap-2 ${
                activeTab === 'personas'
                  ? 'bg-[#05120f] text-[var(--cyan)] border-[var(--cyan)] border-b-transparent shadow-[0_-5px_15px_rgba(53,242,223,0.1)]'
                  : 'bg-transparent text-[var(--muted)] border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <span>🎭 Agent Personas & System Prompts</span>
              <span className="text-[9px] bg-[var(--cyan)] text-black px-1.5 py-0.2 rounded-full font-bold">
                NEW
              </span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 bg-[#05120f]">
          {/* TAB 1: API Providers & Model Keys */}
          {activeTab === 'apis' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Left Column: Saved Profiles & Health Status */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-[var(--cyan)] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <span>Configured APIs</span>
                    <span className="text-[10px] bg-[var(--line)] text-[var(--muted)] px-1.5 py-0.2 rounded-full">{profiles.length}</span>
                  </h3>
                  <button 
                    onClick={handleRestoreDefaultProfiles} 
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--cyan)] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Reset Built-in
                  </button>
                </div>
                
                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[460px]">
                  {profiles.length === 0 ? (
                    <div className="text-[var(--muted)] text-xs italic p-6 border border-dashed border-[var(--line)] rounded-xl text-center">
                      No API profiles added yet. Use the form to configure one.
                    </div>
                  ) : (
                    profiles.map(p => {
                      const isActive = activeProfileId === p.id;
                      const health = profileHealthMap[p.id];
                      const isTestingThis = testingProfileId === p.id;
                      
                      return (
                        <div 
                          key={p.id} 
                          className={`p-3.5 border rounded-xl cursor-pointer transition-all ${
                            isActive 
                              ? 'border-[var(--cyan)] bg-[rgba(53,242,223,0.1)] shadow-[0_0_15px_rgba(53,242,223,0.18)]' 
                              : 'border-[var(--line)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)]'
                          }`}
                          onClick={() => onSelectProfile(p.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isActive ? 'bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] animate-pulse' : 'bg-[var(--muted)] opacity-50'
                                }`} />
                                <span className="font-bold text-white text-sm truncate">{p.name}</span>
                                {isActive && (
                                  <span className="text-[9px] bg-[var(--cyan)] text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-[11px] text-[var(--muted)] mt-1 font-mono truncate">
                                <span className="text-[var(--cyan)] font-semibold">{p.provider.toUpperCase()}</span> • {p.model}
                              </div>
                              
                              <div className="text-[10px] text-[var(--muted)] opacity-60 font-mono truncate mt-0.5">
                                Key: {p.apiKey ? `${p.apiKey.slice(0, 8)}...${p.apiKey.slice(-4)}` : 'Empty'}
                              </div>

                              {health && (
                                <div className={`mt-2 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1.5 ${
                                  health.status === 'valid' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : 'bg-red-950/60 border border-red-500/40 text-red-300'
                                }`}>
                                  <span>{health.status === 'valid' ? '✓ Operational' : '✕ Rejected'}</span>
                                  {health.latencyMs && <span className="opacity-70">({health.latencyMs}ms)</span>}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={(e) => testSingleSavedProfile(p, e)}
                                disabled={isTestingThis}
                                className="px-2 py-1 bg-[rgba(255,255,255,0.05)] hover:bg-[var(--cyan)] hover:text-black border border-[var(--line)] text-[10px] font-mono text-[var(--cyan)] rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                                title="Test connectivity now"
                              >
                                {isTestingThis ? (
                                  <span className="animate-spin text-xs">↻</span>
                                ) : (
                                  <span>Test</span>
                                )}
                              </button>
                              <div className="flex gap-1 justify-end mt-1">
                                <button 
                                  onClick={() => handleEditProfile(p)} 
                                  className="p-1 text-[var(--cyan)] hover:bg-[var(--cyan)]/20 rounded text-xs transition-colors cursor-pointer" 
                                  title="Edit profile"
                                >
                                  ✎
                                </button>
                                <button 
                                  onClick={() => handleDeleteProfile(p.id)} 
                                  className="p-1 text-red-400 hover:bg-red-500/20 rounded text-xs transition-colors cursor-pointer" 
                                  title="Delete profile"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <button 
                  onClick={() => onSelectProfile(null)}
                  className={`mt-3 w-full p-3 border rounded-xl text-xs font-bold uppercase tracking-wider text-center transition-all cursor-pointer font-mono ${
                    activeProfileId === null 
                      ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan)]/10 shadow-[0_0_12px_rgba(53,242,223,0.2)]' 
                      : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--cyan)] hover:text-white'
                  }`}
                >
                  Use Built-in Default Studio API
                </button>
              </div>

              {/* Right Column: Validation & Editing Form */}
              <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-[var(--line)] pt-6 lg:pt-0 lg:pl-8 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-[var(--cyan)] uppercase tracking-widest font-mono">
                    {editingId ? 'Edit AI Profile & Test' : '+ Add New AI Provider'}
                  </h3>
                  {editingId && (
                    <span className="text-[10px] text-[var(--muted)] font-mono">Editing ID: {editingId}</span>
                  )}
                </div>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Profile Name
                      </label>
                      <input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full bg-black/50 border border-[var(--line)] rounded-lg p-2.5 text-white text-xs font-mono focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none" 
                        placeholder="e.g. OpenRouter Llama 3" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Provider
                      </label>
                      <select 
                        value={provider} 
                        onChange={e => {
                          const prov = e.target.value as ApiProfile['provider'];
                          setProvider(prov);
                          const defaultPreset = providerPresets[prov]?.models[0];
                          if (defaultPreset) setModel(defaultPreset);
                          setValidation({ status: 'idle', message: '' });
                        }} 
                        className="w-full bg-[#05120f] border border-[var(--line)] rounded-lg p-2.5 text-white text-xs focus:border-[var(--cyan)] outline-none cursor-pointer"
                      >
                        <option value="openrouter">OpenRouter (Multi-Model Hub)</option>
                        <option value="openai">OpenAI (Official)</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="custom">Custom (OpenAI-Compatible / Groq / Ollama)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        API Key
                      </label>
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        {providerPresets[provider]?.keyHint}
                      </span>
                    </div>
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={e => {
                        setApiKey(e.target.value);
                        setValidation({ status: 'idle', message: '' });
                      }} 
                      className="w-full bg-black/50 border border-[var(--line)] rounded-lg p-2.5 text-white text-xs font-mono focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none" 
                      placeholder="Paste API secret or bearer token..." 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                      Model Identifier
                    </label>
                    <input 
                      value={model} 
                      onChange={e => {
                        setModel(e.target.value);
                        setValidation({ status: 'idle', message: '' });
                      }} 
                      className="w-full bg-black/50 border border-[var(--line)] rounded-lg p-2.5 text-white text-xs font-mono focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none" 
                      placeholder="e.g. google/gemini-3.7-flash or gpt-4o" 
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider self-center mr-1 font-mono">Presets:</span>
                      {providerPresets[provider]?.models.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setModel(m);
                            setValidation({ status: 'idle', message: '' });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all cursor-pointer ${
                            model === m 
                              ? 'border-[var(--cyan)] bg-[var(--cyan)]/20 text-[var(--cyan)]' 
                              : 'border-[var(--line)] bg-black/30 text-[var(--muted)] hover:border-[var(--cyan)] hover:text-white'
                          }`}
                        >
                          {m.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {provider === 'custom' && (
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                        Base URL (OpenAI-Compatible Endpoint)
                      </label>
                      <input 
                        value={baseUrl} 
                        onChange={e => {
                          setBaseUrl(e.target.value);
                          setValidation({ status: 'idle', message: '' });
                        }} 
                        className="w-full bg-black/50 border border-[var(--line)] rounded-lg p-2.5 text-white text-xs font-mono focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none" 
                        placeholder="https://api.groq.com/openai/v1 or http://localhost:11434/v1" 
                      />
                    </div>
                  )}

                  {validation.status === 'testing' && (
                    <div className="p-3.5 rounded-xl bg-[rgba(53,242,223,0.08)] border border-[var(--cyan)] flex items-center gap-3 text-xs text-[var(--cyan)] animate-pulse">
                      <span className="w-4 h-4 border-2 border-[var(--cyan)] border-t-transparent rounded-full animate-spin"></span>
                      <div className="font-mono">
                        <div className="font-bold">Testing Connectivity...</div>
                        <div className="text-[11px] opacity-80">{validation.message}</div>
                      </div>
                    </div>
                  )}

                  {validation.status === 'valid' && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 flex items-start gap-3 text-xs text-emerald-200">
                      <span className="text-base text-emerald-400 font-bold mt-0.5">✓</span>
                      <div className="font-mono flex-1">
                        <div className="font-bold text-emerald-300 flex items-center justify-between">
                          <span>Connection Verified & Operational</span>
                          {validation.latencyMs && <span className="text-[10px] opacity-75">{validation.latencyMs}ms</span>}
                        </div>
                        <div className="text-[11px] text-emerald-200/90 mt-0.5">{validation.message}</div>
                      </div>
                    </div>
                  )}

                  {validation.status === 'invalid' && (
                    <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/60 flex items-start gap-3 text-xs text-rose-200">
                      <span className="text-base text-rose-400 font-bold mt-0.5">⚠️</span>
                      <div className="font-mono flex-1 min-w-0">
                        <div className="font-bold text-rose-300 flex items-center justify-between">
                          <span>API Validation Rejected</span>
                          {validation.statusCode && (
                            <span className="text-[10px] bg-rose-900/80 px-1.5 py-0.2 rounded border border-rose-500/40">
                              HTTP {validation.statusCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-rose-200/90 mt-1 break-words leading-relaxed">
                          {validation.message}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                    <button
                      type="button"
                      id="test-connection-btn"
                      onClick={handleTestConnection}
                      disabled={!apiKey.trim() || validation.status === 'testing'}
                      className="px-4 py-2.5 bg-black/60 hover:bg-[var(--cyan)] hover:text-black border border-[var(--cyan)] text-[var(--cyan)] text-xs font-mono font-bold rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(53,242,223,0.1)]"
                    >
                      <span>⚡</span>
                      <span>{validation.status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
                    </button>

                    <button 
                      type="button"
                      id="save-profile-btn"
                      onClick={() => handleSaveProfile(false)}
                      disabled={!name.trim() || !apiKey.trim() || !model.trim() || validation.status === 'testing'}
                      className="flex-1 bg-[var(--cyan)] text-black font-bold py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider disabled:opacity-40 hover:bg-white transition-all shadow-[0_0_15px_rgba(53,242,223,0.3)] cursor-pointer"
                    >
                      {validation.status === 'testing' ? 'Verifying...' : (editingId ? 'Save & Validate Changes' : '+ Save AI Profile')}
                    </button>

                    {validation.status === 'invalid' && (
                      <button
                        type="button"
                        onClick={() => handleSaveProfile(true)}
                        className="px-3 py-2 border border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10 text-[10px] uppercase tracking-wider rounded-lg font-mono cursor-pointer"
                        title="Save profile even though testing failed"
                      >
                        Save Anyway
                      </button>
                    )}

                    {editingId && (
                      <button 
                        type="button"
                        onClick={resetProfileForm} 
                        className="px-4 py-2.5 border border-[var(--line)] text-[var(--muted)] hover:text-white rounded-lg text-xs uppercase tracking-wider cursor-pointer font-mono"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Agent Personas & Custom System Prompts */}
          {activeTab === 'personas' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Left Column: Agent Selector */}
              <div className="lg:col-span-4 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-[var(--cyan)] uppercase tracking-widest font-mono">
                    Select Agent
                  </h3>
                  <button
                    onClick={handleResetAllPersonas}
                    className="text-[10px] text-[var(--muted)] hover:text-red-400 uppercase tracking-wider transition-colors cursor-pointer font-mono"
                  >
                    Reset All Defaults
                  </button>
                </div>

                <div className="space-y-2">
                  {ORDER.map(key => {
                    const agent = AGENTS[key];
                    const persona = currentPersonas[key] || DEFAULT_AGENT_PERSONAS[key];
                    const isSelected = selectedAgentForPersona === key;
                    const isCustomized = persona.systemPrompt !== AGENTS[key].system || persona.roleTitle !== AGENTS[key].role;

                    const colorVar = key === 'prometheus' ? 'var(--cyan)' : 
                                    key === 'sage' ? 'var(--violet)' : 
                                    key === 'forge' ? 'var(--amber)' : 
                                    key === 'questioner' ? 'var(--green)' : 'var(--blue)';

                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedAgentForPersona(key)}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-[var(--cyan)] bg-[rgba(53,242,223,0.12)] shadow-[0_0_15px_rgba(53,242,223,0.18)]' 
                            : 'border-[var(--line)] bg-black/20 hover:border-[var(--muted)] hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base shrink-0"
                            style={{ 
                              color: colorVar, 
                              border: `1px solid ${colorVar}`,
                              background: 'rgba(255,255,255,0.03)'
                            }}
                          >
                            {agent.glyph}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm truncate">{agent.name}</span>
                              {isCustomized ? (
                                <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.2 rounded font-mono shrink-0">
                                  CUSTOM ROLE
                                </span>
                              ) : (
                                <span className="text-[9px] bg-white/5 text-[var(--muted)] px-1.5 py-0.2 rounded font-mono shrink-0">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--cyan)] font-mono truncate mt-0.5">
                              {persona.roleTitle}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-black/30 border border-[var(--line)] rounded-xl text-[11px] text-[var(--muted)]">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5 font-mono">
                    <span>💡 Persona Tip</span>
                  </div>
                  Each agent's custom system prompt is injected on every board query, governing their tone, decision framework, and task execution logic.
                </div>
              </div>

              {/* Right Column: Persona & System Prompt Editor */}
              <div className="lg:col-span-8 border-t lg:border-t-0 lg:border-l border-[var(--line)] pt-6 lg:pt-0 lg:pl-8 flex flex-col">
                <div className="flex justify-between items-start mb-4 pb-2 border-b border-[var(--line)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg text-[var(--cyan)] border border-[var(--cyan)] bg-[var(--cyan)]/10">
                      {AGENTS[selectedAgentForPersona].glyph}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono">
                        {AGENTS[selectedAgentForPersona].name} — Persona & Role Config
                      </h3>
                      <div className="text-[11px] text-[var(--muted)]">
                        Original Executive Role: {AGENTS[selectedAgentForPersona].role}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAgentToDefault}
                    className="text-[10px] text-[var(--muted)] hover:text-white border border-[var(--line)] px-2.5 py-1 rounded font-mono transition-colors cursor-pointer"
                  >
                    Reset Agent
                  </button>
                </div>

                <div className="space-y-4 flex-1">
                  {/* Role Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1 font-mono">
                      Role / Persona Title
                    </label>
                    <input 
                      value={personaRoleTitle} 
                      onChange={e => setPersonaRoleTitle(e.target.value)} 
                      className="w-full bg-black/50 border border-[var(--line)] rounded-lg p-2.5 text-white text-xs font-mono focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none" 
                      placeholder="e.g. Socratic Tutor, Code Architect, VP of Strategy" 
                    />
                  </div>

                  {/* Preset Role Quick Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5 font-mono">
                      ⚡ Quick Role Presets:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetAgentToDefault}
                        className="text-[10px] px-2.5 py-1 rounded border border-[var(--line)] bg-black/40 text-[var(--muted)] hover:text-white hover:border-[var(--cyan)] transition-all font-mono cursor-pointer"
                      >
                        🏛️ Default {AGENTS[selectedAgentForPersona].role.split('/')[0].trim()}
                      </button>
                      {PERSONA_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className={`text-[10px] px-2.5 py-1 rounded border transition-all font-mono cursor-pointer ${
                            personaRoleTitle === preset.roleTitle
                              ? 'border-[var(--cyan)] bg-[var(--cyan)]/20 text-[var(--cyan)] font-bold'
                              : 'border-[var(--line)] bg-black/40 text-[var(--muted)] hover:text-white hover:border-[var(--cyan)]'
                          }`}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* System Prompt Editor */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
                        System Prompt (Direct Context Injected into AI Calls)
                      </label>
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        {personaSystemPrompt.length} chars • ~{Math.round(personaSystemPrompt.length / 4)} tokens
                      </span>
                    </div>
                    <textarea 
                      value={personaSystemPrompt} 
                      onChange={e => setPersonaSystemPrompt(e.target.value)} 
                      rows={8}
                      className="w-full bg-black/60 border border-[var(--line)] rounded-lg p-3 text-white text-xs font-mono leading-relaxed focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan)] outline-none resize-y" 
                      placeholder="Define the exact persona, tone, rules, and boundaries for this agent..." 
                    />
                  </div>

                  {/* Save Status Banner */}
                  {personaSavedNotice && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-mono flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>Persona configuration for <strong>{AGENTS[selectedAgentForPersona].name}</strong> saved and activated!</span>
                    </div>
                  )}

                  {/* Persona Live Test Section */}
                  <div className="p-3 bg-black/40 border border-[var(--line)] rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] font-mono">
                        Live Persona Test Run
                      </span>
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        Active Model: {profiles.find(p => p.id === activeProfileId)?.model || 'Default Studio'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={testPromptInput}
                        onChange={e => setTestPromptInput(e.target.value)}
                        className="flex-1 bg-black/60 border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:border-[var(--cyan)] outline-none"
                        placeholder="Type a test query..."
                      />
                      <button
                        type="button"
                        onClick={handleTestPersonaPrompt}
                        disabled={testingPersona || !personaSystemPrompt.trim()}
                        className="px-3 py-1.5 bg-[var(--cyan)]/15 border border-[var(--cyan)] hover:bg-[var(--cyan)] hover:text-black text-[var(--cyan)] text-xs font-mono font-bold rounded-lg transition-all disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        {testingPersona ? 'Testing...' : 'Test Persona'}
                      </button>
                    </div>

                    {personaTestOutput && (
                      <div className="p-2.5 bg-black/80 border border-[var(--cyan)]/40 rounded-lg text-xs font-mono text-[var(--ink)] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        <div className="text-[10px] text-[var(--cyan)] font-bold mb-1">
                          {AGENTS[selectedAgentForPersona].name} ({personaRoleTitle}):
                        </div>
                        {personaTestOutput}
                      </div>
                    )}
                  </div>

                  {/* Save Persona Button */}
                  <div className="pt-2 flex gap-3 items-center">
                    <button 
                      type="button"
                      id="save-persona-btn"
                      onClick={handleSaveCurrentPersona}
                      disabled={!personaRoleTitle.trim() || !personaSystemPrompt.trim()}
                      className="flex-1 bg-[var(--cyan)] text-black font-bold py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider disabled:opacity-40 hover:bg-white transition-all shadow-[0_0_15px_rgba(53,242,223,0.3)] cursor-pointer"
                    >
                      Save & Activate {AGENTS[selectedAgentForPersona].name} Persona
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
