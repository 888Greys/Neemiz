"use client";

import { createContext, useContext } from "react";

type AuthModalContextValue = {
  openLogin: () => void;
  openRegister: () => void;
};

export const AuthModalContext = createContext<AuthModalContextValue>({
  openLogin: () => {},
  openRegister: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}
