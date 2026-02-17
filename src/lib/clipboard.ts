import { toast } from 'sonner';

export async function copyToClipboard(text: string, label?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label || 'Copied to clipboard');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    toast.error('Failed to copy');
    return false;
  }
}

export function showCopiedFeedback(element: HTMLElement) {
  const originalText = element.textContent;
  element.textContent = 'Copied!';
  element.classList.add('text-status-success');
  setTimeout(() => {
    element.textContent = originalText;
    element.classList.remove('text-status-success');
  }, 2000);
}
