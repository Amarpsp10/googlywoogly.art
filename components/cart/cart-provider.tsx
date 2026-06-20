"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { purchasableQuantity } from "@/lib/inventory";
import {
  type AddToCartProduct,
  type CartLine,
  lineIdFor,
} from "@/lib/cart/types";

const STORAGE_KEY = "gw_cart";
const MAX_PER_LINE = 99;

interface AddInput {
  product: AddToCartProduct;
  quantity?: number;
  personalizationNote?: string;
  giftMessage?: string;
}

type Action =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; input: AddInput }
  | { type: "setQty"; lineId: string; quantity: number }
  | { type: "remove"; lineId: string }
  | { type: "clear" };

function maxFor(p: AddToCartProduct): number {
  return purchasableQuantity(
    {
      madeToOrder: p.madeToOrder,
      inventoryQuantity: p.inventoryQuantity,
      lowStockThreshold: p.lowStockThreshold,
    },
    MAX_PER_LINE,
  );
}

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "hydrate":
      return action.lines;
    case "add": {
      const { product, quantity = 1, personalizationNote, giftMessage } = action.input;
      const lineId = lineIdFor(product.id, personalizationNote);
      const max = Math.max(1, maxFor(product));
      const existing = state.find((l) => l.lineId === lineId);
      if (existing) {
        return state.map((l) =>
          l.lineId === lineId
            ? { ...l, quantity: Math.min(max, l.quantity + quantity) }
            : l,
        );
      }
      const line: CartLine = {
        lineId,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        sku: product.sku,
        unitPrice: product.price,
        quantity: Math.min(max, Math.max(1, quantity)),
        imageUrl: product.imageUrl,
        personalizationNote: personalizationNote?.trim() || undefined,
        giftMessage: giftMessage?.trim() || undefined,
        madeToOrder: product.madeToOrder,
        maxQuantity: max,
      };
      return [...state, line];
    }
    case "setQty":
      return state
        .map((l) =>
          l.lineId === action.lineId
            ? {
                ...l,
                quantity: Math.min(
                  l.maxQuantity ?? MAX_PER_LINE,
                  Math.max(0, action.quantity),
                ),
              }
            : l,
        )
        .filter((l) => l.quantity > 0);
    case "remove":
      return state.filter((l) => l.lineId !== action.lineId);
    case "clear":
      return [];
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartLine[];
  count: number;
  subtotalPaise: number;
  hydrated: boolean;
  addItem: (input: AddInput) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", lines: JSON.parse(raw) as CartLine[] });
    } catch {
      /* ignore corrupt cart */
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable */
    }
  }, [items, hydrated]);

  // Cross-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          dispatch({ type: "hydrate", lines: JSON.parse(e.newValue) as CartLine[] });
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, l) => n + l.quantity, 0);
    const subtotalPaise = items.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
    return {
      items,
      count,
      subtotalPaise,
      hydrated,
      addItem: (input) => dispatch({ type: "add", input }),
      updateQuantity: (lineId, quantity) => dispatch({ type: "setQty", lineId, quantity }),
      removeItem: (lineId) => dispatch({ type: "remove", lineId }),
      clear: () => dispatch({ type: "clear" }),
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    };
  }, [items, hydrated, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
