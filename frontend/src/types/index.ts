export type User = {
  id: string;
  email: string;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

export type Captcha = {
  captchaId: string;
  image: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  captchaId: string;
  captcha: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
};

export type ProductList = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
};

export type Payment = {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  status: string;
};
