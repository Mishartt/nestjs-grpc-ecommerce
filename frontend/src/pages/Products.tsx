import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ordersApi, productsApi } from '../api/client';
import type { Product } from '../types';

const MAX_W = 320;
const MAX_H = 240;
const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif']);

type CartLine = { product: Product; quantity: number };

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function hasImage(url: string | undefined): boolean {
  return !!url && url.length > 0;
}

async function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      if (width <= MAX_W && height <= MAX_H) {
        resolve(file);
        return;
      }
      const ratio = Math.min(MAX_W / width, MAX_H / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: file.type }));
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };
    img.src = objectUrl;
  });
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [productCount, setProductCount] = useState(0);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('9.99');
  const [stock, setStock] = useState('10');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  const imageInputRef = useRef<HTMLInputElement>(null);

  async function reload(pageNum = page) {
    const res = await productsApi.list(pageNum);
    setProducts(res.products);
    setProductCount(res.total);
    setPageSize(res.pageSize);
  }

  useEffect(() => {
    setLoading(true);
    void reload(page)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const pageCount = Math.max(1, Math.ceil(productCount / pageSize));

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE.has(file.type)) {
      setError('Image must be JPG, PNG or GIF');
      e.target.value = '';
      return;
    }
    setError('');
    const resized = await resizeImage(file);
    setImageFile(resized);
    setImagePreview(URL.createObjectURL(resized));
  }

  function addToCart(product: Product) {
    setNotice('');
    setCart((prev) => {
      const current = prev[product.id]?.quantity ?? 0;
      const nextQty = Math.min(product.stock, current + 1);
      if (nextQty === 0) return prev;
      return { ...prev, [product.id]: { product, quantity: nextQty } };
    });
  }

  function setQty(productId: string, quantity: number) {
    setCart((prev) => {
      const line = prev[productId];
      if (!line) return prev;
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: { ...line, quantity: Math.min(line.product.stock, quantity) },
      };
    });
  }

  async function placeOrder() {
    setError('');
    setNotice('');
    setOrdering(true);
    try {
      const order = await ordersApi.create(
        lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      );
      setCart({});
      setNotice(`Order ${order.id.slice(0, 8)}… created (${order.status}).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setOrdering(false);
    }
  }

  async function onCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!imageFile) {
      setError('Image is required');
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('image', imageFile, imageFile.name);

      await productsApi.create(formData);

      setName('');
      setDescription('');
      setPrice('9.99');
      setStock('10');
      setImageFile(null);
      setImagePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setNotice('Product created.');
      if (page === 1) {
        await reload(1);
      } else {
        setPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
    <div className="split">
      <section>
        <div className="page-head">
          <h1>Catalog</h1>
          {productCount > 0 ? (
            <p className="muted">
              {productCount} item{productCount === 1 ? '' : 's'} · {pageSize} per page
            </p>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && products.length === 0 ? (
          <p className="muted">No products yet. Add one on the right.</p>
        ) : (
          <ul className="product-grid">
            {products.map((product) => (
              <li key={product.id} className="card product-card">
{hasImage(product.imageUrl) ? (
                    <button
                      type="button"
                      className="product-img-btn"
                      onClick={() =>
                        setLightbox({
                          src: product.imageUrl as string,
                          alt: product.name,
                        })
                      }
                    >
                      <img
                        className="product-img"
                        src={product.imageUrl}
                        alt={product.name}
                        width={MAX_W}
                        height={MAX_H}
                      />
                    </button>
                ) : (
                  <div className="product-img product-img--placeholder" />
                )}
                <h2 title={product.name}>{product.name}</h2>
                <p className="product-desc" title={product.description}>
                  {product.description}
                </p>
                <div className="product-meta">
                  <strong>{money(product.price)}</strong>
                  <span className="muted">stock {product.stock}</span>
                </div>
                <button
                  type="button"
                  disabled={product.stock <= 0}
                  onClick={() => addToCart(product)}
                >
                  {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && productCount > pageSize ? (
          <nav className="pager" aria-label="Catalog pages">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>

      <aside className="side">
        <form className="card" onSubmit={(e) => void onCreate(e)}>
          <h2>New product</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              required
            />
          </label>
          <div className="row">
            <label>
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Image <span className="muted">(required, JPG / PNG / GIF, max 320×240)</span>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              required
              onChange={(e) => void handleImageChange(e)}
            />
          </label>
          {imagePreview ? (
            <img
              className="upload-preview"
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: MAX_W, maxHeight: MAX_H }}
            />
          ) : null}

          <button type="submit" disabled={creating || !imageFile}>
            {creating ? 'Saving…' : 'Create'}
          </button>
        </form>

        <div className="card">
          <h2>Cart</h2>
          {lines.length === 0 ? (
            <p className="muted">Empty.</p>
          ) : (
            <ul className="cart-list">
              {lines.map((line) => (
                <li key={line.product.id}>
                  <div>
                    <strong>{line.product.name}</strong>
                    <span className="muted"> {money(line.product.price)}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={line.product.stock}
                    value={line.quantity}
                    onChange={(e) => setQty(line.product.id, Number(e.target.value))}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="total">Total {money(total)}</p>
          <button
            type="button"
            disabled={lines.length === 0 || ordering}
            onClick={() => void placeOrder()}
          >
            {ordering ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </aside>
    </div>
    {lightbox ? (
      <div
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={lightbox.alt}
        onClick={() => setLightbox(null)}
      >
        <img
          src={lightbox.src}
          alt={lightbox.alt}
          width={MAX_W}
          height={MAX_H}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ) : null}
    </>
  );
}
