import { extractTextFromHandwrittenImage } from "../services/ocrService.js";

export const postHandwrittenNoteOcr = async (req, res, next) => {
  try {
    const result = await extractTextFromHandwrittenImage({
      imageDataUrl: req.body?.imageDataUrl,
    });
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  }
};
