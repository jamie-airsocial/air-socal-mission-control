'use client';

export function KeyboardShortcutsCheatSheet() {
  const shortcuts = [
    { key: 'Esc', desc: 'Close task / subtask' },
    { key: 'A', desc: 'Open assignee' },
    { key: 'P', desc: 'Open priority' },
    { key: 'S', desc: 'Open status' },
    { key: 'D', desc: 'Open due date' },
    { key: 'L', desc: 'Open labels' },
    { key: 'C', desc: 'Focus comment' },
    { key: 'E', desc: 'Edit title' },
  ];
  
  return (
    <div className="w-64 p-3">
      <h4 className="text-[13px] font-semibold text-foreground mb-2">Keyboard Shortcuts</h4>
      <div className="space-y-1.5">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground/60">{s.desc}</span>
            <kbd className="px-2 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono text-[13px] border border-border/20">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
