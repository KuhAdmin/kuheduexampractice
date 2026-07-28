import { Link, useParams } from "react-router-dom";
import { legalDocsBySlug } from "../content/legalContent";

// Standalone, unauthenticated page (no login/app state needed) at /legal/:docId
// -- payment gateway KYC review needs a stable, directly-visitable URL per
// policy, separate from the in-app dialogs opened on mobile/tablet.
export const LegalPage = () => {
  const { docId } = useParams();
  const doc = legalDocsBySlug[docId];

  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <img src="/kuhedu-logo.png" alt="" />
        <span>KUHEDU STUDY BUDDY</span>
        <Link className="legal-page-back" to="/">
          Back to KUHEDU STUDY BUDDY
        </Link>
      </header>
      <div className="legal-page-content">
        {doc ? (
          <>
            <h1>{doc.title}</h1>
            {doc.sections.map((section, index) => (
              <div className="legal-modal-section" key={section.heading || index}>
                {section.heading ? <h3>{section.heading}</h3> : null}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            <h1>Page not found</h1>
            <p>This document doesn&apos;t exist.</p>
          </>
        )}
      </div>
    </div>
  );
};
