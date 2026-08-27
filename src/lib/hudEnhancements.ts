const COMMANDS = [
  { id: 'control', label: 'Open Control Deck', search: 'control deck agents round table settings', hint: 'Panels', match: ['Control Deck'] },
  { id: 'builder', label: 'Open AI Builder', search: 'agent builder trainer forge', hint: 'Build', match: ['AI Builder'] },
  { id: 'api', label: 'Open API Adder', search: 'api provider model connection', hint: 'Config', match: ['API Adder'] },
  { id: 'log', label: 'Open Chat Log', search: 'chat history transcript log', hint: 'History', match: ['Chat Log'] },
  { id: 'device', label: 'Open Device Connector', search: 'device connector collaboration', hint: 'Link', match: ['Device Connector'] },
  { id: 'arcade', label: 'Launch 2D Arcade', search: 'arcade games breakroom', hint: 'Fun', match: ['2D Arcade'] },
  { id: 'gmail', label: 'Connect Gmail', search: 'gmail email workspace', hint: 'Workspace', match: ['Connect Real Email'] },
];

function clickFirst(match: string[]) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const hit = buttons.find(button => match.some(term => (button.getAttribute('title') || '').includes(term) || (button.textContent || '').trim().includes(term)));
  hit?.click();
}

function buildPalette() {
  const existing = document.getElementById('hud-command-palette');
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.id = 'hud-command-palette';
  overlay.className = 'hud-palette-backdrop';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="hud-palette" role="dialog" aria-modal="true" aria-label="Prometheus command palette">
      <div class="hud-palette-head">
        <span>COMMAND PALETTE</span>
        <kbd>ESC</kbd>
      </div>
      <label class="hud-palette-search">
        <span>⌕</span>
        <input id="hud-palette-input" autocomplete="off" placeholder="Search command systems…" aria-label="Search commands" />
        <kbd>Ctrl K</kbd>
      </label>
      <div id="hud-palette-list" class="hud-palette-list"></div>
      <div class="hud-palette-foot"><span>ENTER execute</span><span>↑ ↓ navigate</span><span>ESC close</span></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('#hud-palette-input')!;
  const list = overlay.querySelector<HTMLDivElement>('#hud-palette-list')!;
  let filtered = COMMANDS;
  let selected = 0;

  const render = () => {
    list.innerHTML = filtered.map((command, index) => `
      <button type="button" class="hud-palette-item ${index === selected ? 'is-selected' : ''}" data-command="${command.id}">
        <span class="palette-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="palette-copy"><b>${command.label}</b><small>${command.search}</small></span>
        <span class="palette-hint">${command.hint}</span>
      </button>
    `).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => {
      button.addEventListener('click', () => {
        const command = COMMANDS.find(item => item.id === button.dataset.command);
        if (command) clickFirst(command.match);
        close();
      });
    });
  };

  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    input.value = '';
    filtered = COMMANDS;
    selected = 0;
    render();
  };

  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => input.focus(), 30);
    render();
  };

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    filtered = COMMANDS.filter(command => `${command.label} ${command.search}`.toLowerCase().includes(query));
    selected = 0;
    render();
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = filtered.length ? (selected + 1) % filtered.length : 0;
      render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = filtered.length ? (selected - 1 + filtered.length) % filtered.length : 0;
      render();
    } else if (event.key === 'Enter') {
      const command = filtered[selected];
      if (command) clickFirst(command.match);
      close();
    } else if (event.key === 'Escape') {
      close();
    }
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });

  (overlay as any).__open = open;
  (overlay as any).__close = close;
  render();
  return overlay;
}

export function installHudEnhancements() {
  if (typeof window === 'undefined') return;
  const palette = buildPalette() as any;
  const handler = (event: KeyboardEvent) => {
    const isCommand = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (isCommand) {
      event.preventDefault();
      palette.__open?.();
      return;
    }
    if (event.key === 'Escape') palette.__close?.();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
