// xlsx is already a dependency (used to READ admin bulk-upload files, see
// adminBookController.js) -- this is the first caller of its write side.
import XLSX from "xlsx";

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
