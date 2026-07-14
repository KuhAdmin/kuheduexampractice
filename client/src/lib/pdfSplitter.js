import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const PAGE_RENDER_SCALE = 1.8; // legible thumbnail/crop-source resolution without being huge

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read the selected PDF."));
    reader.readAsArrayBuffer(file);
  });

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read the selected PDF."));
    reader.readAsDataURL(file);
  });

// Renders every page of an admin-uploaded chapter PDF to a PNG data URL,
// entirely client-side (pdfjs-dist) -- the server never touches raw PDF
// bytes for splitting, only for the one-time durable-storage upload used
// for later redisplay. Returns the original PDF as a data URL too, for that
// upload.
export const splitPdfIntoPages = async (file) => {
  const [arrayBuffer, pdfDataUrl] = await Promise.all([
    readFileAsArrayBuffer(file),
    readFileAsDataUrl(file),
  ]);

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PAGE_RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({ pageNumber, dataUrl: canvas.toDataURL("image/png") });
  }

  return {
    pageCount: pdf.numPages,
    pages,
    pdfDataUrl,
    fileName: file.name,
  };
};
