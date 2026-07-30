import { redirect } from "next/navigation";

/** Legacy route — setup now lives in the signup stepper. */
export default function OnboardingRedirectPage() {
  redirect("/signup?setup=1");
}
