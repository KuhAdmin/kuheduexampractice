import { env } from "../../config/env.js";

const AI_MODEL_REGISTRY = [
  {
    id: "azure-gpt-5-4-mini",
    label: "Azure OpenAI — GPT-5.4 Mini",
    provider: "azure-openai",
    modelName: env.azureOpenAiDeploymentGpt54Mini || "gpt-5.4-mini",
    isDefault: true,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "openai-compatible",
    baseUrl: env.deepseekApiBaseUrl,
    apiKeyEnvValue: env.deepseekApiKey,
    modelName: env.deepseekModel,
    isDefault: false,
  },
  {
    id: "gemini-2-5-flash",
    label: "Google Gemini 2.5 Flash",
    provider: "openai-compatible",
    baseUrl: env.geminiApiBaseUrl,
    apiKeyEnvValue: env.geminiApiKey,
    modelName: env.geminiModel,
    isDefault: false,
  },
  {
    id: "azure-image-gpt-image-1",
    label: "Azure OpenAI — Image (gpt-image-1)",
    provider: "azure-openai-image",
    modelName: env.azureOpenAiDeploymentImage || "gpt-image-1",
    isDefault: false,
  },
];

export const getModelRegistryEntry = (modelId) =>
  AI_MODEL_REGISTRY.find((entry) => entry.id === modelId) || null;

export const getDefaultModelEntry = () =>
  AI_MODEL_REGISTRY.find((entry) => entry.isDefault) || AI_MODEL_REGISTRY[0];

export const listSelectableModels = () =>
  AI_MODEL_REGISTRY.map(({ apiKeyEnvValue: _apiKeyEnvValue, ...publicFields }) => publicFields);
