import type { LegalDocument } from "@saegim/domain";
import Link from "next/link";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="legal-public">
      <article className="legal-public-shell">
        <Link className="legal-public-back" href="/">
          ← 새김으로 돌아가기
        </Link>

        <header className="legal-public-head">
          <span className="legal-public-kicker">
            버전 {document.version} · 시행일 {document.effectiveDate}
          </span>
          <h1>{document.title}</h1>
          <p>{document.summary}</p>
          <p>
            본 문서는 MVP 운영 준비용 초안입니다. 정식 운영 전 사업자 정보,
            문의 창구, 보존 기간, 위탁 현황을 확정해 갱신합니다.
          </p>
        </header>

        <div className="legal-public-body">
          {document.sections.map((section) => (
            <section className="legal-public-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
