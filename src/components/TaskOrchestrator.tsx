import React, { useState, useEffect } from 'react';

export interface SubAgentNode {
  id: string;
  agentId: string;
  name: string;
  glyph: string;
  role: string;
  status: 'pending' | 'working' | 'completed' | 'failed';
  progress: number;
  actionText: string;
  children?: SubAgentNode[];
}

export interface BackgroundTask {
  id: string;
  title: string;
  parentAgent: string;
  status: 'pending' | 'working' | 'completed' | 'failed';
  overallProgress: number;
  tree: SubAgentNode;
  createdAt: string;
  deliverable?: {
    summary: string;
    outputDetails: string;
    apisUsed: string[];
  };
}

export function TaskOrchestrator({
  open,
  onClose,
  onDeliverMessage,
  tasks,
  setTasks,
  activeTaskId,
  setActiveTaskId
}: {
  open: boolean;
  onClose: () => void;
  onDeliverMessage: (agentId: string, text: string) => void;
  tasks: BackgroundTask[];
  setTasks: React.Dispatch<React.SetStateAction<BackgroundTask[]>>;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<SubAgentNode | null>(null);

  // Form states to create a new orchestrated task
  const [showCreator, setShowCreator] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [leaderAgent, setLeaderAgent] = useState('sam');
  const [selectedSubAgents, setSelectedSubAgents] = useState<string[]>(['sage', 'forge', 'gemini']);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    // Build hierarchical visual tree based on selection
    const subNodes: SubAgentNode[] = selectedSubAgents.map((id, index) => {
      const glyph = id === 'sage' ? '🧙' : id === 'forge' ? '🔨' : id === 'gemini' ? '✨' : id === 'questioner' ? '❓' : '🤖';
      const name = id.toUpperCase();
      const role = id === 'sage' ? 'The Archivist' : id === 'forge' ? 'The Builder' : id === 'gemini' ? 'Reasoning Specialist' : 'Specialist';
      
      // Some nodes can have deep children
      const leafNode: SubAgentNode[] = [];
      if (id === 'sage') {
        leafNode.push({
          id: `leaf-${id}-${Date.now()}`,
          agentId: 'gemini',
          name: 'GEMINI RAW API',
          glyph: '⚙️',
          role: 'Workspace Context Engine',
          status: 'pending',
          progress: 0,
          actionText: 'Awaiting search tokens to fetch Workspace emails'
        });
      }

      return {
        id: `node-${id}-${Date.now()}`,
        agentId: id,
        name,
        glyph,
        role,
        status: 'pending',
        progress: 0,
        actionText: `Working on delegated action for: ${taskTitle}`,
        children: leafNode.length > 0 ? leafNode : undefined
      };
    });

    const newTask: BackgroundTask = {
      id: `task-${Date.now()}`,
      title: taskTitle,
      parentAgent: leaderAgent,
      status: 'working',
      overallProgress: 0,
      createdAt: new Date().toLocaleTimeString(),
      tree: {
        id: `node-lead-${Date.now()}`,
        agentId: leaderAgent,
        name: leaderAgent.toUpperCase(),
        glyph: '👤',
        role: 'Orchestration Leader',
        status: 'working',
        progress: 5,
        actionText: 'Decomposing task and delegating sub-queries to Workspace peer APIs',
        children: subNodes
      }
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setTaskTitle('');
    setShowCreator(false);
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);

  const toggleSubAgentSelection = (id: string) => {
    setSelectedSubAgents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Render a visual node in the tree with lines linking them
  const renderTreeNode = (node: SubAgentNode, depth = 0) => {
    const statusColors = {
      pending: 'bg-slate-800 border-slate-700 text-slate-500',
      working: 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(53,242,223,0.15)] animate-pulse',
      completed: 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400',
      failed: 'bg-rose-950/40 border-rose-500/60 text-rose-400'
    };

    return (
      <div key={node.id} className="flex flex-col items-center relative z-10 my-4">
        {/* Visual Connector Line above children */}
        {depth > 0 && (
          <div className="w-0.5 h-6 bg-[var(--line)] -translate-y-4"></div>
        )}

        {/* Node Card */}
        <div
          className={`px-4 py-3 rounded-xl border flex flex-col w-[230px] text-center cursor-pointer transition-all ${statusColors[node.status]} ${selectedNode?.id === node.id ? 'ring-2 ring-[var(--cyan)] scale-105' : 'hover:scale-102'}`}
          onClick={() => setSelectedNode(node)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-lg">{node.glyph}</span>
            <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">{node.name}</span>
            <span className="text-[10px] font-mono font-bold">{node.progress}%</span>
          </div>
          <div className="text-[11px] font-bold text-white truncate">{node.role}</div>
          <p className="text-[10px] text-[var(--muted)] truncate mt-1">{node.actionText}</p>

          {/* Individual progress bar */}
          <div className="w-full bg-black/30 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[var(--cyan)] h-full transition-all duration-500"
              style={{ width: `${node.progress}%` }}
            ></div>
          </div>
        </div>

        {/* Render Children Horizontal Flow */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col items-center w-full mt-4">
            {/* Visual branching connector horizontal line */}
            <div className="w-0.5 h-6 bg-[var(--line)]"></div>
            <div className="relative flex justify-center gap-6 w-full px-4">
              {node.children.length > 1 && (
                <div className="absolute top-0 left-12 right-12 h-0.5 bg-[var(--line)]"></div>
              )}
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-6xl h-[90vh] bg-[#0c1618] border border-[var(--line)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--ink)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl">
              🌿
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Task Orchestrator & Sub-agent Trees
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                  MULTIPLE APIS
                </span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Spawn workflows, run background agents, and visualize hierarchical sub-agent tree delegation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--cyan)] text-black rounded-lg hover:opacity-95 transition-opacity"
              onClick={() => setShowCreator(true)}
            >
              + Spawn New Tree
            </button>
            <button
              className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white flex items-center justify-center text-sm font-bold"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Tasks History / List */}
          <div className="w-[300px] border-r border-[var(--line)] flex flex-col bg-[var(--bg)] shrink-0">
            <div className="p-3 border-b border-[var(--line)] bg-[var(--panel)]">
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--muted)]">Active Orchestrations</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
              {tasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--muted)]">No active orchestrations found. Spawn a tree!</div>
              ) : (
                tasks.map(t => (
                  <div
                    key={t.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-white/5 ${activeTaskId === t.id ? 'bg-[rgba(53,242,223,0.06)] border-l-2 border-[var(--cyan)]' : ''}`}
                    onClick={() => {
                      setActiveTaskId(t.id);
                      setSelectedNode(null);
                    }}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white line-clamp-1">{t.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400 animate-pulse'}`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mb-2">
                      <span>Leader: {t.parentAgent.toUpperCase()}</span>
                      <span>{t.createdAt}</span>
                    </div>

                    {/* Overall progress bar */}
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${t.status === 'completed' ? 'bg-emerald-400' : 'bg-[var(--cyan)]'}`}
                        style={{ width: `${t.overallProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-[9px] text-[var(--muted)] text-right mt-1 font-mono">{t.overallProgress}% Progress</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Interactive Tree Visualizer */}
          <div className="flex-1 flex flex-col bg-[var(--panel)] overflow-hidden">
            {activeTask ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Visualizer Status Header */}
                <div className="p-4 bg-[var(--bg)] border-b border-[var(--line)] flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {activeTask.title}
                    </h3>
                    <p className="text-[10px] text-[var(--muted)]">
                      Spawning peer sub-agents. Click on any node in the tree below to inspect private logs & memory workspace.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-300 block">Overall Progress</span>
                    <span className="text-lg font-mono font-bold text-[var(--cyan)]">{activeTask.overallProgress}%</span>
                  </div>
                </div>

                {/* The Tree Canvas area */}
                <div className="flex-1 overflow-auto p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-950/20 via-[#0c1618] to-[#080d0e] flex justify-center items-start min-h-0">
                  <div className="flex flex-col items-center">
                    {renderTreeNode(activeTask.tree)}
                  </div>
                </div>

                {/* Bottom Panel: Interactive inspector or completed deliverable */}
                {selectedNode && (
                  <div className="h-[180px] shrink-0 border-t border-[var(--line)] bg-[var(--bg)] p-4 flex gap-4 overflow-hidden">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-2xl flex items-center justify-center shrink-0">
                      {selectedNode.glyph}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold text-white">{selectedNode.name} Inspector</span>
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.2 bg-white/5 rounded text-[var(--cyan)]">
                          {selectedNode.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-serif leading-relaxed mb-2 italic">
                        "{selectedNode.actionText}"
                      </p>
                      
                      {/* Simulated private workspace log */}
                      <div className="bg-black/40 p-2 rounded border border-[var(--line)] font-mono text-[10px] text-slate-400 space-y-1">
                        <div>[Workspace Thread: {selectedNode.id}] Instantiating sub-agent routine.</div>
                        <div>[Consensus Engine] Syncing tokens via Gemini model context routing...</div>
                        {selectedNode.status === 'completed' && (
                          <div className="text-emerald-400 font-bold">[Success] Processed result saved into active session.</div>
                        )}
                        {selectedNode.status === 'working' && (
                          <div className="text-[var(--cyan)] font-bold animate-pulse">[Active] Resolving background request...</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* If completed, show deliverables and give message deliver option */}
                {activeTask.status === 'completed' && activeTask.deliverable && !selectedNode && (
                  <div className="shrink-0 border-t border-[var(--line)] bg-emerald-950/10 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                        <span>🎉</span> Orchestration Complete & Deliverable Ready!
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">{activeTask.deliverable.summary}</p>
                      <pre className="text-[10px] text-slate-400 mt-2 bg-black/20 p-2.5 rounded border border-emerald-500/20 leading-relaxed">
                        {activeTask.deliverable.outputDetails}
                      </pre>
                    </div>

                    <button
                      className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors shrink-0"
                      onClick={() => {
                        if (activeTask.deliverable) {
                          onDeliverMessage(
                            activeTask.parentAgent,
                            `### 🌿 Orchestrated Deliverable: ${activeTask.title}\n\n**Summary:**\n${activeTask.deliverable.summary}\n\n**Details:**\n${activeTask.deliverable.outputDetails}\n\n*APIs Successfully Invoked:* ${activeTask.deliverable.apisUsed.join(', ')}`
                          );
                          onClose();
                        }
                      }}
                    >
                      Deliver Work to Roundtable
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--muted)]">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-[var(--line)] flex items-center justify-center text-2xl mb-3">
                  🌿
                </div>
                <p className="text-xs">Select or spawn an orchestrated tree orchestration on the left sidebar.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Spawn New Tree Creator Dialog */}
      {showCreator && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-lg bg-[#0e1e21] border border-[var(--line)] rounded-2xl shadow-2xl p-6 text-[var(--ink)]"
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--line)]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🌿</span> Decompose & Spawn Sub-agent Tree
              </h3>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-white font-bold text-sm"
                onClick={() => setShowCreator(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-1">Target Task Description</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 bg-black/20 border border-[var(--line)] rounded-lg text-white text-xs outline-none focus:border-[var(--cyan)]"
                  placeholder="e.g. Audit inbox for deadline alerts and schedule review"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-1">Parent Orchestration Leader</label>
                <select
                  className="w-full p-2.5 bg-[#0a1415] border border-[var(--line)] rounded-lg text-white text-xs outline-none focus:border-[var(--cyan)]"
                  value={leaderAgent}
                  onChange={e => setLeaderAgent(e.target.value)}
                >
                  <option value="sam">SAM (Personal AI Secretary)</option>
                  <option value="prometheus">PROMETHEUS (Synthesizer)</option>
                  <option value="gemini">GEMINI (Intelligence Host)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--muted)] uppercase font-mono mb-2">Select Sub-agents for Peer APIs Consensus</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'sage', name: '🧙 SAGE (The Archivist)' },
                    { id: 'forge', name: '🔨 FORGE (The Builder)' },
                    { id: 'gemini', name: '✨ GEMINI (Reasoning)' },
                    { id: 'questioner', name: '❓ QUESTIONER (Socratic)' }
                  ].map(agent => (
                    <div
                      key={agent.id}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                        selectedSubAgents.includes(agent.id)
                          ? 'border-[var(--cyan)] bg-[rgba(53,242,223,0.06)] text-white'
                          : 'border-[var(--line)] bg-black/10 text-slate-400 hover:text-slate-200'
                      }`}
                      onClick={() => toggleSubAgentSelection(agent.id)}
                    >
                      {agent.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-xs text-[var(--muted)] hover:text-white"
                  onClick={() => setShowCreator(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-[var(--cyan)] text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Decompose & Run Background
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
