import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  deleteInstitutionClassHandler,
  deleteInstitutionSectionHandler,
  deleteInstitutionTeacherHandler,
  getInstitutionClasses,
  getInstitutionDetail,
  getInstitutions,
  getInstitutionSections,
  getInstitutionTeacherAssignments,
  getInstitutionTeachers,
  postInstitution,
  postInstitutionClass,
  postInstitutionSection,
  postInstitutionTeacher,
  putInstitution,
  putInstitutionLicense,
  putInstitutionSection,
  putInstitutionTeacherAssignments,
} from "../controllers/adminInstitutionController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", getInstitutions);
router.post("/", postInstitution);
router.get("/:institutionId", getInstitutionDetail);
router.put("/:institutionId", putInstitution);
router.put("/:institutionId/license", putInstitutionLicense);

router.get("/:institutionId/classes", getInstitutionClasses);
router.post("/:institutionId/classes", postInstitutionClass);
router.delete("/:institutionId/classes/:institutionClassId", deleteInstitutionClassHandler);

router.get("/classes/:institutionClassId/sections", getInstitutionSections);
router.post("/classes/:institutionClassId/sections", postInstitutionSection);
router.put("/sections/:sectionId", putInstitutionSection);
router.delete("/sections/:sectionId", deleteInstitutionSectionHandler);

router.get("/:institutionId/teachers", getInstitutionTeachers);
router.post("/:institutionId/teachers", postInstitutionTeacher);
router.delete("/:institutionId/teachers/:institutionTeacherId", deleteInstitutionTeacherHandler);

router.get("/teachers/:institutionTeacherId/assignments", getInstitutionTeacherAssignments);
router.put("/teachers/:institutionTeacherId/assignments", putInstitutionTeacherAssignments);

export default router;
