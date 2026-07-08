import { ImportLeadsWorkflow } from "@/components/leads/import-workflow";

export default function SmmLeadsPage() {
  return (
    <ImportLeadsWorkflow
      type="smm"
      title="SMM Leads"
      description="Paste social media / marketing leads from Google Sheets. AI writes a personalized SMM outreach email for each — review, then send at 100/hour."
    />
  );
}
