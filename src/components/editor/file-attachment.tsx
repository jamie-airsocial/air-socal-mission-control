'use client';

import { Node, mergeAttributes } from '@tiptap/react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { FileText, FileSpreadsheet, File, FileCode } from 'lucide-react';

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return <FileText className="h-3.5 w-3.5 shrink-0" />;
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return <FileText className="h-3.5 w-3.5 shrink-0" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />;
  if (['json', 'xml', 'yaml', 'yml'].includes(ext)) return <FileCode className="h-3.5 w-3.5 shrink-0" />;
  return <File className="h-3.5 w-3.5 shrink-0" />;
}

function FileAttachmentView({ node }: any) {
  const { src, fileName } = node.attrs;

  return (
    <NodeViewWrapper className="inline" as="span">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        download={fileName}
        className="file-attachment-chip"
        contentEditable={false}
      >
        {getFileIcon(fileName || '')}
        <span className="truncate max-w-[200px]">{fileName || 'Download file'}</span>
      </a>
    </NodeViewWrapper>
  );
}

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      fileName: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-file-attachment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes({
      'data-file-attachment': '',
      class: 'file-attachment-chip',
      href: HTMLAttributes.src,
      target: '_blank',
      rel: 'noopener noreferrer',
      download: HTMLAttributes.fileName,
    }), HTMLAttributes.fileName || 'Download file'];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },

  addCommands() {
    return {
      insertFileAttachment:
        (options: { src: string; fileName: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    } as any;
  },
});
