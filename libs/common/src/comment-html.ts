const ALLOWED_TAGS = new Set(['a', 'i', 'strong']);
export const COMMENT_MAX_BODY_BYTES = 100 * 1024;

export class CommentHtmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommentHtmlError';
  }
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseAttributes(raw: string): Record<string, string> {
  if (!raw) {
    return {};
  }
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    if (raw.slice(lastIndex, match.index).trim()) {
      throw new CommentHtmlError('Malformed tag attributes');
    }
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? '';
    lastIndex = match.index + match[0].length;
  }
  if (raw.slice(lastIndex).trim()) {
    throw new CommentHtmlError('Malformed tag attributes');
  }
  return attrs;
}

function isSafeHref(href: string) {
  const value = href.trim();
  if (value.startsWith('//')) {
    return false;
  }
  return /^(https?:\/\/|\/|#)/i.test(value);
}

export function sanitizeCommentHtml(input: string): string {
  const source = input.trim();
  if (!source) {
    throw new CommentHtmlError('Comment cannot be empty');
  }
  if (utf8ByteLength(source) > COMMENT_MAX_BODY_BYTES) {
    throw new CommentHtmlError('Comment must be at most 100 KB');
  }

  const stack: string[] = [];
  let i = 0;
  let out = '';

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      out += escapeText(source.slice(i));
      break;
    }
    if (lt > i) {
      out += escapeText(source.slice(i, lt));
    }
    const gt = source.indexOf('>', lt + 1);
    if (gt === -1) {
      throw new CommentHtmlError('Unclosed HTML tag');
    }
    const inner = source.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (inner.startsWith('!--') || inner.startsWith('?') || inner.startsWith('!')) {
      throw new CommentHtmlError('HTML comments and declarations are not allowed');
    }

    const isClose = inner.startsWith('/');
    const body = isClose ? inner.slice(1).trim() : inner;
    if (body.endsWith('/')) {
      throw new CommentHtmlError('Self-closing tags are not valid for allowed elements');
    }

    const space = body.search(/\s/);
    const tagName = (space === -1 ? body : body.slice(0, space)).toLowerCase();
    const attrRaw = space === -1 ? '' : body.slice(space).trim();

    if (!ALLOWED_TAGS.has(tagName)) {
      throw new CommentHtmlError(
        `Tag <${tagName}> is not allowed. Use a, i, strong`,
      );
    }

    if (isClose) {
      if (attrRaw) {
        throw new CommentHtmlError(`Invalid closing tag </${tagName}>`);
      }
      const open = stack.pop();
      if (open !== tagName) {
        throw new CommentHtmlError('Tags must be properly nested and closed (XHTML)');
      }
      out += `</${tagName}>`;
      continue;
    }

    const attrs = parseAttributes(attrRaw);
    if (tagName === 'a') {
      const href = attrs.href;
      const title = attrs.title ?? '';
      const extra = Object.keys(attrs).filter((k) => k !== 'href' && k !== 'title');
      if (!href || extra.length) {
        throw new CommentHtmlError('<a> may only have href and optional title');
      }
      if (!isSafeHref(href)) {
        throw new CommentHtmlError('Link href must start with http://, https://, / or #');
      }
      const titleAttr = title ? ` title="${escapeText(title)}"` : '';
      out += `<a href="${escapeText(href)}"${titleAttr}>`;
    } else {
      if (Object.keys(attrs).length) {
        throw new CommentHtmlError(`<${tagName}> cannot have attributes`);
      }
      out += `<${tagName}>`;
    }
    stack.push(tagName);
  }

  if (stack.length) {
    throw new CommentHtmlError('Tags must be properly nested and closed (XHTML)');
  }

  return out;
}

export function previewCommentHtml(input: string): { html: string; error?: string } {
  try {
    return { html: sanitizeCommentHtml(input) };
  } catch (err) {
    return {
      html: '',
      error: err instanceof CommentHtmlError ? err.message : 'Invalid HTML',
    };
  }
}
