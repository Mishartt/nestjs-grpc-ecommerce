import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminPage } from '../pages/Admin';
import { LoginPage } from '../pages/Login';
import { OrdersPage } from '../pages/Orders';
import { ProductsPage } from '../pages/Products';
import { RegisterPage } from '../pages/Register';
import { ProtectedRoute } from '../shared/auth/ProtectedRoute';
import { Layout } from '../shared/ui/Layout';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <ProductsPage /> },
      { path: '/orders', element: <OrdersPage /> },
      { path: '/admin', element: <AdminPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
