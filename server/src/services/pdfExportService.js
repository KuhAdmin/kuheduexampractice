// Only Node/Express-side PDF need in this codebase -- pdfkit is pure-JS with
// no headless-browser/native-binary dependency, which fits these two simple
// structured documents (a question list, a lesson plan) without dragging in
// a bundled Chromium the way puppeteer would.
import PDFDocument from "pdfkit";

const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

const optionLabel = (option, index) => {
  const letter = String.fromCharCode(97 + index);
  const text = typeof option === "string" ? option : option?.text || "";
  return `${letter}) ${text}`;
};

export const renderTestPaperPdf = async ({ title, institutionName, className, subjectName, totalMarks, items }) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
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
  const doc = new PDFDocument({ margin: 50, size: "A4" });
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
    field("Learning Objectives", entry.learningObjectives);
    field("Activities", entry.activities);
    field("Resources", entry.resources);
    field("Homework", entry.homework);
    field("Assessment Notes", entry.assessmentNotes);
    doc.moveDown(0.5);
  });

  doc.end();
  return bufferPromise;
};
