import { redirect } from "next/navigation";

/** Legacy route — Website + SMM import now live under /leads. */
export default function SmmLeadsRedirectPage() {
  redirect("/leads");
}
