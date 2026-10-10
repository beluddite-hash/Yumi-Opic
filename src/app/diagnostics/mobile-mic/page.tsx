import { notFound } from "next/navigation";
import { diagnosticPreviewAllowed } from "@/lib/mobileMicDiagnostic";
import MobileMicDiagnostic from "./MobileMicDiagnostic";

export const dynamic = "force-dynamic";
export const metadata = { title: "모바일 신호음 A/B 진단", robots: { index: false, follow: false } };

export default function Page() {
  if (!diagnosticPreviewAllowed(process.env.VERCEL_ENV, process.env.VERCEL_GIT_COMMIT_REF, process.env.NODE_ENV === "development")) notFound();
  return <MobileMicDiagnostic />;
}
