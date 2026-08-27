import React, { useState, useEffect } from 'react';
import { 
  CustomAgentConfig, 
  TrainingModule, 
  BenchmarkEvaluation, 
  TokenOptimizationResult,
  AgentKey,
  AgentPersona,
  AGENTS,
  ORDER
} from '../types';
import { 
  getCustomAgents, 
  saveCustomAgent, 
  deleteCustomAgent, 
  addTrainingModule, 
  addBenchmarkEvaluation,
  initDefaultTemplates,
  apiForgeAgent,
  apiTrainAgent,
  apiSimulateEval,
  apiOptimizeTokens
} from '../lib/agentBuilderStore';

type BuilderTab = 'forge' | 'trainer' | 'evaluator' | 'optimizer' | 'library';

interface AgentBuilderModalProps {
  open: boolean;
  onClose: () => void;
  personas: Record<AgentKey, AgentPersona>;
  onUpdatePersonas: (personas: Record<AgentKey, AgentPersona>) => void;
  activeProfile?: any;
  onSelectAgentSeat?: (seatKey: AgentKey, customAgent: CustomAgentConfig) => void;
}

export function AgentBuilderModal({
  open,
  onClose,
  personas,
  onUpdatePersonas,
  activeProfile,
  onSelectAgentSeat
}: AgentBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<BuilderTab>('forge');
  const [agents, setAgents] = useState<CustomAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  
  // Forge / Creator state
  const [forgeGoal, setForgeGoal] = useState('');
  const [forgeAuthor, setForgeAuthor] = useState<'forge' | 'prometheus' | 'sage' | 'gemini' | 'user'>('forge');
  const [forgeCapabilitiesHint, setForgeCapabilitiesHint] = useState('');
  const [isForging, setIsForging] = useState(false);
  const [forgeError, setForgeError] = useState<string | null>(null);

  // Manual Agent Form
  const [editingAgent, setEditingAgent] = useState<CustomAgentConfig>({
    id: '',
    name: 'Jarvis',
    roleTitle: 'Autonomous Systems Architect',
    glyph: '⚙',
    color: 'var(--cyan)',
    intro: 'I am Jarvis, Autonomous Systems Architect. I orchestrate complex distributed workflows.',
    systemPrompt: '',
    capabilities: ['Multi-Agent Architecture', 'Workflow Decomposition'],
    trainingModules: [],
    author: 'forge',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isCustom: true
  });
  const [newCapabilityInput, setNewCapabilityInput] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Trainer AI State
  const [trainSubject, setTrainSubject] = useState('');
  const [trainFocusTopics, setTrainFocusTopics] = useState('');
  const [trainCustomNotes, setTrainCustomNotes] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [generatedModule, setGeneratedModule] = useState<TrainingModule | null>(null);

  // Evaluator & Benchmark State
  const [evalTestPrompt, setEvalTestPrompt] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<BenchmarkEvaluation | null>(null);

  // Token Optimizer State
  const [optimizerPromptInput, setOptimizerPromptInput] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<TokenOptimizationResult | null>(null);

  // Deploy Target State
  const [deployTargetSeat, setDeployTargetSeat] = useState<AgentKey>('forge');
  const [deployNotice, setDeployNotice] = useState<string | null>(null);

  // Load custom agents from storage
  useEffect(() => {
    if (open) {
      const loaded = getCustomAgents();
      setAgents(loaded);
      if (loaded.length > 0) {
        setSelectedAgentId(loaded[0].id);
        setEditingAgent(loaded[0]);
        setOptimizerPromptInput(loaded[0].systemPrompt);
      }
      setForgeError(null);
      setTrainError(null);
      setEvalError(null);
      setOptimizerError(null);
    }
  }, [open]);

  // When selected agent changes, sync state
  const handleSelectAgent = (agent: CustomAgentConfig) => {
    setSelectedAgentId(agent.id);
    setEditingAgent(agent);
    setOptimizerPromptInput(agent.systemPrompt);
    setGeneratedModule(null);
    setCurrentEvaluation(null);
    setOptimizationResult(null);
  };

  // FORGE AGENT ACTION (AI GENERATION)
  const handleForgeAgent = async () => {
    if (!forgeGoal.trim()) {
      setForgeError('Please describe the mission, goal, or domain of the agent you want to build.');
      return;
    }

    setIsForging(true);
    setForgeError(null);

    try {
      const res = await apiForgeAgent({
        goal: forgeGoal.trim(),
        authorPersona: forgeAuthor,
        capabilitiesHint: forgeCapabilitiesHint.trim(),
        profile: activeProfile
      });

      if (res.agent) {
        const newId = `agent-${Date.now()}`;
        const forged: CustomAgentConfig = {
          id: newId,
          name: res.agent.name || 'NewAgent',
          roleTitle: res.agent.roleTitle || 'Specialized AI Executive',
          glyph: res.agent.glyph || '✦',
          color: res.agent.color || 'var(--cyan)',
          intro: res.agent.intro || `I am ${res.agent.name}. Ready for deployment.`,
          systemPrompt: res.agent.systemPrompt || '',
          capabilities: res.agent.capabilities || ['Autonomous Execution'],
          trainingModules: [],
          author: forgeAuthor,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isCustom: true
        };

        const updatedList = saveCustomAgent(forged);
        setAgents(updatedList);
        setSelectedAgentId(newId);
        setEditingAgent(forged);
        setOptimizerPromptInput(forged.systemPrompt);
        setForgeGoal('');
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 3000);
      }
    } catch (err: any) {
      console.error('Forge Agent failed:', err);
      setForgeError(err.message || 'Failed to forge agent.');
    } finally {
      setIsForging(false);
    }
  };

  // SAVE CURRENT EDITING AGENT
  const handleSaveEditingAgent = () => {
    if (!editingAgent.name.trim()) return;
    const target: CustomAgentConfig = {
      ...editingAgent,
      id: editingAgent.id || `agent-${Date.now()}`,
      updatedAt: Date.now()
    };
    const updatedList = saveCustomAgent(target);
    setAgents(updatedList);
    setSelectedAgentId(target.id);
    setEditingAgent(target);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // SAVE & ADD TO ROUND TABLE
  const handleSaveAndAddToRoundTable = (seat: AgentKey, targetAgent?: CustomAgentConfig) => {
    const agent = targetAgent || editingAgent;
    if (!agent.name.trim()) return;

    const agentId = agent.id || `agent-${Date.now()}`;
    const target: CustomAgentConfig = {
      ...agent,
      id: agentId,
      updatedAt: Date.now()
    };

    // 1. Save agent to custom agents list
    const updatedList = saveCustomAgent(target);
    setAgents(updatedList);
    setSelectedAgentId(target.id);
    setEditingAgent(target);

    // 2. Add to Round Table seat (or register as new seat)
    const seatKey = (seat === 'new_seat' || !seat) ? target.id : seat;

    const updatedPersonas = {
      ...personas,
      [seatKey]: {
        roleTitle: target.roleTitle,
        systemPrompt: target.systemPrompt,
        customIntro: target.intro,
        lastUpdated: Date.now()
      }
    };

    onUpdatePersonas(updatedPersonas);
    if (onSelectAgentSeat) {
      onSelectAgentSeat(seatKey, target);
    }

    const seatName = AGENTS[seatKey]?.name || target.name;
    setDeployNotice(`Saved & Added ${target.name} to Round Table (${seatKey === target.id ? 'Dedicated Own Seat' : seatName + ' Seat'})`);
    setTimeout(() => setDeployNotice(null), 4000);
  };

  // DELETE AGENT
  const handleDeleteAgent = (id: string) => {
    const updated = deleteCustomAgent(id);
    setAgents(updated);
    if (updated.length > 0) {
      handleSelectAgent(updated[0]);
    } else {
      const fresh = initDefaultTemplates();
      setAgents(fresh);
      handleSelectAgent(fresh[0]);
    }
  };

  // ADD CAPABILITY TAG
  const handleAddCapability = () => {
    if (!newCapabilityInput.trim()) return;
    setEditingAgent({
      ...editingAgent,
      capabilities: [...(editingAgent.capabilities || []), newCapabilityInput.trim()]
    });
    setNewCapabilityInput('');
  };

  const handleRemoveCapability = (idx: number) => {
    const updated = [...editingAgent.capabilities];
    updated.splice(idx, 1);
    setEditingAgent({ ...editingAgent, capabilities: updated });
  };

  // TRAINER AI: TRAIN AGENT ON SUBJECT
  const handleTrainAgent = async () => {
    if (!trainSubject.trim()) {
      setTrainError('Please specify a training subject or domain (e.g. Distributed Caching, Threat Modeling).');
      return;
    }

    setIsTraining(true);
    setTrainError(null);

    try {
      const res = await apiTrainAgent({
        agentName: editingAgent.name,
        roleTitle: editingAgent.roleTitle,
        currentSystemPrompt: editingAgent.systemPrompt,
        subject: trainSubject.trim(),
        focusTopics: trainFocusTopics.trim(),
        customNotes: trainCustomNotes.trim(),
        profile: activeProfile
      });

      if (res.module) {
        const fullModule: TrainingModule = {
          ...res.module,
          id: `mod-${Date.now()}`,
          createdAt: Date.now()
        };

        setGeneratedModule(fullModule);
      }
    } catch (err: any) {
      console.error('Trainer AI failed:', err);
      setTrainError(err.message || 'Failed to generate training curriculum.');
    } finally {
      setIsTraining(false);
    }
  };

  // APPLY GENERATED TRAINING MODULE TO AGENT
  const handleApplyTrainingModule = () => {
    if (!generatedModule || !editingAgent) return;

    const updatedPrompt = generatedModule.updatedSystemPrompt || editingAgent.systemPrompt;
    const updatedAgent: CustomAgentConfig = {
      ...editingAgent,
      systemPrompt: updatedPrompt,
      capabilities: Array.from(new Set([...editingAgent.capabilities, generatedModule.targetCapability || generatedModule.subject]))
    };

    const saved = addTrainingModule(editingAgent.id, generatedModule);
    if (saved) {
      setEditingAgent({ ...saved, systemPrompt: updatedPrompt });
      const currentAgents = getCustomAgents();
      setAgents(currentAgents);
    } else {
      handleSaveEditingAgent();
    }

    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // RUN SIMULATOR EVALUATION
  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setEvalError(null);

    try {
      const res = await apiSimulateEval({
        agentName: editingAgent.name,
        roleTitle: editingAgent.roleTitle,
        systemPrompt: editingAgent.systemPrompt,
        subject: trainSubject || editingAgent.capabilities[0] || 'General Task Execution',
        testPrompt: evalTestPrompt.trim() || undefined,
        profile: activeProfile
      });

      if (res.evaluation) {
        const fullEval: BenchmarkEvaluation = {
          ...res.evaluation,
          id: `eval-${Date.now()}`,
          agentId: editingAgent.id,
          evaluatorModel: activeProfile?.model || 'Trainer AI Evaluator',
          createdAt: Date.now()
        };

        setCurrentEvaluation(fullEval);
        addBenchmarkEvaluation(editingAgent.id, fullEval);
        const currentAgents = getCustomAgents();
        setAgents(currentAgents);
      }
    } catch (err: any) {
      console.error('Evaluation failed:', err);
      setEvalError(err.message || 'Failed to complete benchmark evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // APPLY EVALUATOR PROMPT PATCH
  const handleApplyEvalPatch = () => {
    if (!currentEvaluation?.recommendedPatch || !editingAgent) return;

    const patch = `\n\n<evaluator_correction_rule>\n${currentEvaluation.recommendedPatch}\n</evaluator_correction_rule>`;
    const updatedPrompt = editingAgent.systemPrompt + patch;
    
    const updatedAgent = {
      ...editingAgent,
      systemPrompt: updatedPrompt
    };

    setEditingAgent(updatedAgent);
    saveCustomAgent(updatedAgent);
    const currentAgents = getCustomAgents();
    setAgents(currentAgents);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // TOKEN OPTIMIZATION COMPILER
  const handleOptimizeTokens = async () => {
    const promptToOptimize = optimizerPromptInput.trim() || editingAgent.systemPrompt.trim();
    if (!promptToOptimize) {
      setOptimizerError('No system prompt provided for token optimization.');
      return;
    }

    setIsOptimizing(true);
    setOptimizerError(null);

    try {
      const res = await apiOptimizeTokens({
        prompt: promptToOptimize,
        profile: activeProfile
      });

      if (res.optimization) {
        setOptimizationResult(res.optimization);
      }
    } catch (err: any) {
      console.error('Token optimization failed:', err);
      setOptimizerError(err.message || 'Failed to optimize tokens.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // APPLY OPTIMIZED PROMPT
  const handleApplyOptimizedPrompt = () => {
    if (!optimizationResult?.optimizedPrompt) return;

    const updatedAgent: CustomAgentConfig = {
      ...editingAgent,
      systemPrompt: optimizationResult.optimizedPrompt,
      optimizedPrompt: optimizationResult.optimizedPrompt,
      tokenCount: optimizationResult.optimizedTokens
    };

    setEditingAgent(updatedAgent);
    saveCustomAgent(updatedAgent);
    const currentAgents = getCustomAgents();
    setAgents(currentAgents);
    setOptimizerPromptInput(optimizationResult.optimizedPrompt);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // DEPLOY AGENT TO BOARDROOM SEAT
  const handleDeployToBoardroom = (seat: AgentKey) => {
    const updatedPersonas = {
      ...personas,
      [seat]: {
        roleTitle: editingAgent.roleTitle,
        systemPrompt: editingAgent.systemPrompt,
        customIntro: editingAgent.intro,
        lastUpdated: Date.now()
      }
    };

    onUpdatePersonas(updatedPersonas);
    if (onSelectAgentSeat) {
      onSelectAgentSeat(seat, editingAgent);
    }

    setDeployNotice(`Deployed ${editingAgent.name} to the ${AGENTS[seat].name} seat (${editingAgent.roleTitle})`);
    setTimeout(() => setDeployNotice(null), 4000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-6xl h-[92vh] max-h-[920px] flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-2xl overflow-hidden text-[var(--ink)]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(53, 242, 223, 0.08)'
        }}
      >
        {/* TOP BAR */}
        <header className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg"
              style={{ 
                color: editingAgent.color || 'var(--cyan)', 
                border: `1px solid ${editingAgent.color || 'var(--cyan)'}`, 
                background: 'rgba(53,242,223,0.06)' 
              }}
            >
              {editingAgent.glyph || '⚙'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>AI Builder & Trainer Engine</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    Agent Forge + Pedagogy
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[var(--muted)] truncate">
                Build, train, benchmark, and optimize autonomous agents & boardroom executives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccessNotice && (
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-medium animate-in fade-in">
                ✓ Changes Saved
              </span>
            )}
            {deployNotice && (
              <span className="text-xs px-2.5 py-1 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-medium animate-in fade-in">
                ✓ {deployNotice}
              </span>
            )}
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent hover:border-[var(--line)] transition-colors"
              title="Close Builder"
            >
              ✕
            </button>
          </div>
        </header>

        {/* NAVIGATION TABS */}
        <div className="px-5 py-2.5 border-b border-[var(--line)] bg-slate-900/30 flex items-center justify-between overflow-x-auto gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => setActiveTab('forge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'forge'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>🔨</span>
              <span>Agent Forge & Spec</span>
            </button>

            <button
              onClick={() => setActiveTab('trainer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'trainer'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>🎓</span>
              <span>Trainer AI Studio</span>
              {editingAgent.trainingModules?.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900/60 text-purple-200">
                  {editingAgent.trainingModules.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('evaluator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'evaluator'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>⚖</span>
              <span>Benchmark & Simulator</span>
              {editingAgent.benchmarks?.length ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-900/60 text-amber-200">
                  {editingAgent.benchmarks.length}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab('optimizer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'optimizer'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>⚡</span>
              <span>Token Optimizer</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-[var(--muted)] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>📚</span>
              <span>Agent Library ({agents.length})</span>
            </button>
          </div>

          {/* QUICK DEPLOY SELECTOR */}
          <div className="flex items-center gap-2 min-w-max pl-4 border-l border-[var(--line)]">
            <span className="text-[11px] text-[var(--muted)] hidden md:inline">Round Table Seat:</span>
            <select
              value={deployTargetSeat}
              onChange={(e) => setDeployTargetSeat(e.target.value as AgentKey)}
              aria-label="Deploy target seat"
              className="bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-2 py-1 outline-none"
            >
              <option value={editingAgent.id || 'new_seat'}>
                ✨ Own Dedicated Seat ({editingAgent.name || 'Current Agent'})
              </option>
              {ORDER.map((key) => (
                <option key={key} value={key}>
                  Replace Seat: {AGENTS[key].name} ({personas[key]?.roleTitle || AGENTS[key].role})
                </option>
              ))}
            </select>
            <button
              onClick={() => handleSaveAndAddToRoundTable(deployTargetSeat)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <span>🪑 Add to Round Table</span>
            </button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* LEFT SIDEBAR: AGENT SELECTOR */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--line)] bg-slate-950/40 flex flex-col shrink-0 overflow-y-auto max-h-48 md:max-h-none">
            <div className="p-3 border-b border-[var(--line)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Active Agents</span>
              <button
                onClick={() => {
                  const newAgent: CustomAgentConfig = {
                    id: `agent-${Date.now()}`,
                    name: 'New Agent',
                    roleTitle: 'Specialized Consultant',
                    glyph: '✦',
                    color: 'var(--cyan)',
                    intro: 'I am a newly forged specialized agent.',
                    systemPrompt: '<role_definition>\nYou are a specialized AI agent.\n</role_definition>',
                    capabilities: ['Domain Problem Solving'],
                    trainingModules: [],
                    author: 'user',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    isCustom: true
                  };
                  const updated = saveCustomAgent(newAgent);
                  setAgents(updated);
                  handleSelectAgent(newAgent);
                  setActiveTab('forge');
                }}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30"
              >
                + New
              </button>
            </div>

            <div className="p-2 space-y-1 overflow-y-auto flex-1">
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/40 text-white shadow-sm'
                        : 'border-transparent hover:bg-white/5 text-[var(--ink)]'
                    }`}
                  >
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ 
                        color: agent.color || 'var(--cyan)', 
                        border: `1px solid ${agent.color || 'var(--cyan)'}`,
                        background: 'rgba(255,255,255,0.03)'
                      }}
                    >
                      {agent.glyph || '⚙'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        {agent.author !== 'user' && (
                          <span className="text-[9px] px-1 rounded bg-slate-800 text-[var(--muted)] font-mono">
                            {agent.author}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--muted)] truncate font-mono">
                        {agent.roleTitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT VIEW: TAB PANELS */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/20">
            {/* TAB 1: FORGE & SPEC */}
            {activeTab === 'forge' && (
              <div className="space-y-6 max-w-4xl">
                {/* AI FORGE GENERATOR BLOCK */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950/80 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✨</span>
                      <h3 className="text-sm font-bold text-white">AI Autonomous Agent Forge</h3>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/20">
                      Context-Engineered Meta-Compiler
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Describe what you want this agent to accomplish. An AI Architect (Forge, Prometheus, or Sage) will context-engineer the complete agent specification, XML system prompt, heuristics, and domain capabilities.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Agent Goal / Mission / Role Description
                      </label>
                      <input
                        type="text"
                        value={forgeGoal}
                        onChange={(e) => setForgeGoal(e.target.value)}
                        placeholder="e.g. Build an Autonomous SRE that monitors Kubernetes nodes, traces gRPC anomalies, and generates post-mortems..."
                        className="w-full bg-slate-900/90 border border-[var(--line)] focus:border-cyan-400 text-xs text-white rounded-lg px-3 py-2 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Creator Architect
                      </label>
                      <select
                        value={forgeAuthor}
                        onChange={(e) => setForgeAuthor(e.target.value as any)}
                        aria-label="Creator architect"
                        className="w-full bg-slate-900/90 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none"
                      >
                        <option value="forge">Forge (CTO / Engineer)</option>
                        <option value="prometheus">Prometheus (CEO / Orch)</option>
                        <option value="sage">Sage (CSO / Strategist)</option>
                        <option value="gemini">Gemini (COO / Omni)</option>
                        <option value="user">User (Direct Spec)</option>
                      </select>
                    </div>
                  </div>

                  {forgeError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
                      {forgeError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--muted)]">
                      Outputs structured XML prompts with zero conversational filler
                    </span>
                    <button
                      onClick={handleForgeAgent}
                      disabled={isForging}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isForging ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Synthesizing Agent...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Forge Agent</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* MANUAL SPEC & PERSONA EDITOR */}
                <div className="p-5 rounded-xl bg-slate-900/40 border border-[var(--line)] space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>⚙</span>
                      <span>Agent Specification & Context Blueprint</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSaveEditingAgent}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>💾 Save Agent</span>
                      </button>

                      <div className="flex items-center gap-1 bg-cyan-950/70 p-1 rounded-lg border border-cyan-500/40">
                        <button
                          onClick={() => handleSaveAndAddToRoundTable(deployTargetSeat)}
                          className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <span>🪑 Save & Add to Round Table</span>
                        </button>
                        <select
                          value={deployTargetSeat}
                          onChange={(e) => setDeployTargetSeat(e.target.value as AgentKey)}
                          aria-label="Target seat for Round Table"
                          className="bg-slate-900 border border-cyan-500/30 text-[11px] text-cyan-200 rounded px-1.5 py-1 outline-none font-semibold cursor-pointer"
                        >
                          {ORDER.map((key) => (
                            <option key={key} value={key}>
                              Seat: {AGENTS[key].name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleDeleteAgent(editingAgent.id)}
                        className="px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-500/30 text-xs transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={editingAgent.name}
                        onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                        className="w-full bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Role Title
                      </label>
                      <input
                        type="text"
                        value={editingAgent.roleTitle}
                        onChange={(e) => setEditingAgent({ ...editingAgent, roleTitle: e.target.value })}
                        className="w-full bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Glyph / Rune
                      </label>
                      <input
                        type="text"
                        value={editingAgent.glyph}
                        onChange={(e) => setEditingAgent({ ...editingAgent, glyph: e.target.value })}
                        className="w-full bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none text-center font-bold text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Theme Color
                      </label>
                      <select
                        value={editingAgent.color}
                        onChange={(e) => setEditingAgent({ ...editingAgent, color: e.target.value })}
                        aria-label="Theme color"
                        className="w-full bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none"
                      >
                        <option value="var(--cyan)">Cyan (Tech / Operations)</option>
                        <option value="var(--violet)">Violet (Research / Strategy)</option>
                        <option value="var(--amber)">Amber (Optimization / Architecture)</option>
                        <option value="var(--green)">Green (Security / Compliance)</option>
                        <option value="var(--blue)">Blue (General / Synthesis)</option>
                        <option value="var(--danger)">Red (Red-Team / Auditing)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Boardroom Introduction
                    </label>
                    <input
                      type="text"
                      value={editingAgent.intro}
                      onChange={(e) => setEditingAgent({ ...editingAgent, intro: e.target.value })}
                      className="w-full bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none"
                    />
                  </div>

                  {/* CAPABILITIES TAGS */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Domain Capabilities & Skills
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {editingAgent.capabilities?.map((cap, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs text-cyan-300 flex items-center gap-1.5"
                        >
                          <span>{cap}</span>
                          <button 
                            onClick={() => handleRemoveCapability(idx)}
                            className="text-[var(--muted)] hover:text-white"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCapabilityInput}
                        onChange={(e) => setNewCapabilityInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCapability()}
                        placeholder="Add capability (e.g. Distributed Consensus, API Hardening)..."
                        className="flex-1 bg-slate-900 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-1.5 outline-none"
                      />
                      <button
                        onClick={handleAddCapability}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* CONTEXT ENGINEERED SYSTEM PROMPT */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[var(--muted)]">
                        Context-Engineered System Prompt (XML Boundary Formatted)
                      </label>
                      <span className="text-[10px] font-mono text-[var(--muted)]">
                        ~{Math.round((editingAgent.systemPrompt?.length || 0) / 3.8)} tokens
                      </span>
                    </div>
                    <textarea
                      rows={12}
                      value={editingAgent.systemPrompt}
                      onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                      className="w-full bg-slate-950 border border-[var(--line)] text-xs text-emerald-300 font-mono rounded-lg p-3 outline-none focus:border-cyan-400 leading-relaxed"
                      placeholder="<role_definition>...</role_definition>"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TRAINER AI STUDIO */}
            {activeTab === 'trainer' && (
              <div className="space-y-6 max-w-4xl">
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/30 via-slate-900/60 to-slate-950/80 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎓</span>
                      <h3 className="text-sm font-bold text-white">Trainer AI: Agent Pedagogy & Curriculum Engine</h3>
                    </div>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/20">
                      Pedagogy Synthesizer
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Train <b>{editingAgent.name}</b> on specific subjects, tasks, or niche engineering domains. The Trainer AI will generate structured mental models, concrete decision heuristics, 3 golden few-shot exemplars, and edge-case guardrails.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Training Subject / Topic
                      </label>
                      <input
                        type="text"
                        value={trainSubject}
                        onChange={(e) => setTrainSubject(e.target.value)}
                        placeholder="e.g. Zero-Trust API Security & OAuth Token Lifecycles..."
                        className="w-full bg-slate-900/90 border border-[var(--line)] focus:border-purple-400 text-xs text-white rounded-lg px-3 py-2 outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Focus Areas & Operational Requirements (Optional)
                      </label>
                      <input
                        type="text"
                        value={trainFocusTopics}
                        onChange={(e) => setTrainFocusTopics(e.target.value)}
                        placeholder="e.g. Focus on token revocation attacks, refresh token rotation, and timing attack defenses..."
                        className="w-full bg-slate-900/90 border border-[var(--line)] text-xs text-white rounded-lg px-3 py-2 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                        Custom Reference Material, Documentation, or Internal Standards (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={trainCustomNotes}
                        onChange={(e) => setTrainCustomNotes(e.target.value)}
                        placeholder="Paste any custom docs, RFCs, or company guidelines..."
                        className="w-full bg-slate-900/90 border border-[var(--line)] text-xs text-white rounded-lg p-2 outline-none"
                      />
                    </div>
                  </div>

                  {trainError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
                      {trainError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--muted)]">
                      Synthesizes theoretical models and actionable decision heuristics
                    </span>
                    <button
                      onClick={handleTrainAgent}
                      disabled={isTraining}
                      className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isTraining ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Synthesizing Curriculum...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Start Agent Training</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* GENERATED TRAINING MODULE RESULT */}
                {generatedModule && (
                  <div className="p-5 rounded-xl bg-slate-900/50 border border-purple-500/40 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="text-purple-400">✦</span>
                          <span>{generatedModule.title}</span>
                        </h4>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{generatedModule.summary}</p>
                      </div>
                      <button
                        onClick={handleApplyTrainingModule}
                        className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <span>✓ Apply Training to {editingAgent.name}</span>
                      </button>
                    </div>

                    {/* CONCEPTS & HEURISTICS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-lg bg-slate-950 border border-[var(--line)] space-y-2">
                        <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                          Core Theoretical Concepts
                        </h5>
                        <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                          {generatedModule.concepts?.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-950 border border-[var(--line)] space-y-2">
                        <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                          Operational Decision Heuristics
                        </h5>
                        <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                          {generatedModule.heuristics?.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* FEW-SHOT GOLDEN EXEMPLARS */}
                    {generatedModule.fewShotExemplars?.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Golden Few-Shot Exemplars (Task Mastery)
                        </h5>
                        <div className="space-y-2.5">
                          {generatedModule.fewShotExemplars.map((ex, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] space-y-1.5 text-xs">
                              <div className="text-[11px] font-bold text-cyan-400 font-mono">
                                [INPUT CHALLENGE]: <span className="text-slate-200">{ex.input}</span>
                              </div>
                              <div className="text-[11px] text-emerald-300 bg-slate-900/60 p-2 rounded border border-emerald-500/20 font-mono">
                                {ex.idealOutput}
                              </div>
                              <div className="text-[10px] text-[var(--muted)] italic">
                                Rationale: {ex.reasoning}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* GUARDRAILS */}
                    {generatedModule.guardrails?.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/20 space-y-1.5 text-xs">
                        <h5 className="text-xs font-bold text-red-300 uppercase tracking-wider">
                          Edge-Case Failure Guardrails
                        </h5>
                        <ul className="space-y-1 text-slate-300 list-disc list-inside">
                          {generatedModule.guardrails.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* AGENT TRAINING HISTORY */}
                {editingAgent.trainingModules?.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-[var(--line)] space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Completed Training Modules ({editingAgent.trainingModules.length})
                    </h4>
                    <div className="space-y-2">
                      {editingAgent.trainingModules.map((mod) => (
                        <div key={mod.id} className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-purple-300">{mod.title}</div>
                            <div className="text-[10px] text-[var(--muted)]">{mod.subject} · {new Date(mod.createdAt).toLocaleDateString()}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/20">
                            Synthesized
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BENCHMARK & SIMULATOR EVALUATION */}
            {activeTab === 'evaluator' && (
              <div className="space-y-6 max-w-4xl">
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-950/80 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚖</span>
                      <h3 className="text-sm font-bold text-white">Live Benchmark & Simulator Grader</h3>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/20">
                      Chief Evaluator Rubric
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Stress-test <b>{editingAgent.name}</b> against a high-stakes scenario. The Evaluator AI will execute the prompt against the agent's context blueprint and grade reasoning, accuracy, role fidelity, and conciseness on a 0-100 rubric.
                  </p>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      Test Challenge Prompt (Leave blank to generate an autonomous challenge)
                    </label>
                    <textarea
                      rows={3}
                      value={evalTestPrompt}
                      onChange={(e) => setEvalTestPrompt(e.target.value)}
                      placeholder="e.g. A production database node is reporting 99% disk latency spike under distributed failover. Outline immediate diagnosis and remediation protocol..."
                      className="w-full bg-slate-900/90 border border-[var(--line)] text-xs text-white rounded-lg p-2.5 outline-none focus:border-amber-400"
                    />
                  </div>

                  {evalError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
                      {evalError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--muted)]">
                      Evaluates response quality across 4 rigorous technical dimensions
                    </span>
                    <button
                      onClick={handleRunEvaluation}
                      disabled={isEvaluating}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isEvaluating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Simulating & Grading...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Run Benchmark Evaluation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* CURRENT EVALUATION SCORECARD */}
                {currentEvaluation && (
                  <div className="p-5 rounded-xl bg-slate-900/50 border border-amber-500/40 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                      <div>
                        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                          Evaluation Scorecard
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{currentEvaluation.critique}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-white font-mono">
                          {currentEvaluation.overallScore}<span className="text-xs text-[var(--muted)]">/100</span>
                        </div>
                        <div className="text-[10px] text-amber-300 uppercase tracking-wider font-bold">Overall Score</div>
                      </div>
                    </div>

                    {/* 4 SCORE AXES */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Accuracy</div>
                        <div className="text-lg font-bold text-cyan-300 font-mono">{currentEvaluation.accuracyScore}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Reasoning</div>
                        <div className="text-lg font-bold text-purple-300 font-mono">{currentEvaluation.reasoningScore}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Role Fidelity</div>
                        <div className="text-lg font-bold text-emerald-300 font-mono">{currentEvaluation.roleFidelityScore}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Conciseness</div>
                        <div className="text-lg font-bold text-amber-300 font-mono">{currentEvaluation.concisenessScore}%</div>
                      </div>
                    </div>

                    {/* CHALLENGE & RESPONSE */}
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Test Challenge</span>
                        <p className="text-slate-200">{currentEvaluation.testPrompt}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] text-xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{editingAgent.name}'s Output</span>
                        <div className="text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
                          {currentEvaluation.agentResponse}
                        </div>
                      </div>
                    </div>

                    {/* STRENGTHS & WEAKNESSES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/20 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Key Strengths</span>
                        <ul className="space-y-0.5 text-slate-300 list-disc list-inside">
                          {currentEvaluation.strengths?.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/20 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Identified Weaknesses</span>
                        <ul className="space-y-0.5 text-slate-300 list-disc list-inside">
                          {currentEvaluation.weaknesses?.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* RECOMMENDED PATCH */}
                    {currentEvaluation.recommendedPatch && (
                      <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                            Recommended Context Rule Patch
                          </span>
                          <button
                            onClick={handleApplyEvalPatch}
                            className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                          >
                            + Apply Patch to Agent
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 font-mono bg-slate-950/60 p-2 rounded border border-amber-500/20">
                          {currentEvaluation.recommendedPatch}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: TOKEN OPTIMIZER & CONTEXT ENGINEER */}
            {activeTab === 'optimizer' && (
              <div className="space-y-6 max-w-4xl">
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-950/80 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <h3 className="text-sm font-bold text-white">Context Compiler & Token Optimizer</h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                      High-Density XML Compaction
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Compress verbose system prompts, eliminate conversational filler, and structure instructions into clean XML boundaries to reduce token overhead by 25-50% while improving rule adherence and reducing inference latency.
                  </p>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1">
                      System Prompt to Optimize (Defaults to {editingAgent.name})
                    </label>
                    <textarea
                      rows={6}
                      value={optimizerPromptInput}
                      onChange={(e) => setOptimizerPromptInput(e.target.value)}
                      className="w-full bg-slate-900/90 border border-[var(--line)] text-xs text-emerald-300 font-mono rounded-lg p-2.5 outline-none focus:border-emerald-400"
                    />
                  </div>

                  {optimizerError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
                      {optimizerError}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--muted)]">
                      Transforms narrative sentences into dense imperative rules
                    </span>
                    <button
                      onClick={handleOptimizeTokens}
                      disabled={isOptimizing}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isOptimizing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Compacting Tokens...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Compile & Optimize Tokens</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* OPTIMIZATION RESULTS */}
                {optimizationResult && (
                  <div className="p-5 rounded-xl bg-slate-900/50 border border-emerald-500/40 space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          <span>Optimization Complete</span>
                        </h4>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          Compressed by {optimizationResult.compressionRatio}% · Saved ~{optimizationResult.estimatedLatencyMsSavings}ms per round trip
                        </p>
                      </div>
                      <button
                        onClick={handleApplyOptimizedPrompt}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <span>✓ Apply to {editingAgent.name}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Original Tokens</div>
                        <div className="text-base font-bold text-slate-300 font-mono">
                          {optimizationResult.originalTokens}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] text-center">
                        <div className="text-[10px] text-[var(--muted)] uppercase font-semibold">Optimized Tokens</div>
                        <div className="text-base font-bold text-emerald-300 font-mono">
                          {optimizationResult.optimizedTokens}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/30 text-center bg-emerald-950/20">
                        <div className="text-[10px] text-emerald-400 uppercase font-semibold">Token Reduction</div>
                        <div className="text-base font-bold text-emerald-300 font-mono">
                          -{optimizationResult.compressionRatio}%
                        </div>
                      </div>
                    </div>

                    {/* CHANGES SUMMARY */}
                    <div className="p-3 rounded-lg bg-slate-950 border border-[var(--line)] text-xs space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        Compiler Transformations
                      </div>
                      <ul className="space-y-1 text-slate-300 list-disc list-inside">
                        {optimizationResult.changesSummary?.map((ch, i) => (
                          <li key={i}>{ch}</li>
                        ))}
                      </ul>
                    </div>

                    {/* OPTIMIZED PROMPT OUTPUT */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        Optimized Prompt Preview
                      </div>
                      <textarea
                        rows={8}
                        readOnly
                        value={optimizationResult.optimizedPrompt}
                        className="w-full bg-slate-950 border border-[var(--line)] text-xs text-emerald-300 font-mono rounded-lg p-3 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: AGENT LIBRARY */}
            {activeTab === 'library' && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Agent Directory & Blueprints</h3>
                    <p className="text-xs text-[var(--muted)]">Manage your custom built agents and specialized boardroom executives.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {agents.map((agent) => (
                    <div 
                      key={agent.id}
                      className="p-4 rounded-xl bg-slate-900/50 border border-[var(--line)] hover:border-cyan-500/40 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base"
                            style={{ 
                              color: agent.color || 'var(--cyan)', 
                              border: `1px solid ${agent.color || 'var(--cyan)'}`,
                              background: 'rgba(255,255,255,0.03)'
                            }}
                          >
                            {agent.glyph || '⚙'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              <span>{agent.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-[var(--muted)] font-mono">
                                {agent.author}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--muted)] font-mono truncate max-w-[200px]">
                              {agent.roleTitle}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleSelectAgent(agent);
                            setActiveTab('forge');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition-colors"
                        >
                          Edit
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 italic">
                        "{agent.intro}"
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities?.slice(0, 3).map((cap, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-cyan-500/20">
                            {cap}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[11px]">
                        <span className="text-[var(--muted)]">
                          {agent.trainingModules?.length || 0} Modules · {agent.benchmarks?.length || 0} Evals
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              handleSelectAgent(agent);
                              setActiveTab('trainer');
                            }}
                            className="text-purple-400 hover:underline font-semibold"
                          >
                            Train
                          </button>
                          <span className="text-[var(--muted)]">·</span>
                          <button
                            onClick={() => {
                              handleSelectAgent(agent);
                              setActiveTab('evaluator');
                            }}
                            className="text-amber-400 hover:underline font-semibold"
                          >
                            Benchmark
                          </button>
                        </div>
                      </div>

                      {/* ROUND TABLE QUICK SELECTION */}
                      <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-lg border border-cyan-500/20">
                        <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span>🪑</span> Round Table
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            id={`library-seat-select-${agent.id}`}
                            defaultValue={agent.id}
                            aria-label="Select Round Table seat"
                            className="bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-1 outline-none font-mono"
                          >
                            <option value={agent.id}>
                              ✨ Own Seat ({agent.name})
                            </option>
                            {ORDER.map((key) => (
                              <option key={key} value={key}>
                                Replace: {AGENTS[key].name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const selectEl = document.getElementById(`library-seat-select-${agent.id}`) as HTMLSelectElement;
                              const chosenSeat = (selectEl?.value || agent.id) as AgentKey;
                              handleSaveAndAddToRoundTable(chosenSeat, agent);
                            }}
                            className="px-2 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <span>+ Add to Seat</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
