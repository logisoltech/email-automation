import { Suspense } from "react";
import SignupPage from "./signup-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignupPage />
    </Suspense>
  );
}
