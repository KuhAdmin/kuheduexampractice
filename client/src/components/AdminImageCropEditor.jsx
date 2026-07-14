import { useRef, useState } from "react";

// A minimal, dependency-free rectangle-crop tool: drag on the image to draw
// a selection, drag inside it to move, drag a corner handle to resize.
// Pointer Events (not separate mouse/touch handlers) so it works with mouse,
// touch, and pen with one code path. Coordinates are tracked in on-screen
// (rendered) pixels and converted to the image's natural pixel space only
// when actually cropping, so this works regardless of how large the
// preview is displayed.
export const AdminImageCropEditor = ({ imageDataUrl, initialCropRegion, onSave, onCancel, saving }) => {
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef(null);

  const [rect, setRect] = useState(null); // { x, y, width, height } in rendered (display) pixels
  const [naturalSize, setNaturalSize] = useState(null);

  const handleImageLoad = (event) => {
    const image = event.target;
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    if (initialCropRegion && image.naturalWidth) {
      const scale = image.clientWidth / image.naturalWidth;
      setRect({
        x: initialCropRegion.x * scale,
        y: initialCropRegion.y * scale,
        width: initialCropRegion.width * scale,
        height: initialCropRegion.height * scale,
      });
    }
  };

  const getRelativePoint = (event) => {
    const bounds = containerRef.current.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width),
      y: Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height),
    };
  };

  const startNewRect = (event) => {
    const point = getRelativePoint(event);
    dragStateRef.current = { mode: "draw", startX: point.x, startY: point.y };
    setRect({ x: point.x, y: point.y, width: 0, height: 0 });
    event.target.setPointerCapture(event.pointerId);
  };

  const startMove = (event) => {
    event.stopPropagation();
    const point = getRelativePoint(event);
    dragStateRef.current = { mode: "move", startX: point.x, startY: point.y, originRect: rect };
    event.target.setPointerCapture(event.pointerId);
  };

  const startResize = (corner) => (event) => {
    event.stopPropagation();
    dragStateRef.current = { mode: "resize", corner, originRect: rect };
    event.target.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const point = getRelativePoint(event);
    const bounds = containerRef.current.getBoundingClientRect();

    if (drag.mode === "draw") {
      setRect({
        x: Math.min(drag.startX, point.x),
        y: Math.min(drag.startY, point.y),
        width: Math.abs(point.x - drag.startX),
        height: Math.abs(point.y - drag.startY),
      });
      return;
    }

    if (drag.mode === "move") {
      const deltaX = point.x - drag.startX;
      const deltaY = point.y - drag.startY;
      const maxX = bounds.width - drag.originRect.width;
      const maxY = bounds.height - drag.originRect.height;
      setRect({
        ...drag.originRect,
        x: Math.min(Math.max(drag.originRect.x + deltaX, 0), Math.max(maxX, 0)),
        y: Math.min(Math.max(drag.originRect.y + deltaY, 0), Math.max(maxY, 0)),
      });
      return;
    }

    if (drag.mode === "resize") {
      const { originRect, corner } = drag;
      const right = originRect.x + originRect.width;
      const bottom = originRect.y + originRect.height;
      let next = { ...originRect };

      if (corner.includes("left")) {
        next.x = Math.min(point.x, right - 10);
        next.width = right - next.x;
      }
      if (corner.includes("right")) {
        next.width = Math.max(point.x - originRect.x, 10);
      }
      if (corner.includes("top")) {
        next.y = Math.min(point.y, bottom - 10);
        next.height = bottom - next.y;
      }
      if (corner.includes("bottom")) {
        next.height = Math.max(point.y - originRect.y, 10);
      }
      setRect(next);
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleSaveCrop = () => {
    if (!rect || !naturalSize || rect.width < 4 || rect.height < 4) return;

    const scale = naturalSize.width / imageRef.current.clientWidth;
    const cropRegion = {
      x: Math.round(rect.x * scale),
      y: Math.round(rect.y * scale),
      width: Math.round(rect.width * scale),
      height: Math.round(rect.height * scale),
    };

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
      <div
        className="admin-crop-editor-canvas"
        ref={containerRef}
        onPointerDown={rect ? undefined : startNewRect}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imageRef}
          src={imageDataUrl}
          alt="Page to crop"
          onLoad={handleImageLoad}
          draggable={false}
        />
        {rect && (
          <div
            className="admin-crop-editor-rect"
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onPointerDown={startMove}
          >
            {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
              <span
                key={corner}
                className={`admin-crop-editor-handle is-${corner}`}
                onPointerDown={startResize(corner)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="admin-crop-editor-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        {rect && (
          <button type="button" className="ghost-button" onClick={() => setRect(null)} disabled={saving}>
            Clear Selection
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
          disabled={saving || !rect || rect.width < 4 || rect.height < 4}
        >
          {saving ? "Saving..." : "Save Crop"}
        </button>
      </div>
    </div>
  );
};
