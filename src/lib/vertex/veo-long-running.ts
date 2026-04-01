import {
  getVertexAccessToken,
  getVertexLocation,
  getVertexProjectId,
  getVeoModelId,
} from "./access-token";

export type VeoStartInput = {
  prompt: string;
  /** Image-to-video: frame inicial */
  image?: { bytesBase64Encoded: string; mimeType: string };
  aspectRatio?: "16:9" | "9:16";
  durationSeconds: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  /** Obrigatório em Veo 3.x */
  generateAudio: boolean;
  sampleCount?: number;
  resizeMode?: "pad" | "crop";
  personGeneration?: string;
};

export function parseModelIdFromOperationName(operationName: string): string {
  const m = operationName.match(/\/models\/([^/]+)\/operations\//);
  if (!m?.[1]) {
    throw new Error("operationName inválido: não foi possível extrair o modelId.");
  }
  return m[1];
}

export async function veoPredictLongRunning(
  input: VeoStartInput
): Promise<{ name: string }> {
  const project = getVertexProjectId();
  const location = getVertexLocation();
  const model = getVeoModelId();
  const token = await getVertexAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.image) {
    instance.image = {
      bytesBase64Encoded: input.image.bytesBase64Encoded,
      mimeType: input.image.mimeType,
    };
  }

  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: input.aspectRatio ?? "9:16",
      durationSeconds: input.durationSeconds,
      resolution: input.resolution ?? "720p",
      generateAudio: input.generateAudio,
      sampleCount: input.sampleCount ?? 1,
      personGeneration: input.personGeneration ?? "allow_adult",
      ...(input.resizeMode ? { resizeMode: input.resizeMode } : {}),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Veo start (${model}): ${res.status} ${text.slice(0, 800)}`);
  }

  const json = JSON.parse(text) as { name?: string; error?: { message?: string } };
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  if (!json.name) {
    throw new Error("Resposta Veo sem operation name.");
  }
  return { name: json.name };
}

export type VeoVideoOut = {
  gcsUri?: string;
  mimeType?: string;
  bytesBase64Encoded?: string;
};

export async function veoFetchPredictOperation(operationName: string): Promise<{
  done: boolean;
  error?: { message?: string; code?: number };
  videos?: VeoVideoOut[];
  raiMediaFilteredCount?: number;
  raiMediaFilteredReasons?: string[];
}> {
  const project = getVertexProjectId();
  const location = getVertexLocation();
  const modelId = parseModelIdFromOperationName(operationName);
  const token = await getVertexAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ operationName }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Veo poll: ${res.status} ${text.slice(0, 800)}`);
  }

  const json = JSON.parse(text) as {
    done?: boolean;
    error?: { message?: string; code?: number };
    response?: {
      videos?: VeoVideoOut[];
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };

  if (json.error?.message) {
    return { done: true, error: json.error };
  }

  const done = json.done === true;
  const videos = json.response?.videos;
  return {
    done,
    videos,
    raiMediaFilteredCount: json.response?.raiMediaFilteredCount,
    raiMediaFilteredReasons: json.response?.raiMediaFilteredReasons,
  };
}
