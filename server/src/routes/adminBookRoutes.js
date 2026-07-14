import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteBookHandler,
  getBookOptions,
  getBooks,
  postBook,
  postBookBulkUpload,
  putBook,
} from "../controllers/adminBookController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getBooks);
router.get("/options", getBookOptions);
router.post("/", postBook);
router.post("/bulk-upload", postBookBulkUpload);
router.put("/:bookId", putBook);
router.delete("/:bookId", deleteBookHandler);

export default router;
