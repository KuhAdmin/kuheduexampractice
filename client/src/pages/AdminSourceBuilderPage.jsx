import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addSourceSectionImage,
  getAssessmentStudioBootstrap,
  getAssessmentStudioChapters,
  getAssessmentStudioSections,
  removeSourceSectionImage,
  runAssessmentStudioPipeline,
  saveSourceDocumentPdf,
  saveSourceSectionDraft,
  updateSourceSection,
} from "../api/client";
import { splitPdfIntoPages } from "../lib/pdfSplitter";
import { AdminPdfPageLightbox } from "../components/AdminPdfPageLightbox";
import { AdminImageCropEditor } from "../components/AdminImageCropEditor";

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Defaults for the pipeline-strategy fields the wizard page
// (AdminAssessmentStudioPage.jsx) exposes as its own pickers -- this page's
// job is source-content authoring (PDF -> pages -> sections -> crops ->
// notes), not re-building that settings UI, so a sensible fixed default is
// used instead of a second picker for the same thing.
const PIPELINE_DEFAULTS = {
  practiceType: "Concept Builder",
  targetDifficulty: "Balanced",
  duration: "25",
  blueprint: "Understand -> recall -> apply -> retry",
};

const emptySectionDraft = () => ({
  sourceSectionId: null,
  adminNotes: "",
  sectionOcrText: "",
  images: [],
  loading: true,
});

export const AdminSourceBuilderPage = () => {
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState({ boards: [{ code: "CBSE", name: "CBSE" }], levels: [], subjects: [], chapters: [] });
  const [selection, setSelection] = useState({ board: "CBSE", className: "", subjectCode: "", subject: "", chapterKey: "", chapter: "" });
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [sections, setSections] = useState([]); // [{sectionNumber, topicName}]
  const [sectionDrafts, setSectionDrafts] = useState({}); // sectionNumber -> draft state
  const [sourceDocumentId, setSourceDocumentId] = useState(null);

  const [pdfPages, setPdfPages] = useState([]);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfSplitting, setPdfSplitting] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const [lightboxPage, setLightboxPage] = useState(null);
  const [croppingTarget, setCroppingTarget] = useState(null); // { sectionNumber, imageId, mediaData, cropRegion }
  const [cropSaving, setCropSaving] = useState(false);
  const [dropTargetSection, setDropTargetSection] = useState(null);

  const [startBusyKey, setStartBusyKey] = useState("");
  const [startErrors, setStartErrors] = useState({});
  const [startedJobIds, setStartedJobIds] = useState({});

  const bootstrapHydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setBootstrapLoading(true);
    setCatalogError("");

    getAssessmentStudioBootstrap({ levelCode: selection.className })
      .then((data) => {
        if (cancelled) return;
        setCatalog((current) => ({ ...current, ...data }));
        setSelection((current) => ({
          ...current,
          className: current.className || data.levels?.[0]?.code || "",
          subjectCode: current.subjectCode || data.subjects?.[0]?.code || "",
          subject: current.subject || data.subjects?.[0]?.name || "",
        }));
        bootstrapHydratedRef.current = true;
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error.message || "Failed to load academic setup.");
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.className]);

  useEffect(() => {
    if (!bootstrapHydratedRef.current || !selection.className || !selection.subjectCode) return;
    let cancelled = false;
    setChaptersLoading(true);
    setCatalogError("");

    getAssessmentStudioChapters({ levelCode: selection.className, subjectCode: selection.subjectCode })
      .then((data) => {
        if (cancelled) return;
        setCatalog((current) => ({ ...current, chapters: data.chapters }));
        setSelection((current) => {
          const selectedChapter = data.chapters.find((item) => item.key === current.chapterKey) || data.chapters[0];
          return { ...current, chapterKey: selectedChapter?.key || "", chapter: selectedChapter?.chapterName || "" };
        });
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error.message || "Failed to load chapters.");
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.className, selection.subjectCode]);

  // Loading this chapter's sections eagerly creates (or reuses) a durable
  // source_section/source_document row for every one of them right away --
  // not just the one the admin happens to touch first -- so the PDF upload
  // and every section's tray always has a real sourceSectionId to save
  // against, no lazy "create on first assignment" edge case to handle.
  useEffect(() => {
    if (!bootstrapHydratedRef.current || !selection.chapterKey) return;
    let cancelled = false;

    setSections([]);
    setSectionDrafts({});
    setSourceDocumentId(null);
    setPdfPages([]);
    setPdfFileName("");

    getAssessmentStudioSections({
      levelCode: selection.className,
      subjectCode: selection.subjectCode,
      chapterKey: selection.chapterKey,
    })
      .then(async (data) => {
        if (cancelled) return;
        const sectionList = data.sections || [];
        setSections(sectionList);
        setSectionDrafts(
          Object.fromEntries(sectionList.map((section) => [section.sectionNumber, emptySectionDraft()]))
        );

        const results = await Promise.all(
          sectionList.map((section) =>
            saveSourceSectionDraft({
              board: selection.board,
              className: selection.className,
              subject: selection.subject,
              subjectCode: selection.subjectCode,
              chapter: selection.chapter,
              chapterKey: selection.chapterKey,
              sectionNumber: section.sectionNumber,
            })
              .then((refs) => ({ sectionNumber: section.sectionNumber, refs }))
              .catch(() => ({ sectionNumber: section.sectionNumber, refs: null }))
          )
        );
        if (cancelled) return;

        setSectionDrafts((current) => {
          const next = { ...current };
          for (const { sectionNumber, refs } of results) {
            next[sectionNumber] = { ...next[sectionNumber], sourceSectionId: refs?.sourceSectionId || null, loading: false };
          }
          return next;
        });
        const firstDocumentId = results.find((row) => row.refs)?.refs.sourceDocumentId;
        if (firstDocumentId) setSourceDocumentId(firstDocumentId);
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error.message || "Failed to load sections.");
      });

    return () => {
      cancelled = true;
    };
  }, [selection.chapterKey]);

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPdfError("");
    setPdfSplitting(true);
    try {
      const result = await splitPdfIntoPages(file);
      setPdfPages(result.pages);
      setPdfFileName(result.fileName);

      if (sourceDocumentId) {
        await saveSourceDocumentPdf(sourceDocumentId, {
          pdfDataUrl: result.pdfDataUrl,
          fileName: result.fileName,
          pageCount: result.pageCount,
        });
      }
    } catch (error) {
      setPdfError(error.message || "Failed to read that PDF. Please try a different file.");
    } finally {
      setPdfSplitting(false);
    }
  };

  const assignPageToSection = async (page, sectionNumber) => {
    const target = sectionDrafts[sectionNumber];
    if (!target?.sourceSectionId) return;

    try {
      const saved = await addSourceSectionImage(target.sourceSectionId, {
        mediaData: page.dataUrl,
        mimeType: "image/png",
        fileName: `page-${page.pageNumber}.png`,
        sourcePageNumber: page.pageNumber,
        cropRegion: null,
      });
      setSectionDrafts((current) => ({
        ...current,
        [sectionNumber]: { ...current[sectionNumber], images: [...current[sectionNumber].images, saved] },
      }));
    } catch (error) {
      setCatalogError(error.message || "Failed to assign that page.");
    }
  };

  const removeImageFromSection = async (sectionNumber, imageId) => {
    const target = sectionDrafts[sectionNumber];
    if (!target?.sourceSectionId) return;
    try {
      await removeSourceSectionImage(target.sourceSectionId, imageId);
      setSectionDrafts((current) => ({
        ...current,
        [sectionNumber]: {
          ...current[sectionNumber],
          images: current[sectionNumber].images.filter((image) => image.id !== imageId),
        },
      }));
    } catch (error) {
      setCatalogError(error.message || "Failed to remove that image.");
    }
  };

  const handleCropSave = async (croppedDataUrl, cropRegion) => {
    const { sectionNumber, imageId, sourcePageNumber } = croppingTarget;
    const target = sectionDrafts[sectionNumber];
    setCropSaving(true);
    try {
      // Replace-by-remove-then-add -- there's no update-in-place endpoint,
      // so a crop is modeled as "remove the old image, add the refined one".
      await removeSourceSectionImage(target.sourceSectionId, imageId);
      const saved = await addSourceSectionImage(target.sourceSectionId, {
        mediaData: croppedDataUrl,
        mimeType: "image/jpeg",
        fileName: `page-${sourcePageNumber}-cropped.jpg`,
        sourcePageNumber,
        cropRegion,
      });
      setSectionDrafts((current) => ({
        ...current,
        [sectionNumber]: {
          ...current[sectionNumber],
          images: [...current[sectionNumber].images.filter((image) => image.id !== imageId), saved],
        },
      }));
      setCroppingTarget(null);
    } catch (error) {
      setCatalogError(error.message || "Failed to save the crop.");
    } finally {
      setCropSaving(false);
    }
  };

  const handleNotesBlur = async (sectionNumber, adminNotes) => {
    const target = sectionDrafts[sectionNumber];
    if (!target?.sourceSectionId) return;
    try {
      await updateSourceSection(target.sourceSectionId, { adminNotes });
    } catch {
      // Non-blocking -- the field still holds the admin's typed value locally.
    }
  };

  const isSectionReady = (sectionNumber) => (sectionDrafts[sectionNumber]?.images.length || 0) > 0;

  const handleStartPipeline = async (sectionNumber) => {
    const target = sectionDrafts[sectionNumber];
    const section = sections.find((item) => item.sectionNumber === sectionNumber);
    if (!target?.sourceSectionId || !isSectionReady(sectionNumber)) return;

    setStartBusyKey(sectionNumber);
    setStartErrors((current) => ({ ...current, [sectionNumber]: "" }));
    try {
      const result = await runAssessmentStudioPipeline({
        board: selection.board,
        className: selection.className,
        subject: selection.subject,
        subjectCode: selection.subjectCode,
        chapter: selection.chapter,
        chapterKey: selection.chapterKey,
        sectionNumber,
        sourceSectionId: target.sourceSectionId,
        ...PIPELINE_DEFAULTS,
        targetLayerNumber: 7,
      });
      setStartedJobIds((current) => ({ ...current, [sectionNumber]: result.jobId }));
    } catch (error) {
      setStartErrors((current) => ({ ...current, [sectionNumber]: error.message || "Failed to start the pipeline." }));
    } finally {
      setStartBusyKey("");
    }
  };

  return (
    <section className="admin-source-builder-page">
      <header className="admin-bulk-pipeline-header">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Source Builder</h1>
          <p>
            Upload a chapter PDF, split it into pages, assign the relevant pages to each section, crop
            them down if needed, add notes, then start the pipeline -- an alternative to pasting text
            directly on the <Link to="/admin/ai-assessment-studio">Assessment Studio</Link> page.
          </p>
        </div>
      </header>

      {catalogError && <p className="error-text">{catalogError}</p>}

      <div className="admin-studio-form-grid">
        <label className="admin-studio-field">
          <span>Board</span>
          <select value={selection.board} onChange={(event) => setSelection((c) => ({ ...c, board: event.target.value }))}>
            {catalog.boards.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-studio-field">
          <span>Class</span>
          <select
            value={selection.className}
            onChange={(event) => setSelection((c) => ({ ...c, className: event.target.value }))}
            disabled={bootstrapLoading}
          >
            {catalog.levels.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-studio-field">
          <span>Subject</span>
          <select
            value={selection.subjectCode}
            onChange={(event) => {
              const selectedSubject = catalog.subjects.find((item) => item.code === event.target.value);
              setSelection((c) => ({
                ...c,
                subjectCode: event.target.value,
                subject: selectedSubject?.name || "",
                chapterKey: "",
              }));
            }}
            disabled={bootstrapLoading || catalog.subjects.length === 0}
          >
            {catalog.subjects.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-studio-field admin-studio-field-wide">
          <span>Chapter</span>
          <select
            value={selection.chapterKey}
            onChange={(event) => setSelection((c) => ({ ...c, chapterKey: event.target.value }))}
            disabled={chaptersLoading || catalog.chapters.length === 0}
          >
            {catalog.chapters.map((item) => (
              <option key={item.key} value={item.key}>
                {`Chapter ${item.chapterNumber || "?"} - ${item.chapterName} (${item.bookName})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selection.chapterKey && (
        <>
          <div className="admin-source-builder-upload">
            <label className="admin-studio-file-upload">
              <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} disabled={pdfSplitting} />
              <strong>{pdfSplitting ? "Splitting PDF into pages..." : pdfFileName ? "Replace chapter PDF" : "Upload chapter PDF"}</strong>
              <small>{pdfFileName || "Splits client-side into page images -- nothing uploaded until you assign pages below."}</small>
            </label>
            {pdfError && <p className="error-text">{pdfError}</p>}
          </div>

          {pdfPages.length > 0 && (
            <div className="admin-source-builder-layout">
              <div className="admin-source-builder-pages-panel">
                <h2>Pages ({pdfPages.length})</h2>
                <p className="admin-workbench-muted">
                  Drag a page into a section below, or use "Add to..." on a section card.
                </p>
                <div className="admin-source-builder-page-grid">
                  {pdfPages.map((page) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      className="admin-source-builder-page-thumb"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(page.pageNumber))}
                    >
                      <span className="admin-source-builder-page-thumb-number">{page.pageNumber}</span>
                      <span
                        className="admin-source-builder-page-thumb-expand"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setLightboxPage(page);
                        }}
                      >
                        <ExpandIcon />
                      </span>
                      <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-source-builder-sections-panel">
                {sections.map((section) => {
                  const draft = sectionDrafts[section.sectionNumber] || emptySectionDraft();
                  const ready = isSectionReady(section.sectionNumber);
                  return (
                    <div
                      key={section.sectionNumber}
                      className={`admin-source-builder-section-card ${dropTargetSection === section.sectionNumber ? "is-drop-target" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTargetSection(section.sectionNumber);
                      }}
                      onDragLeave={() => setDropTargetSection(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDropTargetSection(null);
                        const pageNumber = Number(event.dataTransfer.getData("text/plain"));
                        const page = pdfPages.find((item) => item.pageNumber === pageNumber);
                        if (page) assignPageToSection(page, section.sectionNumber);
                      }}
                    >
                      <div className="admin-source-builder-section-head">
                        <h3>
                          {section.sectionNumber} - {section.topicName}
                        </h3>
                        <select
                          value=""
                          onChange={(event) => {
                            const page = pdfPages.find((item) => item.pageNumber === Number(event.target.value));
                            if (page) assignPageToSection(page, section.sectionNumber);
                          }}
                        >
                          <option value="">+ Add page...</option>
                          {pdfPages.map((page) => (
                            <option key={page.pageNumber} value={page.pageNumber}>
                              Page {page.pageNumber}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="admin-source-builder-section-images">
                        {draft.images.map((image) => (
                          <div key={image.id} className="admin-source-builder-assigned-thumb">
                            <img src={image.media_data || image.mediaData} alt={`Page ${image.source_page_number}`} />
                            <button
                              type="button"
                              className="admin-source-builder-assigned-thumb-remove"
                              aria-label="Remove"
                              onClick={() => removeImageFromSection(section.sectionNumber, image.id)}
                            >
                              &times;
                            </button>
                            <button
                              type="button"
                              className="ghost-button is-compact"
                              onClick={() =>
                                setCroppingTarget({
                                  sectionNumber: section.sectionNumber,
                                  imageId: image.id,
                                  mediaData: image.media_data || image.mediaData,
                                  cropRegion: image.crop_region_json || image.cropRegion,
                                  sourcePageNumber: image.source_page_number ?? image.sourcePageNumber,
                                })
                              }
                            >
                              Crop
                            </button>
                          </div>
                        ))}
                      </div>

                      <label className="admin-source-builder-section-notes">
                        <span>Admin notes / instructions (optional)</span>
                        <textarea
                          defaultValue={draft.adminNotes}
                          placeholder="e.g. Focus on numerical problem-solving, skip the historical background."
                          onBlur={(event) => handleNotesBlur(section.sectionNumber, event.target.value)}
                        />
                      </label>

                      <div className="admin-source-builder-section-head">
                        <span className={`admin-source-builder-section-readiness ${ready ? "is-ready" : "is-not-ready"}`}>
                          {ready ? `Ready (${draft.images.length} page${draft.images.length === 1 ? "" : "s"})` : "Add at least one page to enable Start"}
                        </span>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!ready || startBusyKey === section.sectionNumber}
                          onClick={() => handleStartPipeline(section.sectionNumber)}
                        >
                          {startBusyKey === section.sectionNumber ? "Starting..." : "Start Pipeline"}
                        </button>
                      </div>
                      {startErrors[section.sectionNumber] && (
                        <p className="error-text">{startErrors[section.sectionNumber]}</p>
                      )}
                      {startedJobIds[section.sectionNumber] && (
                        <p className="admin-bulk-pipeline-concurrency">
                          Started -- <Link to={`/admin/ai-assessment-studio/runs`}>view in Pipeline Runs</Link>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {lightboxPage && (
        <AdminPdfPageLightbox
          pageNumber={lightboxPage.pageNumber}
          dataUrl={lightboxPage.dataUrl}
          onClose={() => setLightboxPage(null)}
        />
      )}

      {croppingTarget && (
        <div className="modal-backdrop" onClick={() => !cropSaving && setCroppingTarget(null)}>
          <div className="modal-panel is-wide" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setCroppingTarget(null)}
              disabled={cropSaving}
            >
              &times;
            </button>
            <h2>Crop Page {croppingTarget.sourcePageNumber}</h2>
            <AdminImageCropEditor
              imageDataUrl={croppingTarget.mediaData}
              initialCropRegion={croppingTarget.cropRegion}
              onSave={handleCropSave}
              onCancel={() => setCroppingTarget(null)}
              saving={cropSaving}
            />
          </div>
        </div>
      )}
    </section>
  );
};
