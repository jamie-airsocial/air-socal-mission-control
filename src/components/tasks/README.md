# Shared Task Components

This directory contains shared, reusable task UI components extracted from `task-preview/page.tsx` to ensure pixel-perfect consistency across task views.

## Components

### 1. `InteractiveSubtasks`
Full-featured subtask list with:
- Inline editing (double-click title)
- Multi-select with shift-click range selection
- Bulk operations (status, assignee, date, delete)
- Status, assignee, and date pickers
- Expand button to open subtask detail
- Progress bar

**Usage:**
```tsx
import { InteractiveSubtasks, tasksToSubtasks, subtasksToTaskUpdates } from '@/components/tasks';

// Convert your Supabase Task[] to Subtask[]
const subtasksData = tasksToSubtasks(tasks);

<InteractiveSubtasks
  subtasks={subtasksData}
  onUpdate={(updated) => {
    // Convert back to Task format
    const taskUpdates = subtasksToTaskUpdates(updated);
    // Save to Supabase
  }}
  onSubtaskClick={(id) => console.log('Open subtask', id)}
  showProgress={true}
/>
```

### 2. `CollapsibleAttachments`
Collapsible attachment list with:
- Expandable/collapsible sections
- Multi-select with shift-click
- Bulk download/delete
- Inline rename (double-click)
- File icons (image vs generic)
- Preview thumbnails when collapsed

**Usage:**
```tsx
import { CollapsibleAttachments, attachmentToFileAttachment } from '@/components/tasks';

// Convert Supabase attachments to shared format
const fileAttachments = attachments.map(attachmentToFileAttachment);

<CollapsibleAttachments
  attachments={fileAttachments}
  onAdd={(files) => console.log('Add files', files)}
  onDelete={(id) => console.log('Delete', id)}
  onRename={(id, name) => console.log('Rename', id, name)}
/>
```

### 3. `InteractivePropertyGrid`
Property grid for status, priority, assignee, project, due date, and labels.

**Usage:**
```tsx
import { InteractivePropertyGrid } from '@/components/tasks';

// Map your task to TaskData interface
const taskData = {
  status: task.status,
  priority: task.priority,
  assignee: task.assignee,
  project: { id: task.project_id, name: task.project_name, color: task.project_color },
  dueDate: task.due_date ? new Date(task.due_date) : null,
  dueTime: '', // Extract time if needed
  labels: task.labels || [],
};

<InteractivePropertyGrid
  task={taskData}
  projects={projects}
  updateTask={(updates) => {
    // Save updates to Supabase
  }}
  columns={2}
/>
```

### 4. `KeyboardShortcutsCheatSheet`
Simple keyboard shortcuts reference tooltip content.

**Usage:**
```tsx
import { KeyboardShortcutsCheatSheet } from '@/components/tasks';

<TooltipContent>
  <KeyboardShortcutsCheatSheet />
</TooltipContent>
```

## Adapters

Helper functions in `adapters.ts` convert between Supabase `Task` types and shared component types:

- `taskToSubtask(task: Task): Subtask`
- `subtaskToTaskUpdates(subtask: Subtask): Partial<Task>`
- `tasksToSubtasks(tasks: Task[]): Subtask[]`
- `subtasksToTaskUpdates(subtasks: Subtask[]): Partial<Task>[]`
- `attachmentToFileAttachment(attachment): FileAttachment`

## Why These Components?

These were extracted from `task-preview/page.tsx` (the gold standard design) to:
1. **Guarantee visual consistency** - same code = same appearance
2. **Reduce duplication** - 680+ lines of code now shared
3. **Easier maintenance** - fix once, applies everywhere
4. **Type safety** - shared interfaces prevent drift

## Migration Path

### Option 1: Full replacement (recommended for new code)
Import and use directly with adapters.

### Option 2: Gradual replacement
Keep existing implementations, gradually replace one component at a time.

### Option 3: Side-by-side
Use shared components in new views, keep custom implementations in legacy views.

## Status

✅ **Extracted and tested** - All components build successfully
⏳ **Integration in progress** - Ready to use in `task-sheet.tsx` and elsewhere
📝 **Documentation** - This README + TypeScript interfaces

## Notes

- All components are **client components** (`'use client'`)
- All components maintain **exact styling** from task-preview
- All components support **keyboard shortcuts** and accessibility
- Components depend on:
  - `@/components/board/searchable-*-popover.tsx` (already exist)
  - `@/components/board/enhanced-date-picker.tsx` (already exists)
  - `@/components/board/property-row.tsx` (already exists)
