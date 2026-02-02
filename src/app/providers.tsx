"use client";

import { AppProvider } from "@/store/AppContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
