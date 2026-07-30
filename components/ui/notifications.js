"use client";

import { Toaster } from "sonner";

export function Notifications() {
  return (
    <Toaster
      position="top-right"
      visibleToasts={4}
      gap={12}
      offset={16}
      expand
      toastOptions={{
        unstyled: true,
        className: "w-auto!",
      }}
    />
  );
}
