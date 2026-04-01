import {
  getVertexAccessToken,
  getVertexLocation,
  getVertexProjectId,
  getImagenModelId,
} from "./access-token";

export type ImagenPredictParams = {
  prompt: string;
  sampleCount?: number;
  aspectRatio?: string;
  language?: string;
  personGeneration?: string;
  sampleImageSize?: "1K" | "2K";
};

export type ImagenPrediction = {
  bytesBase64Encoded?: string;
  mimeType?: string;
  raiFilteredReason?: string;
};

export async function imagenPredict(
  params: ImagenPredictParams
): Promise<ImagenPrediction[]> {
  const project = getVertexProjectId();
  const location = getVertexLocation();
  const model = getImagenModelId();
  const token = await getVertexAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

  const body = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      sampleCount: params.sampleCount ?? 1,
      aspectRatio: params.aspectRatio ?? "9:16",
      language: params.language ?? "pt",
      personGeneration: params.personGeneration ?? "allow_adult",
      sampleImageSize: params.sampleImageSize ?? "1K",
      addWatermark: true,
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
    let detail = text.slice(0, 1200);
    try {
      const errJson = JSON.parse(text) as {
        error?: { message?: string; status?: string; code?: number };
      };
      if (errJson.error?.message) {
        detail = errJson.error.message;
      }
    } catch {
      /* manter slice bruto */
    }
    const err = new Error(
      `Vertex Imagen (${model} em ${location}): HTTP ${res.status} — ${detail}`
    ) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  const json = JSON.parse(text) as {
    predictions?: ImagenPrediction[];
    error?: { message?: string };
  };

  if (json.error?.message) {
    throw new Error(json.error.message);
  }

  return json.predictions ?? [];
}
