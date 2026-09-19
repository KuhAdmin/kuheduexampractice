import {
  addInstitutionClass,
  addInstitutionSection,
  createInstitution,
  getAssignmentGrid,
  getInstitution,
  linkTeacherToInstitution,
  listInstitutionClasses,
  listInstitutions,
  listInstitutionSections,
  listInstitutionTeachers,
  removeInstitutionClass,
  removeInstitutionSection,
  saveTeacherAssignments,
  unlinkTeacherFromInstitution,
  updateInstitution,
  updateInstitutionLicense,
  updateInstitutionSection,
} from "../services/institutionService.js";

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  return next(error);
};

export const getInstitutions = async (_req, res, next) => {
  try {
    res.json({ institutions: await listInstitutions() });
  } catch (error) {
    next(error);
  }
};

export const getInstitutionDetail = async (req, res, next) => {
  try {
    const institution = await getInstitution(req.params.institutionId);
    if (!institution) {
      return res.status(404).json({ message: "Institution not found." });
    }
    return res.json({ institution });
  } catch (error) {
    return next(error);
  }
};

export const postInstitution = async (req, res, next) => {
  try {
    const institution = await createInstitution(req.body);
    return res.status(201).json({ institution });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putInstitution = async (req, res, next) => {
  try {
    const institution = await updateInstitution(req.params.institutionId, req.body);
    if (!institution) {
      return res.status(404).json({ message: "Institution not found." });
    }
    return res.json({ institution });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putInstitutionLicense = async (req, res, next) => {
  try {
    const institution = await updateInstitutionLicense(req.params.institutionId, {
      ...req.body,
      updatedByUserId: req.user.id,
    });
    if (!institution) {
      return res.status(404).json({ message: "Institution not found." });
    }
    return res.json({ institution });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getInstitutionClasses = async (req, res, next) => {
  try {
    res.json({ classes: await listInstitutionClasses(req.params.institutionId) });
  } catch (error) {
    next(error);
  }
};

export const postInstitutionClass = async (req, res, next) => {
  try {
    const { mstLevelId } = req.body || {};
    if (!mstLevelId) {
      return res.status(400).json({ message: "mstLevelId is required." });
    }
    const institutionClass = await addInstitutionClass(req.params.institutionId, mstLevelId);
    return res.status(201).json({ institutionClass });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deleteInstitutionClassHandler = async (req, res, next) => {
  try {
    const deleted = await removeInstitutionClass(req.params.institutionClassId);
    if (!deleted) {
      return res.status(404).json({ message: "Class not found." });
    }
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getInstitutionSections = async (req, res, next) => {
  try {
    res.json({ sections: await listInstitutionSections(req.params.institutionClassId) });
  } catch (error) {
    next(error);
  }
};

export const postInstitutionSection = async (req, res, next) => {
  try {
    const section = await addInstitutionSection(req.params.institutionClassId, req.body);
    return res.status(201).json({ section });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putInstitutionSection = async (req, res, next) => {
  try {
    const section = await updateInstitutionSection(req.params.sectionId, req.body);
    if (!section) {
      return res.status(404).json({ message: "Section not found." });
    }
    return res.json({ section });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deleteInstitutionSectionHandler = async (req, res, next) => {
  try {
    const deleted = await removeInstitutionSection(req.params.sectionId);
    if (!deleted) {
      return res.status(404).json({ message: "Section not found." });
    }
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getInstitutionTeachers = async (req, res, next) => {
  try {
    res.json({ teachers: await listInstitutionTeachers(req.params.institutionId) });
  } catch (error) {
    next(error);
  }
};

export const postInstitutionTeacher = async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }
    const institutionTeacher = await linkTeacherToInstitution(req.params.institutionId, userId, req.user.id);
    return res.status(201).json({ institutionTeacher });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deleteInstitutionTeacherHandler = async (req, res, next) => {
  try {
    const deleted = await unlinkTeacherFromInstitution(req.params.institutionTeacherId);
    if (!deleted) {
      return res.status(404).json({ message: "Teacher link not found." });
    }
    return res.status(204).send();
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getInstitutionTeacherAssignments = async (req, res, next) => {
  try {
    res.json(await getAssignmentGrid(req.params.institutionTeacherId));
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const putInstitutionTeacherAssignments = async (req, res, next) => {
  try {
    const { assignments } = req.body || {};
    const grid = await saveTeacherAssignments({
      institutionTeacherId: req.params.institutionTeacherId,
      assignments,
      assignedByUserId: req.user.id,
    });
    return res.json(grid);
  } catch (error) {
    return handleError(error, res, next);
  }
};
