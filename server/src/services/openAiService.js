import { env } from "../config/env.js";
import { getModelRegistryEntry } from "./llm/modelRegistry.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MAX_ATTEMPTS = Number(process.env.OPENAI_MAX_ATTEMPTS || 5);
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_BACKOFF_MS = 15000;

const backoffDelayMs = (attempt) => {
  const exponential = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (attempt - 1));
  const jitter = Math.random() * exponential * 0.3;
  return exponential + jitter;
};
const PLACEHOLDER_VALUES = new Set([
  "your_openai_api_key",
  "replace_with_a_long_random_secret",
  "replace_with_another_long_random_secret",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const supportsCustomTemperature = (modelName = "") => !/^gpt-5(\b|[-.])/i.test(modelName);
const hasConfiguredValue = (value = "") =>
  Boolean(value && !PLACEHOLDER_VALUES.has(String(value).trim()));
const isAzureOpenAiConfigured = () =>
  Boolean(
    hasConfiguredValue(env.azureOpenAiEndpoint) &&
      hasConfiguredValue(env.azureOpenAiApiKey) &&
      hasConfiguredValue(env.azureOpenAiApiVersion)
  );
const trimTrailingSlashes = (value = "") => value.replace(/\/+$/, "");
const normalizeAzureEndpointBase = (value = "") =>
  trimTrailingSlashes(value)
    .replace(/\/openai\/v1\/responses$/i, "")
    .replace(/\/openai\/v1$/i, "")
    .replace(/\/openai\/deployments\/[^/]+\/chat\/completions$/i, "")
    .replace(/\/openai$/i, "");

const getAzureOpenAiUrl = (deploymentName) => {
  const endpoint = normalizeAzureEndpointBase(env.azureOpenAiEndpoint);
  const encodedDeployment = encodeURIComponent(deploymentName);
  const encodedApiVersion = encodeURIComponent(env.azureOpenAiApiVersion);

  return `${endpoint}/openai/deployments/${encodedDeployment}/chat/completions?api-version=${encodedApiVersion}`;
};

const getAzureDeploymentName = (modelName) =>
  modelName || env.azureOpenAiDeployment || env.openAiModel;

// Azure's image-generation endpoint uses a different path suffix
// (images/generations, not chat/completions) and, in real-world Azure
// deployments, has sometimes required a DIFFERENT api-version than the
// chat-completions one -- hence a separate env var with a fallback.
const getAzureOpenAiImageUrl = (deploymentName) => {
  const endpoint = normalizeAzureEndpointBase(env.azureOpenAiEndpoint);
  const encodedDeployment = encodeURIComponent(deploymentName);
  const encodedApiVersion = encodeURIComponent(
    env.azureOpenAiImageApiVersion || env.azureOpenAiApiVersion
  );

  return `${endpoint}/openai/deployments/${encodedDeployment}/images/generations?api-version=${encodedApiVersion}`;
};

const getAzureImageDeploymentName = (modelName) => modelName || env.azureOpenAiDeploymentImage;

const resolveProviderRequest = ({ modelId, modelName }) => {
  const registryEntry = modelId ? getModelRegistryEntry(modelId) : null;

  if (!registryEntry) {
    return null;
  }

  if (registryEntry.provider === "azure-openai") {
    const deploymentName = getAzureDeploymentName(registryEntry.modelName || modelName);
    return {
      resolvedModel: deploymentName,
      apiUrl: getAzureOpenAiUrl(deploymentName),
      requestHeaders: {
        "Content-Type": "application/json",
        "api-key": env.azureOpenAiApiKey,
      },
    };
  }

  if (registryEntry.provider === "openai-compatible") {
    if (!hasConfiguredValue(registryEntry.apiKeyEnvValue)) {
      throw new Error(
        `${registryEntry.label} is not configured. Set its API key environment variable.`
      );
    }

    return {
      resolvedModel: registryEntry.modelName,
      apiUrl: `${trimTrailingSlashes(registryEntry.baseUrl)}/chat/completions`,
      requestHeaders: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registryEntry.apiKeyEnvValue}`,
      },
    };
  }

  return null;
};

const extractText = (data) => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
  }

  return "";
};

export const isOpenAiConfigured = () =>
  isAzureOpenAiConfigured() || hasConfiguredValue(env.openAiApiKey);

const parseOpenAiResponse = async (response) => {
  const rawText = await response.text();

  if (!rawText) {
    return { data: null, rawText };
  }

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: null, rawText };
  }
};

const getOpenAiErrorMessage = ({ response, data, rawText }) => {
  const message = data?.error?.message || rawText?.trim();
  if (message) {
    return `OpenAI request failed (${response.status}): ${message}`;
  }
  return `OpenAI request failed with status ${response.status}.`;
};

export const createStructuredCompletion = async ({
  systemPrompt,
  userPrompt,
  userContent,
  responseFormatName,
  signal,
  modelName,
  modelId,
}) => {
  const providerRequest = resolveProviderRequest({ modelId, modelName });

  let resolvedModel;
  let apiUrl;
  let requestHeaders;

  if (providerRequest) {
    ({ resolvedModel, apiUrl, requestHeaders } = providerRequest);
  } else {
    resolvedModel = modelName || env.openAiModel;
    const useAzureOpenAi = isAzureOpenAiConfigured();
    const azureDeploymentName = useAzureOpenAi ? getAzureDeploymentName(resolvedModel) : "";

    if (useAzureOpenAi && !azureDeploymentName) {
      throw new Error(
        "Azure OpenAI is configured, but no deployment name was provided. Set AZURE_OPENAI_DEPLOYMENT or OPENAI_MODEL."
      );
    }

    if (!useAzureOpenAi && !hasConfiguredValue(env.openAiApiKey)) {
      throw new Error(
        "No AI provider is configured. Set OPENAI_API_KEY or Azure OpenAI env vars."
      );
    }

    apiUrl = useAzureOpenAi ? getAzureOpenAiUrl(azureDeploymentName) : OPENAI_API_URL;
    requestHeaders = useAzureOpenAi
      ? {
          "Content-Type": "application/json",
          "api-key": env.azureOpenAiApiKey,
        }
      : {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.openAiApiKey}`,
        };
  }

  const requestPayload = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent || userPrompt },
    ],
    response_format: { type: "json_object" },
  };

  requestPayload.model = resolvedModel;

  if (supportsCustomTemperature(resolvedModel)) {
    requestPayload.temperature = 0.2;
  }

  const requestBody = JSON.stringify(requestPayload);

  let data = null;
  let rawText = "";
  let lastError = null;

  for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        signal,
        headers: requestHeaders,
        body: requestBody,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
      if (attempt < OPENAI_MAX_ATTEMPTS) {
        await sleep(backoffDelayMs(attempt));
        continue;
      }
      throw new Error(`OpenAI network request failed: ${error.message}`);
    }

    const parsedResponse = await parseOpenAiResponse(response);
    data = parsedResponse.data;
    rawText = parsedResponse.rawText;

    if (response.ok && data) {
      lastError = null;
      break;
    }

    const errorMessage = getOpenAiErrorMessage({ response, data, rawText });
    lastError = new Error(errorMessage);

    if (attempt < OPENAI_MAX_ATTEMPTS && RETRYABLE_STATUS_CODES.has(response.status)) {
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    throw lastError;
  }

  if (lastError) {
    throw lastError;
  }

  if (!data) {
    throw new Error(
      `OpenAI returned a non-JSON response for ${responseFormatName || "contract"}: ${rawText.slice(
        0,
        240
      )}`
    );
  }

  const text = extractText(data);
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `OpenAI returned non-JSON output for ${responseFormatName || "contract"}.`
    );
  }

  return {
    responseId: data?.id || null,
    parsed,
    rawText: text,
    usage: {
      inputTokens: data?.usage?.prompt_tokens || 0,
      outputTokens: data?.usage?.completion_tokens || 0,
      totalTokens: data?.usage?.total_tokens || 0,
    },
    model: data?.model || resolvedModel,
  };
};

// Image calls are much slower than chat completions (10-30s+ typical), so a
// distinct, smaller retry budget is used to bound worst-case latency --
// OPENAI_MAX_ATTEMPTS (5) with chat's backoff would push a single image call
// past 2+ minutes. 408/409 are dropped from the retryable set here: a
// timeout on an already-slow image call is likely to time out again
// identically, so retrying buys nothing.
const IMAGE_MAX_ATTEMPTS = 2;
const IMAGE_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export const generateImage = async ({ prompt, size = "1536x1024", modelId, modelName, signal }) => {
  const registryEntry = modelId ? getModelRegistryEntry(modelId) : null;
  const deploymentName = getAzureImageDeploymentName(registryEntry?.modelName || modelName);

  if (!isAzureOpenAiConfigured()) {
    const configError = new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_API_VERSION."
    );
    configError.statusCode = 503;
    throw configError;
  }
  if (!deploymentName) {
    const configError = new Error(
      "No Azure OpenAI image deployment configured. Set AZURE_OPENAI_DEPLOYMENT_IMAGE."
    );
    configError.statusCode = 503;
    throw configError;
  }

  const apiUrl = getAzureOpenAiImageUrl(deploymentName);
  const requestHeaders = {
    "Content-Type": "application/json",
    "api-key": env.azureOpenAiApiKey,
  };

  // gpt-image-1 deployments always return b64_json and reject an explicit
  // response_format field -- if the configured deployment turns out to be
  // DALL-E-3-shaped instead, this request body will need response_format:
  // "b64_json" added; a failure here is a config/deployment mismatch, not a
  // bug in the surrounding retry/parsing plumbing.
  const requestBody = JSON.stringify({ prompt, size, n: 1 });

  let data = null;
  let rawText = "";
  let lastError = null;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        signal,
        headers: requestHeaders,
        body: requestBody,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
      if (attempt < IMAGE_MAX_ATTEMPTS) {
        await sleep(backoffDelayMs(attempt));
        continue;
      }
      const networkError = new Error(`Image generation network request failed: ${error.message}`);
      networkError.statusCode = 502;
      throw networkError;
    }

    const parsedResponse = await parseOpenAiResponse(response);
    data = parsedResponse.data;
    rawText = parsedResponse.rawText;

    if (response.ok && data) {
      lastError = null;
      break;
    }

    // Content-policy rejections are a distinct, non-retryable failure mode
    // (the prompt itself was refused, not a transient server issue) -- flag
    // them so callers can show a clear, actionable message instead of a
    // generic failure.
    const errorCode = data?.error?.code || data?.error?.inner_error?.code;
    if (response.status === 400 && /content_policy|content_filter/i.test(String(errorCode))) {
      const policyError = new Error(
        data?.error?.message || "The image prompt was rejected by the content safety system."
      );
      policyError.isContentPolicyViolation = true;
      policyError.statusCode = 422;
      throw policyError;
    }

    const errorMessage = getOpenAiErrorMessage({ response, data, rawText });
    lastError = new Error(errorMessage);
    lastError.statusCode = response.status;

    if (attempt < IMAGE_MAX_ATTEMPTS && IMAGE_RETRYABLE_STATUS_CODES.has(response.status)) {
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    throw lastError;
  }

  if (lastError) {
    throw lastError;
  }

  if (!data) {
    const parseError = new Error(`Image generation returned a non-JSON response: ${rawText.slice(0, 240)}`);
    parseError.statusCode = 502;
    throw parseError;
  }

  const image = data?.data?.[0];
  const b64 = image?.b64_json;
  if (!b64) {
    throw new Error("Image generation response did not include base64 image data.");
  }

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    mimeType: "image/png",
    revisedPrompt: image?.revised_prompt || null,
    model: deploymentName,
  };
};
