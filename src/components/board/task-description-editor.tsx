'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import { ResizableImage } from '@/components/editor/resizable-image';
import { FileAttachment } from '@/components/editor/file-attachment';
import { createSlashCommandExtension } from '@/components/editor/slash-commands';
import { mentionSuggestion } from '@/components/editor/mention-suggestion';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, Code, Link as LinkIcon, Quote, ImageIcon, Paperclip, Smile, Undo2, Redo2, X as XIcon, MoreHorizontal } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const CompactEmojiPicker = dynamic(() => import('@/components/editor/emoji-picker').then(mod => ({ default: mod.CompactEmojiPicker })), {
  ssr: false,
  loading: () => <div className="h-[280px] w-[320px] rounded-lg bg-muted/30 animate-pulse" />,
});

interface TaskDescriptionEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  taskId?: string;
  taskTitle?: string;
}

function ToolbarButton({ 
  onClick, 
  active, 
  disabled, 
  children, 
  title 
}: { 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean; 
  children: React.ReactNode; 
  title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`p-1.5 rounded-md transition-all ${
            active 
              ? 'bg-primary/20 text-primary dark:bg-primary/20 dark:text-primary ring-1 ring-primary/20' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

export function TaskDescriptionEditor({ content, onChange, placeholder = "Add description...", taskId, taskTitle }: TaskDescriptionEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  // Track mentions we've already notified to avoid spam on every keystroke
  const notifiedMentions = useRef<Set<string>>(new Set());
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // M13: Guard against cursor-jump loop — set true when the user types (internal),
  // so the content-sync effect skips the redundant setContent call.
  const isInternalUpdate = useRef(false);
  // M4: Inline link input popover state
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  // Responsive toolbar
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(99); // Start with all visible

  const slashCommands = useMemo(
    () => createSlashCommandExtension(
      () => fileInputRef.current?.click(),
      () => docInputRef.current?.click(),
      () => setShowEmojiPicker(true)
    ),
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We'll configure this separately
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary dark:text-primary underline decoration-primary/30 dark:decoration-primary/30 hover:text-primary/90 dark:hover:text-primary/70 hover:decoration-primary/50 dark:hover:decoration-primary/50 transition-colors',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: mentionSuggestion,
      }),
      ResizableImage,
      FileAttachment,
      slashCommands,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[150px] prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary dark:prose-a:text-primary prose-code:text-foreground prose-pre:bg-muted prose-pre:border prose-pre:border-border/20',
      },
    },
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true; // M13: flag this as a user-driven change
      const html = editor.getHTML();
      onChange(html);
      
      // Debounced mention check — only notify for NEW mentions not previously seen
      if (taskId && taskTitle) {
        if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
        mentionDebounceRef.current = setTimeout(() => {
          const mentions = html.match(/@[\w\s/-]+/g) || [];
          mentions.forEach((mention) => {
            const userName = mention.substring(1).trim();
            if (!notifiedMentions.current.has(userName)) {
              notifiedMentions.current.add(userName);
              createMentionNotification(userName, taskId, taskTitle);
            }
          });
        }, 2000);
      }
    },
  });

  // Define all toolbar items in order
  const toolbarItems = useMemo(() => {
    if (!editor) return [];
    
    type ToolbarItem = {
      id: string;
      type: 'button' | 'separator';
      icon?: React.ReactNode;
      label?: string;
      action?: () => void;
      isActive?: boolean;
      group?: string;
    };

    const items: ToolbarItem[] = [
      {
        id: 'undo',
        type: 'button',
        icon: <Undo2 className="h-3.5 w-3.5" />,
        label: 'Undo (⌘Z)',
        action: () => editor.chain().focus().undo().run(),
        group: 'history',
      },
      {
        id: 'redo',
        type: 'button',
        icon: <Redo2 className="h-3.5 w-3.5" />,
        label: 'Redo (⌘⇧Z)',
        action: () => editor.chain().focus().redo().run(),
        group: 'history',
      },
      { id: 'sep-1', type: 'separator' },
      {
        id: 'bold',
        type: 'button',
        icon: <Bold className="h-3.5 w-3.5" />,
        label: 'Bold (⌘B)',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: editor.isActive('bold'),
        group: 'format',
      },
      {
        id: 'italic',
        type: 'button',
        icon: <Italic className="h-3.5 w-3.5" />,
        label: 'Italic (⌘I)',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: editor.isActive('italic'),
        group: 'format',
      },
      {
        id: 'underline',
        type: 'button',
        icon: <UnderlineIcon className="h-3.5 w-3.5" />,
        label: 'Underline (⌘U)',
        action: () => editor.chain().focus().toggleUnderline().run(),
        isActive: editor.isActive('underline'),
        group: 'format',
      },
      { id: 'sep-2', type: 'separator' },
      {
        id: 'h1',
        type: 'button',
        icon: <Heading1 className="h-3.5 w-3.5" />,
        label: 'Heading 1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: editor.isActive('heading', { level: 1 }),
        group: 'headings',
      },
      {
        id: 'h2',
        type: 'button',
        icon: <Heading2 className="h-3.5 w-3.5" />,
        label: 'Heading 2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: editor.isActive('heading', { level: 2 }),
        group: 'headings',
      },
      {
        id: 'h3',
        type: 'button',
        icon: <Heading3 className="h-3.5 w-3.5" />,
        label: 'Heading 3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: editor.isActive('heading', { level: 3 }),
        group: 'headings',
      },
      { id: 'sep-3', type: 'separator' },
      {
        id: 'bullet-list',
        type: 'button',
        icon: <List className="h-3.5 w-3.5" />,
        label: 'Bullet List',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: editor.isActive('bulletList'),
        group: 'lists',
      },
      {
        id: 'ordered-list',
        type: 'button',
        icon: <ListOrdered className="h-3.5 w-3.5" />,
        label: 'Ordered List',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: editor.isActive('orderedList'),
        group: 'lists',
      },
      { id: 'sep-4', type: 'separator' },
      {
        id: 'link',
        type: 'button',
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        label: 'Insert Link',
        action: () => {
          const previousUrl = editor.getAttributes('link').href || '';
          setLinkUrl(previousUrl);
          setLinkPopoverOpen(true);
        },
        isActive: editor.isActive('link'),
        group: 'insert',
      },
      {
        id: 'code-block',
        type: 'button',
        icon: <Code className="h-3.5 w-3.5" />,
        label: 'Code Block',
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: editor.isActive('codeBlock'),
        group: 'insert',
      },
      {
        id: 'quote',
        type: 'button',
        icon: <Quote className="h-3.5 w-3.5" />,
        label: 'Quote',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: editor.isActive('blockquote'),
        group: 'insert',
      },
      { id: 'sep-5', type: 'separator' },
      {
        id: 'emoji',
        type: 'button',
        icon: <Smile className="h-3.5 w-3.5" />,
        label: 'Insert Emoji',
        action: () => setShowEmojiPicker(!showEmojiPicker),
        isActive: showEmojiPicker,
        group: 'media',
      },
      {
        id: 'image',
        type: 'button',
        icon: <ImageIcon className="h-3.5 w-3.5" />,
        label: 'Insert Image',
        action: () => fileInputRef.current?.click(),
        group: 'media',
      },
      {
        id: 'attach-doc',
        type: 'button',
        icon: <Paperclip className="h-3.5 w-3.5" />,
        label: 'Attach Document',
        action: () => docInputRef.current?.click(),
        group: 'media',
      },
    ];

    return items;
  }, [editor, showEmojiPicker]);

  // Calculate how many items fit based on available width
  useEffect(() => {
    if (!toolbarRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        // Account for padding (~20px total), More button (~30px), and some margin
        const availableWidth = containerWidth - 60;
        
        let currentWidth = 0;
        let count = 0;
        
        for (const item of toolbarItems) {
          const itemWidth = item.type === 'separator' ? 13 : 30;
          if (currentWidth + itemWidth <= availableWidth) {
            currentWidth += itemWidth;
            count++;
          } else {
            break;
          }
        }
        
        setVisibleCount(count);
      }
    });

    resizeObserver.observe(toolbarRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [toolbarItems]);

  // M13: Sync editor content when the prop changes from OUTSIDE (e.g. a different task is opened).
  // Skip when isInternalUpdate is set — that means the change came from the user typing,
  // and calling setContent would cause a cursor jump.
  useEffect(() => {
    if (isInternalUpdate.current) {
      // This render was triggered by our own typing — clear the flag and skip.
      isInternalUpdate.current = false;
      return;
    }
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Close emoji picker on Escape
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showEmojiPicker]);

  const emojiPopoverRef = useCallback((el: HTMLDivElement | null) => {
    if (el && emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      el.style.left = `${rect.left}px`;
      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    }
  }, []);

  if (!editor) {
    return null;
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        editor.commands.insertContent({ type: 'image', attrs: { src: data.url, alt: file.name } });
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        editor.commands.insertContent({
          type: 'fileAttachment',
          attrs: { src: data.url, fileName: data.fileName || file.name },
        });
      }
    } catch (err) {
      console.error('Document upload failed:', err);
    }
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const applyLink = (url: string) => {
    setLinkPopoverOpen(false);
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Prepend https:// if the user omitted a scheme
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const createMentionNotification = async (userName: string, taskId: string, taskTitle: string) => {
    try {
      // Map user name to agent_status ID
      const userIdMap: Record<string, string> = {
        'Jamie': 'jamie',
        'Casper': 'casper',
        'Developer': 'developer',
        'UI/UX Designer': 'uiux-designer',
        'QA Tester': 'qa-tester',
        'Copywriter': 'copywriter',
        'Analyst': 'analyst',
        'Manager': 'manager',
        'Trainer': 'trainer',
        'Heartbeat': 'heartbeat',
      };

      const userId = userIdMap[userName];
      if (!userId) return;

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          type: 'mention',
          title: 'You were mentioned',
          message: `You were mentioned in ${taskTitle}`,
          task_id: taskId,
          read: false,
        }),
      });
    } catch (error) {
      console.error('Failed to create mention notification:', error);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run();
      setShowEmojiPicker(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/20 bg-card relative">
      {/* Toolbar */}
      <div ref={toolbarRef} className="flex items-center gap-0.5 border-b border-border/20 px-2.5 py-1.5 bg-muted/30">
        {/* Render visible items */}
        {toolbarItems.slice(0, visibleCount).map((item, index) => {
          if (item.type === 'separator') {
            // Don't render separator if it's the last visible item (before More button)
            if (index === visibleCount - 1) return null;
            return <div key={item.id} className="w-px h-4 bg-border mx-1.5" />;
          }
          
          return (
            <ToolbarButton
              key={item.id}
              onClick={item.action!}
              active={item.isActive}
              title={item.label!}
            >
              {item.icon}
            </ToolbarButton>
          );
        })}

        {/* Link popover — triggered from More dropdown or visible toolbar */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 p-2">
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink(linkUrl); }
                  if (e.key === 'Escape') setLinkPopoverOpen(false);
                }}
                placeholder="https://example.com"
                autoFocus
                className="flex-1 text-[13px] bg-muted/30 rounded-md px-2.5 py-1.5 outline-none border border-border/20 focus:border-primary/30 placeholder:text-muted-foreground/60 min-w-0"
              />
              {linkUrl && (
                <button
                  onClick={() => setLinkUrl('')}
                  className="p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors duration-150 rounded"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => applyLink(linkUrl)}
                className="px-2.5 py-1.5 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-150 font-medium whitespace-nowrap"
              >
                {editor.isActive('link') ? 'Update' : 'Add link'}
              </button>
            </div>
            {editor.isActive('link') && (
              <button
                onClick={() => applyLink('')}
                className="mt-1.5 w-full text-[13px] text-destructive/60 hover:text-destructive transition-colors duration-150 text-left px-1"
              >
                Remove link
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* More button — always visible, contains overflow items */}
        {visibleCount < toolbarItems.length && (
          <>
            <div className="w-px h-4 bg-border mx-1.5" />
            <Popover>
              <PopoverTrigger asChild>
                <span className="ml-0.5">
                  <ToolbarButton
                    onClick={() => {}}
                    title="More"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </ToolbarButton>
                </span>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-auto p-1">
                <div className="flex flex-col gap-0.5">
                  {toolbarItems.slice(visibleCount).map((item) => {
                    if (item.type === 'separator') {
                      return <div key={item.id} className="h-px bg-border/20 my-0.5" />;
                    }
                    
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-muted/60 transition-colors duration-150 ${
                          item.isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
          onChange={handleDocUpload}
          className="hidden"
        />
      </div>

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <>
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setShowEmojiPicker(false)}
          />
          <div 
            className="fixed z-[70]"
            ref={emojiPopoverRef}
          >
            <CompactEmojiPicker onSelect={handleEmojiSelect} />
          </div>
        </>
      )}

      {/* Editor */}
      <div className="overflow-y-auto bg-background">
        <EditorContent editor={editor} />
      </div>
      {/* Slash command hint strip */}
      <div className="flex items-center px-3 py-1.5 border-t border-border/20 bg-muted/20">
        <span className="text-[11px] text-muted-foreground/30">
          Type <kbd className="px-1 py-0.5 rounded bg-muted/30 text-muted-foreground/30 text-[10px] font-mono">/</kbd> for commands
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}
