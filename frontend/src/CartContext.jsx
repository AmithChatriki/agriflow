import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const KEY = "agriflow_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  });

  // Keep the cart when the page is refreshed
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  function addItem(product, qty = 1) {
    const max = Number(product.quantity);
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + qty, max) }
            : i
        );
      }
      return [...prev, { product, quantity: Math.min(qty, max) }];
    });
  }

  function setQuantity(id, qty) {
    setItems((prev) =>
      prev.map((i) => (i.product.id === id ? { ...i, quantity: qty } : i))
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.product.id !== id));
  }

  function clearCart() {
    setItems([]);
  }

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, setQuantity, removeItem, clearCart, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
