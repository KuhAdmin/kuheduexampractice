INSERT INTO app_settings (setting_key, setting_value)
VALUES (
  'ai_model_selection',
  '{"activeModelId": "azure-gpt-5-4-mini", "layerOverrides": {}}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
