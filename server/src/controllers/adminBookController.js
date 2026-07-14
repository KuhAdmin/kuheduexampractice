import XLSX from "xlsx";
import {
  bulkUpsertBooks,
  createBook,
  deleteBook,
  listBookFormOptions,
  listBooks,
  updateBook,
} from "../services/bookService.js";

const MAX_BULK_UPLOAD_ROWS = 2000;

export const getBooks = async (_req, res, next) => {
  try {
    const books = await listBooks();
    return res.json({ books });
  } catch (error) {
    return next(error);
  }
};

export const getBookOptions = async (_req, res, next) => {
  try {
    const options = await listBookFormOptions();
    return res.json(options);
  } catch (error) {
    return next(error);
  }
};

const parseBookBody = (body) => {
  const nameCode = String(body?.nameCode || "").trim();
  const name = String(body?.name || "").trim();
  const subjectId = Number(body?.subjectId);
  const levelId = Number(body?.levelId);
  const examGoalId = Number(body?.examGoalId);
  const displayOrder = Number.isInteger(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0;
  const isActive = body?.isActive !== false;

  if (
    !nameCode ||
    !name ||
    !Number.isInteger(subjectId) ||
    !Number.isInteger(levelId) ||
    !Number.isInteger(examGoalId)
  ) {
    return null;
  }

  return { nameCode, name, subjectId, levelId, examGoalId, displayOrder, isActive };
};

export const postBook = async (req, res, next) => {
  try {
    const payload = parseBookBody(req.body);
    if (!payload) {
      return res
        .status(400)
        .json({ message: "nameCode, name, subjectId, levelId, and examGoalId are required." });
    }

    const book = await createBook(payload);
    return res.status(201).json({ book });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const putBook = async (req, res, next) => {
  try {
    const payload = parseBookBody(req.body);
    if (!payload) {
      return res
        .status(400)
        .json({ message: "nameCode, name, subjectId, levelId, and examGoalId are required." });
    }

    const book = await updateBook(req.params.bookId, payload);
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    return res.json({ book });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const postBookBulkUpload = async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl || "");
    const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
    if (!base64) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    let rows;
    try {
      const buffer = Buffer.from(base64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } catch {
      return res
        .status(400)
        .json({ message: "Could not read the uploaded file. Please use a valid .xlsx or .csv file." });
    }

    if (rows.length === 0) {
      return res.status(400).json({ message: "The uploaded file has no data rows." });
    }
    if (rows.length > MAX_BULK_UPLOAD_ROWS) {
      return res
        .status(400)
        .json({ message: `The uploaded file has too many rows (max ${MAX_BULK_UPLOAD_ROWS} per upload).` });
    }

    const results = await bulkUpsertBooks(rows);
    const summary = {
      created: results.filter((row) => row.status === "created").length,
      updated: results.filter((row) => row.status === "updated").length,
      errors: results.filter((row) => row.status === "error"),
    };
    return res.json({ summary, results });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};

export const deleteBookHandler = async (req, res, next) => {
  try {
    const deleted = await deleteBook(req.params.bookId);
    if (!deleted) {
      return res.status(404).json({ message: "Book not found." });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
