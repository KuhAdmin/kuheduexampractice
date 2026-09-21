// Only Node/Express-side PDF need in this codebase -- pdfkit is pure-JS with
// no headless-browser/native-binary dependency, which fits these two simple
// structured documents (a question list, a lesson plan) without dragging in
// a bundled Chromium the way puppeteer would.
import PDFDocument from "pdfkit";
import { BLOOM_LEVELS } from "../constants/bloomLevels.js";

const BLOOM_STAGE_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyse: "Analyse",
  evaluate: "Evaluate",
  create: "Create",
};

const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

// pdfkit has no "line-height multiplier" option -- only a fixed-point
// lineGap per .text() call -- so this wraps .text() to inject a lineGap
// computed from whatever font size is active at call time, giving a
// consistent ~1.5x line-height across the document regardless of how many
// different font sizes it uses. Every .text() call in this file uses the
// (string) or (string, options) signature, never positional x/y args.
const LINE_HEIGHT_MULTIPLIER = 1.5;
const withLineHeight = (doc) => {
  const originalText = doc.text.bind(doc);
  doc.text = (text, options) => originalText(text, { ...options, lineGap: options?.lineGap ?? doc._fontSize * (LINE_HEIGHT_MULTIPLIER - 1) });
  return doc;
};

const optionLabel = (option, index) => {
  const letter = String.fromCharCode(97 + index);
  const text = typeof option === "string" ? option : option?.text || "";
  return `${letter}) ${text}`;
};

export const renderTestPaperPdf = async ({ title, institutionName, className, subjectName, totalMarks, items }) => {
  const doc = withLineHeight(new PDFDocument({ margin: 50, size: "A4" }));
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(18).font("Helvetica-Bold").text(title, { align: "center" });
  doc.moveDown(0.2);
  if (institutionName) {
    doc.fontSize(11).font("Helvetica").text(institutionName, { align: "center" });
  }
  doc
    .fontSize(10)
    .text(`Class: ${className || "-"}    Subject: ${subjectName || "-"}    Total Marks: ${totalMarks}`, {
      align: "center",
    });
  doc.moveDown(0.5);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown();

  items.forEach((item, index) => {
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`Q${index + 1}. `, { continued: true })
      .font("Helvetica")
      .text(`${item.question || ""}  [${item.marks} mark${item.marks === 1 ? "" : "s"}]`);

    (item.options || []).forEach((option, optionIndex) => {
      doc.fontSize(10).text(`     ${optionLabel(option, optionIndex)}`);
    });
    doc.moveDown(0.6);
  });

  doc.end();
  return bufferPromise;
};

export const renderLessonPlanPdf = async ({ title, institutionName, className, subjectName, entries }) => {
  const doc = withLineHeight(new PDFDocument({ margin: 50, size: "A4" }));
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(18).font("Helvetica-Bold").text(title, { align: "center" });
  doc.moveDown(0.2);
  if (institutionName) {
    doc.fontSize(11).font("Helvetica").text(institutionName, { align: "center" });
  }
  doc.fontSize(10).text(`Class: ${className || "-"}    Subject: ${subjectName || "-"}`, { align: "center" });
  doc.moveDown();

  entries.forEach((entry, index) => {
    if (index > 0) {
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.5);
    }
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(`Day ${index + 1}${entry.entryDate ? ` -- ${entry.entryDate}` : ""}: ${entry.topic}`);
    doc.moveDown(0.3);

    const field = (label, value) => {
      if (!value) return;
      doc.fontSize(10).font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
      doc.moveDown(0.2);
    };
    field("Chapter", entry.chapterLabel);
    field("Pre Concept", entry.preConcept);
    field("Subtopic", entry.subtopic);
    field("Teaching Approach", entry.teachingApproach);
    if (entry.teachingMethod && typeof entry.teachingMethod === "object") {
      const stagesWithContent = BLOOM_LEVELS.filter((stage) => entry.teachingMethod[stage]);
      if (stagesWithContent.length) {
        doc.fontSize(10).font("Helvetica-Bold").text("Teaching Method (by Bloom's Level):");
        stagesWithContent.forEach((stage) => {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(`${BLOOM_STAGE_LABELS[stage]}: `, { continued: true })
            .font("Helvetica")
            .text(entry.teachingMethod[stage]);
        });
        doc.moveDown(0.2);
      }
    }
    field("Learning Aid", entry.learningAid);
    field("Learning Outcome", entry.learningOutcome);
    field("Activities", entry.activities);
    const teachingNotesIntro = `${entry.preConcept ? `Building on what students already know -- ${entry.preConcept}. ` : ""}${
      entry.teachingApproach || ""
    }`.trim();
    if (teachingNotesIntro || entry.learningOutcome) {
      doc.fontSize(10).font("Helvetica-Bold").text("Teaching Notes:");
      if (teachingNotesIntro) {
        doc.fontSize(10).font("Helvetica").text(teachingNotesIntro);
      }
      if (entry.learningOutcome) {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("By the end of this lesson, students will: ", { continued: true })
          .font("Helvetica")
          .text(entry.learningOutcome);
      }
      doc.moveDown(0.2);
    }
    doc.moveDown(0.5);
  });

  doc.end();
  return bufferPromise;
};

const TEACHING_AID_LABELS = {
  boardChalk: "Board / Chalk / Textbook",
  concreteObjects: "Concrete / Real Objects",
  visualAids: "Visual Aids",
  laboratoryAids: "Laboratory Aids",
  digitalAiAids: "Digital / AI Aids",
};

export const renderMasterLessonPlanPdf = async ({ institutionName, className, subjectName, plan }) => {
  const doc = withLineHeight(new PDFDocument({ margin: 50, size: "A4" }));
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(18).font("Helvetica-Bold").text("MASTER LESSON PLAN", { align: "center" });
  doc.moveDown(0.2);
  if (institutionName) {
    doc.fontSize(11).font("Helvetica").text(institutionName, { align: "center" });
  }
  doc.fontSize(10).text(`Class: ${className || "-"}    Subject: ${subjectName || "-"}`, { align: "center" });
  doc.moveDown();

  const heading = (text) => {
    doc.fontSize(12).font("Helvetica-Bold").text(text);
    doc.moveDown(0.2);
  };
  const paragraph = (text) => {
    if (!text) return;
    doc.fontSize(10).font("Helvetica").text(text);
    doc.moveDown(0.3);
  };
  const numberedList = (items) => {
    if (!items?.length) return;
    items.forEach((item, index) => {
      doc.fontSize(10).font("Helvetica").text(`${index + 1}. ${item}`);
    });
    doc.moveDown(0.3);
  };

  doc.fontSize(11).font("Helvetica-Bold").text(`Unit/Lesson Name: `, { continued: true }).font("Helvetica").text(plan.chapterLabel);
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(`Class Transaction Time: `, { continued: true })
    .font("Helvetica")
    .text(plan.classTransactionTime ? `${plan.classTransactionTime} Classes` : "-");
  doc.moveDown(0.5);

  if (plan.previousKnowledge) {
    heading("Previous Knowledge");
    paragraph(plan.previousKnowledge);
  }

  const teachingAidLines = Object.entries(TEACHING_AID_LABELS)
    .filter(([key]) => plan.teachingAids?.[key])
    .map(([key, label]) => `${label}: ${plan.teachingAids[key]}`);
  if (teachingAidLines.length) {
    heading("Teaching Aids");
    teachingAidLines.forEach((line) => paragraph(line));
  }

  const objectiveStages = BLOOM_LEVELS.filter((stage) => plan.objectives?.[stage]);
  if (objectiveStages.length) {
    heading("Objectives");
    objectiveStages.forEach((stage) => {
      doc.fontSize(10).font("Helvetica-Bold").text(`${BLOOM_STAGE_LABELS[stage]}: `, { continued: true }).font("Helvetica").text(plan.objectives[stage]);
      doc.moveDown(0.2);
    });
    doc.moveDown(0.1);
  }

  if (plan.skillsCompetencies?.length) {
    heading("Skills and Competencies");
    plan.skillsCompetencies.forEach((skill) => {
      if (!skill.title && !skill.description) return;
      doc.fontSize(10).font("Helvetica-Bold").text(`${skill.title}: `, { continued: true }).font("Helvetica").text(skill.description || "");
      doc.moveDown(0.2);
    });
    doc.moveDown(0.1);
  }

  if (plan.transactionMethodology) {
    heading("Transaction Methodology");
    paragraph(plan.transactionMethodology);
  }

  if (plan.interDisciplinaryLinkage?.length) {
    heading("Inter-Disciplinary Linkage");
    plan.interDisciplinaryLinkage.forEach((link) => {
      if (!link.subjectPair && !link.description) return;
      doc.fontSize(10).font("Helvetica-Bold").text(`${link.subjectPair}: `, { continued: true }).font("Helvetica").text(link.description || "");
      doc.moveDown(0.2);
    });
    doc.moveDown(0.1);
  }

  if (plan.assessmentQuestions?.length) {
    heading("Assessment Questions");
    numberedList(plan.assessmentQuestions);
  }

  if (plan.extraQuestions?.length) {
    heading("Extra Questions (Other Than Textual)");
    numberedList(plan.extraQuestions);
  }

  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(
      `Subject Teacher (Name & Sign.): ${plan.subjectTeacherName || "____________"}     H.O.D.: ${plan.hodName || "____________"}     Principal: ${
        plan.principalName || "____________"
      }`
    );

  doc.end();
  return bufferPromise;
};
