import { ImportLeadsWorkflow } from "@/components/leads/import-workflow";

export default function WebsiteLeadsPage() {
  return (
    <ImportLeadsWorkflow
      type="website"
      title="Website Leads"
      description="Paste software & web dev leads from Google Sheets. AI writes a personalized outreach email for each — review, then send at 100/hour."
    />
  );
}
