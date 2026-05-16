// Import createDepthTrackingContainer from the parser package
import { createDepthTrackingContainer } from '@docmd/parser';

interface ThreadInfo {
  id: string;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

interface CommentInfo {
  id: string | null;
  parentId: string | null;
  author: string;
  date: string;
  editedAt: string | null;
}

/**
 * Parse a thread info string.
 * Format: `<id> [resolved "<by>" "<date>"]`
 */
export function parseThreadInfo(info: string): ThreadInfo {
  const trimmed = info.trim();
  const resolvedMatch = trimmed.match(
    /^(\S+)\s+resolved\s+"([^"]+)"\s+"([^"]+)"$/
  );
  if (resolvedMatch) {
    return {
      id: resolvedMatch[1],
      resolved: true,
      resolvedBy: resolvedMatch[2],
      resolvedAt: resolvedMatch[3],
    };
  }

  const simpleMatch = trimmed.match(/^(\S+)$/);
  if (simpleMatch) {
    return {
      id: simpleMatch[1],
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    };
  }

  return { id: 'unknown', resolved: false, resolvedBy: null, resolvedAt: null };
}

/**
 * Parse a comment info string.
 * Format: `[<id>] "<author>" "<date>" [reply-to <parentId>] [edited "<date>"]`
 */
export function parseCommentInfo(info: string): CommentInfo {
  const trimmed = info.trim();

  // Format with ID, optional reply-to, optional edited
  const fullMatch = trimmed.match(
    /^(\S+)\s+"([^"]+)"\s+"([^"]+)"(?:\s+reply-to\s+(\S+))?(?:\s+edited\s+"([^"]+)")?$/
  );
  if (fullMatch) {
    return {
      id: fullMatch[1],
      author: fullMatch[2],
      date: fullMatch[3],
      parentId: fullMatch[4] || null,
      editedAt: fullMatch[5] || null,
    };
  }

  // Legacy format without ID: "<author>" "<date>" edited "<date>"
  const editedMatch = trimmed.match(
    /^"([^"]+)"\s+"([^"]+)"\s+edited\s+"([^"]+)"$/
  );
  if (editedMatch) {
    return {
      id: null,
      parentId: null,
      author: editedMatch[1],
      date: editedMatch[2],
      editedAt: editedMatch[3],
    };
  }

  // Legacy format without ID: "<author>" "<date>"
  const simpleMatch = trimmed.match(/^"([^"]+)"\s+"([^"]+)"$/);
  if (simpleMatch) {
    return {
      id: null,
      parentId: null,
      author: simpleMatch[1],
      date: simpleMatch[2],
      editedAt: null,
    };
  }

  return { id: null, parentId: null, author: 'unknown', date: '', editedAt: null };
}

/**
 * Register all thread-related container rules on a markdown-it instance.
 */
export function setup(md: any): void {
  // 1. threads - outer wrapper
  createDepthTrackingContainer(
    md,
    'threads',
    () => '<div class="threads-sidebar">\n',
    () => '</div>\n'
  );

  // 2. thread - individual thread
  createDepthTrackingContainer(
    md,
    'thread',
    (tokens: any[], idx: number) => {
      const info = tokens[idx].info.trim();
      const parsed = parseThreadInfo(info);
      const resolvedClass = parsed.resolved ? ' threads-thread--resolved' : '';
      const safeId = md.utils.escapeHtml(parsed.id);
      return `<div class="threads-thread${resolvedClass}" data-thread-id="${safeId}">\n`;
    },
    () => '</div>\n'
  );

  // 3. comment - individual comment
  createDepthTrackingContainer(
    md,
    'comment',
    (tokens: any[], idx: number) => {
      const info = tokens[idx].info.trim();
      const parsed = parseCommentInfo(info);
      
      const safeId = parsed.id ? md.utils.escapeHtml(parsed.id) : null;
      const safeParentId = parsed.parentId ? md.utils.escapeHtml(parsed.parentId) : null;
      const safeAuthor = md.utils.escapeHtml(parsed.author);
      const safeDate = md.utils.escapeHtml(parsed.date);
      const safeEdited = parsed.editedAt ? md.utils.escapeHtml(parsed.editedAt) : null;

      const idAttr = safeId ? ` data-comment-id="${safeId}"` : '';
      const parentAttr = safeParentId ? ` data-parent-id="${safeParentId}"` : '';
      const editedAttr = safeEdited ? ` data-edited="${safeEdited}"` : '';
      const replyClass = parsed.parentId ? ' threads-comment--reply' : '';
      
      return (
        `<div class="threads-comment${replyClass}"${idAttr}${parentAttr} data-author="${safeAuthor}" data-date="${safeDate}"${editedAttr}>` +
        `<div class="threads-comment__avatar-col"></div>` +
        `<div class="threads-comment__meta"><strong>${safeAuthor}</strong> &middot; ${safeDate}</div>` +
        `<div class="threads-comment__body">\n`
      );
    },
    () => '</div></div>\n'
  );

  // 4. reactions - reactions container
  createDepthTrackingContainer(
    md,
    'reactions',
    () => '<div class="threads-reactions">\n',
    () => '</div>\n'
  );

  // 5. Security: Harden comment bodies by disabling raw HTML rendering
  // We push this to the core ruler to intercept tokens after block parsing
  md.core.ruler.after('block', 'threads_harden', (state: any) => {
    let insideComment = false;

    for (const token of state.tokens) {
      if (token.type === 'container_comment_open') {
        insideComment = true;
        continue;
      }
      if (token.type === 'container_comment_close') {
        insideComment = false;
        continue;
      }

      if (insideComment) {
        // Disable raw HTML blocks inside comments
        if (token.type === 'html_block') {
          token.type = 'text';
          token.content = md.utils.escapeHtml(token.content);
        }

        // Disable raw HTML inline inside comments
        if (token.type === 'inline' && token.children) {
          for (const child of token.children) {
            if (child.type === 'html_inline') {
              child.type = 'text';
              child.content = md.utils.escapeHtml(child.content);
            }
          }
        }
      }
    }
  });
}
