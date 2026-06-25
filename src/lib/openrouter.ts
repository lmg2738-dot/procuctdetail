const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const RETRY_DELAY_MS = 800;
const MAX_PASSES = 2;
const MAX_PASSES_TEXT = 4;
const MAX_PASSES_VISION = 3;
const MAX_PASSES_QUICK = 1;
const MAX_MODEL_ATTEMPTS = 5;
const MAX_MODEL_ATTEMPTS_TEXT = 12;
const MAX_MODEL_ATTEMPTS_VISION = 10;
const PASS_DELAYS_MS = [0, 4000];
const TEXT_PASS_DELAYS_MS = [0, 2500, 6000, 12000];
const VISION_PASS_DELAYS_MS = [0, 3000, 6000];

const APP_REFERER =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:50005";

/** 비전 정확도 우선 — 상위 모델부터 순차 시도 (셔플하지 않음) */
const PRIORITY_VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen-vl-plus:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "qwen/qwen2.5-vl-3b-instruct:free",
  "microsoft/phi-4-multimodal-instruct:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

/** 무료 비전(이미지 입력) 모델 — API 목록 실패 시 폴백 */
const FALLBACK_FREE_VISION_MODELS = PRIORITY_VISION_MODELS;

/** 텍스트 생성 우선 모델 — rate limit 시 순차 시도 */
const PRIORITY_TEXT_MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "nousresearch/deephermes-3-llama-3-8b-preview:free",
];

/** 무료 텍스트 생성 모델 폴백 */
const FALLBACK_FREE_TEXT_MODELS = PRIORITY_TEXT_MODELS;

/** 무료 이미지 생성(출력) 모델 폴백 */
const FALLBACK_FREE_IMAGE_GEN_MODELS = [
  "black-forest-labs/flux-schnell:free",
  "google/gemini-2.0-flash-exp:free",
];

export type ModelTask = "vision" | "text" | "image-gen";

type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | {
            type: "image_url";
            image_url: { url: string; detail?: "low" | "high" | "auto" };
          }
      >;
    };

interface OpenRouterModel {
  id: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  supported_parameters?: string[];
}

interface ModelsCache {
  models: string[];
  fetchedAt: number;
}

const failedModels = new Set<string>();
const rateLimitedUntil = new Map<string, number>();
const cacheByTask: Partial<Record<ModelTask, ModelsCache>> = {};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("사용량 제한") ||
    error.message.includes("rate limit") ||
    error.message.includes("rate-limited")
  );
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    );
  }
  if (!apiKey.startsWith("sk-or-")) {
    throw new Error(
      "OPENROUTER_API_KEY 형식이 올바르지 않습니다. OpenRouter에서 새 키를 발급하세요."
    );
  }
  return apiKey;
}

function getRequestHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": APP_REFERER,
    "X-Title": "DetailMaster AI",
  };
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const lowered = body.toLowerCase();
  return (
    lowered.includes("user not found") ||
    lowered.includes("invalid api key") ||
    lowered.includes("unauthorized")
  );
}

function formatAuthError(): Error {
  return new Error(
    "OpenRouter API 키가 유효하지 않습니다. openrouter.ai/keys 에서 새 키를 발급한 뒤 .env.local의 OPENROUTER_API_KEY를 업데이트하고 개발 서버를 재시작하세요."
  );
}

function isFreePricing(pricing?: OpenRouterModel["pricing"]): boolean {
  if (!pricing) return false;

  const prompt = Number.parseFloat(pricing.prompt ?? "1");
  const completion = Number.parseFloat(pricing.completion ?? "1");
  const image = Number.parseFloat(pricing.image ?? "0");
  const request = Number.parseFloat(pricing.request ?? "0");

  return (
    prompt === 0 &&
    completion === 0 &&
    image === 0 &&
    request === 0 &&
    !Number.isNaN(prompt) &&
    !Number.isNaN(completion)
  );
}

function matchesTask(model: OpenRouterModel, task: ModelTask): boolean {
  const input = model.architecture?.input_modalities ?? [];
  const output = model.architecture?.output_modalities ?? ["text"];

  switch (task) {
    case "vision":
      return input.includes("image");
    case "image-gen":
      return output.includes("image");
    case "text":
      return output.includes("text");
    default:
      return true;
  }
}

function isTemporarilyBlocked(modelId: string, ignoreCooldown = false): boolean {
  if (ignoreCooldown) return false;

  const until = rateLimitedUntil.get(modelId);
  if (!until) return false;

  if (Date.now() > until) {
    rateLimitedUntil.delete(modelId);
    return false;
  }

  return true;
}

function markRateLimited(modelId: string): void {
  rateLimitedUntil.set(modelId, Date.now() + RATE_LIMIT_COOLDOWN_MS);
}

function isModelUnavailable(status: number, body: string): boolean {
  if (status === 404 || status === 503 || status === 529) return true;

  const lowered = body.toLowerCase();
  return (
    lowered.includes("no endpoints found") ||
    lowered.includes("model not found") ||
    lowered.includes("not a valid model") ||
    lowered.includes("does not exist") ||
    lowered.includes("no available providers") ||
    lowered.includes("does not support")
  );
}

function isRateLimited(status: number, body: string): boolean {
  if (status === 429) return true;

  const lowered = body.toLowerCase();
  return (
    lowered.includes("rate-limited") ||
    lowered.includes("rate limit") ||
    lowered.includes("too many requests")
  );
}

function extractRateLimitedModel(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: { metadata?: { raw?: string } };
    };
    const raw = parsed.error?.metadata?.raw ?? "";
    const match = raw.match(/^([^\s]+)\s+is temporarily rate-limited/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function getFallbackModels(task: ModelTask): string[] {
  switch (task) {
    case "vision":
      return FALLBACK_FREE_VISION_MODELS;
    case "image-gen":
      return FALLBACK_FREE_IMAGE_GEN_MODELS;
    case "text":
      return FALLBACK_FREE_TEXT_MODELS;
  }
}

function getFetchParams(task: ModelTask): URLSearchParams {
  const params = new URLSearchParams({
    max_price: "0",
    sort: "throughput-high-to-low",
  });

  switch (task) {
    case "vision":
      params.set("input_modalities", "image");
      params.set("output_modalities", "text");
      break;
    case "image-gen":
      params.set("output_modalities", "image");
      params.set("input_modalities", "text");
      break;
    case "text":
      params.set("input_modalities", "text");
      params.set("output_modalities", "text");
      break;
  }

  return params;
}

async function fetchModelsFromApi(task: ModelTask): Promise<string[]> {
  const primary = await loadModels(getFetchParams(task), task);

  if (task === "vision") {
    const broad = await loadModels(
      new URLSearchParams({ max_price: "0", output_modalities: "all" }),
      "vision"
    );
    const merged = [...new Set([...primary, ...broad])];
    if (merged.length > 0) return merged;
  } else if (primary.length > 0) {
    return primary;
  }

  return getFallbackModels(task);
}

async function loadModels(
  params: URLSearchParams,
  task: ModelTask
): Promise<string[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models?${params}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    if (isAuthError(response.status, bodyText)) {
      throw formatAuthError();
    }
    return [];
  }

  const payload = (await response.json()) as { data?: OpenRouterModel[] };
  const models = payload.data ?? [];

  return models
    .filter((model) => isFreePricing(model.pricing))
    .filter((model) => matchesTask(model, task))
    .map((model) => model.id);
}

async function getCandidateModels(
  task: ModelTask,
  ignoreCooldown = false,
  options?: { prioritize?: boolean }
): Promise<string[]> {
  const pinnedVision = process.env.OPENROUTER_VISION_MODEL?.trim();
  if (task === "vision" && pinnedVision) {
    return [pinnedVision];
  }

  const pinnedText = process.env.OPENROUTER_TEXT_MODEL?.trim();
  if (task === "text" && pinnedText) {
    return [pinnedText];
  }

  const cache = cacheByTask[task];
  const now = Date.now();
  let models: string[];

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    models = cache.models;
  } else {
    try {
      models = await fetchModelsFromApi(task);
      cacheByTask[task] = { models, fetchedAt: now };
    } catch {
      models = cache?.models ?? getFallbackModels(task);
    }
  }

  const merged = [...new Set([...models, ...getFallbackModels(task)])];

  const filtered = merged.filter(
    (id) =>
      !failedModels.has(id) && !isTemporarilyBlocked(id, ignoreCooldown)
  );

  if (task === "vision" && options?.prioritize) {
    const priority = PRIORITY_VISION_MODELS.filter((id) =>
      filtered.includes(id)
    );
    const rest = shuffle(
      filtered.filter((id) => !PRIORITY_VISION_MODELS.includes(id))
    );
    return [...priority, ...rest];
  }

  if (task === "text" && options?.prioritize) {
    const priority = PRIORITY_TEXT_MODELS.filter((id) =>
      filtered.includes(id)
    );
    const rest = shuffle(
      filtered.filter((id) => !PRIORITY_TEXT_MODELS.includes(id))
    );
    return [...priority, ...rest];
  }

  return shuffle(filtered);
}

function extractJsonContent(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

async function requestCompletion(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  useJsonMode: boolean
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
  };

  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify(body),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return { ok: false, status: response.status, body: bodyText };
  }

  const payload = JSON.parse(bodyText) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      status: 502,
      body: JSON.stringify({ error: { message: "empty response" } }),
    };
  }

  return { ok: true, content };
}

async function tryModels<T>(
  task: ModelTask,
  messages: ChatMessage[],
  maxTokens: number,
  ignoreCooldown: boolean,
  options?: { maxAttempts?: number; prioritize?: boolean }
): Promise<{ content: T; model: string } | null> {
  const maxAttempts =
    options?.maxAttempts ??
    (task === "vision"
      ? MAX_MODEL_ATTEMPTS_VISION
      : task === "text"
        ? MAX_MODEL_ATTEMPTS_TEXT
        : MAX_MODEL_ATTEMPTS);

  const candidates = (
    await getCandidateModels(task, ignoreCooldown, {
      prioritize:
        options?.prioritize ?? (task === "vision" || task === "text"),
    })
  ).slice(0, maxAttempts);

  if (candidates.length === 0) {
    return null;
  }

  for (const model of candidates) {
    for (const useJsonMode of [true, false]) {
      try {
        const result = await requestCompletion(
          model,
          messages,
          maxTokens,
          useJsonMode
        );

        if (!result.ok) {
          const { status, body } = result;

          if (isAuthError(status, body)) {
            throw formatAuthError();
          }

          if (isRateLimited(status, body)) {
            markRateLimited(model);
            const upstream = extractRateLimitedModel(body);
            if (upstream) markRateLimited(upstream);
            await sleep(RETRY_DELAY_MS);
            break;
          }

          if (isModelUnavailable(status, body)) {
            failedModels.add(model);
            break;
          }

          if (useJsonMode) continue;
          break;
        }

        const parsed = JSON.parse(extractJsonContent(result.content)) as T;
        return { content: parsed, model };
      } catch (error) {
        if (error instanceof Error && error.message.includes("API 키")) {
          throw error;
        }
        if (useJsonMode) continue;
      }
    }
  }

  return null;
}

async function runWithPasses<T>(
  task: ModelTask,
  messages: ChatMessage[],
  maxTokens: number,
  maxPasses: number,
  options?: { delays?: number[]; maxAttempts?: number; prioritize?: boolean }
): Promise<{ content: T; model: string } | null> {
  const delays =
    options?.delays ??
    (task === "vision"
      ? VISION_PASS_DELAYS_MS
      : task === "text"
        ? TEXT_PASS_DELAYS_MS
        : PASS_DELAYS_MS);

  for (let pass = 0; pass < maxPasses; pass++) {
    const ignoreCooldown = pass > 0;
    const result = await tryModels<T>(
      task,
      messages,
      maxTokens,
      ignoreCooldown,
      {
        maxAttempts: options?.maxAttempts,
        prioritize:
          options?.prioritize ?? (task === "vision" || task === "text"),
      }
    );

    if (result) {
      return result;
    }

    if (pass < maxPasses - 1) {
      await sleep(delays[pass + 1] ?? 3000);
    }
  }

  return null;
}

/** 비전 전용 — 우선순위 모델 + 다중 재시도로 이미지 분석 정확도 확보 */
export async function chatWithFreeVisionModels<T>(options: {
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string }> {
  const result = await runWithPasses<T>(
    "vision",
    options.messages,
    options.maxTokens,
    MAX_PASSES_VISION,
    { prioritize: true, maxAttempts: MAX_MODEL_ATTEMPTS_VISION }
  );

  if (result) {
    return result;
  }

  throw new Error(
    "무료 이미지 분석(비전) 모델이 모두 일시적으로 사용량 제한 상태입니다. 1~2분 후 다시 시도하거나 상품명/카테고리 힌트를 입력해 주세요."
  );
}

/** 비전 1회 빠른 시도 — 내부 폴백 체인용 */
export async function tryChatWithFreeVisionModels<T>(options: {
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string } | null> {
  try {
    return await runWithPasses<T>(
      "vision",
      options.messages,
      options.maxTokens,
      MAX_PASSES_QUICK,
      { prioritize: true, maxAttempts: MAX_MODEL_ATTEMPTS_VISION }
    );
  } catch {
    return null;
  }
}

/** 텍스트 전용 — 다중 모델·재시도로 rate limit 완화 */
export async function chatWithFreeTextModels<T>(options: {
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string }> {
  const result = await runWithPasses<T>(
    "text",
    options.messages,
    options.maxTokens,
    MAX_PASSES_TEXT,
    { prioritize: true, maxAttempts: MAX_MODEL_ATTEMPTS_TEXT }
  );

  if (result) {
    return result;
  }

  throw new Error(
    "무료 텍스트 모델이 모두 일시적으로 사용량 제한 상태입니다. 1~2분 후 다시 시도하거나 상품 힌트를 입력해 주세요."
  );
}

export async function tryChatWithFreeTextModels<T>(options: {
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string } | null> {
  try {
    return await chatWithFreeTextModels<T>(options);
  } catch {
    return null;
  }
}

export async function chatWithFreeModels<T>(options: {
  task: ModelTask;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string }> {
  if (options.task === "text") {
    return chatWithFreeTextModels<T>(options);
  }

  const result = await runWithPasses<T>(
    options.task,
    options.messages,
    options.maxTokens,
    MAX_PASSES
  );

  if (result) {
    return result;
  }

  const taskLabel =
    options.task === "vision"
      ? "이미지 분석(비전)"
      : options.task === "image-gen"
        ? "이미지 생성"
        : "텍스트";

  throw new Error(
    `무료 ${taskLabel} 모델이 모두 일시적으로 사용량 제한 상태입니다. 1~2분 후 다시 시도해 주세요.`
  );
}

/** 빠른 1회 시도 — 비전 폴백·선택적 작업용 */
export async function tryChatWithFreeModels<T>(options: {
  task: ModelTask;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<{ content: T; model: string } | null> {
  try {
    return await runWithPasses<T>(
      options.task,
      options.messages,
      options.maxTokens,
      MAX_PASSES_QUICK
    );
  } catch {
    return null;
  }
}

/** 무료 이미지 생성 모델로 프롬프트 기반 이미지 URL 생성 */
export async function generateImageWithFreeModels(
  prompt: string
): Promise<{ url: string; model: string } | null> {
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  const candidates = (await getCandidateModels("image-gen")).slice(0, 3);

  for (const model of candidates) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      if (isRateLimited(response.status, bodyText)) {
        markRateLimited(model);
        await sleep(RETRY_DELAY_MS);
      }
      continue;
    }

    const payload = JSON.parse(bodyText) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; image_url?: { url?: string } }>;
          images?: Array<{ image_url?: { url?: string } }>;
        };
      }>;
    };

    const message = payload.choices?.[0]?.message;
    const imageFromImages = message?.images?.[0]?.image_url?.url;
    if (imageFromImages) {
      return { url: imageFromImages, model };
    }

    const content = message?.content;
    if (typeof content === "string") {
      const dataUrl = content.match(/data:image\/[^;]+;base64,[^\s"']+/);
      const httpUrl = content.match(/https?:\/\/[^\s"']+\.(png|jpg|jpeg|webp)/i);
      if (dataUrl) return { url: dataUrl[0], model };
      if (httpUrl) return { url: httpUrl[0], model };
    }

    if (Array.isArray(content)) {
      for (const part of content) {
        const url = part.image_url?.url;
        if (url) return { url, model };
      }
    }
  }

  return null;
}
