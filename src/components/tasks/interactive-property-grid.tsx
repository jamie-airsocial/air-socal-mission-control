'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Activity, Flag, User, Folder, Calendar as CalendarIcon, Tag, Plus, X 
} from 'lucide-react';
import { PropertyRow } from '@/components/board/property-row';
import { SearchableStatusPopover } from '@/components/board/searchable-status-popover';
import { SearchablePriorityPopover } from '@/components/board/searchable-priority-popover';
import { SearchableAssigneePopover } from '@/components/board/searchable-assignee-popover';
import { SearchableProjectPopover } from '@/components/board/searchable-project-popover';
import { EnhancedDatePicker, formatRelativeDate } from '@/components/board/enhanced-date-picker';
import { LabelCombobox } from '@/components/board/label-combobox';
import type { Project } from '@/lib/types';

// Generic task interface that works with both PreviewTask and Supabase Task
export interface TaskData {
  status: string;
  priority: string;
  assignee: string;
  project: { id: string; name: string; color: string } | null;
  dueDate: Date | null;
  dueTime: string;
  labels: string[];
}

export interface InteractivePropertyGridProps {
  task: TaskData;
  updateTask: (updates: Partial<TaskData>) => void;
  projects: Project[];
  allLabels?: string[]; // All existing labels across all tasks
  compact?: boolean;
  columns?: 1 | 2;
  statusOpen?: boolean;
  onStatusOpenChange?: (open: boolean) => void;
  priorityOpen?: boolean;
  onPriorityOpenChange?: (open: boolean) => void;
  assigneeOpen?: boolean;
  onAssigneeOpenChange?: (open: boolean) => void;
  dueDateOpen?: boolean;
  onDueDateOpenChange?: (open: boolean) => void;
}

export function InteractivePropertyGrid({ 
  task, 
  updateTask, 
  projects,
  allLabels = [],
  compact = false, 
  columns = 2,
  statusOpen: statusOpenProp,
  onStatusOpenChange,
  priorityOpen: priorityOpenProp,
  onPriorityOpenChange,
  assigneeOpen: assigneeOpenProp,
  onAssigneeOpenChange,
  dueDateOpen: dueDateOpenProp,
  onDueDateOpenChange,
}: InteractivePropertyGridProps) {
  const [internalDateOpen, setInternalDateOpen] = useState(false);
  const dueDateOpen = dueDateOpenProp !== undefined ? dueDateOpenProp : internalDateOpen;
  const setDueDateOpen = onDueDateOpenChange || setInternalDateOpen;
  
  const gridClass = columns === 2 ? 'grid grid-cols-2 gap-x-4' : 'space-y-0';
  const iconSize = compact ? 12 : 13;

  return (
    <div className={gridClass}>
      <PropertyRow icon={<Activity size={iconSize} />} label="Status">
        <SearchableStatusPopover
          value={task.status}
          onChange={(status) => updateTask({ status })}
          open={statusOpenProp}
          onOpenChange={onStatusOpenChange}
        />
      </PropertyRow>
      
      <PropertyRow icon={<Flag size={iconSize} />} label="Priority">
        <SearchablePriorityPopover
          value={task.priority}
          onChange={(priority) => updateTask({ priority })}
          open={priorityOpenProp}
          onOpenChange={onPriorityOpenChange}
        />
      </PropertyRow>
      
      <PropertyRow icon={<User size={iconSize} />} label="Assignee">
        <SearchableAssigneePopover
          value={task.assignee}
          onChange={(assignee) => updateTask({ assignee })}
          open={assigneeOpenProp}
          onOpenChange={onAssigneeOpenChange}
        />
      </PropertyRow>
      
      <PropertyRow icon={<Folder size={iconSize} />} label="Project">
        <SearchableProjectPopover
          value={task.project}
          projects={projects}
          onChange={(project) => updateTask({ project: project ?? null })}
        />
      </PropertyRow>
      
      <PropertyRow icon={<CalendarIcon size={iconSize} />} label="Due date">
        <div className="flex items-center gap-1.5">
          <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <PopoverTrigger asChild>
              <button className={`text-[13px] whitespace-nowrap hover:text-foreground/80 transition-colors duration-150 hover:bg-muted/60 rounded px-1.5 py-0.5 ${!task.dueDate ? 'text-muted-foreground/30' : ''}`}>
                {formatRelativeDate(task.dueDate)}
                {task.dueTime && <span> at {task.dueTime}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <EnhancedDatePicker
                date={task.dueDate}
                time={task.dueTime}
                onDateChange={(date) => updateTask({ dueDate: date })}
                onTimeChange={(time) => updateTask({ dueTime: time })}
                onClear={() => updateTask({ dueDate: null, dueTime: '' })}
                onOpenChange={setDueDateOpen}
              />
            </PopoverContent>
          </Popover>
          {(task.dueDate || task.dueTime) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => updateTask({ dueDate: null, dueTime: '' })}
                  className="p-0.5 flex items-center justify-center text-muted-foreground/30 hover:text-destructive transition-colors duration-150 opacity-0 group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Clear date</TooltipContent>
            </Tooltip>
          )}
        </div>
      </PropertyRow>
      
      <PropertyRow icon={<Tag size={iconSize} />} label="Labels">
        <LabelCombobox
          selectedLabels={task.labels}
          allLabels={allLabels}
          onChange={(labels) => updateTask({ labels })}
        />
      </PropertyRow>
    </div>
  );
}
