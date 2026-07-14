import { useRef, useState } from "react";

const ZoomInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M15.6 15.6 21 21M10.5 7.5v6M7.5 10.5h6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ZoomOutIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M15.6 15.6 21 21M7.5 10.5h6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ZOOM_MIN = 100;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

// Two-pin crop tool: drop a red pin on one corner of the region and a blue
// pin on the opposite corner; the rectangle is the bounding box between
// them. Faster and less fiddly on a touchscreen than drag-to-draw-a-
// rectangle (no resize handles to hit precisely), and the pins stay
// draggable afterwards for fine adjustment. Pins are tracked in the
// image's own natural pixel space (not on-screen/rendered pixels), so
// zooming in/out never needs to remap them -- only their on-screen
// position (computed from the current render scale) changes.
export const AdminImageCropEditor = ({ imageDataUrl, initialCropRegion, onSave, onCancel, saving }) => {
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const dragPinRef = useRef(null);

  const [naturalSize, setNaturalSize] = useState(null);
  const [baseWidthPx, setBaseWidthPx] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [pins, setPins] = useState(() =>
    initialCropRegion
      ? {
          red: { x: initialCropRegion.x, y: initialCropRegion.y },
          blue: {
            x: initialCropRegion.x + initialCropRegion.width,
            y: initialCropRegion.y + initialCropRegion.height,
          },
        }
      : { red: null, blue: null }
  );

  const renderedWidth = baseWidthPx ? (baseWidthPx * zoomPercent) / 100 : 0;
  const scale = naturalSize && renderedWidth ? renderedWidth / naturalSize.width : 0;

  const handleImageLoad = (event) => {
    const image = event.target;
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    setBaseWidthPx(image.clientWidth);
  };

  const toScreen = (point) => (point && scale ? { x: point.x * scale, y: point.y * scale } : null);

  const getRelativeNaturalPoint = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    const screenX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const screenY = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height);
    const pointScale = naturalSize ? bounds.width / naturalSize.width : 0;
    if (!pointScale) return { x: 0, y: 0 };
    return { x: Math.round(screenX / pointScale), y: Math.round(screenY / pointScale) };
  };

  const handleCanvasPointerDown = (event) => {
    if (pins.red && pins.blue) return;
    const point = getRelativeNaturalPoint(event);
    setPins((current) => {
      if (!current.red) return { ...current, red: point };
      if (!current.blue) return { ...current, blue: point };
      return current;
    });
  };

  const startDragPin = (key) => (event) => {
    event.stopPropagation();
    dragPinRef.current = key;
    event.target.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event) => {
    if (!dragPinRef.current) return;
    const point = getRelativeNaturalPoint(event);
    setPins((current) => ({ ...current, [dragPinRef.current]: point }));
  };

  const handleCanvasPointerUp = () => {
    dragPinRef.current = null;
  };

  const resetPins = () => setPins({ red: null, blue: null });

  const cropRegion =
    pins.red && pins.blue
      ? {
          x: Math.round(Math.min(pins.red.x, pins.blue.x)),
          y: Math.round(Math.min(pins.red.y, pins.blue.y)),
          width: Math.round(Math.abs(pins.red.x - pins.blue.x)),
          height: Math.round(Math.abs(pins.red.y - pins.blue.y)),
        }
      : null;

  const redPinScreen = toScreen(pins.red);
  const bluePinScreen = toScreen(pins.blue);

  const overlayRect = (() => {
    if (!cropRegion) return null;
    const origin = toScreen({ x: cropRegion.x, y: cropRegion.y });
    const size = toScreen({ x: cropRegion.width, y: cropRegion.height });
    if (!origin || !size) return null;
    return { left: origin.x, top: origin.y, width: size.x, height: size.y };
  })();

  const handleSaveCrop = () => {
    if (!cropRegion || cropRegion.width < 4 || cropRegion.height < 4) return;

    const canvas = document.createElement("canvas");
    canvas.width = cropRegion.width;
    canvas.height = cropRegion.height;
    const context = canvas.getContext("2d");
    context.drawImage(
      imageRef.current,
      cropRegion.x,
      cropRegion.y,
      cropRegion.width,
      cropRegion.height,
      0,
      0,
      cropRegion.width,
      cropRegion.height
    );

    onSave(canvas.toDataURL("image/jpeg", 0.9), cropRegion);
  };

  return (
    <div className="admin-crop-editor">
      <div className="admin-crop-editor-toolbar">
        <p className="admin-crop-editor-hint">
          {!pins.red
            ? "Click the image to drop the red pin on one corner of the question."
            : !pins.blue
              ? "Now click to drop the blue pin on the opposite corner."
              : "Drag either pin to fine-tune, or reset and start over."}
        </p>
        <div className="admin-crop-editor-zoom-controls">
          <button
            type="button"
            className="admin-crop-editor-zoom-button"
            aria-label="Zoom out"
            disabled={zoomPercent <= ZOOM_MIN}
            onClick={() => setZoomPercent((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          >
            <ZoomOutIcon />
          </button>
          <span className="admin-crop-editor-zoom-level">{zoomPercent}%</span>
          <button
            type="button"
            className="admin-crop-editor-zoom-button"
            aria-label="Zoom in"
            disabled={zoomPercent >= ZOOM_MAX}
            onClick={() => setZoomPercent((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          >
            <ZoomInIcon />
          </button>
        </div>
      </div>

      <div className="admin-crop-editor-viewport">
        <div
          className="admin-crop-editor-canvas"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          <img
            ref={imageRef}
            src={imageDataUrl}
            alt="Page to crop"
            onLoad={handleImageLoad}
            draggable={false}
            style={baseWidthPx ? { width: `${renderedWidth}px`, maxWidth: "none" } : undefined}
          />
          {overlayRect && <div className="admin-crop-editor-rect" style={overlayRect} />}
          {redPinScreen && (
            <span
              className="admin-crop-editor-pin is-red"
              style={{ left: redPinScreen.x, top: redPinScreen.y }}
              onPointerDown={startDragPin("red")}
            />
          )}
          {bluePinScreen && (
            <span
              className="admin-crop-editor-pin is-blue"
              style={{ left: bluePinScreen.x, top: bluePinScreen.y }}
              onPointerDown={startDragPin("blue")}
            />
          )}
        </div>
      </div>

      <div className="admin-crop-editor-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        {(pins.red || pins.blue) && (
          <button type="button" className="ghost-button" onClick={resetPins} disabled={saving}>
            Reset Pins
          </button>
        )}
        <button
          type="button"
          className="ghost-button"
          onClick={() => onSave(imageDataUrl, null)}
          disabled={saving}
        >
          Use Full Page
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleSaveCrop}
          disabled={saving || !cropRegion || cropRegion.width < 4 || cropRegion.height < 4}
        >
          {saving ? "Saving..." : "Save Crop"}
        </button>
      </div>
    </div>
  );
};
