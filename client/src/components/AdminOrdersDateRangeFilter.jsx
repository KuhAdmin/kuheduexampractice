import { useEffect, useState } from "react";
import { DATE_RANGE_PRESETS, customRange } from "../lib/dateRangePresets";

// Emits {dateFrom, dateTo} (ISO instants, IST calendar semantics -- see
// dateRangePresets.js) via onChange whenever the selected preset or custom
// range changes. Fires once on mount with defaultPresetKey's range so the
// parent always has a range to filter by, not an "unset" state.
export const AdminOrdersDateRangeFilter = ({ onChange, defaultPresetKey = "thisMonth" }) => {
  const [activePreset, setActivePreset] = useState(defaultPresetKey);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const preset = DATE_RANGE_PRESETS.find((item) => item.key === defaultPresetKey);
    if (preset?.getRange) {
      onChange(preset.getRange());
    }
    // Only ever run once on mount -- preset clicks below drive further changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetClick = (preset) => {
    setActivePreset(preset.key);
    if (preset.getRange) {
      onChange(preset.getRange());
    } else if (customFrom || customTo) {
      onChange(customRange(customFrom, customTo));
    }
  };

  const handleCustomChange = (nextFrom, nextTo) => {
    setCustomFrom(nextFrom);
    setCustomTo(nextTo);
    if (nextFrom && nextTo) {
      onChange(customRange(nextFrom, nextTo));
    }
  };

  return (
    <div className="admin-orders-date-range">
      {DATE_RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className={`admin-orders-date-preset-button${activePreset === preset.key ? " is-active" : ""}`}
          onClick={() => handlePresetClick(preset)}
        >
          {preset.label}
        </button>
      ))}

      {activePreset === "custom" ? (
        <div className="admin-orders-date-custom-inputs">
          <input
            type="date"
            value={customFrom}
            onChange={(event) => handleCustomChange(event.target.value, customTo)}
            aria-label="Custom range start date"
          />
          <span>to</span>
          <input
            type="date"
            value={customTo}
            onChange={(event) => handleCustomChange(customFrom, event.target.value)}
            aria-label="Custom range end date"
          />
        </div>
      ) : null}
    </div>
  );
};
