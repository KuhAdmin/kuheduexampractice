// xlsx is already a dependency (used to READ admin bulk-upload files, see
// adminBookController.js) -- this is the first caller of its write side.
import XLSX from "xlsx";
// xlsx (SheetJS Community Edition) cannot WRITE cell styling at all -- bold,
// borders, alignment and wrap-text are explicitly a paid "Pro"-only feature
// (see its own README). exceljs is used here instead, only for the one
// export that actually needs real formatting -- xlsx stays the tool for
// everything else above/below (plain data dumps, and reading uploads).
import ExcelJS from "exceljs";
import { BLOOM_LEVELS } from "../constants/bloomLevels.js";

const BLOOM_STAGE_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyse: "Analyse",
  evaluate: "Evaluate",
  create: "Create",
};

const optionText = (option) => (typeof option === "string" ? option : option?.text || "");

export const buildTestPaperWorkbook = ({ items }) => {
  const rows = items.map((item, index) => ({
    "Q#": index + 1,
    Question: item.question,
    Options: (item.options || []).map((option, i) => `${String.fromCharCode(97 + i)}) ${optionText(option)}`).join(" | "),
    "Correct Answer": item.correctAnswer || "",
    Marks: item.marks,
    Difficulty: item.difficulty || "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Paper");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

export const buildLessonPlanWorkbook = async ({ plan, entries }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet((plan.title || "Lesson Plan").slice(0, 31));

  sheet.columns = [
    { header: "Day", key: "day", width: 8 },
    { header: "Date", key: "date", width: 12 },
    { header: "Chapter", key: "chapter", width: 22 },
    { header: "Topic", key: "topic", width: 26 },
    { header: "Pre Concept", key: "preConcept", width: 30 },
    { header: "Subtopic", key: "subtopic", width: 26 },
    { header: "Teaching Approach", key: "teachingApproach", width: 30 },
    { header: "Remember", key: "remember", width: 30 },
    { header: "Understand", key: "understand", width: 30 },
    { header: "Apply", key: "apply", width: 30 },
    { header: "Analyse", key: "analyse", width: 30 },
    { header: "Evaluate", key: "evaluate", width: 30 },
    { header: "Create", key: "create", width: 30 },
    { header: "Learning Aid", key: "learningAid", width: 26 },
    { header: "Learning Outcome", key: "learningOutcome", width: 30 },
    { header: "Activities", key: "activities", width: 30 },
    { header: "Teaching Notes", key: "teachingNotes", width: 40 },
  ];

  entries.forEach((entry, index) => {
    const teachingNotesIntro = `${entry.preConcept ? `Building on what students already know -- ${entry.preConcept}. ` : ""}${
      entry.teachingApproach || ""
    }`.trim();
    const teachingNotes = [teachingNotesIntro, entry.learningOutcome ? `By the end of this lesson, students will: ${entry.learningOutcome}` : ""]
      .filter(Boolean)
      .join("\n\n");

    sheet.addRow({
      day: index + 1,
      date: entry.entryDate || "",
      chapter: entry.chapterLabel || "",
      topic: entry.topic || "",
      preConcept: entry.preConcept || "",
      subtopic: entry.subtopic || "",
      teachingApproach: entry.teachingApproach || "",
      remember: entry.teachingMethod?.remember || "",
      understand: entry.teachingMethod?.understand || "",
      apply: entry.teachingMethod?.apply || "",
      analyse: entry.teachingMethod?.analyse || "",
      evaluate: entry.teachingMethod?.evaluate || "",
      create: entry.teachingMethod?.create || "",
      learningAid: entry.learningAid || "",
      learningOutcome: entry.learningOutcome || "",
      activities: entry.activities || "",
      teachingNotes,
    });
  });

  sheet.getRow(1).font = { bold: true };

  // Column A (Day) holds short, single-value content -- centered both ways
  // reads better than top-left for that, unlike the free-text columns
  // (including the Bloom's-stage columns, which now hold generated
  // question/approach text) which need top+wrap instead.
  const middleAlignedColumns = new Set([1]);

  // wrapText + no explicit row.height lets Excel auto-fit each row's height
  // to its wrapped content on open -- the standard way to avoid vertical
  // text overflow without precomputing pixel-exact row heights.
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = middleAlignedColumns.has(cell.col)
        ? { vertical: "middle", horizontal: "center" }
        : { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  return workbook.xlsx.writeBuffer();
};

export const buildGradebookWorkbook = (exam) => {
  const rows = exam.students.map((student) => {
    const row = { Student: student.name, Email: student.email };
    let total = 0;
    exam.questions.forEach((question) => {
      const marksAwarded = student.marks[question.id]?.marksAwarded;
      row[`${question.questionLabel} (${question.maxMarks})`] = marksAwarded ?? "";
      total += Number(marksAwarded || 0);
    });
    row[`Total (${exam.totalMarks})`] = total;
    return row;
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, exam.title.slice(0, 31) || "Gradebook");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};
