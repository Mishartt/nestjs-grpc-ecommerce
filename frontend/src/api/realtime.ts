import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../shared/auth/store';
import type { Order, Payment } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type RealtimeEvents = {
  'order.updated': Order;
  'payment.created': Payment;
};

export function useRealtimeBindings(
  handlers: {
    [K in keyof RealtimeEvents]?: (payload: RealtimeEvents[K]) => void;
  },
) {
  const token = useAuthStore((state) => state.token);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    const onOrder = (payload: Order) => {
      handlersRef.current['order.updated']?.(payload);
    };
    const onPayment = (payload: Payment) => {
      handlersRef.current['payment.created']?.(payload);
    };

    socket.on('order.updated', onOrder);
    socket.on('payment.created', onPayment);

    return () => {
      socket.off('order.updated', onOrder);
      socket.off('payment.created', onPayment);
      socket.disconnect();
    };
  }, [token]);
}

export function patchById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((row) => row.id === item.id);
  if (index === -1) {
    return [item, ...list];
  }
  const next = [...list];
  next[index] = item;
  return next;
}
