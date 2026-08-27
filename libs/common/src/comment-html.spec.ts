/// <reference types="jest" />
import {
  COMMENT_MAX_BODY_BYTES,
  CommentHtmlError,
  previewCommentHtml,
  sanitizeCommentHtml,
  utf8ByteLength,
} from './comment-html';

function expectError(input: string, message: string | RegExp) {
  expect(() => sanitizeCommentHtml(input)).toThrow(CommentHtmlError);
  expect(() => sanitizeCommentHtml(input)).toThrow(message);
}

describe('sanitizeCommentHtml', () => {
  it('keeps allowed markup and escapes text', () => {
    expect(
      sanitizeCommentHtml(
        'Hi <strong><a href="https://shop.test" title="Shop">buy</a></strong> & more',
      ),
    ).toBe(
      'Hi <strong><a href="https://shop.test" title="Shop">buy</a></strong> &amp; more',
    );
  });

  it('normalizes tag case and quotes', () => {
    expect(sanitizeCommentHtml('<I>ok</I>')).toBe('<i>ok</i>');
    expect(sanitizeCommentHtml(`<A HREF='https://x.test'>x</A>`)).toBe(
      '<a href="https://x.test">x</a>',
    );
  });

  it('accepts relative and hash hrefs', () => {
    expect(sanitizeCommentHtml('<a href="/p/1">x</a>')).toBe(
      '<a href="/p/1">x</a>',
    );
    expect(sanitizeCommentHtml('<a href="#top">x</a>')).toBe(
      '<a href="#top">x</a>',
    );
  });

  it('allows exactly 100 KB of UTF-8', () => {
    const body = 'a'.repeat(COMMENT_MAX_BODY_BYTES);
    expect(sanitizeCommentHtml(body)).toBe(body);
  });

  it.each([
    ['', 'Comment cannot be empty'],
    ['   ', 'Comment cannot be empty'],
    ['<script>x</script>', 'Tag <script> is not allowed'],
    ['<b>x</b>', 'Tag <b> is not allowed'],
    ['hello <', 'Unclosed HTML tag'],
    ['<!-- hi -->', 'HTML comments and declarations are not allowed'],
    ['<!DOCTYPE html>x', 'HTML comments and declarations are not allowed'],
    ['<i/>', 'Self-closing tags are not valid for allowed elements'],
    ['<strong><i>x</strong></i>', 'Tags must be properly nested and closed'],
    ['<i>x', 'Tags must be properly nested and closed'],
    ['<i class="x">x</i>', '<i> cannot have attributes'],
    ['<a>x</a>', '<a> may only have href and optional title'],
    [
      '<a href="https://x.test" target="_blank">x</a>',
      '<a> may only have href and optional title',
    ],
    [
      '<a href="javascript:alert(1)">x</a>',
      'Link href must start with http://, https://, / or #',
    ],
    [
      '<a href="//evil.test">x</a>',
      'Link href must start with http://, https://, / or #',
    ],
    ['<a href=https://x.test>x</a>', 'Malformed tag attributes'],
  ])('rejects %j', (input, message) => {
    expectError(input, message);
  });

  it('rejects bodies over 100 KB in UTF-8 bytes', () => {
    const body = 'a'.repeat(COMMENT_MAX_BODY_BYTES + 1);
    expectError(body, 'Comment must be at most 100 KB');
  });

  it('counts Cyrillic as two UTF-8 bytes', () => {
    const tooBig = 'я'.repeat(COMMENT_MAX_BODY_BYTES / 2 + 1);
    expect(utf8ByteLength(tooBig)).toBeGreaterThan(COMMENT_MAX_BODY_BYTES);
    expectError(tooBig, 'Comment must be at most 100 KB');
  });
});

describe('previewCommentHtml', () => {
  it('returns sanitized html', () => {
    expect(previewCommentHtml('<i>ok</i>')).toEqual({ html: '<i>ok</i>' });
  });

  it('returns the sanitizer message on invalid input', () => {
    expect(previewCommentHtml('<script>x</script>')).toEqual({
      html: '',
      error: 'Tag <script> is not allowed. Use a, i, strong',
    });
  });
});
