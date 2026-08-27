import React, { useState, useRef, useEffect } from 'react';
import { AgentKey, AGENTS, ORDER, Message, AgentPersona, DEFAULT_AGENT_PERSONAS, BudgetSessionSummary, BudgetWatcherConfig, SpeakerState, CustomAgentConfig, getAgentConfig } from './types';
import { storage } from './storage';
import { useSpeech } from './hooks/useSpeech';
import { useTTS } from './hooks/useTTS';
import { CoreRing } from './components/CoreRing';
import { CommandDock } from './components/CommandDock';
import { LogConsole } from './components/LogConsole';
import { Sidebar } from './components/Sidebar';
import { VaultPanel } from './components/VaultPanel';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { ApiPanel, DEFAULT_PROFILES, ApiProfile } from './components/ApiPanel';
import { ProviderQuickSwitcher } from './components/ProviderQuickSwitcher';
import { AgentBuilderModal } from './components/AgentBuilderModal';
import { QrCodeModal } from './components/QrCodeModal';
import { BudgetWatcherModal } from './components/BudgetWatcherModal';
import {
  initBudgetStore,
  subscribeBudget,
  recordTokenUsage,
  calculateBudgetStatus,
  formatTokens,
  formatUsd
} from './lib/budgetStore';
import { apiForgeAgent, saveCustomAgent, getCustomAgents } from './lib/agentBuilderStore';
import { GmailPanel } from './components/GmailPanel';
import { TaskOrchestrator, BackgroundTask, SubAgentNode } from './components/TaskOrchestrator';
import { initAuth, googleSignIn, logout } from './lib/auth';
import { WiretapPanel } from './components/WiretapPanel';
import { DeviceConnector } from './components/DeviceConnector';
import { LiveBreakroomTicker } from './components/LiveBreakroomTicker';

export default function App() {
  const [booted, setBooted] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentKey>('prometheus');
  const [mode, setMode] = useState<'SINGLE' | 'ROUND TABLE'>('SINGLE');
  const [roundTableSeats, setRoundTableSeats] = useState<AgentKey[]>(ORDER);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentStates, setAgentStates] = useState<Record<AgentKey, string>>({
    prometheus: 'idle', sage: 'idle', forge: 'idle', questioner: 'idle', gemini: 'idle'
  });
  
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('prometheus_username') || 'YOU';
  });
  const [collaboratorCount, setCollaboratorCount] = useState(1);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'phone'>('desktop');
  const [breakroomMessages, setBreakroomMessages] = useState<any[]>([]);

  const handleSendBreakroomMessage = async (content: string) => {
    try {
      await fetch('/api/breakroom-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', who: userName, content })
      });
    } catch (err) {
      console.error('Failed to post breakroom message:', err);
    }
  };

  const handleClearBreakroomMessages = async () => {
    try {
      await fetch('/api/breakroom-messages/clear', { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear breakroom messages:', err);
    }
  };

  const [transcript, setTranscript] = useState('');
  const [coreState, setCoreState] = useState('');
  const [coreText, setCoreText] = useState('standby');
  const [introduced, setIntroduced] = useState<Set<AgentKey>>(new Set());

  // Personas state
  const [personas, setPersonas] = useState<Record<AgentKey, AgentPersona>>(DEFAULT_AGENT_PERSONAS);
  const [apiPanelTab, setApiPanelTab] = useState<'apis' | 'personas'>('apis');

  // Budget Watcher state
  const [budgetSummary, setBudgetSummary] = useState<BudgetSessionSummary>({
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    requestCount: 0,
    lastUpdated: Date.now(),
    history: []
  });
  const [budgetConfig, setBudgetConfig] = useState<BudgetWatcherConfig>({
    enabled: true,
    thresholdMode: 'tokens',
    tokenThreshold: 50000,
    costThresholdUsd: 0.50,
    warningPercentage: 80,
    soundAlerts: true,
    autoPauseAtLimit: false
  });
  const [dismissBudgetBanner, setDismissBudgetBanner] = useState(false);

  const [uiState, setUiState] = useState({
    sidebar: false,
    log: false,
    vault: false,
    connectors: false,
    apiConfig: false,
    builder: false,
    qrCode: false,
    budgetWatcher: false,
    gmail: false,
    orchestrator: false,
    wiretap: false,
    deviceConnector: false
  });

  const [interAgentChats, setInterAgentChats] = useState<any[]>([]);

  // Gmail user state
  const [gmailUser, setGmailUser] = useState<any>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [authErrorModal, setAuthErrorModal] = useState<boolean>(false);

  // Background task state (lifted from TaskOrchestrator)
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Execution Plan states
  const [pendingPlan, setPendingPlan] = useState<{
    goal: string;
    steps: { id: string; text: string; enabled: boolean }[];
    agentKey: AgentKey;
    originalText: string;
  } | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfileName, setActiveProfileName] = useState<string>('Server Default');
  const [activeProfileModel, setActiveProfileModel] = useState<string>('Server Default');
  const [showProviderDropdown, setShowProviderDropdown] = useState<boolean>(false);

  useEffect(() => {
    // Fetch initial logs
    fetch('/api/inter-agent-chats')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.chats)) {
          setInterAgentChats(data.chats);
        }
      })
      .catch(err => console.error('Failed to load inter-agent chats:', err));

    // Fetch initial shared messages history from collaborative backend
    fetch('/api/shared-messages')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, who: m.who, content: m.content })));
        }
      })
      .catch(err => console.error('Failed to load collaborative shared messages:', err));

    // Fetch initial breakroom messages history from collaborative backend
    fetch('/api/breakroom-messages')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.messages)) {
          setBreakroomMessages(data.messages);
        }
      })
      .catch(err => console.error('Failed to load collaborative breakroom messages:', err));

    // Subscribe to SSE backend broadcasts
    const sse = new EventSource('/api/events');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INTER_AGENT_CHAT' && data.payload?.chat) {
          setInterAgentChats(prev => {
            if (prev.some(c => c.id === data.payload.chat.id)) return prev;
            const updated = [...prev, data.payload.chat];
            if (updated.length > 150) updated.shift();
            return updated;
          });
        } else if (data.type === 'COLLABORATOR_COUNT_CHANGED') {
          setCollaboratorCount(data.payload?.count || 1);
        } else if (data.type === 'SHARED_MESSAGE' && data.payload?.message) {
          const m = data.payload.message;
          setMessages(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            return [...prev, { id: m.id, role: m.role, who: m.who, content: m.content }];
          });
        } else if (data.type === 'SHARED_MESSAGES_CLEARED' && data.payload?.messages) {
          setMessages(data.payload.messages.map((m: any) => ({ id: m.id, role: m.role, who: m.who, content: m.content })));
        } else if (data.type === 'BREAKROOM_MESSAGE' && data.payload?.message) {
          const m = data.payload.message;
          setBreakroomMessages(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            return [...prev, m];
          });
        } else if (data.type === 'BREAKROOM_MESSAGES_CLEARED' && data.payload?.messages) {
          setBreakroomMessages(data.payload.messages);
        } else if (data.type === 'AGENT_READY' && data.payload?.agent) {
          const newAgent = data.payload.agent;
          console.log('[SSE] AGENT_READY received:', newAgent);
          saveCustomAgent(newAgent);

          AGENTS[newAgent.id] = {
            name: newAgent.name,
            role: newAgent.roleTitle,
            glyph: newAgent.glyph || '⚡',
            idx: 99,
            intro: newAgent.intro,
            system: newAgent.systemPrompt,
            color: newAgent.color || '#35f2df',
            voice: newAgent.voice?.voiceId || 'alloy',
            personality: newAgent.personality?.temperament?.join(', ') || 'analytical'
          };

          setRoundTableSeats(prev => prev.includes(newAgent.id) ? prev : [...prev, newAgent.id]);

          setMessages(prev => [
            ...prev,
            {
              id: `system-${Date.now()}`,
              role: 'system',
              who: 'AUTO AGENT BUILDER',
              content: `⚡ **AGENT READY**: ${newAgent.name} (${newAgent.roleTitle}) has been forged, verified, and placed into the Roundtable automatically!`
            }
          ]);
        }
      } catch (err) {
        console.error('SSE chat parse fail:', err);
      }
    };

    return () => {
      sse.close();
    };
  }, []);

  useEffect(() => {
    // Initialize budget store and listener
    initBudgetStore().then(({ summary, config }) => {
      setBudgetSummary(summary);
      setBudgetConfig(config);
    });

    const unsubBudget = subscribeBudget((newSummary, newConfig) => {
      setBudgetSummary(newSummary);
      setBudgetConfig(newConfig);
    });

    async function initializeAIProfile() {
      try {
        const saved = await storage.get('active_api_profile');
        const profilesData = await storage.get('api_profiles');
        const profiles: ApiProfile[] = profilesData?.value
          ? JSON.parse(profilesData.value)
          : DEFAULT_PROFILES;

        /*
         * First priority:
         * saved profile, but only if it exists.
         */
        let selected = saved?.value
          ? profiles.find(p => p.id === saved.value)
          : null;

        /*
         * Do NOT automatically choose Google Gemini.
         *
         * Prefer OpenRouter, then OpenAI,
         * then Anthropic, then Gemini.
         */
        if (!selected) {
          selected =
            profiles.find(p => p.provider === 'openrouter' && Boolean(p.apiKey?.trim())) ||
            profiles.find(p => p.provider === 'openai' && Boolean(p.apiKey?.trim())) ||
            profiles.find(p => p.provider === 'anthropic' && Boolean(p.apiKey?.trim())) ||
            profiles.find(p => p.provider === 'gemini' && Boolean(p.apiKey?.trim()));
        }

        if (selected) {
          setActiveProfileId(selected.id);
          setActiveProfileName(selected.name);
          setActiveProfileModel(selected.model);
          await storage.set('active_api_profile', selected.id);
        } else {
          /*
           * No local profile:
           * backend chooses the provider
           * from environment variables.
           */
          setActiveProfileId(null);
          setActiveProfileName('Server Default');
          setActiveProfileModel('Environment Provider');
        }
      } catch (error) {
        console.error('AI profile initialization failed:', error);
        setActiveProfileId(null);
        setActiveProfileName('Server Default');
        setActiveProfileModel('Environment Provider');
      }
    }

    initializeAIProfile();

    // Load custom agents & initialize dynamic Roundtable seats
    try {
      const customs = getCustomAgents();
      const dynamicSeats: AgentKey[] = [...ORDER];
      customs.forEach(c => {
        AGENTS[c.id] = {
          name: c.name,
          role: c.roleTitle,
          glyph: c.glyph || '⚡',
          idx: 99,
          intro: c.intro,
          system: c.systemPrompt,
          color: c.color || '#35f2df',
          voice: c.voice?.voiceId || 'alloy',
          personality: c.personality?.temperament?.join(', ') || 'analytical'
        };
        if (!dynamicSeats.includes(c.id)) {
          dynamicSeats.push(c.id);
        }
      });
      setRoundTableSeats(dynamicSeats);
    } catch (err) {
      console.error('Failed to load dynamic agent seats:', err);
    }

    // Sync all backend registered agents (including SAM and dynamic auto-built agents)
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.agents)) {
          data.agents.forEach((ag: any) => {
            if (!ag || !ag.id) return;
            const agKey = ag.id === 'agent_sam' ? 'sam' : ag.id;
            AGENTS[agKey] = {
              name: ag.name,
              role: ag.roleTitle || ag.role || 'Specialized Agent',
              glyph: ag.glyph || '⚡',
              idx: agKey === 'sam' ? 5 : 99,
              intro: ag.intro || `I am ${ag.name}.`,
              system: ag.systemPrompt || ag.system || `You are ${ag.name}.`,
              color: ag.color || '#35f2df',
              voice: ag.voice?.voiceId || ag.voice || 'fable',
              personality: typeof ag.personality === 'object' ? ag.personality?.traits?.join(', ') : (ag.personality || 'attentive')
            };
            setRoundTableSeats(prev => prev.includes(agKey) ? prev : [...prev, agKey]);
          });
        }
      })
      .catch(err => console.error('Failed to sync backend agents:', err));

    // Load Personas
    storage.get('agent_personas')
      .then(res => {
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (parsed && typeof parsed === 'object') {
            setPersonas({ ...DEFAULT_AGENT_PERSONAS, ...parsed });
          }
        }
      })
      .catch(() => {
        setPersonas(DEFAULT_AGENT_PERSONAS);
      });

    return () => {
      unsubBudget();
    };
  }, []);

  const loadProfileInfo = async (id: string | null) => {
    if (!id) {
      setActiveProfileName('Server Default');
      setActiveProfileModel('gemini-3.7-flash');
      return;
    }
    try {
      const res = await storage.get('api_profiles');
      const profiles: ApiProfile[] = res?.value ? JSON.parse(res.value) : DEFAULT_PROFILES;
      const found = profiles.find(p => p.id === id);
      if (found) {
        setActiveProfileName(found.name);
        setActiveProfileModel(found.model);
      }
    } catch {
      const found = DEFAULT_PROFILES.find(p => p.id === id);
      if (found) {
        setActiveProfileName(found.name);
        setActiveProfileModel(found.model);
      }
    }
  };

  const handleSelectProfile = (id: string | null) => {
    setActiveProfileId(id);
    loadProfileInfo(id);
    if (id) {
      storage.set('active_api_profile', id);
      const found = DEFAULT_PROFILES.find(p => p.id === id);
      addMsg('system', 'AI ENGINE', `Switched to ${found ? found.name : 'custom API'}`);
    } else {
      storage.delete('active_api_profile');
      addMsg('system', 'AI ENGINE', 'Reverted to default server API.');
    }
  };

  const handleUpdatePersonas = (newPersonas: Record<AgentKey, AgentPersona>) => {
    setPersonas(newPersonas);
    storage.set('agent_personas', JSON.stringify(newPersonas));
  };

  const handleClearInterAgentChats = async () => {
    try {
      const res = await fetch('/api/inter-agent-chats/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        setInterAgentChats(data.chats);
      }
    } catch (err) {
      console.error('Failed to clear inter-agent chats:', err);
    }
  };

  const handleInjectInterAgentChat = async (content: string) => {
    try {
      await fetch('/api/inter-agent-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'prometheus',
          recipient: 'all',
          content,
          taskContext: 'Intercom Direct',
          type: 'system'
        })
      });
    } catch (err) {
      console.error('Failed to inject inter-agent chat:', err);
    }
  };

  useEffect(() => {
    setTimeout(() => setBooted(true), 1500);
  }, []);

  const addMsg = (role: Message['role'], who: string, content: string) => {
    setMessages(prev => [...prev, { role, who, content }]);
  };

  const [currentSpeaker, setCurrentSpeaker] = useState<AgentKey | null>(null);
  const { speak, stop: stopSpeaking, speaking, audioLevel, ttsAvailable } = useTTS();

  const speakerState: SpeakerState = {
    agentId: currentSpeaker,
    status: currentSpeaker ? 'speaking' : (coreState === 'thinking' ? 'thinking' : 'idle'),
    audioLevel: speaking ? audioLevel : 0
  };

  const handleInterrupt = () => {
    stopSpeaking();
    setCurrentSpeaker(null);
    addMsg('system', 'SYSTEM', 'Interrupted — listening now.');
  };

  const { listening, level, sttAvailable, toggleMic } = useSpeech(
    (text, isFinal) => {
      setTranscript(isFinal ? '' : text);
      if (isFinal && text) handleSend(text);
    },
    handleInterrupt
  );

  useEffect(() => {
    if (listening) {
      setCoreState('listening');
      setCoreText('listening');
    } else if (!speaking) {
      setCoreState('');
      setCoreText('standby');
    }
  }, [listening, speaking]);

  const updateAgentState = (key: AgentKey, state: string) => {
    setAgentStates(prev => ({ ...prev, [key]: state }));
  };

  const speakAndLog = (agent: AgentKey, text: string) => {
    // Sync the agent's response to the collaborative database
    fetch('/api/shared-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: agent, who: AGENTS[agent].name.toUpperCase(), content: text })
    }).catch(err => console.error('Collaborative write failure:', err));

    speak(
      agent, 
      text, 
      (k) => {
        setCurrentSpeaker(k);
        updateAgentState(k, 'speaking');
        setCoreState('speaking');
        setCoreText(`${AGENTS[k].name} speaking...`);
      },
      (k) => {
        setCurrentSpeaker(null);
        updateAgentState(k, 'idle');
      },
      () => {
        setCurrentSpeaker(null);
        if (listening) {
          setCoreState('listening');
          setCoreText('listening');
        } else {
          setCoreState('');
          setCoreText('standby');
        }
      }
    );
  };

  // Gmail auth state initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setGmailUser(u);
        setGmailToken(token);
      },
      () => {
        setGmailUser(null);
        setGmailToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Background Simulation & completed notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setBackgroundTasks(prevTasks => {
        let updated = false;
        let completedTaskName: string | null = null;
        let completedTaskSummary: string | null = null;
        let completedTaskAgent: string | null = null;

        const newTasks = prevTasks.map(t => {
          if (t.status === 'working') {
            updated = true;
            
            // Deep clone tree to mutate progress
            const cloneTree = (node: SubAgentNode): SubAgentNode => {
              const newNode = { ...node };
              if (newNode.children) {
                newNode.children = newNode.children.map(cloneTree);
              }

              // Update progress logic
              if (newNode.status === 'working') {
                const nextProgress = newNode.progress + Math.floor(Math.random() * 15) + 5;
                if (nextProgress >= 100) {
                  newNode.progress = 100;
                  newNode.status = 'completed';
                  newNode.actionText = `Completed work: ${newNode.actionText.replace('Working on', 'Successfully resolved')}`;
                } else {
                  newNode.progress = nextProgress;
                }
              } else if (newNode.status === 'pending') {
                const childrenCompleted = !newNode.children || newNode.children.every(c => c.status === 'completed');
                if (childrenCompleted) {
                  newNode.status = 'working';
                  newNode.progress = Math.floor(Math.random() * 10) + 1;
                }
              }
              return newNode;
            };

            const newTree = cloneTree(t.tree);

            // Calculate overall progress based on average of all nodes
            const getAllNodes = (node: SubAgentNode): SubAgentNode[] => {
              let res = [node];
              if (node.children) {
                node.children.forEach(c => {
                  res = [...res, ...getAllNodes(c)];
                });
              }
              return res;
            };

            const allNodes = getAllNodes(newTree);
            const totalProg = allNodes.reduce((acc, curr) => acc + curr.progress, 0);
            const averageProgress = Math.floor(totalProg / allNodes.length);

            const isFullyCompleted = allNodes.every(n => n.status === 'completed');

            let deliverable = t.deliverable;
            if (isFullyCompleted && !t.deliverable) {
              deliverable = {
                summary: `${t.parentAgent.toUpperCase()} has consolidated sub-agent reports and finalized background orchestration.`,
                outputDetails: `• Sub-agents successfully queried Gmail & connected workspaces.\n• Task "${t.title}" finalized successfully with zero errors.\n• Deliverables and updates written to system databases.`,
                apisUsed: ['Gmail API', 'Roundtable Peer Consensus', 'Memory Write Client']
              };
              completedTaskName = t.title;
              completedTaskSummary = deliverable.summary;
              completedTaskAgent = t.parentAgent;
            }

            return {
              ...t,
              tree: newTree,
              overallProgress: averageProgress,
              status: isFullyCompleted ? 'completed' : 'working',
              deliverable
            };
          }
          return t;
        });

        if (completedTaskName && completedTaskSummary && completedTaskAgent) {
          // Speak & log the task completion to deliver the work to the user!
          const deliverableText = `### 🌿 Background Task Completed: ${completedTaskName}\n\n${completedTaskSummary}\n\n*Review details or trigger deliveries in the Task Orchestrator.*`;
          
          setTimeout(() => {
            speakAndLog(completedTaskAgent || 'sam', deliverableText);
          }, 100);
        }

        if (updated) return newTasks;
        return prevTasks;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const introduceIfNeeded = (key: AgentKey) => {
    if (introduced.has(key)) return;
    setIntroduced(prev => new Set(prev).add(key));
    const persona = personas[key];
    const customIntro = persona?.customIntro || AGENTS[key].intro;
    speakAndLog(key, customIntro);
  };

  const callApi = async (agentKey: AgentKey, text: string, context?: string | null) => {
    try {
      const hist = messages
        .filter(m => m.role === 'user' || m.role === agentKey)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      
      const content = context ? `${context}\n\n${text}` : text;
      hist.push({ role: 'user', content });

      let profileData = null;
      if (activeProfileId) {
        try {
          const storedProfiles = await storage.get('api_profiles');
          if (storedProfiles && storedProfiles.value) {
            const profiles = JSON.parse(storedProfiles.value);
            profileData = profiles.find((p: any) => p.id === activeProfileId);
          }
        } catch (e) {
          // ignore not found
        }
      }

      // Persona prompt override
      const currentPersona = personas[agentKey];
      const effectiveSystemPrompt = currentPersona?.systemPrompt || AGENTS[agentKey].system;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentKey,
          system: effectiveSystemPrompt,
          messages: hist,
          profile: profileData,
          gmailToken: gmailToken
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.message || `API Error (${res.status})`);
      }
      const data = await res.json();
      const responseText = data.content?.[0]?.text as string;

      // Record token consumption for global Budget Watcher
      const estimatedPromptTokens = Math.max(1, Math.round((effectiveSystemPrompt.length + hist.reduce((acc, h) => acc + h.content.length, 0)) / 3.8));
      const promptTokens = data.usage?.promptTokens || estimatedPromptTokens;
      const completionTokens = data.usage?.completionTokens || Math.max(1, Math.round((responseText || '').length / 3.8));
      const totalTokens = data.usage?.totalTokens || (promptTokens + completionTokens);

      recordTokenUsage({
        agentKey,
        model: data.model || activeProfileModel,
        provider: data.provider || profileData?.provider || 'gemini',
        promptTokens,
        completionTokens,
        totalTokens,
        note: `Boardroom message from ${AGENTS[agentKey].name}`
      });

      return responseText;
    } catch (e: any) {
      addMsg('error', 'SYSTEM', `Call to ${AGENTS[agentKey].name} failed: ${e.message}`);
      return null;
    }
  };

  const findPriorNotes = async (topicGuess: string) => {
    try {
      const listing = await storage.list('vault:');
      const slug = topicGuess.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,30);
      const match = listing.keys.find(k => k.includes(slug));
      if (!match) return null;
      const rec = await storage.get(match);
      const parsed = JSON.parse(rec.value);
      return `Prior notes on this topic from ${parsed.date}:\n${parsed.notes}`;
    } catch (e) {
      return null;
    }
  };

  const handleSend = async (text: string) => {
    // Sync the user's message to the server's collaborative shared feed with custom Username
    fetch('/api/shared-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', who: userName, content: text })
    }).catch(err => console.error('Collaborative message post error:', err));

    // Extract targeted agent (either from Slash command or default activeAgent)
    let targetAgentKey = activeAgent;
    let actualText = text;

    const slashMatch = text.match(/^\/([a-zA-Z0-9_\-\(\)]+)\s*(.*)$/s);
    if (slashMatch) {
      const rawTarget = slashMatch[1].replace(/[\(\)]/g, '').trim().toLowerCase();
      const promptRest = slashMatch[2].trim();

      const availableKeys = Array.from(new Set([...roundTableSeats, ...Object.keys(AGENTS)]));
      const foundKey = availableKeys.find(k => {
        const cfg = AGENTS[k] || getAgentConfig(k);
        const nameLower = cfg.name.toLowerCase();
        const nameClean = nameLower.replace(/[^a-z0-9]/g, '');
        return k.toLowerCase() === rawTarget || nameLower === rawTarget || nameClean === rawTarget;
      });

      if (foundKey) {
        targetAgentKey = foundKey;
        actualText = promptRest || `Hello ${AGENTS[foundKey]?.name}! Please state your status.`;
      }
    }

    // Check if we should execute a plan/approval or just talk normally
    let isAction = false;
    const isAgentBuild = /\b(build|create|forge|make)\s+(an?\s+)?(ai\s+)?(agent|bot|executive)\b/i.test(actualText) || actualText.toLowerCase().includes('build an ai') || actualText.toLowerCase().includes('create an agent');
    
    if (isAgentBuild) {
      isAction = true;
    } else {
      setIsGeneratingPlan(true);
      setCoreState('thinking');
      setCoreText('Analyzing intent...');
      updateAgentState('prometheus', 'thinking');
      
      try {
        const classificationPrompt = `Analyze the user's input: "${actualText}".
Is this input requesting the AI to perform a specific actionable task, execution sequence, database/file update, automated workflow, email querying, or creating/forging something? Or is it just a conversational query, a general informational question, standard chat, saying hello, or discussing a topic?
Respond with exactly one word: either "ACTION" or "CHAT" in uppercase. Do not include any other text.`;
        
        const classification = await callApi('prometheus', classificationPrompt);
        if (classification && classification.toUpperCase().includes('ACTION')) {
          isAction = true;
        }
      } catch (e) {
        console.error('Classification error:', e);
        isAction = false; // default to safe chat if classification fails
      }
    }

    if (!isAction) {
      setIsGeneratingPlan(false);
      setCoreState('thinking');
      setCoreText(`${AGENTS[targetAgentKey].name} is processing...`);
      updateAgentState(targetAgentKey, 'thinking');
      await resumeSend(text, text, targetAgentKey);
      return;
    }

    // It is an ACTION task! Formulate Plan steps
    setCoreText('Formulating execution plan...');
    updateAgentState('prometheus', 'thinking');

    // Formulate Plan steps
    const planPrompt = `The user gave this task/prompt: "${actualText}".
Before executing, formulate a structured, step-by-step Execution Plan.
Generate 3 to 4 logical, concrete steps required to execute this task.
Respond ONLY with a valid JSON array of strings representing these steps. Do NOT include markdown code blocks, do NOT write any introductory or concluding text.
Example response:
["Identify key requirements from user input", "Query Gmail inbox for relevant messages", "Synthesize findings using Gemini reasoning engine"]`;

    let steps: string[] = [];
    try {
      const reply = await callApi('prometheus', planPrompt);
      if (reply) {
        let cleaned = reply.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        steps = JSON.parse(cleaned);
      }
    } catch (e) {
      console.error('Plan formulation error:', e);
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      steps = [
        `Analyze prompt: "${actualText}" and determine core objectives`,
        `Query active Roundtable memory & connected Gmail endpoints`,
        `Orchestrate consensus between specialized agents`,
        `Consolidate final deliverables & present response`
      ];
    }

    // Set the pending plan!
    setPendingPlan({
      goal: actualText,
      steps: steps.map((s, i) => ({ id: `step-${i}`, text: s, enabled: true })),
      agentKey: targetAgentKey,
      originalText: text
    });

    setIsGeneratingPlan(false);
    setCoreState('idle');
    setCoreText('standby');
    updateAgentState('prometheus', 'idle');
  };

  const handleApprovePlan = async () => {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    setPendingPlan(null);

    const allowedSteps = plan.steps.filter(s => s.enabled);
    if (allowedSteps.length === 0) {
      speakAndLog('prometheus', `All steps were disabled. Task execution aborted.`);
      return;
    }

    const contextBriefing = `[TASK EXECUTION PLAN AUTHORIZED BY USER]\n` +
      `Original Goal: "${plan.goal}"\n` +
      `Approved Steps to Execute:\n` +
      allowedSteps.map(s => `• ${s.text}`).join('\n') + `\n\n` +
      `(Note: Non-approved steps were excluded from execution by user policy.)`;

    // Create a beautiful background orchestrated task visual tree matching those allowed steps!
    const subAgentsNeeded = ['sage', 'forge', 'gemini'];
    const leader = plan.agentKey === 'sam' ? 'sam' : 'prometheus';

    const subNodes: SubAgentNode[] = subAgentsNeeded.map((id) => {
      const glyph = id === 'sage' ? '🧙' : id === 'forge' ? '🔨' : id === 'gemini' ? '✨' : '🤖';
      const name = id.toUpperCase();
      const role = id === 'sage' ? 'The Archivist' : id === 'forge' ? 'The Builder' : id === 'gemini' ? 'Reasoning Specialist' : 'Specialist';
      
      return {
        id: `node-${id}-${Date.now()}`,
        agentId: id,
        name,
        glyph,
        role,
        status: 'pending',
        progress: 0,
        actionText: `Executing: ${allowedSteps[0]?.text || 'Processing authorized task'}`
      };
    });

    const newTask: BackgroundTask = {
      id: `task-${Date.now()}`,
      title: plan.goal,
      parentAgent: leader,
      status: 'working',
      overallProgress: 0,
      createdAt: new Date().toLocaleTimeString(),
      tree: {
        id: `node-lead-${Date.now()}`,
        agentId: leader,
        name: leader.toUpperCase(),
        glyph: '👤',
        role: 'Orchestration Leader',
        status: 'working',
        progress: 5,
        actionText: `Orchestrating plan: ${allowedSteps.length} authorized steps`,
        children: subNodes
      }
    };

    setBackgroundTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);

    speakAndLog('prometheus', `Plan authorized! Spawning sub-agent tree to coordinate execution of the ${allowedSteps.length} approved steps in the background.`);

    await resumeSend(plan.originalText, `${contextBriefing}\n\nPlease execute these authorized actions and formulate your response.`, plan.agentKey);
  };

  const handleDenyPlan = () => {
    if (!pendingPlan) return;
    speakAndLog('prometheus', `Proposed execution plan was rejected by user. Task aborted.`);
    setPendingPlan(null);
  };

  const resumeSend = async (originalText: string, textToRun: string, targetAgentKey: AgentKey) => {
    // Check if user is asking to build/forge another AI agent
    const isAgentBuildRequest = /\b(build|create|forge|make)\s+(an?\s+)?(ai\s+)?(agent|bot|executive)\b/i.test(originalText) || originalText.toLowerCase().includes('build an ai') || originalText.toLowerCase().includes('create an agent');

    if (isAgentBuildRequest) {
      const isClearInstructions = originalText.trim().length > 35 && (originalText.includes('that') || originalText.includes('for') || originalText.includes('specializing') || originalText.includes('focus') || originalText.includes('with') || originalText.includes('expert'));

      if (!isClearInstructions) {
        setCoreState('thinking');
        setCoreText('Prometheus is analyzing your request...');
        updateAgentState('prometheus', 'thinking');
        
        const questionPrompt = `The user asked to build an agent with the instruction: "${originalText}". This instruction is brief or lacks specific details. As Prometheus, respond by asking 2-3 precise, clarifying questions on how they want this AI agent built (e.g., its primary mission/domain, role title, and key capabilities). Keep it direct and professional.`;
        const clarificationReply = await callApi('prometheus', questionPrompt);
        
        const replyText = clarificationReply || "To forge a high-precision AI agent for your team, I need a few more details. Could you clarify: 1. What is the core domain or mission of this agent? 2. What specific role title should it hold? 3. What key capabilities or expertise do you want it to master?";
        speakAndLog('prometheus', replyText);
        updateAgentState('prometheus', 'idle');
        setCoreState('idle');
        setCoreText('standby');
        return;
      } else {
        setCoreState('thinking');
        setCoreText('Prometheus & Forge are building your new agent...');
        updateAgentState('prometheus', 'thinking');
        updateAgentState('forge', 'thinking');

        speakAndLog('prometheus', `Clear instructions received. Initiating neural forge for your requested agent based on: "${originalText}". Seating new executive at the round table now...`);

        try {
          const forgedResp = await apiForgeAgent({ goal: originalText, authorPersona: 'prometheus' });
          const partialAgent = forgedResp.agent;

          const newAgentConfig: CustomAgentConfig = {
            id: `agent-${Date.now()}`,
            name: partialAgent.name || 'NexusAgent',
            roleTitle: partialAgent.roleTitle || 'Specialized Executive',
            glyph: partialAgent.glyph || '⚡',
            color: partialAgent.color || 'var(--cyan)',
            intro: partialAgent.intro || 'Greetings, round table. I am online and ready to execute.',
            systemPrompt: partialAgent.systemPrompt || 'You are an expert AI agent.',
            capabilities: partialAgent.capabilities || ['Expert Analysis', 'Execution'],
            trainingModules: [],
            author: 'prometheus',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            benchmarks: []
          };

          saveCustomAgent(newAgentConfig);

          const seatKey: AgentKey = 'questioner';
          setPersonas(prev => ({
            ...prev,
            [seatKey]: {
              roleTitle: newAgentConfig.roleTitle,
              systemPrompt: newAgentConfig.systemPrompt,
              customIntro: newAgentConfig.intro,
              lastUpdated: Date.now()
            }
          }));

          updateAgentState('prometheus', 'idle');
          updateAgentState('forge', 'idle');

          setCoreState('thinking');
          setCoreText(`${newAgentConfig.name} is taking their seat...`);
          
          speakAndLog(seatKey, `${newAgentConfig.intro} (Seated at the round table as our new ${newAgentConfig.roleTitle})`);
          
          setCoreState('idle');
          setCoreText('standby');
          return;
        } catch (err: any) {
          console.error("Forge Error:", err);
          speakAndLog('prometheus', `Agent forging encountered an error: ${err.message || 'Unknown error'}. Let's refine the instructions.`);
          updateAgentState('prometheus', 'idle');
          updateAgentState('forge', 'idle');
          setCoreState('idle');
          setCoreText('standby');
          return;
        }
      }
    }

    if (mode === 'ROUND TABLE') {
      setCoreState('thinking');
      setCoreText('Prometheus is briefing the circle...');
      updateAgentState('prometheus', 'thinking');
      
      ORDER.forEach(k => introduceIfNeeded(k));
      
      const promReply = await callApi('prometheus', textToRun, "The user has convened the full round table. Decide who is needed and brief them directly and concretely.");
      if (!promReply) {
        updateAgentState('prometheus', 'idle');
        return;
      }

      const m = promReply.match(/^ROUTE:\s*(sage|forge|questioner|gemini|self|multiple)([^\n]*)\n+([\s\S]*)$/i);
      const route = m ? m[1].toLowerCase() : 'self';
      const multiList = m ? (m[2] || '') : '';
      const briefing = m ? m[3].trim() : promReply;
      
      speakAndLog('prometheus', briefing);
      updateAgentState('prometheus', 'idle');

      const targets = route === 'multiple' ? ORDER.filter(k => k !== 'prometheus' && multiList.toLowerCase().includes(k))
                    : route !== 'self' ? [route as AgentKey] : [];
      
      const replies = [];
      for (const t of targets) {
        updateAgentState(t, 'thinking');
        setCoreState('thinking');
        setCoreText(`${AGENTS[t].name} is responding to the circle...`);
        
        const priorNotes = t === 'sage' ? await findPriorNotes(originalText) : null;
        const r = await callApi(t, `Prometheus, addressing the round table, said: "${briefing}"\n\nOriginal request: ${originalText}\n\nRespond directly to Prometheus and the user — give your own take, and ask a question back if something matters to you.`, priorNotes);
        
        if (r) {
          speakAndLog(t, r);
          replies.push(`${AGENTS[t].name} said: ${r}`);
        }
        updateAgentState(t, 'idle');
      }

      if (replies.length) {
        updateAgentState('prometheus', 'thinking');
        setCoreState('thinking');
        setCoreText('Prometheus is closing the circle...');
        const closing = await callApi('prometheus', `Give a short closing to the round table: summarize what was decided and what happens next.\n\n${replies.join('\n\n')}`);
        if (closing) {
          const closingClean = closing.replace(/^ROUTE:\s*[\w:, ]+\n+/i, '');
          speakAndLog('prometheus', closingClean);
        }
      }
      ORDER.forEach(k => updateAgentState(k, 'idle'));

    } else {
      setCoreState('thinking');
      setCoreText(`${AGENTS[targetAgentKey].name} is thinking`);
      updateAgentState(targetAgentKey, 'thinking');
      
      const extra = targetAgentKey === 'sage' ? await findPriorNotes(originalText) : null;
      const reply = await callApi(targetAgentKey, textToRun, extra);
      
      if (reply) {
        if (targetAgentKey === 'prometheus') {
          const m = reply.match(/^ROUTE:\s*(sage|forge|questioner|gemini|self|multiple)([^\n]*)\n+([\s\S]*)$/i);
          if (m) {
            const route = m[1].toLowerCase();
            const multiList = m[2] || '';
            const briefing = m[3].trim();
            speakAndLog('prometheus', briefing);

            const targets = route === 'multiple' ? ORDER.filter(k => k !== 'prometheus' && multiList.toLowerCase().includes(k))
                        : route !== 'self' ? [route as AgentKey] : [];
            
            for (const t of targets) {
              updateAgentState(t, 'thinking');
              setCoreState('thinking');
              setCoreText(`${AGENTS[t].name} is responding...`);
              const priorNotes = t === 'sage' ? await findPriorNotes(originalText) : null;
              const r = await callApi(t, `Prometheus briefed the circle: "${briefing}"\n\nOriginal request: ${originalText}`, priorNotes);
              if (r) speakAndLog(t, r);
              updateAgentState(t, 'idle');
            }
            updateAgentState(targetAgentKey, 'idle');
            return;
          }
        }
        speakAndLog(targetAgentKey, reply);
      }
      updateAgentState(targetAgentKey, 'idle');
    }
  };

  const saveToVault = async () => {
    const topic = prompt("Name this topic for the Vault (e.g. 'quantum computing basics'):");
    if (!topic) return;
    const notes = messages.map(m => `${m.who}: ${m.content}`).join('\n\n');
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,30);
    const date = new Date().toISOString().slice(0,10);
    const key = `vault:${date}:${slug}`;
    try {
      await storage.set(key, JSON.stringify({ topic, date, notes }));
      addMsg('system', 'VAULT', `Saved "${topic}" into today's folder.`);
    } catch (e: any) {
      addMsg('error', 'VAULT', 'Could not save: ' + e.message);
    }
  };

  const budgetStatus = calculateBudgetStatus(budgetSummary, budgetConfig);

  return (
    <>
      <div id="boot" className={booted ? 'hide' : ''}>
        <div className="boot-inner">
          <div className="boot-glyph"><span>B</span></div>
          <p>engine initializing</p>
          <h1>BuildEngine</h1>
          <div className="boot-sub">PROMETHEUS V4.0</div>
        </div>
      </div>

      <div id="app" className={booted ? 'show' : ''}>
        <div className="top">
          <div className="brand">
            <div className="w-10 h-10 rounded-xl border border-white/30 bg-black/80 flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <span className="font-['Yuji_Boku',serif] font-bold text-xl text-amber-400">普</span>
            </div>
            <div className="brand-text">
              <div className="brand-name font-['Cinzel'] tracking-widest flex items-center gap-2">
                BUILDENGINE <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-mono">NEO-EDO</span>
              </div>
              <div className="brand-sub font-mono text-[9px] text-slate-400">CYBER AI BOARD · PROMETHEUS</div>
            </div>
          </div>
          <div className="actions flex items-center gap-2">
            <div className="sys-online"><i className="led"></i> <b>SYS ONLINE</b></div>

            {/* Direct 2D Breakroom Arcade Launcher */}
            <button
              onClick={() => setUiState(s => ({ ...s, deviceConnector: true }))}
              className="btn flex items-center gap-1.5 border-red-500/40 text-red-300 bg-red-950/40 hover:bg-red-900/60 font-mono text-xs cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.25)]"
              title="Launch 2D Breakroom Mini-Games (Daruma Catch, Reflex Dojo, Spirit Pong)"
            >
              <span>⛩️</span>
              <span className="font-bold">2D Arcade</span>
              <span className="bg-red-500/20 text-red-200 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">3 Games</span>
            </button>
            
            {/* Global Budget Watcher Top Bar Indicator */}
            {budgetConfig.enabled && (
              <button 
                className={`btn flex items-center gap-1.5 font-mono text-xs cursor-pointer transition-all ${
                  budgetStatus.isExceeded
                    ? 'border-rose-500 text-rose-300 bg-rose-950/70 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                    : budgetStatus.isWarning
                    ? 'border-amber-500 text-amber-300 bg-amber-950/70 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                }`} 
                onClick={() => setUiState(s => ({ ...s, budgetWatcher: true }))}
                title={`Budget Watcher: ${budgetStatus.percentage}% used (${budgetStatus.currentValueFormatted} / ${budgetStatus.thresholdFormatted}). Click to view or optimize.`}
              >
                <span>{budgetStatus.isExceeded ? '🚨' : budgetStatus.isWarning ? '⚠️' : '⚡'}</span>
                <span className="font-bold">
                  {budgetStatus.isWarning || budgetStatus.isExceeded
                    ? `Budget ${budgetStatus.percentage}%`
                    : formatTokens(budgetSummary.totalTokens)}
                </span>
                <span className="opacity-75 text-[10px] hidden md:inline font-mono">
                  {budgetStatus.isWarning || budgetStatus.isExceeded
                    ? `(${formatTokens(budgetSummary.totalTokens)} tok)`
                    : `· ${formatUsd(budgetSummary.totalCostUsd)}`}
                </span>
              </button>
            )}

            {/* Active AI Provider Quick Switcher */}
            <ProviderQuickSwitcher
              activeProfileId={activeProfileId}
              onSelectProfile={(profile) => {
                setActiveProfileId(profile.id);
                setActiveProfileName(profile.name);
                setActiveProfileModel(profile.model);
                storage.set('active_api_profile', profile.id);
                addMsg('system', 'AI ENGINE', `Active AI Engine switched to ${profile.name} (${profile.model})`);
              }}
              onOpenApiPanel={() => {
                setApiPanelTab('apis');
                setUiState(s => ({ ...s, apiConfig: true }));
              }}
            />

            {/* Personas Quick Button */}
            <button 
              className="btn flex items-center gap-1.5 border-emerald-500/40 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 font-mono text-xs cursor-pointer" 
              onClick={() => {
                setApiPanelTab('personas');
                setUiState(s => ({ ...s, apiConfig: true }));
              }}
              title="Configure Agent Personas & Custom System Prompts"
            >
              <span>🎭</span>
              <span className="hidden sm:inline">Personas</span>
            </button>

            {/* AI Builder & Trainer Button */}
            <button 
              className="btn flex items-center gap-1.5 border-purple-500/50 text-purple-300 bg-purple-950/50 hover:bg-purple-900/70 font-mono text-xs cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)]" 
              onClick={() => {
                setUiState(s => ({ ...s, builder: true }));
              }}
              title="AI Builder, Trainer, Benchmark Evaluator & Token Optimizer"
            >
              <span>⚙</span>
              <span className="font-bold">AI Builder</span>
              <span className="bg-purple-500/20 text-purple-200 text-[10px] px-1.5 py-0.2 rounded font-sans hidden sm:inline">Jarvis</span>
            </button>

            {/* Device Layout View-port Selector Segmented Control */}
            <div className="flex bg-[#030d0f] border border-cyan-500/30 rounded-xl p-0.5 shrink-0 select-none items-center shadow-[0_0_12px_rgba(34,211,238,0.1)]">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono text-[10px] font-bold ${
                  deviceMode === 'desktop'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View Mode (Standard)"
              >
                <span>🖥️</span>
                <span className="hidden md:inline">Desktop</span>
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono text-[10px] font-bold ${
                  deviceMode === 'tablet'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tablet Simulator Mode (iPad)"
              >
                <span>📟</span>
                <span className="hidden md:inline">Tablet</span>
              </button>
              <button
                onClick={() => setDeviceMode('phone')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-mono text-[10px] font-bold ${
                  deviceMode === 'phone'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Phone Simulator Mode (iPhone)"
              >
                <span>📱</span>
                <span className="hidden md:inline">Phone</span>
              </button>
            </div>

            {/* Real-time Device Connector Co-Pilot Button */}
            <button 
              className="btn flex items-center gap-1.5 border-cyan-500/50 text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/70 font-mono text-xs cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.25)]" 
              onClick={() => {
                setUiState(s => ({ ...s, deviceConnector: true }));
              }}
              title="Connect multiple devices or share invite link for real-time Co-Pilot collaboration"
            >
              <span>🔗</span>
              <span className="font-bold">Device Connector</span>
              <span className="bg-cyan-500/20 text-cyan-200 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                {collaboratorCount} {collaboratorCount === 1 ? 'Client' : 'Clients'}
              </span>
            </button>

            {/* AI Wiretap / Private Chats button */}
            <button 
              className="btn flex items-center gap-1.5 border-indigo-500/50 text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/70 font-mono text-xs cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.2)]" 
              onClick={() => {
                setUiState(s => ({ ...s, wiretap: true }));
              }}
              title="Monitor inter-agent backend whispers & private chat feeds"
            >
              <span>📡</span>
              <span className="font-bold">Wiretap Feed</span>
              {interAgentChats.length > 0 && (
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold animate-pulse">
                  {interAgentChats.length}
                </span>
              )}
            </button>

            {/* Google Gmail Workspace Connection status */}
            {gmailUser ? (
              <button 
                className="btn flex items-center gap-1.5 border-emerald-500/50 text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 font-mono text-xs cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                onClick={() => {
                  setUiState(s => ({ ...s, gmail: true }));
                }}
                title={`Gmail workspace connected: ${gmailUser.email}`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="font-bold truncate max-w-[125px]">{gmailUser.email}</span>
                <span className="bg-emerald-500/20 text-emerald-200 text-[10px] px-1.5 py-0.2 rounded font-sans">Workspace OK</span>
              </button>
            ) : (
              <button 
                className="btn flex items-center gap-1.5 border-red-500/50 text-red-300 bg-red-950/50 hover:bg-red-900/70 font-mono text-xs cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse"
                onClick={async () => {
                  try {
                    const res = await googleSignIn();
                    if (res) {
                      setGmailUser(res.user);
                      setGmailToken(res.accessToken);
                      addMsg('system', 'WORKSPACE', `Successfully connected to real Gmail inbox: ${res.user.email}`);
                    }
                  } catch (err: any) {
                    console.error('Real Gmail authentication failed:', err);
                    addMsg('error', 'WORKSPACE', `Gmail Authentication Failed: ${err.message || 'Verification Error'}`);
                    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
                    if (isIframe || err.message?.includes('network-request-failed') || err.code?.includes('network-request-failed')) {
                      setAuthErrorModal(true);
                    }
                  }
                }}
                title="Connect Your Real Gmail Account to allow SAM to read alerts and drafts"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="font-bold">Connect Real Email</span>
                <span className="bg-red-500/20 text-red-200 text-[10px] px-1.5 py-0.2 rounded font-sans">G-OAuth</span>
              </button>
            )}

            <button className="btn cursor-pointer" onClick={() => {
              setApiPanelTab('apis');
              setUiState(s => ({ ...s, apiConfig: true }));
            }}>API Adder</button>
            <button className="btn cursor-pointer" onClick={() => setUiState(s => ({ ...s, sidebar: true }))}>Control Deck</button>
            <button className="btn cursor-pointer" onClick={() => setUiState(s => ({ ...s, log: true }))}>Chat Log</button>
          </div>
        </div>

        {/* TOP ALERT BANNER (Approaching or Exceeded Threshold) */}
        {budgetConfig.enabled && (budgetStatus.isWarning || budgetStatus.isExceeded) && !dismissBudgetBanner && (
          <div 
            className={`px-4 py-2 flex items-center justify-between text-xs border-b transition-all ${
              budgetStatus.isExceeded
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-[0_4px_15px_rgba(244,63,94,0.2)]'
                : 'bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-[0_4px_15px_rgba(245,158,11,0.2)]'
            }`}
          >
            <div className="flex items-center gap-2 max-w-4xl">
              <span className="text-base">{budgetStatus.isExceeded ? '🚨' : '⚠️'}</span>
              <span>
                <strong>{budgetStatus.isExceeded ? 'Session Budget Limit Reached!' : 'Approaching Budget Threshold:'}</strong>{' '}
                {budgetStatus.currentValueFormatted} consumed of {budgetStatus.thresholdFormatted} ({budgetStatus.percentage}%).
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setUiState(s => ({ ...s, budgetWatcher: true }))}
                className={`px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer ${
                  budgetStatus.isExceeded
                    ? 'bg-rose-500 text-slate-950 hover:bg-rose-400'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                Manage Budget
              </button>
              <button
                onClick={() => setDismissBudgetBanner(true)}
                className="text-[var(--muted)] hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                title="Dismiss warning banner"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {(() => {
          const layoutContent = (
            <div className="layout">
          <main className="stage relative">
            {/* Floating background task status shortcut */}
            {backgroundTasks.length > 0 && (
              <div className="absolute top-4 left-4 z-20">
                <button 
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(53,242,223,0.1)]"
                  onClick={() => setUiState(s => ({ ...s, orchestrator: true }))}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  🌿 Task Trees & Progress
                </button>
              </div>
            )}

            <img
              style={{ display: 'none' }}
              src="/public/icon.png"
              alt="System Logo"
              referrerPolicy="no-referrer"
            />

            <CoreRing 
              activeAgent={activeAgent} 
              coreState={coreState} 
              coreText={coreText} 
              transcript={transcript} 
              agentStates={agentStates}
              speakerState={speakerState}
              personas={personas}
              seats={roundTableSeats}
              onSelectAgent={(key) => {
                setMode('SINGLE');
                setActiveAgent(key);
                introduceIfNeeded(key);
              }}
            />
            <CommandDock 
              listening={listening}
              speaking={speaking}
              level={level}
              voiceState={listening ? 'LISTENING · SPEAK NOW' : (speaking ? 'SPEAKING' : 'MIC OFF · TTS READY')}
              onMicClick={() => toggleMic(speaking)}
              onSend={handleSend}
              seats={roundTableSeats}
            />

            <LiveBreakroomTicker 
              messages={breakroomMessages}
              userName={userName}
              onOpenBreakroom={() => setUiState(s => ({ ...s, deviceConnector: true }))}
            />

            {/* Embedded Preview Iframe OAuth Restriction Modal */}
            {authErrorModal && (
              <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
                <div className="p-6 max-w-md w-[90%] bg-slate-900 border-2 border-red-500/40 rounded-xl shadow-[0_0_50px_rgba(239,68,68,0.25)] text-center flex flex-col items-center gap-4">
                  <div className="relative flex h-12 w-12 items-center justify-center text-red-400 text-3xl">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-400 font-mono tracking-wider">IFRAME SECURITY BLOCK</h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      Google OAuth popups are restricted inside embedded iframe previews (due to third-party cookie blocking policies in modern browsers).
                    </p>
                    <p className="text-[11px] text-cyan-400 mt-3 font-semibold leading-relaxed">
                      To successfully connect your real Gmail, please open this app in a separate, secure tab using the button below.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <button 
                      className="w-full px-4 py-2.5 rounded font-mono text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all cursor-pointer uppercase tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      onClick={() => {
                        window.open(window.location.href, '_blank');
                        setAuthErrorModal(false);
                      }}
                    >
                      🚀 Open App in New Tab
                    </button>
                    <button 
                      className="w-full px-4 py-2 rounded font-mono text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 transition-all cursor-pointer uppercase"
                      onClick={() => setAuthErrorModal(false)}
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generating Plan Spinner overlay */}
            {isGeneratingPlan && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
                <div className="p-6 max-w-md w-[90%] bg-slate-900 border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(34,211,238,0.15)] text-center flex flex-col items-center gap-4">
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-20"></span>
                    <span className="relative inline-flex rounded-full h-8 w-8 bg-cyan-500 flex items-center justify-center text-slate-950 font-mono text-xs font-bold">🧠</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-cyan-300 font-mono tracking-wider">FORMULATING EXECUTION PLAN</h3>
                    <p className="text-xs text-slate-400 mt-2">Prometheus is deconstructing your command, polling Roundtable models, and organizing specialized sub-agents.</p>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full w-2/3 animate-pulse rounded-full"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Task Execution Plan Authorization Panel */}
            {pendingPlan && (
              <div className="absolute inset-x-4 bottom-24 z-40 max-w-2xl mx-auto">
                <div className="bg-slate-950/95 border-2 border-amber-500/50 rounded-xl shadow-[0_10px_40px_rgba(245,158,11,0.3)] overflow-hidden">
                  {/* Title Bar */}
                  <div className="bg-amber-500 text-slate-950 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📋</span>
                      <span className="font-mono font-bold text-xs tracking-wider uppercase">Executive Task Execution Plan</span>
                    </div>
                    <span className="bg-slate-950/20 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">Awaiting Authorization</span>
                  </div>

                  {/* Goal and Instructions */}
                  <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block mb-1">Proposed Goal</span>
                    <p className="text-sm font-semibold text-slate-100 italic">"{pendingPlan.goal}"</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Review SAM's proposed pipeline. Select or deselect individual sub-tasks below to tailor agent permission bounds before releasing execution.
                    </p>
                  </div>

                  {/* Steps list */}
                  <div className="p-4 space-y-2 max-h-48 overflow-y-auto bg-slate-900">
                    {pendingPlan.steps.map((step) => (
                      <div 
                        key={step.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          step.enabled 
                            ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/30 text-slate-100' 
                            : 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
                        }`}
                        onClick={() => {
                          setPendingPlan(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              steps: prev.steps.map(s => s.id === step.id ? { ...s, enabled: !s.enabled } : s)
                            };
                          });
                        }}
                      >
                        <div className="flex items-center gap-3 pr-4">
                          <span className={`text-base shrink-0 ${step.enabled ? 'text-amber-400' : 'text-slate-600'}`}>
                            {step.enabled ? '⚡' : '🔒'}
                          </span>
                          <span className="text-xs font-mono">{step.text}</span>
                        </div>
                        <div className="shrink-0">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            step.enabled 
                              ? 'bg-amber-500 border-amber-500 text-slate-950' 
                              : 'bg-transparent border-slate-700 text-transparent'
                          }`}>
                            ✓
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button 
                      className="px-4 py-2 rounded font-mono text-xs font-bold border border-rose-500/40 text-rose-300 hover:bg-rose-950/30 cursor-pointer uppercase tracking-wider"
                      onClick={handleDenyPlan}
                    >
                      ✕ Reject Task
                    </button>
                    
                    <button 
                      className="px-6 py-2 rounded font-mono text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                      onClick={handleApprovePlan}
                    >
                      ✓ Authorize & Execute
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>

          <LogConsole 
            open={uiState.log} 
            onClose={() => setUiState(s => ({ ...s, log: false }))} 
            messages={messages} 
            activeAgent={activeAgent}
            onSaveVault={saveToVault}
            userName={userName}
          />
          <Sidebar 
            open={uiState.sidebar} 
            onClose={() => setUiState(s => ({ ...s, sidebar: false }))} 
            activeAgent={activeAgent} 
            onSelectAgent={(key) => {
              setMode('SINGLE');
              setActiveAgent(key);
              introduceIfNeeded(key);
            }} 
            mode={mode} 
            setMode={(m) => {
              setMode(m);
              if (m === 'ROUND TABLE') addMsg('system', 'MODE', 'Round table convened — your next message reaches the whole circle.');
              else addMsg('system', 'MODE', `Single-agent mode. Talking to ${AGENTS[activeAgent]?.name || activeAgent}.`);
            }} 
            logCount={messages.filter(m => m.role === 'user').length}
            onOpenLog={() => setUiState(s => ({ ...s, log: true }))}
            onOpenVault={() => {
              setUiState(s => ({ ...s, vault: !s.vault, connectors: false, log: false }));
            }}
            onOpenConnectors={() => {
              setUiState(s => ({ ...s, connectors: !s.connectors, vault: false, log: false, apiConfig: false }));
            }}
            onOpenApi={() => {
              setApiPanelTab('apis');
              setUiState(s => ({ ...s, apiConfig: true, sidebar: false }));
            }}
            onOpenBudget={() => {
              setUiState(s => ({ ...s, budgetWatcher: true, sidebar: false }));
            }}
            onOpenPersonas={() => {
              setApiPanelTab('personas');
              setUiState(s => ({ ...s, apiConfig: true, sidebar: false }));
            }}
            onOpenBuilder={() => {
              setUiState(s => ({ ...s, builder: true, sidebar: false }));
            }}
            onOpenQrCode={() => {
              setUiState(s => ({ ...s, qrCode: true, sidebar: false }));
            }}
            onOpenGmail={() => {
              setUiState(s => ({ ...s, gmail: true, sidebar: false }));
            }}
            onOpenOrchestrator={() => {
              setUiState(s => ({ ...s, orchestrator: true, sidebar: false }));
            }}
            onOpenWiretap={() => {
              setUiState(s => ({ ...s, wiretap: true, sidebar: false }));
            }}
            personas={personas}
            seats={roundTableSeats}
          />
          <VaultPanel open={uiState.vault} onClose={() => setUiState(s => ({ ...s, vault: false }))} />
          <ConnectorsPanel open={uiState.connectors} onClose={() => setUiState(s => ({ ...s, connectors: false }))} />
          <ApiPanel 
            open={uiState.apiConfig} 
            onClose={() => setUiState(s => ({ ...s, apiConfig: false }))} 
            activeProfileId={activeProfileId}
            onSelectProfile={handleSelectProfile}
            personas={personas}
            onUpdatePersonas={handleUpdatePersonas}
            initialTab={apiPanelTab}
          />
          <AgentBuilderModal
            open={uiState.builder}
            onClose={() => setUiState(s => ({ ...s, builder: false }))}
            personas={personas}
            onUpdatePersonas={handleUpdatePersonas}
            activeProfile={{
              id: activeProfileId,
              name: activeProfileName,
              model: activeProfileModel
            }}
            onSelectAgentSeat={(seatKey, customAgent) => {
              if (customAgent) {
                AGENTS[seatKey] = {
                  name: customAgent.name,
                  role: customAgent.roleTitle,
                  glyph: customAgent.glyph || '⚡',
                  idx: 99,
                  intro: customAgent.intro,
                  system: customAgent.systemPrompt,
                  color: customAgent.color || '#35f2df',
                  voice: customAgent.voice?.voiceId || 'alloy',
                  personality: customAgent.personality?.temperament?.join(', ') || 'analytical'
                };
              }
              setRoundTableSeats(prev => prev.includes(seatKey) ? prev : [...prev, seatKey]);
              setActiveAgent(seatKey);
              const seatName = AGENTS[seatKey]?.name || customAgent?.name || seatKey;
              addMsg('system', 'DEPLOYMENT', `Deployed ${customAgent?.name || seatKey} (${customAgent?.roleTitle || ''}) to Round Table seat (${seatName}).`);
            }}
          />
          <QrCodeModal
            open={uiState.qrCode}
            onClose={() => setUiState(s => ({ ...s, qrCode: false }))}
            activePersonas={personas}
          />
          <BudgetWatcherModal
            open={uiState.budgetWatcher}
            onClose={() => setUiState(s => ({ ...s, budgetWatcher: false }))}
            onOpenApiConfig={() => {
              setApiPanelTab('apis');
              setUiState(s => ({ ...s, apiConfig: true, budgetWatcher: false }));
            }}
            onOpenOptimizer={() => {
              setUiState(s => ({ ...s, builder: true, budgetWatcher: false }));
            }}
          />
          <GmailPanel
            open={uiState.gmail}
            onClose={() => setUiState(s => ({ ...s, gmail: false }))}
          />
          <TaskOrchestrator
            open={uiState.orchestrator}
            onClose={() => setUiState(s => ({ ...s, orchestrator: false }))}
            onDeliverMessage={(agentId, text) => {
              addMsg(agentId, agentId.toUpperCase(), text);
              speakAndLog(agentId as AgentKey, text);
            }}
            tasks={backgroundTasks}
            setTasks={setBackgroundTasks}
            activeTaskId={activeTaskId}
            setActiveTaskId={setActiveTaskId}
          />
          <WiretapPanel
            open={uiState.wiretap}
            onClose={() => setUiState(s => ({ ...s, wiretap: false }))}
            chats={interAgentChats}
            onClearChats={handleClearInterAgentChats}
            onInjectMessage={handleInjectInterAgentChat}
          />
          <DeviceConnector
            open={uiState.deviceConnector}
            onClose={() => setUiState(s => ({ ...s, deviceConnector: false }))}
            onClearAllSharedMessages={async () => {
              try {
                await fetch('/api/shared-messages/clear', { method: 'POST' });
              } catch (err) {
                console.error('Failed to clear shared messages:', err);
              }
            }}
            collaboratorCount={collaboratorCount}
            userName={userName}
            onChangeUserName={(name) => {
              setUserName(name);
              localStorage.setItem('prometheus_username', name);
            }}
            breakroomMessages={breakroomMessages}
            onSendBreakroomMessage={handleSendBreakroomMessage}
            onClearBreakroomMessages={handleClearBreakroomMessages}
          />
        </div>
      );

      if (deviceMode === 'tablet') {
        return (
          <div className="w-full flex items-center justify-center py-6 px-4 bg-[#010505] min-h-[85vh]">
            <div 
              className="w-full max-w-[850px] aspect-[4/3] rounded-[32px] border-[16px] border-slate-800 bg-[#020706] shadow-2xl relative flex flex-col overflow-hidden"
              style={{
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(53, 242, 223, 0.05)',
              }}
            >
              {/* Tablet Status Bar */}
              <div className="h-6 bg-slate-900 px-4 flex items-center justify-between text-[10px] font-mono text-slate-400 select-none border-b border-cyan-500/10 shrink-0">
                <span className="flex items-center gap-1">📶 <b>Co-Pilot Link Active</b></span>
                <span>12:00 PM</span>
                <span className="flex items-center gap-1">🔋 <b>98%</b></span>
              </div>
              
              {/* Embedded layout */}
              <div className="flex-1 overflow-auto relative flex flex-col min-h-0">
                {layoutContent}
              </div>
            </div>
          </div>
        );
      }

      if (deviceMode === 'phone') {
        return (
          <div className="w-full flex items-center justify-center py-6 px-4 bg-[#010505] min-h-[85vh]">
            <div 
              className="w-[390px] h-[780px] rounded-[48px] border-[16px] border-slate-800 bg-[#020706] shadow-2xl relative flex flex-col overflow-hidden"
              style={{
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(53, 242, 223, 0.05)',
              }}
            >
              {/* Phone Speaker Notch */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-[100] flex items-center justify-center">
                <span className="w-10 h-1 bg-slate-950 rounded-full"></span>
              </div>
              
              {/* Phone Status Bar */}
              <div className="h-8 bg-slate-900 pt-1 border-b border-cyan-500/10 px-6 flex items-center justify-between text-[9px] font-mono text-slate-400 select-none shrink-0">
                <span className="flex items-center gap-1">📶 <b>5G</b></span>
                <span className="ml-4">12:00 PM</span>
                <span className="flex items-center gap-1">🔋 <b>100%</b></span>
              </div>
              
              {/* Embedded layout */}
              <div className="flex-1 overflow-auto relative flex flex-col min-h-0">
                {layoutContent}
              </div>
              
              {/* Home Indicator */}
              <div className="h-4 bg-slate-900 shrink-0 flex items-center justify-center border-t border-cyan-500/5">
                <span className="w-28 h-1 bg-slate-700 rounded-full"></span>
              </div>
            </div>
          </div>
        );
      }

      return layoutContent;
    })()}
        
        <footer className="text-center py-4 text-[var(--muted)] text-[10px] uppercase tracking-wider shrink-0 mt-4 border-t border-[var(--line)]">
          REAL BROWSER STT + TTS · REAL AGENT CALLS TO THE MODEL · SPEECH IS SPOKEN SENTENCE-BY-SENTENCE, NOT TRUE TOKEN STREAMING · TAP THE MIC WHILE AN AGENT IS SPEAKING TO INTERRUPT IT · CONNECTORS ARE SAVED LOCALLY AND NOT YET WIRED TO REAL TOOL EXECUTION
        </footer>
      </div>
    </>
  );
}
