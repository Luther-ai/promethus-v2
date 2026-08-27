import React, { useEffect, useState } from 'react';
import { storage } from '../storage';

export function ConnectorsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('mcp');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  useEffect(() => {
    if (open) load();
  }, [open]);

  const load = async () => {
    try {
      const listing = await storage.list('conn:');
      const loaded = [];
      for (const k of listing.keys) {
        const rec = await storage.get(k);
        loaded.push({ id: k, ...JSON.parse(rec.value) });
      }

      if (loaded.length === 0) {
        // Seed default Reflo GitHub connector
        const refloConn = {
          id: 'conn:reflo-github',
          name: 'Reflo AI GitHub (PR & Browser Flow Validator)',
          type: 'mcp',
          url: 'https://github.com/reflow-project/reflow',
          key: ''
        };
        await storage.set(refloConn.id, JSON.stringify(refloConn));
        loaded.push(refloConn);
      }

      setItems(loaded);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async () => {
    if (!name || !url) return;
    const id = 'conn:' + Date.now();
    await storage.set(id, JSON.stringify({ name, type, url, key }));
    setName('');
    setUrl('');
    setKey('');
    load();
  };

  const handleRemove = async (id: string) => {
    await storage.delete(id);
    load();
  };

  return (
    <section className={`panel fixed top-20 left-1/2 -translate-x-1/2 w-[min(500px,calc(100vw-40px))] z-30 transition-all duration-200 ${open ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-4'}`}>
      <div className="panel-head">
        <span>Connectors — MCP / API / Tools</span>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>
      <div className="p-4 bg-[var(--bg)] max-h-[70vh] overflow-auto">
        <div className="mb-3">
          <label className="block text-[10px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1">Name</label>
          <input className="w-full p-2.5 bg-[rgba(255,255,255,0.03)] border border-[var(--line)] text-[var(--ink)] rounded-lg outline-none focus:border-[var(--cyan)]" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My MCP Server" />
        </div>
        <div className="mb-3">
          <label className="block text-[10px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1">Type</label>
          <select className="w-full p-2.5 bg-[rgba(255,255,255,0.03)] border border-[var(--line)] text-[var(--ink)] rounded-lg outline-none focus:border-[var(--cyan)]" value={type} onChange={e => setType(e.target.value)}>
            <option value="mcp" className="bg-[#071512]">MCP Server</option>
            <option value="rest" className="bg-[#071512]">REST API</option>
            <option value="other" className="bg-[#071512]">Other</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-[10px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1">URL / Endpoint</label>
          <input className="w-full p-2.5 bg-[rgba(255,255,255,0.03)] border border-[var(--line)] text-[var(--ink)] rounded-lg outline-none focus:border-[var(--cyan)]" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="mb-4">
          <label className="block text-[10px] text-[var(--muted)] tracking-[0.1em] uppercase mb-1">API Key (optional)</label>
          <input className="w-full p-2.5 bg-[rgba(255,255,255,0.03)] border border-[var(--line)] text-[var(--ink)] rounded-lg outline-none focus:border-[var(--cyan)]" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="optional" />
        </div>
        <button className="btn active w-full justify-center mb-4 py-2.5 font-semibold" onClick={handleAdd}>+ Add Connector</button>
        
        <div className="mt-4 flex flex-col gap-3">
          {items.map(item => (
            <div key={item.id} className="border border-[var(--line)] bg-[rgba(0,0,0,0.3)] rounded-xl p-3 mb-2 shadow-sm">
              <div className="flex justify-between items-center text-sm">
                <b className="text-[var(--ink)]">{item.name}</b>
                <span className="text-[10px] font-bold py-1 px-2 border border-[var(--line)] rounded-md text-[var(--muted)] uppercase bg-[var(--panel)]">{item.type}</span>
              </div>
              <div className="text-xs text-[var(--muted)] mt-1.5 break-all font-mono">{item.url}</div>
              <span className="text-[10px] font-bold text-[var(--amber)] mt-2 block flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]"></span> saved locally — not yet wired</span>
              <button className="btn danger mt-3 text-xs py-1.5 px-3 font-semibold" onClick={() => handleRemove(item.id)}>Remove</button>
            </div>
          ))}
          {items.length === 0 && <div className="text-[var(--muted)] text-sm py-4 text-center">No connectors added yet.</div>}
        </div>
        
        <div className="text-[10px] text-[var(--muted)] leading-relaxed border-t border-[var(--line)] mt-4 pt-4">
          Connectors are saved in this browser only. Registering one here does not yet give agents the ability to call it — real MCP/tool execution needs a backend service holding your keys, which this browser page can't safely run on its own. This panel is the honest first step: real config, clearly marked as not yet wired to execution.
        </div>
      </div>
    </section>
  );
}
