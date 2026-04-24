"use client";

import { RouterProvider as Provider } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function HeroUIRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <Provider navigate={router.push}>
      {children}
    </Provider>
  );
}
