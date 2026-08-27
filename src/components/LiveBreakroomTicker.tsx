import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function LiveBreakroomTicker({ 
  messages, 
  userName,
  onOpenBreakroom 
}: { 
  messages: any[]; 
  userName: string;
  onOpenBreakroom: () => void;
}) {
  const [latestMessage, setLatestMessage] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      setLatestMessage(last);
      setShow(true);
      
      const timer = setTimeout(() => {
        setShow(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  return (
    <AnimatePresence>
      {show && latestMessage && (
        <motion.div 
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[35] w-full max-w-xl px-4 pointer-events-none"
        >
          <div 
            className="bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-3 shadow-[0_0_30px_rgba(34,211,238,0.15)] flex items-center gap-3 pointer-events-auto cursor-pointer hover:bg-slate-900/90 transition-all group"
            onClick={onOpenBreakroom}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-lg shadow-[inset_0_0_10px_rgba(34,211,238,0.2)]">
                {latestMessage.who === 'SAM' ? '🍹' : '📱'}
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">
                  Live Breakroom Activity
                </span>
                <span className="text-[8px] text-slate-500 font-mono">• {new Date(latestMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-white shrink-0">{latestMessage.who}:</span>
                <span className="text-xs text-slate-300 truncate font-mono">
                  {latestMessage.type === 'action' ? `*${latestMessage.content}*` : latestMessage.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 px-2 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold font-mono">OPEN CHAT</span>
              <span className="text-xs">→</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShow(false);
              }}
              className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
