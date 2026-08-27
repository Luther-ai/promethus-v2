import { useState, useEffect, useRef } from 'react';
import { AgentKey } from '../types';

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [ttsAvailable, setTtsAvailable] = useState(true);

  const queue = useRef<{agentKey: AgentKey, text: string}[]>([]);
  const isProcessingQueue = useRef(false);
  const isPlaying = useRef(false);
  const animRef = useRef<number | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  
  const callbacksRef = useRef<{
    onStart: (k: AgentKey) => void;
    onEnd: (k: AgentKey) => void;
    onQueueEmpty: () => void;
  } | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setTtsAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (speaking) {
      let startTime = Date.now();
      const updateLevel = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const level = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * 8) * Math.cos(elapsed * 3));
        setAudioLevel(level);
        animRef.current = requestAnimationFrame(updateLevel);
      };
      animRef.current = requestAnimationFrame(updateLevel);
      return () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
    } else {
      setAudioLevel(0);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
  }, [speaking]);

  const splitSentences = (text: string) => {
    const clean = text.replace(/ROUTE:\s*[\w:, ]+\n+/i, '').trim();
    const parts = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
    return parts ? parts.map(s => s.trim()).filter(Boolean) : [clean];
  };

  const processQueue = async () => {
    if (isProcessingQueue.current) return;
    isProcessingQueue.current = true;

    while (queue.current.length > 0) {
      const item = queue.current[0];
      if (!item) {
        queue.current.shift();
        continue;
      }

      await playSentence(item.agentKey, item.text);
      if (callbacksRef.current?.onEnd) {
        callbacksRef.current.onEnd(item.agentKey);
      }
      queue.current.shift();
    }

    isProcessingQueue.current = false;
    isPlaying.current = false;
    setSpeaking(false);
    if (callbacksRef.current?.onQueueEmpty) {
      callbacksRef.current.onQueueEmpty();
    }
  };

  const playSentence = async (agentKey: AgentKey, text: string): Promise<void> => {
    if (!text.trim()) return;
    isPlaying.current = true;

    return new Promise((resolve) => {
      if (!ttsAvailable || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      const u = new SpeechSynthesisUtterance(text);
      currentUtterance.current = u;

      let rate = 1.0;
      if (agentKey === 'prometheus') { u.pitch = 0.85; u.rate = 1.0; rate = 1.0; }
      else if (agentKey === 'sage') { u.pitch = 1.05; u.rate = 0.98; rate = 0.98; }
      else if (agentKey === 'forge') { u.pitch = 0.92; u.rate = 1.05; rate = 1.05; }
      else { u.pitch = 1.1; u.rate = 1.0; rate = 1.0; }

      const wordCount = text.split(/\s+/).length;
      const estimatedDurationMs = Math.max(800, (wordCount / (2.5 * rate)) * 1000);
      const startTimeRef = { current: Date.now() };

      const updateSentenceLevel = () => {
        if (!isPlaying.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(1.0, elapsed / estimatedDurationMs);
        const envelope = Math.sin(progress * Math.PI);
        const modulation = 0.5 + 0.5 * Math.sin(elapsed / 120);
        const level = Math.max(0.15, envelope * modulation * 0.9 + 0.1);
        setAudioLevel(level);
      };

      const levelInterval = setInterval(updateSentenceLevel, 50);

      u.onstart = () => {
        startTimeRef.current = Date.now();
        setSpeaking(true);
        if (callbacksRef.current?.onStart) {
          callbacksRef.current.onStart(agentKey);
        }
      };

      u.onend = () => {
        clearInterval(levelInterval);
        currentUtterance.current = null;
        resolve();
      };

      u.onerror = (e) => {
        console.warn('TTS error:', e);
        clearInterval(levelInterval);
        currentUtterance.current = null;
        resolve();
      };

      try {
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn('SpeechSynthesis speak failed:', err);
        clearInterval(levelInterval);
        resolve();
      }
    });
  };

  const enqueueSentence = (agentKey: AgentKey, sentence: string, onStart: (k: AgentKey) => void, onEnd: (k: AgentKey) => void, onQueueEmpty: () => void) => {
    if (!sentence.trim()) return;
    callbacksRef.current = { onStart, onEnd, onQueueEmpty };
    queue.current.push({ agentKey, text: sentence.trim() });
    
    if (!isProcessingQueue.current) {
      processQueue();
    }
  };

  const speak = (agentKey: AgentKey, text: string, onStart: (k: AgentKey) => void, onEnd: (k: AgentKey) => void, onQueueEmpty: () => void) => {
    if (ttsAvailable && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    queue.current = [];
    isProcessingQueue.current = false;
    isPlaying.current = false;
    callbacksRef.current = { onStart, onEnd, onQueueEmpty };

    const sentences = splitSentences(text);
    sentences.forEach(sentence => {
      queue.current.push({ agentKey, text: sentence });
    });

    if (queue.current.length > 0 && !isProcessingQueue.current) {
      processQueue();
    }
  };

  const stop = () => {
    queue.current = [];
    if (ttsAvailable && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    setSpeaking(false);
    isProcessingQueue.current = false;
    isPlaying.current = false;
    setAudioLevel(0);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  return { speak, enqueueSentence, stop, speaking, audioLevel, ttsAvailable, usingKokoro: false };
}



