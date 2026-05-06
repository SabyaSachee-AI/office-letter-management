import { PageHeader } from "@/components/layout/page-header";
import { LetterReceiveForm } from "@/components/letters/letter-receive-form";

export default function ReceiveLetterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive letter"
        description="Central intake form for registering incoming letters with an attachment."
      />
      <LetterReceiveForm />
    </div>
  );
}
