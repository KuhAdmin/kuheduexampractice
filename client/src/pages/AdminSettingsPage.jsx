import { useEffect, useMemo, useState } from "react";
import {
  getAiModelSettings,
  updateActiveAiModel,
  updateLayerAiModelOverride,
} from "../api/client";

const initialSettings = {
  defaultBoard: "CBSE",
  defaultClassRange: "11-12",
  premiumPrice: "500",
  autoSaveDrafts: true,
  requireReviewBeforePublish: true,
  allowAiSuggestions: true,
  googleSignIn: true,
  emailSignIn: true,
  weeklySummary: true,
  reviewAlerts: true,
  weakTopicAlerts: true,
  defaultOwner: "Content Lead",
  revisionWindow: "72 hours",
};

const activityFeed = [
  "Publishing review is enabled for all new practice sets.",
  "Google sign-in is active for learners and admins.",
  "Weekly analytics summary is sent every Monday morning.",
  "AI-assisted recommendations are currently enabled in Assessment Studio.",
];

export const AdminSettingsPage = () => {
  const [settings, setSettings] = useState(initialSettings);
  const [savedMessage, setSavedMessage] = useState("Settings synced just now");

  const [aiModelState, setAiModelState] = useState({
    availableModels: [],
    activeModelId: "",
    layerOverrides: {},
    layers: [],
    loading: true,
    error: "",
    updating: false,
    updatingLayer: null,
  });

  useEffect(() => {
    let isMounted = true;

    getAiModelSettings()
      .then((data) => {
        if (!isMounted) return;
        setAiModelState((current) => ({
          ...current,
          availableModels: data?.availableModels || [],
          activeModelId: data?.activeModelId || "",
          layerOverrides: data?.layerOverrides || {},
          layers: data?.layers || [],
          loading: false,
        }));
      })
      .catch((error) => {
        if (!isMounted) return;
        setAiModelState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Failed to load AI model settings.",
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAiModelChange = async (event) => {
    const modelId = event.target.value;
    const previousModelId = aiModelState.activeModelId;

    setAiModelState((current) => ({ ...current, activeModelId: modelId, updating: true, error: "" }));

    try {
      const updated = await updateActiveAiModel(modelId);
      setAiModelState((current) => ({
        ...current,
        activeModelId: updated?.activeModelId || modelId,
        updating: false,
      }));
    } catch (error) {
      setAiModelState((current) => ({
        ...current,
        activeModelId: previousModelId,
        updating: false,
        error: error.message || "Failed to update the active AI model.",
      }));
    }
  };

  const handleLayerOverrideChange = async (layerNumber, event) => {
    const modelId = event.target.value || null;
    const previousOverrides = aiModelState.layerOverrides;

    setAiModelState((current) => ({
      ...current,
      layerOverrides: { ...current.layerOverrides, [layerNumber]: modelId || undefined },
      updatingLayer: layerNumber,
      error: "",
    }));

    try {
      const updated = await updateLayerAiModelOverride(layerNumber, modelId);
      setAiModelState((current) => ({
        ...current,
        layerOverrides: updated?.layerOverrides || current.layerOverrides,
        updatingLayer: null,
      }));
    } catch (error) {
      setAiModelState((current) => ({
        ...current,
        layerOverrides: previousOverrides,
        updatingLayer: null,
        error: error.message || "Failed to update the layer model override.",
      }));
    }
  };

  const activeModel = aiModelState.availableModels.find(
    (model) => model.id === aiModelState.activeModelId,
  );

  const summary = useMemo(
    () => ({
      togglesOn: Object.values(settings).filter((value) => value === true).length,
      premiumPlan: `Rs. ${settings.premiumPrice}/month`,
      reviewMode: settings.requireReviewBeforePublish ? "Required" : "Optional",
      revisionWindow: settings.revisionWindow,
    }),
    [settings],
  );

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedMessage("Settings updated just now");
  };

  return (
    <section className="admin-settings-page">
      <div className="admin-settings-hero">
        <div>
          <span className="eyebrow">Admin module</span>
          <h1>Settings</h1>
          <p>
            Control workspace defaults, publishing behavior, access methods, and
            notification rules from one place.
          </p>
        </div>
        <div className="admin-settings-hero-card">
          <p>Workspace status</p>
          <strong>{savedMessage}</strong>
        </div>
      </div>

      <section className="admin-settings-summary-grid">
        <article className="admin-settings-summary-card">
          <strong>{summary.togglesOn}</strong>
          <span>Automation toggles enabled</span>
        </article>
        <article className="admin-settings-summary-card">
          <strong>{summary.premiumPlan}</strong>
          <span>Current premium plan</span>
        </article>
        <article className="admin-settings-summary-card">
          <strong>{summary.reviewMode}</strong>
          <span>Publishing review mode</span>
        </article>
        <article className="admin-settings-summary-card">
          <strong>{summary.revisionWindow}</strong>
          <span>Target retry revision window</span>
        </article>
      </section>

      <section className="admin-settings-layout">
        <div className="admin-settings-main">
          <section className="admin-panel admin-settings-panel">
            <div className="admin-panel-head">
              <h2>Platform defaults</h2>
              <span>Base settings that shape new content and pricing</span>
            </div>

            <div className="admin-settings-form-grid">
              <label className="admin-settings-field">
                <span>Default board</span>
                <input
                  value={settings.defaultBoard}
                  onChange={(event) => updateSetting("defaultBoard", event.target.value)}
                />
              </label>

              <label className="admin-settings-field">
                <span>Default class range</span>
                <input
                  value={settings.defaultClassRange}
                  onChange={(event) => updateSetting("defaultClassRange", event.target.value)}
                />
              </label>

              <label className="admin-settings-field">
                <span>Premium plan price</span>
                <input
                  value={settings.premiumPrice}
                  onChange={(event) => updateSetting("premiumPrice", event.target.value)}
                />
              </label>

              <label className="admin-settings-field">
                <span>Default editorial owner</span>
                <input
                  value={settings.defaultOwner}
                  onChange={(event) => updateSetting("defaultOwner", event.target.value)}
                />
              </label>

              <label className="admin-settings-field admin-settings-field-wide">
                <span>Target revision window</span>
                <input
                  value={settings.revisionWindow}
                  onChange={(event) => updateSetting("revisionWindow", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-settings-panel">
            <div className="admin-panel-head">
              <h2>AI model provider</h2>
              <span>Choose which model powers Assessment Studio's AI pipeline</span>
            </div>

            <div className="admin-settings-form-grid">
              <label className="admin-settings-field">
                <span>Active model</span>
                <select
                  value={aiModelState.activeModelId}
                  disabled={aiModelState.loading || aiModelState.updating}
                  onChange={handleAiModelChange}
                >
                  {aiModelState.availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {aiModelState.loading && <p>Loading available models…</p>}
            {aiModelState.updating && <p>Switching active model…</p>}
            {aiModelState.error && <p className="error-text">{aiModelState.error}</p>}

            {!aiModelState.loading && aiModelState.layers.length > 0 && (
              <div className="admin-settings-layer-overrides">
                <h3>Per-layer overrides</h3>
                <p>Route individual pipeline layers to a different model than the active default.</p>
                <table className="admin-settings-layer-table">
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiModelState.layers.map((layer) => (
                      <tr key={layer.layerNumber}>
                        <td>
                          {layer.layerNumber}. {layer.layerName}
                        </td>
                        <td>
                          <select
                            value={aiModelState.layerOverrides?.[layer.layerNumber] || ""}
                            disabled={aiModelState.updatingLayer === layer.layerNumber}
                            onChange={(event) => handleLayerOverrideChange(layer.layerNumber, event)}
                          >
                            <option value="">Use active default</option>
                            {aiModelState.availableModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-panel admin-settings-panel">
            <div className="admin-panel-head">
              <h2>Publishing and workflow</h2>
              <span>Decide how creation, review, and AI support should behave</span>
            </div>

            <div className="admin-settings-toggle-list">
              <label className="admin-settings-toggle">
                <div>
                  <strong>Auto-save drafts</strong>
                  <p>Save changes continuously while admins work in Assessment Studio.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSaveDrafts}
                  onChange={(event) => updateSetting("autoSaveDrafts", event.target.checked)}
                />
              </label>

              <label className="admin-settings-toggle">
                <div>
                  <strong>Require review before publish</strong>
                  <p>Every practice set must pass through Content Review before publication.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireReviewBeforePublish}
                  onChange={(event) =>
                    updateSetting("requireReviewBeforePublish", event.target.checked)
                  }
                />
              </label>

              <label className="admin-settings-toggle">
                <div>
                  <strong>Allow AI suggestions</strong>
                  <p>Show analytics-driven recommendations and studio starter guidance.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowAiSuggestions}
                  onChange={(event) => updateSetting("allowAiSuggestions", event.target.checked)}
                />
              </label>
            </div>
          </section>

          <section className="admin-panel admin-settings-panel">
            <div className="admin-panel-head">
              <h2>Access and notifications</h2>
              <span>Control sign-in methods and who gets operational alerts</span>
            </div>

            <div className="admin-settings-split-grid">
              <div className="admin-settings-subpanel">
                <h3>Sign-in methods</h3>
                <div className="admin-settings-toggle-list compact">
                  <label className="admin-settings-toggle">
                    <div>
                      <strong>Email sign-in</strong>
                      <p>Allow direct email and password access.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.emailSignIn}
                      onChange={(event) => updateSetting("emailSignIn", event.target.checked)}
                    />
                  </label>

                  <label className="admin-settings-toggle">
                    <div>
                      <strong>Google sign-in</strong>
                      <p>Keep Google login active across learner and admin access.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.googleSignIn}
                      onChange={(event) => updateSetting("googleSignIn", event.target.checked)}
                    />
                  </label>
                </div>
              </div>

              <div className="admin-settings-subpanel">
                <h3>Alert rules</h3>
                <div className="admin-settings-toggle-list compact">
                  <label className="admin-settings-toggle">
                    <div>
                      <strong>Weekly summary</strong>
                      <p>Send recurring learning and publishing summary emails.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.weeklySummary}
                      onChange={(event) => updateSetting("weeklySummary", event.target.checked)}
                    />
                  </label>

                  <label className="admin-settings-toggle">
                    <div>
                      <strong>Review alerts</strong>
                      <p>Notify editors when new content enters the review queue.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reviewAlerts}
                      onChange={(event) => updateSetting("reviewAlerts", event.target.checked)}
                    />
                  </label>

                  <label className="admin-settings-toggle">
                    <div>
                      <strong>Weak-topic alerts</strong>
                      <p>Flag rising weak-topic signals from Learning Analytics.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.weakTopicAlerts}
                      onChange={(event) => updateSetting("weakTopicAlerts", event.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="admin-settings-side">
          <section className="admin-panel admin-settings-side-panel">
            <div className="admin-panel-head">
              <h2>Active configuration</h2>
              <span>Quick operational snapshot</span>
            </div>

            <div className="admin-settings-keyvalue-list">
              <div className="admin-settings-keyvalue-row">
                <span>AI model</span>
                <strong>{activeModel?.label || "Not configured"}</strong>
              </div>
              <div className="admin-settings-keyvalue-row">
                <span>Premium billing</span>
                <strong>Rs. {settings.premiumPrice}/month</strong>
              </div>
              <div className="admin-settings-keyvalue-row">
                <span>Review gate</span>
                <strong>
                  {settings.requireReviewBeforePublish ? "Mandatory" : "Optional"}
                </strong>
              </div>
              <div className="admin-settings-keyvalue-row">
                <span>AI recommendations</span>
                <strong>{settings.allowAiSuggestions ? "Enabled" : "Disabled"}</strong>
              </div>
              <div className="admin-settings-keyvalue-row">
                <span>Retry window</span>
                <strong>{settings.revisionWindow}</strong>
              </div>
            </div>
          </section>

          <section className="admin-panel admin-settings-side-panel">
            <div className="admin-panel-head">
              <h2>Recent settings activity</h2>
              <span>What the workspace is currently honoring</span>
            </div>

            <div className="admin-settings-activity-list">
              {activityFeed.map((item) => (
                <article key={item} className="admin-settings-activity-card">
                  {item}
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </section>
  );
};
