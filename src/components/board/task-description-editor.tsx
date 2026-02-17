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
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, Code, Link as LinkIcon, Quote, ImageIcon, Paperclip, Smile, Undo2, Redo2, X as XIcon } from 'lucide-react';
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

  // M4: Open link popover — pre-fill with existing href if cursor is on a link
  const openLinkPopover = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setLinkPopoverOpen(true);
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
      <div className="flex items-center gap-0.5 border-b border-border/20 px-2.5 py-1.5 bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (⌘Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1.5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (⌘I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (⌘U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1.5" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1.5" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1.5" />
        
        {/* M4: Inline link popover — replaces window.prompt */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <span>
              <ToolbarButton
                onClick={openLinkPopover}
                active={editor.isActive('link')}
                title="Insert Link (⌘K)"
              >
                <LinkIcon className="h-3.5 w-3.5" />
              </ToolbarButton>
            </span>
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
                className="flex-1 text-[13px] bg-muted/30 rounded-md px-2.5 py-1.5 outline-none border border-border/20 focus:border-primary/30 placeholder:text-muted-foreground/30 min-w-0"
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
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1.5" />

        <ToolbarButton
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          active={showEmojiPicker}
          title="Insert Emoji"
        >
          <Smile className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          title="Insert Image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <ToolbarButton
          onClick={() => docInputRef.current?.click()}
          title="Attach Document"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </ToolbarButton>
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
