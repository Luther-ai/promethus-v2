# PROMETHEUS V2 — JARVIS HUD DESIGN HANDOFF

## Design direction

The interface is now a cinematic command center rather than a collection of panels. The visual language combines the supplied futuristic HUD references with a restrained JARVIS/reactor aesthetic: deep navy-black surfaces, cyan energy, thin technical lines, concentric radar geometry, compact telemetry, and a single dominant command core.

## Core layout

- **Top system bar:** identity, system health, provider state, and secondary controls.
- **Central reactor:** Prometheus is the visual anchor. The selected AI is surfaced in the core while every Roundtable seat remains visible as a discrete node.
- **Command dock:** voice + text are one interaction surface. The microphone is the primary action, the text field remains always available, and input level is visible without competing with the command itself.
- **Peripheral telemetry:** small readouts provide context without becoming dashboard noise.
- **Panels/drawers:** existing API, Vault, Gmail, Task Orchestrator, Wiretap, Builder, Budget Watcher, and Device Connector features keep their functionality but inherit the new surface language.

## Visual tokens

- Background: `#03070D` / `#02050A`
- Primary energy: `#58E7FF`
- Secondary blue: `#6C8DFF`
- Success: `#67F6C0`
- Warning: `#FFC35C`
- Danger: `#FF6D7D`
- Panel radius: 14–18px
- Technical copy: JetBrains Mono
- UI/body copy: Inter
- Glow: restrained, local to active systems rather than global neon haze

## Interaction model

### Voice first
The microphone remains the highest-salience control. Listening, thinking, speaking, and standby states are visually distinct through the same reactor vocabulary.

### Direct agent targeting
Typing `/` exposes the Roundtable agents. Arrow keys navigate, Tab selects, and Enter sends. This keeps the fast-path for power users while remaining obvious to new users.

### Command palette
`Ctrl+K` / `Cmd+K` opens the global command palette. It exposes the main control systems without requiring the user to visually hunt through the top bar.

### Progressive disclosure
Secondary tools remain available, but do not compete with the command core. The hierarchy is: command → current AI state → supporting telemetry → configuration.

## Accessibility review

- Visible `:focus-visible` rings use the primary cyan token.
- Agent nodes expose descriptive `aria-label` text and `aria-pressed` state.
- The live transcript uses `aria-live="polite"` so voice feedback is announced without stealing focus.
- Command palette is exposed as a modal dialog and its search input is focusable on open.
- Motion-heavy HUD effects have a `prefers-reduced-motion` fallback.
- Text is not used as the only carrier of interaction state; active controls also receive border/glow/shape changes.

## Efficient-subagent / orchestration presentation

Existing background task orchestration is deliberately represented as a supporting system instead of another full-screen dashboard. The main reactor communicates the active state; detailed tree/progress remains in Task Orchestrator where the user explicitly asks for it.

## Context-engineering / token-optimization UX

The UI keeps prompts compact and predictable. Slash targeting reduces routing ambiguity, the command palette reduces repetitive navigation instructions, and the central state label communicates whether the system is idle, listening, processing, or speaking before the user reads secondary logs.

The visual layer intentionally avoids adding verbose persistent status copy. Detailed diagnostics remain available on demand.

## Design: UX copy

Preferred command copy:

- `Ask Prometheus anything…`
- `Ready. Speak naturally or type a command below.`
- `DIRECT TARGET`
- `VOICE LINK // LISTENING`
- `NEURAL CORE // NOMINAL`
- `CORE // STANDBY`
- `COMMAND PALETTE`

Avoid alarmist language for normal states. Reserve emergency/warning language for genuine budget, connection, or execution faults.

## Changed files

- `src/components/CoreRing.tsx` — redesigned central reactor, Roundtable nodes, state readouts, transcript treatment.
- `src/components/CommandDock.tsx` — redesigned voice/text command surface, slash targeting, audio meter, keyboard-forward UX.
- `src/index.css` — new visual system, responsive behavior, motion controls, focus treatment, panel polish, and HUD palette styling.
- `src/lib/hudEnhancements.ts` — global command palette and keyboard shortcut layer.
- `src/main.tsx` — installs the global HUD enhancement layer.

## Engineering principles used

`context-engineering` · `efficient-subagents` · `frontend-design` · `design:accessibility-review` · `high-quality-ui-ux` · `design:ux-copy` · `jarvis-ai-builder` · `token-optimization` · `design:design-handoff`
