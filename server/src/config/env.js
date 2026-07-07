import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(serverRoot, "..");

dotenv.config({ path: path.join(workspaceRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, ".env"), override: false });

const defaults = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kuhedu_practice",
  JWT_SECRET: "dev-jwt-secret-change-me",
  SESSION_SECRET: "dev-session-secret-change-me",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

export const env = {
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  serverUrl: process.env.SERVER_URL || "http://localhost:5005",
  port: Number(process.env.PORT || 5005),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5005/api/auth/google/callback",
  openAiApiKey: process.env.OPENAI_API_KEY,
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
  azureOpenAiApiKey:
    process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
  azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION || "",
  azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || "",
  azureOpenAiDeploymentGpt54Mini:
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI || "",
  azureOpenAiDeploymentImage: process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE || "",
  azureOpenAiImageApiVersion: process.env.AZURE_OPENAI_IMAGE_API_VERSION || "",
  openAiModel:
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-4.1-mini",
  openAiModelLayer1:
    process.env.OPENAI_MODEL_LAYER_1 ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4",
  openAiModelLayer2:
    process.env.OPENAI_MODEL_LAYER_2 ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4",
  openAiModelLayer3:
    process.env.OPENAI_MODEL_LAYER_3 ||
    process.env.OPENAI_MODEL_MINI ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4-mini",
  openAiModelLayer4:
    process.env.OPENAI_MODEL_LAYER_4 ||
    process.env.OPENAI_MODEL_MINI ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4-mini",
  openAiModelLayer5:
    process.env.OPENAI_MODEL_LAYER_5 ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4",
  openAiModelLayer6:
    process.env.OPENAI_MODEL_LAYER_6 ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4",
  openAiModelLayer7:
    process.env.OPENAI_MODEL_LAYER_7 ||
    process.env.OPENAI_MODEL_MINI ||
    process.env.OPENAI_MODEL ||
    process.env.AZURE_OPENAI_DEPLOYMENT_GPT54_MINI ||
    "gpt-5.4-mini",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekApiBaseUrl: process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com/v1",
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
};
