import { AgentKey } from '../types';

export type SpeechJob = {
  agentId: AgentKey;
  text: string;
  audioBuffer?: AudioBuffer | null;
  onStart?: () => void;
  onEnd?: () => void;
};

export function splitForSpeech(text: string): string[] {
  const clean = text.replace(/ROUTE:\s*[\w:, ]+\n+/i, '').trim();
  const matches = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return matches ? matches.map(s => s.trim()).filter(Boolean) : [clean];
}

class SpeechQueueManager {
  private queue: SpeechJob[] = [];
  private isSpeaking = false;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private activeSpeakerListener: ((agentId: AgentKey | null) => void) | null = null;

  public setSpeakerListener(listener: (agentId: AgentKey | null) => void) {
    this.activeSpeakerListener = listener;
  }

  public async enqueue(job: SpeechJob) {
    this.queue.push(job);
    await this.processQueue();
  }

  public async enqueueBatch(jobs: SpeechJob[]) {
    for (const job of jobs) {
      this.queue.push(job);
    }
    await this.processQueue();
  }

  private async processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;

    this.isSpeaking = true;
    const job = this.queue.shift()!;

    if (this.activeSpeakerListener) {
      this.activeSpeakerListener(job.agentId);
    }
    if (job.onStart) {
      job.onStart();
    }

    try {
      if (job.audioBuffer) {
        await this.playAudioBuffer(job.audioBuffer);
      } else {
        await this.playWebSpeech(job.agentId, job.text);
      }
    } finally {
      if (job.onEnd) {
        job.onEnd();
      }
      this.isSpeaking = false;
      
      if (this.queue.length === 0 && this.activeSpeakerListener) {
        this.activeSpeakerListener(null);
      }

      // Process next in queue
      await this.processQueue();
    }
  }

  private playAudioBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        this.currentAudioSource = source;

        source.onended = () => {
          this.currentAudioSource = null;
          resolve();
        };
        source.start(0);
      } catch (e) {
        console.warn("AudioBuffer playback failed:", e);
        resolve();
      }
    });
  }

  private playWebSpeech(agentKey: AgentKey, text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      const u = new SpeechSynthesisUtterance(text);
      if (agentKey === 'prometheus') { u.pitch = 0.82; u.rate = 0.98; }
      else if (agentKey === 'sage') { u.pitch = 1.04; u.rate = 0.94; }
      else if (agentKey === 'forge') { u.pitch = 0.97; u.rate = 1.08; }
      else { u.pitch = 1.12; u.rate = 1.0; }

      u.onend = () => resolve();
      u.onerror = () => resolve();

      speechSynthesis.speak(u);
    });
  }

  public stop() {
    this.queue = [];
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {}
      this.currentAudioSource = null;
    }
    this.isSpeaking = false;
    if (this.activeSpeakerListener) {
      this.activeSpeakerListener(null);
    }
  }
}

export const speechQueueManager = new SpeechQueueManager();
