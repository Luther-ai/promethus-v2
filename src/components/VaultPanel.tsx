import React, { useEffect, useState, useRef } from 'react';
import { storage } from '../storage';
import * as d3 from 'd3';

interface VaultItem {
  key: string;
  date: string;
  topic: string;
  notes: string;
}

function NeuralMemoryMap({ items, onNodeClick, activeNode }: { items: VaultItem[], onNodeClick: (key: string) => void, activeNode: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || items.length === 0) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const width = 600;
    const height = 240;

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: any[] = [{ id: 'core', group: 0, label: 'Neural Core', radius: 14 }];
    
    items.forEach((item) => {
      nodes.push({ id: item.key, group: 1, label: item.topic, radius: 8, item });
    });

    const links: any[] = [];
    
    items.forEach(item => {
      links.push({ source: item.key, target: 'core', value: 1 });
    });

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const wordsI = new Set(items[i].topic.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const wordsJ = new Set(items[j].topic.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const intersection = new Set([...wordsI].filter(x => wordsJ.has(x)));
        if (intersection.size > 0) {
          links.push({ source: items[i].key, target: items[j].key, value: 2 });
        }
      }
    }

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => d.radius + 8));

    const defs = svg.append('defs');
    
    const filterCore = defs.append('filter').attr('id', 'glow-core');
    filterCore.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMergeCore = filterCore.append('feMerge');
    feMergeCore.append('feMergeNode').attr('in', 'coloredBlur');
    feMergeCore.append('feMergeNode').attr('in', 'SourceGraphic');

    const filterNode = defs.append('filter').attr('id', 'glow-node');
    filterNode.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur');
    const feMergeNode = filterNode.append('feMerge');
    feMergeNode.append('feMergeNode').attr('in', 'coloredBlur');
    feMergeNode.append('feMergeNode').attr('in', 'SourceGraphic');

    const link = svg.append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d: any) => d.value > 1 ? '#06b6d4' : '#334155')
      .attr('stroke-width', (d: any) => Math.sqrt(d.value) * 1.5);

    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', d => d.group === 0 ? 'default' : 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('click', (event, d: any) => {
        if (d.group !== 0) onNodeClick(d.id);
      });

    nodeGroup.append('circle')
      .attr('r', (d: any) => d.id === activeNode ? d.radius * 1.5 : d.radius)
      .attr('fill', (d: any) => {
        if (d.group === 0) return '#a855f7'; // Purple core
        if (d.id === activeNode) return '#fbbf24'; // Amber active
        return '#22d3ee'; // Cyan default
      })
      .attr('style', (d: any) => d.group === 0 ? 'filter: url(#glow-core);' : 'filter: url(#glow-node);')
      .attr('stroke', (d: any) => d.id === activeNode ? '#fff' : 'none')
      .attr('stroke-width', (d: any) => d.id === activeNode ? 2 : 0);

    nodeGroup.append('text')
      .text((d: any) => d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label)
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('fill', (d: any) => d.id === activeNode ? '#fbbf24' : '#94a3b8')
      .attr('font-weight', (d: any) => d.id === activeNode ? 'bold' : 'normal')
      .attr('dx', 14)
      .attr('dy', 4)
      .attr('pointer-events', 'none');

    nodeGroup.append('title').text((d: any) => d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup.attr('transform', (d: any) => {
        const x = Math.max(d.radius, Math.min(width - d.radius, d.x));
        const y = Math.max(d.radius, Math.min(height - d.radius, d.y));
        return `translate(${x},${y})`;
      });
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [items, activeNode]);

  return (
    <div className="w-full h-[240px] bg-slate-950/80 rounded-xl border border-cyan-500/20 overflow-hidden relative shadow-[inset_0_0_20px_rgba(34,211,238,0.1)] mb-4 shrink-0">
      <div className="absolute top-2 left-3 text-[10px] font-bold text-cyan-500/50 uppercase tracking-widest font-mono pointer-events-none">
        Neural Memory Map
      </div>
      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-sm">
          Awaiting Memory Imprints...
        </div>
      ) : (
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
      )}
    </div>
  );
}

export function VaultPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<VaultItem[]>([]);
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
    <section className={`panel fixed top-20 left-1/2 -translate-x-1/2 w-[min(700px,calc(100vw-40px))] z-30 transition-all duration-300 shadow-2xl ${open ? 'opacity-100 visible translate-y-0 scale-100' : 'opacity-0 invisible -translate-y-4 scale-95'}`}>
      <div className="panel-head border-b border-cyan-500/30 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🧠</span>
          <span className="font-mono font-bold tracking-widest text-sm text-cyan-50">VAULT MEMORY</span>
        </div>
        <button className="drawer-close text-cyan-500 hover:text-cyan-300 transition-colors" onClick={onClose}>✕</button>
      </div>
      <div className="p-4 bg-slate-900/95 min-h-[100px] max-h-[75vh] overflow-y-auto overflow-x-hidden flex flex-col custom-scrollbar">
        
        <NeuralMemoryMap 
          items={items} 
          onNodeClick={(key) => {
            setExpanded(expanded === key ? null : key);
            // Scroll to item
            setTimeout(() => {
              document.getElementById(`vault-item-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
          }} 
          activeNode={expanded}
        />

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-slate-500 text-sm font-mono text-center py-8 bg-black/20 rounded-xl border border-dashed border-slate-700">
              No memory imprints found.
            </div>
          ) : (
            items.map(item => (
              <div 
                id={`vault-item-${item.key}`}
                key={item.key} 
                className={`transition-all duration-200 border rounded-xl p-4 ${expanded === item.key ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'bg-black/40 border-slate-700/50 hover:border-slate-500/50 shadow-sm'}`}
              >
                <div 
                  className="cursor-pointer flex items-center justify-between group"
                  onClick={() => setExpanded(expanded === item.key ? null : item.key)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg transition-transform duration-200 ${expanded === item.key ? 'rotate-90' : ''}`}>
                      {expanded === item.key ? '📂' : '📁'}
                    </span>
                    <span className={`font-semibold font-mono text-sm ${expanded === item.key ? 'text-cyan-300' : 'text-slate-300 group-hover:text-cyan-100'}`}>
                      {item.topic}
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs font-mono bg-slate-800/50 px-2 py-1 rounded-md">{item.date}</span>
                </div>
                {expanded === item.key && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <pre className="whitespace-pre-wrap text-[13px] text-slate-300 bg-black/60 rounded-lg p-4 font-mono overflow-auto border border-slate-700 leading-relaxed custom-scrollbar max-h-[300px]">
                      {item.notes}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
