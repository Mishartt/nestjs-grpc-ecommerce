import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ordersApi, productsApi } from '../api/client';
import {
  COMMENT_MAX_BODY_BYTES,
  previewCommentHtml,
  utf8ByteLength,
} from '@app/common/comment-html';
import type { Order, Product, ProductComment } from '../types';

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_COMMENT_IMAGES = 5;

function formatKb(bytes: number) {
  return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
}

type SortKey = 'userName' | 'email' | 'createdAt';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'userName', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'createdAt', label: 'Date' },
];

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarHue(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

function wrapSelection(
  source: string,
  start: number,
  end: number,
  open: string,
  close: string,
  emptyFallback = 'text',
) {
  const selected = source.slice(start, end) || emptyFallback;
  return {
    next: source.slice(0, start) + open + selected + close + source.slice(end),
    cursor: start + open.length + selected.length + close.length,
  };
}

function ProductBuy({
  product,
  onPurchased,
}: {
  product: Product;
  onPurchased: () => Promise<void>;
}) {
  const maxQty = Math.max(0, product.stock);
  const [quantity, setQuantity] = useState(maxQty > 0 ? 1 : 0);
  const [ordering, setOrdering] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    setQuantity((current) => {
      if (maxQty <= 0) {
        return 0;
      }
      return Math.min(Math.max(1, current || 1), maxQty);
    });
  }, [maxQty]);

  const lineTotal = product.price * quantity;
  const outOfStock = maxQty <= 0;
  const canOrder = !outOfStock && quantity >= 1 && !ordering && !paying;
  const canPay = order?.status === 'PENDING' && !paying && !ordering;

  function onQtyChange(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setQuantity(Math.min(Math.max(1, Math.trunc(parsed)), Math.max(1, maxQty)));
  }

  async function placeOrder() {
    setError('');
    setOrdering(true);
    try {
      const created = await ordersApi.create([
        { productId: product.id, quantity },
      ]);
      setOrder(created);
      try {
        await onPurchased();
      } catch {
        // Order is already created; stale stock is a refresh issue only.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setOrdering(false);
    }
  }

  async function pay() {
    if (!order) {
      return;
    }
    setError('');
    setPaying(true);
    try {
      const res = await ordersApi.pay(order.id);
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="product-buy">
      <label className="product-buy-qty">
        Quantity
        <input
          type="number"
          min={outOfStock ? 0 : 1}
          max={Math.max(1, maxQty)}
          step="1"
          value={quantity}
          disabled={outOfStock || ordering || paying}
          onChange={(e) => onQtyChange(e.target.value)}
        />
      </label>
      <p className="product-buy-total">
        Total <strong>{money(lineTotal)}</strong>
      </p>
      <button type="button" disabled={!canOrder} onClick={() => void placeOrder()}>
        {outOfStock ? 'Out of stock' : ordering ? 'Placing…' : 'Place order'}
      </button>
      {order ? (
        <div className="product-buy-result">
          <p className="notice">
            Order {order.id.slice(0, 8)}… {order.status.toLowerCase()}.{' '}
            <Link to="/orders">View orders</Link>
          </p>
          {order.status === 'PENDING' ? (
            <button type="button" disabled={!canPay} onClick={() => void pay()}>
              {paying ? 'Paying…' : 'Pay now'}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function CommentBody({ comment }: { comment: ProductComment }) {
  const photos = comment.imageUrls ?? [];
  if (!comment.body && photos.length === 0) {
    return null;
  }

  return (
    <div className="comment-body">
      {comment.body ? (
        <div
          className="comment-html"
          dangerouslySetInnerHTML={{ __html: comment.body }}
        />
      ) : null}
      {photos.length ? (
        <div className="comment-photos">
          {photos.map((src) => (
            <img key={src} className="comment-photo" src={src} alt="" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentForm({
  productId,
  parentId,
  onCreated,
  onCancel,
  compact,
}: {
  productId: string;
  parentId?: string;
  onCreated: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const usedBytes = utf8ByteLength(body);
  const preview = useMemo(() => {
    if (!body.trim()) {
      return { html: '', error: undefined as string | undefined };
    }
    return previewCommentHtml(body);
  }, [body]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  function insertTag(tag: 'i' | 'strong' | 'a') {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    let open = `<${tag}>`;
    let emptyFallback = 'text';
    if (tag === 'a') {
      const href = window.prompt('Link URL', 'https://');
      if (!href) {
        return;
      }
      open = `<a href="${href}">`;
      if (start === end) {
        const label = window.prompt('Link text', href);
        if (label == null) {
          return;
        }
        emptyFallback = label.trim() || href;
      }
    }
    const close = tag === 'a' ? '</a>' : `</${tag}>`;
    const { next, cursor } = wrapSelection(
      body,
      start,
      end,
      open,
      close,
      emptyFallback,
    );
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function onPickFiles(list: FileList | null) {
    setError('');
    if (!list?.length) {
      return;
    }
    const next = [...files];
    for (const selected of Array.from(list)) {
      if (next.length >= MAX_COMMENT_IMAGES) {
        setError(`You can attach at most ${MAX_COMMENT_IMAGES} images`);
        break;
      }
      if (!ALLOWED_IMAGE.has(selected.type)) {
        setError('Image must be JPG, PNG or GIF');
        return;
      }
      if (selected.size > MAX_IMAGE_BYTES) {
        setError('Image must be at most 2 MB');
        return;
      }
      next.push(selected);
    }
    setFiles(next);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (usedBytes > COMMENT_MAX_BODY_BYTES) {
      setError('Comment must be at most 100 KB');
      return;
    }
    if (body.trim()) {
      const check = previewCommentHtml(body);
      if (check.error) {
        setError(check.error);
        return;
      }
    }
    if (!body.trim() && files.length === 0) {
      setError('Write a comment or attach an image');
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.append('body', body);
      if (parentId) {
        form.append('parentId', parentId);
      }
      if (files.length) {
        files.forEach((file) => form.append('image', file));
      }
      await productsApi.createComment(productId, form);
      setBody('');
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setPending(false);
    }
  }

  const showPreview = Boolean(preview.html || preview.error || files.length);

  return (
    <form
      className={`comment-form${compact ? ' comment-form--reply' : ''}`}
      onSubmit={(e) => void onSubmit(e)}
    >
      {!compact ? (
        <p className="comment-form-title">Leave a comment</p>
      ) : null}
      <div className="comment-toolbar" role="toolbar" aria-label="HTML tags">
        <button
          type="button"
          className="ghost comment-tag"
          title="Italic"
          onClick={() => insertTag('i')}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="ghost comment-tag"
          title="Bold"
          onClick={() => insertTag('strong')}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="ghost comment-tag"
          title="Link"
          onClick={() => insertTag('a')}
        >
          Link
        </button>
        <span className="comment-toolbar-hint">i, strong, a</span>
      </div>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 3 : 5}
        placeholder={
          parentId
            ? 'Write a reply…'
            : 'Share your thoughts. You can use italic, bold, and links.'
        }
      />
      <div className="comment-form-meta">
        <div className="comment-attach">
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/gif,.jpg,.jpeg,.png,.gif"
            multiple
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <button
            type="button"
            className="ghost comment-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_COMMENT_IMAGES}
          >
            Add photos
          </button>
          {files.length ? (
            <div className="file-chips">
              {files.map((file, index) => (
                <span key={`${file.name}-${file.size}-${index}`} className="file-chip">
                  <span className="file-chip-name" title={file.name}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="file-chip-remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="muted small">
              JPG, PNG or GIF, max 2 MB each, up to {MAX_COMMENT_IMAGES}
            </span>
          )}
        </div>
        <span className={`muted small${usedBytes > COMMENT_MAX_BODY_BYTES ? ' error' : ''}`}>
          {formatKb(usedBytes)} / 100 KB
        </span>
      </div>
      {showPreview ? (
        <div className="comment-preview-wrap">
          <span className="comment-preview-label">Preview</span>
          {preview.error ? (
            <p className="error">{preview.error}</p>
          ) : (
            <div className="comment-preview">
              {preview.html ? (
                <div
                  className="comment-html"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : null}
              {previewUrls.length ? (
                <div className="comment-photos">
                  {previewUrls.map((src) => (
                    <img key={src} className="comment-photo" src={src} alt="" />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="comment-form-actions">
        <button type="submit" disabled={pending}>
          {pending ? 'Posting…' : parentId ? 'Reply' : 'Post comment'}
        </button>
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  productId,
  onCreated,
}: {
  comment: ProductComment;
  productId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hue = avatarHue(comment.authorEmail || comment.authorName);

  return (
    <article className="comment-item">
      <div
        className="comment-avatar"
        style={{ '--hue': hue } as CSSProperties}
        aria-hidden
      >
        {initials(comment.authorName)}
      </div>
      <div className="comment-content">
        <header className="comment-head">
          <span className="comment-author">{comment.authorName}</span>
          <span className="comment-email">{comment.authorEmail}</span>
          <time className="comment-date" dateTime={comment.createdAt}>
            {formatDate(comment.createdAt)}
          </time>
        </header>
        <CommentBody comment={comment} />
        <div className="comment-actions">
          <button
            type="button"
            className="ghost comment-reply-btn"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? 'Cancel' : 'Reply'}
          </button>
        </div>
        {open ? (
          <CommentForm
            productId={productId}
            parentId={comment.id}
            compact
            onCancel={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              onCreated();
            }}
          />
        ) : null}
        {comment.replies?.length ? (
          <div className="comment-replies">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                productId={productId}
                onCreated={onCreated}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ProductPage() {
  const { id = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRoots, setTotalRoots] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadComments(
    nextSort = sort,
    nextOrder = order,
    nextPage = page,
  ) {
    const res = await productsApi.comments(id, nextSort, nextOrder, nextPage);
    setComments(res.comments);
    setTotalRoots(res.total);
    setPage(res.page);
    setPageSize(res.pageSize);
  }

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setPage(1);
    Promise.all([productsApi.get(id), productsApi.comments(id, sort, order, 1)])
      .then(([item, commentRes]) => {
        setProduct(item);
        setComments(commentRes.comments);
        setTotalRoots(commentRes.total);
        setPage(commentRes.page);
        setPageSize(commentRes.pageSize);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => setLoading(false));
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toggleSort(key: SortKey) {
    const nextOrder = sort === key && order === 'asc' ? 'desc' : 'asc';
    setSort(key);
    setOrder(nextOrder);
    setPage(1);
    void loadComments(key, nextOrder, 1).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to sort comments');
    });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    void loadComments(sort, order, nextPage).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    });
  }

  const pageCount = Math.max(1, Math.ceil(totalRoots / pageSize));

  if (loading) {
    return <p className="muted">Loading…</p>;
  }
  if (!product) {
    return (
      <section>
        <p className="error">{error || 'Product not found'}</p>
        <Link to="/">Back to catalog</Link>
      </section>
    );
  }

  return (
    <section className="product-page">
      <p>
        <Link to="/" className="back-link">
          ← Catalog
        </Link>
      </p>
      <div className="card product-hero">
        <div className="product-hero-main">
          {product.imageUrl ? (
            <img
              className="product-img"
              src={product.imageUrl}
              alt={product.name}
              width={320}
              height={240}
            />
          ) : null}
          <div>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <p className="product-hero-meta">
              <strong>{money(product.price)}</strong>
              <span className="muted">stock {product.stock}</span>
            </p>
          </div>
        </div>
        <ProductBuy
          key={product.id}
          product={product}
          onPurchased={async () => {
            const item = await productsApi.get(id);
            setProduct(item);
          }}
        />
      </div>

      {error ? <p className="error">{error}</p> : null}

      <section className="comments-section" aria-labelledby="comments-heading">
        <div className="comments-head">
          <div>
            <h2 id="comments-heading">Comments</h2>
            <p className="muted comments-count">
              {totalRoots === 0
                ? 'No comments yet'
                : `${totalRoots} thread${totalRoots === 1 ? '' : 's'} · ${pageSize} per page`}
            </p>
          </div>
          <div className="comment-sort" role="group" aria-label="Sort comments">
            <span className="comment-sort-label">Sort</span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`sort-chip${sort === option.key ? ' is-active' : ''}`}
                onClick={() => toggleSort(option.key)}
              >
                {option.label}
                {sort === option.key ? (order === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
        </div>

        <CommentForm
          productId={id}
          onCreated={() => {
            setPage(1);
            void loadComments(sort, order, 1);
          }}
        />

        {comments.length === 0 ? (
          <div className="comment-empty">
            <p>Be the first to leave a comment.</p>
          </div>
        ) : (
          <>
            <div className="comment-list">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  productId={id}
                  onCreated={() => void loadComments()}
                />
              ))}
            </div>
            {totalRoots > pageSize ? (
              <nav className="pager" aria-label="Comment pages">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goToPage(Math.max(1, page - 1))}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => goToPage(Math.min(pageCount, page + 1))}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </section>
  );
}
