'use client';

import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  ImageIcon,
  Paperclip,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Smile,
} from 'lucide-react';

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  aliases: string[];
  command: (props: { editor: any; range: any }) => void;
}

function getCommands(
  onImageUpload?: () => void,
  onDocUpload?: () => void,
  onEmojiPicker?: () => void
): CommandItem[] {
  return [
    {
      title: 'Image',
      description: 'Upload an image',
      icon: <ImageIcon className="h-4 w-4" />,
      aliases: ['image', 'img', 'photo', 'picture'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onImageUpload?.();
      },
    },
    {
      title: 'File Attachment',
      description: 'Upload a document',
      icon: <Paperclip className="h-4 w-4" />,
      aliases: ['file', 'document', 'attach', 'upload', 'pdf'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onDocUpload?.();
      },
    },
    {
      title: 'Heading 1',
      description: 'Large heading',
      icon: <Heading1 className="h-4 w-4" />,
      aliases: ['heading 1', 'h1', 'heading1'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium heading',
      icon: <Heading2 className="h-4 w-4" />,
      aliases: ['heading 2', 'h2', 'heading2'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small heading',
      icon: <Heading3 className="h-4 w-4" />,
      aliases: ['heading 3', 'h3', 'heading3'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: <List className="h-4 w-4" />,
      aliases: ['bullet list', 'bullets', 'ul', 'unordered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered list',
      icon: <ListOrdered className="h-4 w-4" />,
      aliases: ['numbered list', 'numbers', 'ol', 'ordered'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Quote',
      description: 'Block quote',
      icon: <Quote className="h-4 w-4" />,
      aliases: ['quote', 'blockquote'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: 'Code Block',
      description: 'Code snippet',
      icon: <Code className="h-4 w-4" />,
      aliases: ['code', 'codeblock', 'code block'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      icon: <Minus className="h-4 w-4" />,
      aliases: ['divider', 'hr', 'horizontal rule', 'separator', 'line'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Link',
      description: 'Insert a link',
      icon: <LinkIcon className="h-4 w-4" />,
      aliases: ['link', 'url', 'href'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        const url = window.prompt('URL');
        if (url) {
          editor.chain().focus().setLink({ href: url }).insertContent(url).run();
        }
      },
    },
    {
      title: 'Emoji',
      description: 'Insert an emoji',
      icon: <Smile className="h-4 w-4" />,
      aliases: ['emoji', 'smiley', 'emoticon', 'face'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onEmojiPicker?.();
      },
    },
  ];
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
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
        <div className="slash-command-menu">
          <div className="slash-command-empty">No results</div>
        </div>
      );
    }

    return (
      <div className="slash-command-menu" ref={containerRef}>
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`slash-command-item ${index === selectedIndex ? 'active' : ''}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="slash-command-icon">{item.icon}</div>
            <div className="slash-command-text">
              <span className="slash-command-title">{item.title}</span>
              <span className="slash-command-desc">{item.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = 'CommandList';

export function createSlashCommandExtension(
  onImageUpload?: () => void,
  onDocUpload?: () => void,
  onEmojiPicker?: () => void
) {
  const commands = getCommands(onImageUpload, onDocUpload, onEmojiPicker);

  return Extension.create({
    name: 'slashCommands',

    addOptions() {
      return {
        suggestion: {
          char: '/',
          command: ({ editor, range, props }: { editor: any; range: any; props: CommandItem }) => {
            props.command({ editor, range });
          },
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            if (!q) return commands;
            return commands.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.aliases.some((a) => a.includes(q))
            );
          },
          render: () => {
            let component: ReactRenderer<CommandListRef> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: SuggestionProps) => {
                component = new ReactRenderer(CommandList, {
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
                  maxWidth: 320,
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
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
