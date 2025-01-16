export const NORMALIZE_REGEX = /\s*\r?\n|\r/g;

export const PROVIDER_HELLO_TIMEOUT = 30000;

export const serverMessageKeys = {
  challenge: "challenge",
  conectionSize: "conectionSize",
  healthCheck: "healthCheck",
  healthCheckAck: "healthCheckAck",
  heartbeat: "heartbeat",
  inference: "inference",
  inferenceEnded: "inferenceEnded",
  inferenceError: "inferenceError",
  join: "join",
  joinAck: "joinAck",
  leave: "leave",
  newConversation: "newConversation",
  providerDetails: "providerDetails",
  reportCompletion: "reportCompletion",
  requestProvider: "requestProvider",
  sendMetrics: "sendMetrics",
  sessionValid: "sessionValid",
  verifySession: "verifySession",
  versionMismatch: "versionMismatch",
} as const;

export const apiProviders = {
  LiteLLM: "litellm",
  LlamaCpp: "llamacpp",
  LMStudio: "lmstudio",
  Ollama: "ollama",
  Oobabooga: "oobabooga",
  OpenAICompatible: "openai-compatible",
  OpenWebUI: "openwebui",
} as const;
