import { marked } from 'marked';

/**
 * Detect if a string looks like markdown rather than HTML.
 * Returns true if it contains common markdown patterns and doesn't look like HTML.
 */
function looksLikeMarkdown(content: string): boolean {
  if (!content || content.trim().length === 0) return false;
  
  // If it starts with < and contains closing tags, it's probably HTML
  const trimmed = content.trim();
  if (trimmed.startsWith('<') && (trimmed.startsWith('<p>') || trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul'))) {
    return false;
  }
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,          // Headings: # ## ###
    /\*\*[^*]+\*\*/,       // Bold: **text**
    /\*[^*]+\*/,           // Italic: *text*
    /^[-*+]\s/m,           // Unordered list items
    /^\d+\.\s/m,           // Ordered list items
    /^>\s/m,               // Blockquotes
    /\[.+\]\(.+\)/,        // Links: [text](url)
    /^```/m,               // Code blocks
    /`[^`]+`/,             // Inline code
    /^---$/m,              // Horizontal rules
  ];
  
  const matches = markdownPatterns.filter(p => p.test(content)).length;
  return matches >= 1;
}

/**
 * Convert content to HTML if it's markdown. Pass through if already HTML.
 */
export function ensureHtml(content: string | null | undefined): string {
  if (!content) return '';
  if (!looksLikeMarkdown(content)) return content;
  
  // Configure marked for clean output
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  
  return marked.parse(content, { async: false }) as string;
}
