import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeech(
  onResult: (text: string, isFinal: boolean) => void,
  onInterrupt: () => void
) {
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [sttAvailable, setSttAvailable] = useState(true);
  
  const recognizer = useRef<any>(null);
  const audioCtx = useRef<any>(null);
  const analyser = useRef<any>(null);
  const micStream = useRef<any>(null);
  const meterRAF = useRef<number | null>(null);
  const listeningRef = useRef(false);
  listeningRef.current = listening;

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onInterruptRef = useRef(onInterrupt);
  onInterruptRef.current = onInterrupt;

  const stopListeningRef = useRef<() => void>(() => {});

  const startMeter = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      micStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new Ctx();
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 256;
      audioCtx.current.createMediaStreamSource(micStream.current).connect(analyser.current);
      
      const data = new Uint8Array(analyser.current.frequencyBinCount);
      const tick = () => {
        if (!analyser.current) return;
        analyser.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(100, avg / 2.2));
        meterRAF.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error('Meter error', e);
    }
  };

  const stopMeter = () => {
    if (meterRAF.current) cancelAnimationFrame(meterRAF.current);
    meterRAF.current = null;
    setLevel(0);
    if (micStream.current) micStream.current.getTracks().forEach((t: any) => t.stop());
    micStream.current = null;
    if (audioCtx.current) {
      audioCtx.current.close().catch(() => {});
      audioCtx.current = null;
    }
    analyser.current = null;
  };

  const stopListening = useCallback(() => {
    setListening(false);
    listeningRef.current = false;
    if (recognizer.current) {
      try { recognizer.current.stop(); } catch {}
    }
    stopMeter();
  }, []);

  stopListeningRef.current = stopListening;

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      
      rec.onstart = () => {
        setListening(true);
        startMeter();
      };
      
      rec.onresult = (e: any) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        if (interim) {
          onResultRef.current(interim, false);
        }
        if (final.trim()) {
          onResultRef.current(final.trim(), true);
          // Close the microphone the moment the user is done talking
          stopListeningRef.current();
        }
      };
      
      rec.onerror = (e: any) => {
        console.warn('STT warning/error:', e.error);
        if (e.error === 'not-allowed') {
          setListening(false);
          stopMeter();
        }
      };
      
      rec.onend = () => {
        // If we are still supposed to be listening, auto-restart
        if (listeningRef.current) {
          try {
            rec.start();
          } catch (err) {
            // ignore if already started
          }
        } else {
          stopMeter();
        }
      };
      
      recognizer.current = rec;
    } else {
      setSttAvailable(false);
    }
    
    return () => {
      if (recognizer.current) {
        try { recognizer.current.stop(); } catch {}
      }
      stopMeter();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognizer.current) return;
    try {
      listeningRef.current = true;
      setListening(true);
      recognizer.current.start();
    } catch (e) {
      // already started or error
    }
  }, []);

  const toggleMic = (isSpeaking: boolean) => {
    if (isSpeaking) {
      onInterruptRef.current();
      if (recognizer.current && !listeningRef.current) {
        startListening();
      }
      return;
    }
    if (listeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    listening,
    level,
    sttAvailable,
    toggleMic
  };
}
