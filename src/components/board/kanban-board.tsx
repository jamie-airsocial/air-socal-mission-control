'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult, type DragStart, type DragUpdate } from '@hello-pangea/dnd';
import type { Task, Project } from '@/lib/types';
import { STATUSES, PRIORITIES } from '@/lib/types';
import { STATUS_STYLES, PRIORITY_STYLES, SLUG_TO_NAME, SERVICE_STYLES, TEAM_STYLES } from '@/lib/constants';
import { TaskCard } from './task-card';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStatuses } from '@/hooks/use-statuses';

export type KanbanGroupBy = 'status' | 'priority' | 'project' | 'assignee' | 'service' | 'team';

interface KanbanColumn {
  id: string;
  label: string;
  /** Tailwind bg class for the dot indicator */
  dotClass?: string;
  /** Optional inline color for dynamic data (e.g. project colours from DB) */
  dotColor?: string;
}

interface KanbanBoardProps {
  tasks: (Task & { project_name?: string; project_color?: string })[];
  onTaskClick: (task: Task & { project_name?: string; project_color?: string }) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onFieldChange?: (taskId: string, field: 'priority' | 'project_id' | 'assignee' | 'service', value: string | null) => void;
  onAddTask?: (columnId: string) => void;
  onViewCompleted?: () => void;
  groupBy?: KanbanGroupBy;
  projects?: Project[];
}

type TaskWithProject = Task & { project_name?: string; project_color?: string };

function defaultSort(tasks: TaskWithProject[], columnId: string): TaskWithProject[] {
  return [...tasks].sort((a, b) => {
    if (columnId === 'done') {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    }
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

/** Source ghost — grey dashed outline where the card was picked up from. */
function SourceGhost({ height, negativeMargin }: { height: number; negativeMargin: boolean }) {
  return (
    <div
      className="rounded-xl pointer-events-none"
      style={{
        border: '2px dashed var(--muted-foreground)',
        opacity: 0.2,
        height,
        boxSizing: 'border-box',
        marginBottom: negativeMargin ? -(height) : 8,
      }}
    />
  );
}

/** Drop indicator — dashed outline showing where the card will land. */
function DropIndicator({ height }: { height: number }) {
  return (
    <div
      className="rounded-xl pointer-events-none"
      style={{
        border: '2px dashed var(--primary)',
        opacity: 0.4,
        background: 'color-mix(in oklab, var(--primary) 6%, transparent)',
        height,
        boxSizing: 'border-box',
        marginBottom: -(height),
      }}
    />
  );
}

// TODO: Replace hardcoded Tailwind colour classes with CSS variable approach
// (e.g. [background:var(--color-status-todo)]) once design tokens for status/priority
// dot colours are defined in the global CSS. Hardcoded classes are used for now
// because Tailwind requires full class names at build time and our semantic tokens
// don't currently have solid (non-opacity-modified) equivalents.
const PRIORITY_DOT_CLASSES: Record<string, string> = {
  P1: 'bg-red-500',
  P2: 'bg-amber-500',
  P3: 'bg-indigo-500',
  P4: 'bg-emerald-500',
};

const STATUS_DOT_CLASSES: Record<string, string> = {
  todo: 'bg-amber-500',
  doing: 'bg-purple-500',
  review: 'bg-blue-500',
  done: 'bg-emerald-500',
};

/** Per-assignee dot colours — solid, no opacity modifier */
const ASSIGNEE_DOT_CLASSES: Record<string, string> = {
  jamie: 'bg-green-400',
  casper: 'bg-indigo-400',
  developer: 'bg-blue-400',
  'ui-designer': 'bg-purple-400',
  'qa-tester': 'bg-red-400',
  copywriter: 'bg-amber-400',
  analyst: 'bg-cyan-400',
  manager: 'bg-slate-400',
  trainer: 'bg-orange-400',
  heartbeat: 'bg-pink-400',
};

export function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  onFieldChange,
  onAddTask,
  onViewCompleted,
  groupBy = 'status',
  projects = [],
}: KanbanBoardProps) {
  const [columnOrder, setColumnOrder] = useState<Record<string, string[]>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [destination, setDestination] = useState<{ droppableId: string; index: number } | null>(null);
  const [source, setSource] = useState<{ col: string; idx: number } | null>(null);
  const dragHeightRef = useRef(72);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { statuses: dynamicStatuses, loading: statusesLoading } = useStatuses();

  // Reset column order when group-by changes
  useEffect(() => {
    setColumnOrder({});
  }, [groupBy]);

  // Build column definitions based on groupBy
  const columns = useMemo<KanbanColumn[]>(() => {
    if (groupBy === 'priority') {
      const cols: KanbanColumn[] = PRIORITIES.map((p) => ({
        id: p,
        label: PRIORITY_STYLES[p]?.label || p,
        dotClass: PRIORITY_DOT_CLASSES[p],
      }));
      // Only show "No Priority" column if at least one task has no priority
      if (tasks.some((t) => !t.priority)) {
        cols.unshift({ id: 'no-priority', label: 'No priority', dotClass: 'bg-muted-foreground/40' });
      }
      return cols;
    }

    if (groupBy === 'project') {
      const cols: KanbanColumn[] = projects.map((p) => ({
        id: p.id,
        label: p.name,
        dotColor: p.color,
      }));
      // Only show "No Client" column if at least one task has no project
      if (tasks.some((t) => !t.project_id)) {
        cols.unshift({ id: 'no-client', label: 'No client', dotClass: 'bg-muted-foreground/40' });
      }
      return cols;
    }

    if (groupBy === 'assignee') {
      // Derive unique assignees from current task set, sorted by known order
      const knownOrder = Object.keys(SLUG_TO_NAME); // keys are slugs
      const assigneeSlugs = Array.from(
        new Set(
          (tasks.map((t) => t.assignee) as (string | null | undefined)[]).filter(
            (a): a is string => Boolean(a)
          )
        )
      ).sort((a, b) => {
        const ai = knownOrder.indexOf(a);
        const bi = knownOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      const cols: KanbanColumn[] = assigneeSlugs.map((slug) => ({
        id: slug,
        label: SLUG_TO_NAME[slug] || slug,
        dotClass: ASSIGNEE_DOT_CLASSES[slug] || 'bg-muted-foreground',
      }));
      if (tasks.some((t) => !t.assignee)) {
        cols.unshift({ id: 'unassigned', label: 'No assignee', dotClass: 'bg-muted-foreground/40' });
      }
      return cols;
    }

    if (groupBy === 'service') {
      const cols: KanbanColumn[] = Object.entries(SERVICE_STYLES).map(([key, style]) => ({
        id: key,
        label: style.label,
        dotClass: '',
      }));
      if (tasks.some((t) => !t.service)) {
        cols.unshift({ id: 'no-service', label: 'No service', dotClass: 'bg-muted-foreground/40' });
      }
      return cols;
    }

    if (groupBy === 'team') {
      const cols: KanbanColumn[] = Object.entries(TEAM_STYLES).map(([key, style]) => ({
        id: key,
        label: style.label,
        dotColor: style.color,
      }));
      if (tasks.some((t) => !t.client_team)) {
        cols.unshift({ id: 'no-team', label: 'No team', dotClass: 'bg-muted-foreground/40' });
      }
      return cols;
    }

    // Default: status - use dynamic statuses if loaded, fallback to hardcoded
    const statusSource = !statusesLoading && dynamicStatuses.length > 0 ? dynamicStatuses : STATUSES.map(s => ({
      slug: s,
      label: STATUS_STYLES[s]?.label || s,
      colour: STATUS_STYLES[s]?.text || '#6366f1',
      sort_order: STATUSES.indexOf(s),
    }));
    
    const cols: KanbanColumn[] = statusSource.map((status) => {
      const slug = typeof status === 'string' ? status : status.slug;
      const label = typeof status === 'string' ? (STATUS_STYLES[status]?.label || status) : status.label;
      return {
        id: slug,
        label,
        dotClass: STATUS_DOT_CLASSES[slug],
      };
    });
    if (tasks.some((t) => !t.status)) {
      cols.unshift({ id: 'no-status', label: 'No status', dotClass: 'bg-muted-foreground/40' });
    }
    return cols;
  }, [groupBy, projects, tasks, dynamicStatuses, statusesLoading]);

  const getColumnTasks = useCallback(
    (columnId: string): TaskWithProject[] => {
      let columnTasks: TaskWithProject[];

      if (groupBy === 'priority') {
        columnTasks =
          columnId === 'no-priority'
            ? tasks.filter((t) => !t.priority)
            : tasks.filter((t) => t.priority === columnId);
      } else if (groupBy === 'project') {
        columnTasks =
          columnId === 'no-client'
            ? tasks.filter((t) => !t.project_id)
            : tasks.filter((t) => t.project_id === columnId);
      } else if (groupBy === 'assignee') {
        columnTasks =
          columnId === 'unassigned'
            ? tasks.filter((t) => !t.assignee)
            : tasks.filter((t) => t.assignee === columnId);
      } else if (groupBy === 'service') {
        columnTasks =
          columnId === 'no-service'
            ? tasks.filter((t) => !t.service)
            : tasks.filter((t) => t.service === columnId);
      } else if (groupBy === 'team') {
        columnTasks =
          columnId === 'no-team'
            ? tasks.filter((t) => !t.client_team)
            : tasks.filter((t) => t.client_team === columnId);
      } else {
        // Status grouping — merge backlog into todo
        columnTasks =
          columnId === 'no-status'
            ? tasks.filter((t) => !t.status)
            : columnId === 'todo'
            ? tasks.filter((t) => t.status === 'todo' || (t.status as string) === 'backlog')
            : tasks.filter((t) => t.status === columnId);
      }

      const customOrder = columnOrder[columnId];
      if (customOrder) {
        const ordered: TaskWithProject[] = [];
        const taskMap = new Map(columnTasks.map((t) => [t.id, t]));
        for (const id of customOrder) {
          const task = taskMap.get(id);
          if (task) { ordered.push(task); taskMap.delete(id); }
        }
        const remaining = defaultSort(Array.from(taskMap.values()), columnId);
        return [...ordered, ...remaining];
      }
      return defaultSort(columnTasks, columnId);
    },
    [tasks, columnOrder, groupBy]
  );

  // Pre-compute tasks for every column once per render cycle instead of calling
  // getColumnTasks individually inside the render map (#29)
  const columnTasksMap = useMemo<Record<string, TaskWithProject[]>>(() => {
    const map: Record<string, TaskWithProject[]> = {};
    for (const col of columns) {
      map[col.id] = getColumnTasks(col.id);
    }
    return map;
  }, [columns, getColumnTasks]);

  // Scroll indicator logic
  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollIndicators();
    const ro = new ResizeObserver(updateScrollIndicators);
    ro.observe(el);
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScrollIndicators);
    };
  }, [updateScrollIndicators, columns.length]);

  const onDragStart = (start: DragStart) => {
    setIsDragging(true);
    setSource({ col: start.source.droppableId, idx: start.source.index });
    setDestination({ droppableId: start.source.droppableId, index: start.source.index });
    const el = document.querySelector(`[data-rfd-draggable-id="${start.draggableId}"]`);
    if (el) dragHeightRef.current = el.getBoundingClientRect().height;
  };

  const onDragUpdate = (update: DragUpdate) => {
    if (update.destination) {
      setDestination({ droppableId: update.destination.droppableId, index: update.destination.index });
    } else {
      setDestination(null);
    }
  };

  const onDragEnd = (result: DropResult) => {
    setIsDragging(false);
    setDestination(null);
    setSource(null);
    const { source: dragSource, destination: dest, draggableId } = result;
    if (!dest) return;

    const sourceColId = dragSource.droppableId;
    const destColId = dest.droppableId;

    if (sourceColId === destColId) {
      const currentTasks = getColumnTasks(sourceColId);
      const ids = currentTasks.map((t) => t.id);
      const [removed] = ids.splice(dragSource.index, 1);
      ids.splice(dest.index, 0, removed);
      setColumnOrder((prev) => ({ ...prev, [sourceColId]: ids }));
    } else {
      const sourceTasks = getColumnTasks(sourceColId);
      const sourceIds = sourceTasks.map((t) => t.id).filter((id) => id !== draggableId);
      setColumnOrder((prev) => ({ ...prev, [sourceColId]: sourceIds }));

      const destTasks = getColumnTasks(destColId);
      const destIds = destTasks.map((t) => t.id);
      destIds.splice(dest.index, 0, draggableId);
      setColumnOrder((prev) => ({ ...prev, [destColId]: destIds }));

      // Dispatch the appropriate field update
      if (groupBy === 'status' || groupBy === undefined) {
        onStatusChange(draggableId, destColId);
      } else if (groupBy === 'priority') {
        onFieldChange?.(draggableId, 'priority', destColId);
      } else if (groupBy === 'project') {
        onFieldChange?.(draggableId, 'project_id', destColId === 'no-client' ? null : destColId);
      } else if (groupBy === 'assignee') {
        onFieldChange?.(draggableId, 'assignee', destColId === 'unassigned' ? null : destColId);
      } else if (groupBy === 'service') {
        onFieldChange?.(draggableId, 'service', destColId === 'no-service' ? null : destColId);
      }
    }
  };

  // Hide the library's placeholder (we render our own indicator)
  useEffect(() => {
    if (!isDragging) return;
    const style = document.createElement('style');
    style.textContent = `[data-rfd-placeholder-context-id] { height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; overflow: hidden !important; }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [isDragging]);

  return (
    <div className="relative">
      <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin"
          role="region"
          aria-label="Kanban board"
        >
          {columns.map((column) => {
            const columnTasks = columnTasksMap[column.id] ?? getColumnTasks(column.id);
            const totalCount = columnTasks.length;
            // Limit "done" column to 15 tasks in status mode
            const isStatusDone = groupBy === 'status' && column.id === 'done';
            const displayTasks = isStatusDone ? columnTasks.slice(0, 15) : columnTasks;
            const hiddenCount = totalCount - displayTasks.length;

            const isDestCol = destination?.droppableId === column.id;
            const isSourceCol = source?.col === column.id;
            const destIdx = destination?.index ?? -1;
            const destMatchesSource = isDestCol && isSourceCol && destIdx === source?.idx;
            const showDestIndicator = isDestCol && !destMatchesSource;

            return (
              <div key={column.id} className="flex-1 min-w-[280px] flex flex-col" role="group" aria-label={`${column.label} column`}>
                {/* Column header */}
                <div className="mb-3 flex items-center gap-2 px-1">
                  {column.dotColor ? (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: column.dotColor }}
                    />
                  ) : (
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${column.dotClass || 'bg-muted-foreground'}`}
                    />
                  )}
                  <h3 className="text-[13px] font-medium text-foreground truncate">{column.label}</h3>
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground/60 tabular-nums shrink-0">
                    {totalCount}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[60px] flex-1 rounded-lg p-1.5"
                    >
                      {/* Drop indicator at top */}
                      {isDragging && showDestIndicator && destIdx === 0 && (
                        <DropIndicator height={dragHeightRef.current} />
                      )}

                      {displayTasks.flatMap((task, index) => {
                        let showAfter = false;
                        if (isDragging && showDestIndicator) {
                          if (isSourceCol) {
                            const srcIdx = source!.idx;
                            if (srcIdx < destIdx) {
                              showAfter = index === destIdx;
                            } else if (srcIdx > destIdx) {
                              showAfter = index === destIdx - 1;
                            }
                          } else {
                            showAfter = index === destIdx - 1;
                          }
                        }

                        const elements = [
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <>
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={provided.draggableProps.style}
                                  className={`mb-2 ${
                                    snapshot.isDragging
                                      ? 'z-50 shadow-xl shadow-black/10 scale-[1.02] rotate-[0.3deg]'
                                      : ''
                                  }`}
                                >
                                  <div className={snapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'}>
                                    <TaskCard task={task} onClick={() => onTaskClick(task)} dimDone={groupBy === 'status'} />
                                  </div>
                                </div>
                                {snapshot.isDragging && (() => {
                                  const destCol = destination?.droppableId;
                                  const srcCol = source?.col;
                                  const dIdx = destination?.index;
                                  const sIdx = source?.idx;
                                  const crossColumn = destCol !== srcCol;
                                  const atOriginal = destCol === srcCol && dIdx === sIdx;
                                  if (!crossColumn && !atOriginal) return null;
                                  return (
                                    <SourceGhost
                                      height={dragHeightRef.current}
                                      negativeMargin={atOriginal}
                                    />
                                  );
                                })()}
                              </>
                            )}
                          </Draggable>,
                        ];
                        if (showAfter) {
                          elements.push(
                            <DropIndicator
                              key={`indicator-${index}`}
                              height={dragHeightRef.current}
                            />
                          );
                        }
                        return elements;
                      })}

                      {/* Empty column placeholder */}
                      {displayTasks.length === 0 && !isDragging && (
                        <div className="flex flex-col items-center justify-center py-6 text-center rounded-lg border border-dashed border-border/20 mb-2">
                          <p className="text-[11px] text-muted-foreground/30">No tasks</p>
                        </div>
                      )}

                      {/* Drop indicator at bottom / empty column — shown when:
                          - destination is past the last task (bottom of non-empty column),
                          - column is empty, or
                          - column has exactly one task that is the source (looks empty) */}
                      {isDragging && showDestIndicator && (
                        destIdx >= displayTasks.length ||
                        (displayTasks.length === 1 && isSourceCol)
                      ) && (
                        <DropIndicator height={dragHeightRef.current} />
                      )}

                      {provided.placeholder}

                      {/* "View all done" — only in status mode */}
                      {isStatusDone && hiddenCount > 0 && (
                        <button
                          onClick={onViewCompleted}
                          className="flex w-full items-center justify-center text-[11px] text-muted-foreground/30 py-1.5 hover:text-muted-foreground/60 transition-colors duration-150 cursor-pointer"
                        >
                          +{hiddenCount} more · View all in table →
                        </button>
                      )}

                      {!snapshot.isDraggingOver && (
                        <button
                          onClick={() => onAddTask?.(column.id)}
                          aria-label={`Add task to ${column.label}`}
                          className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[11px] text-muted-foreground/60 transition-colors duration-150 hover:text-muted-foreground hover:bg-muted/40 rounded-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                        >
                          <Plus size={12} /> Add task
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Left scroll-fade gradient */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-4 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none z-10 flex items-center">
          <ChevronLeft className="h-4 w-4 text-muted-foreground/40 ml-1 shrink-0" aria-hidden="true" />
        </div>
      )}
      {/* Right scroll-fade gradient */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-4 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 flex items-center justify-end">
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 mr-1 shrink-0" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
