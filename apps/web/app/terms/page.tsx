import { LEGAL_DOCUMENTS } from "@saegim/domain";
import { LegalDocumentPage } from "../../src/components/LegalDocumentPage";

export const metadata = {
  title: "이용약관 - 새김",
  description: LEGAL_DOCUMENTS.terms.summary,
};

export default function TermsPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.terms} />;
}
