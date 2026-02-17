'use client';

import { ReactRenderer } from '@tiptap/react';
import { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react';
import { ASSIGNEE_COLORS } from '@/lib/constants';

interface MentionUser {
  id: string;
  name: string;
}

const MENTIONABLE_USERS: MentionUser[] = [
  { id: 'jamie', name: 'Jamie' },
  { id: 'casper', name: 'Casper' },
  { id: 'developer', name: 'Developer' },
  { id: 'uiux-designer', name: 'UI/UX Designer' },
  { id: 'qa-tester', name: 'QA Tester' },
  { id: 'copywriter', name: 'Copywriter' },
  { id: 'analyst', name: 'Analyst' },
  { id: 'manager', name: 'Manager' },
  { id: 'trainer', name: 'Trainer' },
  { id: 'heartbeat', name: 'Heartbeat' },
];

interface MentionListProps {
  items: MentionUser[];
  command: (item: MentionUser) => void;
}

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const el = container.children[selectedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="w-56 bg-popover border border-border/20 rounded-lg shadow-xl overflow-hidden">
          <div className="px-2 py-3 text-[13px] text-muted-foreground/30 text-center">
            No one found
          </div>
        </div>
      );
    }

    return (
      <div className="w-56 bg-popover border border-border/20 rounded-lg shadow-xl overflow-hidden" ref={containerRef}>
        <div className="p-1 max-h-[280px] overflow-y-auto">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[13px] hover:bg-muted/60 transition-colors ${index === selectedIndex ? 'bg-primary/15 text-primary' : ''}`}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${ASSIGNEE_COLORS[item.name] || 'bg-muted/40 text-muted-foreground'}`}>
                {item.name.charAt(0).toUpperCase()}
              </span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';

export const mentionSuggestion = {
  items: ({ query }: { query: string }) => {
    const q = query.toLowerCase();
    if (!q) return MENTIONABLE_USERS;
    return MENTIONABLE_USERS.filter((user) =>
      user.name.toLowerCase().includes(q)
    );
  },

  render: () => {
    let component: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          offset: [0, 4],
          animation: false,
          maxWidth: 280,
        });
      },

      onUpdate: (props: SuggestionProps) => {
        component?.updateProps(props);
        if (popup && props.clientRect) {
          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};
