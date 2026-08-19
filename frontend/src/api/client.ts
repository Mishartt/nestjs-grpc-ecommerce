import type {
  AuthResponse,
  Captcha,
  Order,
  Payment,
  Product,
  ProductList,
  RegisterRequest,
  User,
} from '../types';
import { http, request } from './http';

export const authApi = {
  captcha: () => request<Captcha>(http.get('/auth/captcha')),
  me: () => request<User>(http.get('/auth/me')),
  register: (body: RegisterRequest) =>
    request<AuthResponse>(http.post('/auth/register', body)),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>(http.post('/auth/login', body)),
};

export const productsApi = {
  list: async (page = 1) => {
    const res = await request<ProductList>(
      http.get('/products', { params: { page } }),
    );
    return {
      products: res.products ?? [],
      total: res.total ?? 0,
      page: res.page ?? page,
      pageSize: res.pageSize ?? 25,
    };
  },
  create: (formData: FormData) =>
    request<Product>(
      http.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    ),
};

function normalizeOrder(order: Order): Order {
  return { ...order, items: order.items ?? [] };
}

export const ordersApi = {
  mine: async () => {
    const res = await request<{ orders?: Order[] }>(http.get('/orders'));
    return { orders: (res.orders ?? []).map(normalizeOrder) };
  },
  all: async () => {
    const res = await request<{ orders?: Order[] }>(http.get('/orders/all'));
    return { orders: (res.orders ?? []).map(normalizeOrder) };
  },
  create: async (items: { productId: string; quantity: number }[]) =>
    normalizeOrder(await request<Order>(http.post('/orders', { items }))),
  pay: async (orderId: string) => {
    const res = await request<{ payment: Payment; order: Order }>(
      http.post(`/orders/${orderId}/pay`),
    );
    return { ...res, order: normalizeOrder(res.order) };
  },
};

export const paymentsApi = {
  all: async () => {
    const res = await request<Payment[] | { payments?: Payment[] }>(
      http.get('/payments'),
    );
    return Array.isArray(res) ? res : (res.payments ?? []);
  },
};
