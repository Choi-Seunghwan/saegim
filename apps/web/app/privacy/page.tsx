import { LEGAL_DOCUMENTS } from "@saegim/domain";
import { LegalDocumentPage } from "../../src/components/LegalDocumentPage";

export const metadata = {
  title: "개인정보 처리방침 - 새김",
  description: LEGAL_DOCUMENTS.privacy.summary,
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.privacy} />;
}
