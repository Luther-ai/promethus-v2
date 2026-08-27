import React, { useEffect, useState } from 'react';
import { storage } from '../storage';

export function VaultPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<{ key: string; date: string; topic: string; notes: string }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadVault();
    }
  }, [open]);

  const loadVault = async () => {
    try {
      const listing = await storage.list('vault:');
      const loaded = [];
      for (const k of listing.keys) {
        const rec = await storage.get(k);
        const parsed = JSON.parse(rec.value);
        loaded.push({ key: k, ...parsed });
      }
      setItems(loaded);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section className={`panel fixed top-20 left-1/2 -translate-x-1/2 w-[min(600px,calc(100vw-40px))] z-30 transition-all duration-200 shadow-2xl ${open ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-4'}`}>
      <div className="panel-head">
        <span>Vault Memory</span>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>
      <div className="p-6 bg-[var(--bg)] min-h-[100px] max-h-[60vh] overflow-auto flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="text-[var(--muted)] text-sm text-center py-8">Nothing saved yet.</div>
        ) : (
          items.map(item => (
            <div key={item.key} className="bg-[rgba(0,0,0,0.3)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div 
                className="text-[var(--cyan)] text-sm font-semibold cursor-pointer flex justify-between"
                onClick={() => setExpanded(expanded === item.key ? null : item.key)}
              >
                <span>{item.topic}</span>
                <span className="text-[var(--muted)] text-xs font-normal">{item.date}</span>
              </div>
              {expanded === item.key && (
                <pre className="whitespace-pre-wrap text-sm text-[var(--ink)] mt-4 p-4 bg-[var(--panel)] rounded-lg border border-[var(--line)] font-mono overflow-auto">{item.notes}</pre>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
