"use client";

import { createContext, useContext } from "react";

type AuthModalContextValue = {
  openLogin: () => void;
  openRegister: () => void;
  openWallet: () => void;
};

export const AuthModalContext = createContext<AuthModalContextValue>({
  openLogin: () => {},
  openRegister: () => {},
  openWallet: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}
