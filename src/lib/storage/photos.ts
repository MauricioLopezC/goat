import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXTENSION_TO_MIME: Record<string, AllowedMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type PhotoValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Detecta el tipo MIME real de una imagen inspeccionando su firma binaria (magic bytes).
 */
export function detectPhotoMimeType(bytes: Uint8Array): AllowedMimeType | null {
  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" (0..3) + size (4..7) + "WEBP" (8..11)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Valida que el contenido binario coincida con un formato de imagen permitido
 * y con el Content-Type declarado si se indicó.
 */
export function validatePhotoBytes(
  bytes: Uint8Array,
  declaredMimeType?: string,
): PhotoValidationResult {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "El archivo de imagen está vacío" };
  }

  if (bytes.byteLength > MAX_PHOTO_SIZE_BYTES) {
    return {
      ok: false,
      error: "La foto supera el límite máximo de 10 MB",
    };
  }

  const detected = detectPhotoMimeType(bytes);
  if (!detected) {
    return {
      ok: false,
      error:
        "El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida",
    };
  }

  if (declaredMimeType && declaredMimeType !== detected) {
    return {
      ok: false,
      error: "El formato real de la imagen no coincide con el tipo declarado",
    };
  }

  return { ok: true };
}

/**
 * Valida que el archivo subido no supere los 10 MB y sea una imagen permitida (JPEG, PNG o WebP).
 */
export function validatePhotoFile(file: unknown): PhotoValidationResult {
  if (!file || typeof file !== "object") {
    return { ok: false, error: "El archivo no es válido" };
  }

  const f = file as { size?: unknown; type?: unknown };

  if (typeof f.size !== "number" || typeof f.type !== "string") {
    return { ok: false, error: "El archivo no tiene el formato esperado" };
  }

  if (f.size > MAX_PHOTO_SIZE_BYTES) {
    return {
      ok: false,
      error: "La foto supera el límite máximo de 10 MB",
    };
  }

  if (!ALLOWED_PHOTO_MIME_TYPES.includes(f.type as AllowedMimeType)) {
    return {
      ok: false,
      error: "Formato no permitido. Solo se aceptan imágenes JPG, PNG o WebP",
    };
  }

  return { ok: true };
}

// ─────────────────── Configuración de Bucket S3 (Railway) ───────────────────

type S3Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region: string;
};

function getS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const endpoint = env.AWS_ENDPOINT_URL?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucketName = env.AWS_S3_BUCKET_NAME?.trim();
  const region = env.AWS_DEFAULT_REGION?.trim() || "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { endpoint, accessKeyId, secretAccessKey, bucketName, region };
}

function hmacSha256(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Uint8Array | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function s3Request(
  config: S3Config,
  method: "PUT" | "GET" | "DELETE",
  objectKey: string,
  body?: Uint8Array,
  contentType?: string,
): Promise<Response> {
  const endpointUrl = new URL(config.endpoint);
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const isIpOrLocal =
    endpointUrl.hostname === "localhost" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(endpointUrl.hostname);
  const url = isIpOrLocal
    ? new URL(
        `${endpointUrl.origin}/${encodeURIComponent(config.bucketName)}/${encodedKey}`,
      )
    : new URL(
        `${endpointUrl.protocol}//${config.bucketName}.${endpointUrl.host}/${encodedKey}`,
      );

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? "");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) {
    headers["content-type"] = contentType;
  }

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });
}

function isSafePhotoFileName(fileName: string): boolean {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return false;
  }
  return /^prof-[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(fileName);
}

/**
 * Guarda la foto en el Bucket S3 (si está configurado en Railway) o en disco
 * dentro de `public/uploads/professionals/` con un nombre único.
 * Retorna la URL pública accesible (ej: `/uploads/professionals/prof-uuid.jpg`).
 */
export async function saveProfessionalPhoto(file: File): Promise<string> {
  const validation = validatePhotoFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const bytesValidation = validatePhotoBytes(bytes, file.type);
  if (!bytesValidation.ok) {
    throw new Error(bytesValidation.error);
  }

  const detectedMime =
    detectPhotoMimeType(bytes) ?? (file.type as AllowedMimeType);
  const ext = MIME_TO_EXTENSION[detectedMime] || ".jpg";
  const uniqueName = `prof-${crypto.randomUUID()}${ext}`;

  const s3Config = getS3Config();
  if (s3Config) {
    const response = await s3Request(
      s3Config,
      "PUT",
      `professionals/${uniqueName}`,
      bytes,
      detectedMime,
    );
    if (!response.ok) {
      throw new Error("No se pudo guardar la imagen en el almacenamiento");
    }
    return `/uploads/professionals/${uniqueName}`;
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "professionals",
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  await fs.writeFile(filePath, Buffer.from(bytes));

  return `/uploads/professionals/${uniqueName}`;
}

/**
 * Lee una foto de profesional desde el Bucket S3 (si está configurado) o desde
 * el directorio local `public/uploads/professionals/`.
 */
export async function readProfessionalPhoto(
  fileName: string,
): Promise<{ body: Buffer; contentType: AllowedMimeType } | null> {
  if (!isSafePhotoFileName(fileName)) {
    return null;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = EXTENSION_TO_MIME[ext];
  if (!contentType) {
    return null;
  }

  const s3Config = getS3Config();
  if (s3Config) {
    const response = await s3Request(
      s3Config,
      "GET",
      `professionals/${fileName}`,
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Error al leer imagen del bucket (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return { body: Buffer.from(arrayBuffer), contentType };
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "professionals",
    fileName,
  );
  try {
    const body = await fs.readFile(filePath);
    return { body, contentType };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Elimina de forma segura un archivo previamente subido al almacenamiento de profesionales.
 */
export async function deleteProfessionalPhoto(
  photoUrl: string | null | undefined,
): Promise<void> {
  if (!photoUrl || typeof photoUrl !== "string") return;

  const prefix = "/uploads/professionals/";
  if (!photoUrl.startsWith(prefix)) return;

  const fileName = photoUrl.slice(prefix.length);
  // Evitar directory traversal
  if (!isSafePhotoFileName(fileName)) {
    return;
  }

  const s3Config = getS3Config();
  if (s3Config) {
    try {
      await s3Request(s3Config, "DELETE", `professionals/${fileName}`);
    } catch (error) {
      console.warn("No se pudo eliminar la foto previa del bucket:", error);
    }
    return;
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "professionals",
    fileName,
  );

  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Si el archivo no existe (ENOENT), se ignora silenciosamente
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      console.warn("No se pudo eliminar la foto previa:", error);
    }
  }
}
