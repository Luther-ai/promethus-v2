import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentKey } from '../types';

export interface SpeechJob {
  id: string;
  agentKey: AgentKey;
  text: string;
  audioBuffer?: AudioBuffer | null;
  onStart?: () => void;
  onEnd?: () => void;
}

export function useSpeechManager() {
  const [activeSpeaker, setActiveSpeaker] = useState<AgentKey | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const queueRef = useRef<SpeechJob[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const startMeter = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(avg / 128);
        animRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {}
  };

  const stopMeter = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setAudioLevel(0);
  };

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;

    isProcessingRef.current = true;
    const job = queueRef.current.shift();
    if (!job) {
      isProcessingRef.current = false;
      return;
    }

    setActiveSpeaker(job.agentKey);
    setIsSpeaking(true);
    if (job.onStart) job.onStart();
    startMeter();

    try {
      if (job.audioBuffer) {
        await new Promise<void>((resolve) => {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();

            const source = ctx.createBufferSource();
            source.buffer = job.audioBuffer!;
            source.connect(ctx.destination);
            if (analyserRef.current) {
              source.connect(analyserRef.current);
            }
            currentSourceRef.current = source;

            source.onended = () => {
              currentSourceRef.current = null;
              resolve();
            };
            source.start(0);
          } catch {
            resolve();
          }
        });
      } else {
        await new Promise<void>((resolve) => {
          if (!('speechSynthesis' in window)) {
            resolve();
            return;
          }

          // Cancel any lingering utterances
          try { window.speechSynthesis.cancel(); } catch {}

          const u = new SpeechSynthesisUtterance(job.text);
          currentUtteranceRef.current = u;

          if (job.agentKey === 'prometheus') { u.pitch = 0.85; u.rate = 1.0; }
          else if (job.agentKey === 'sage') { u.pitch = 1.05; u.rate = 0.98; }
          else if (job.agentKey === 'forge') { u.pitch = 0.92; u.rate = 1.05; }
          else { u.pitch = 1.1; u.rate = 1.0; }

          u.onend = () => {
            currentUtteranceRef.current = null;
            resolve();
          };

          u.onerror = () => {
            currentUtteranceRef.current = null;
            resolve();
          };

          try {
            window.speechSynthesis.speak(u);
          } catch {
            resolve();
          }
        });
      }
    } finally {
      stopMeter();
      if (job.onEnd) job.onEnd();

      // If queue is empty, release speaker lock
      if (queueRef.current.length === 0) {
        setActiveSpeaker(null);
        setIsSpeaking(false);
      }

      isProcessingRef.current = false;
      // Process next item in sequence
      processQueue();
    }
  }, []);

  const enqueue = useCallback((job: Omit<SpeechJob, 'id'>) => {
    const fullJob: SpeechJob = {
      ...job,
      id: `speech-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };
    queueRef.current.push(fullJob);
    processQueue();
  }, [processQueue]);

  const stop = useCallback(() => {
    queueRef.current = [];
    isProcessingRef.current = false;

    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }

    stopMeter();
    setActiveSpeaker(null);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    enqueue,
    stop,
    activeSpeaker,
    isSpeaking,
    audioLevel
  };
}
