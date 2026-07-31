import { Suspense } from "react";
import CampaignsPageClient from "./campaigns-client";

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl py-10 text-sm text-(--muted-text)">
          Loading campaigns…
        </div>
      }
    >
      <CampaignsPageClient />
    </Suspense>
  );
}
