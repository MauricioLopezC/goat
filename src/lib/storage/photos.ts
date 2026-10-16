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

export type PhotoValidationResult = { ok: true } | { ok: false; error: string };

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

/**
 * Guarda la foto en disco dentro de `public/uploads/professionals/` con un nombre único.
 * Retorna la URL pública accesible (ej: `/uploads/professionals/prof-uuid.jpg`).
 */
export async function saveProfessionalPhoto(file: File): Promise<string> {
  const validation = validatePhotoFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const ext =
    MIME_TO_EXTENSION[file.type as AllowedMimeType] ||
    path.extname(file.name).toLowerCase() ||
    ".jpg";
  const uniqueName = `prof-${crypto.randomUUID()}${ext}`;

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "professionals",
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  const bytes = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(bytes));

  return `/uploads/professionals/${uniqueName}`;
}

/**
 * Elimina de forma segura un archivo local previamente subido al directorio de profesionales.
 */
export async function deleteProfessionalPhoto(
  photoUrl: string | null | undefined,
): Promise<void> {
  if (!photoUrl || typeof photoUrl !== "string") return;

  const prefix = "/uploads/professionals/";
  if (!photoUrl.startsWith(prefix)) return;

  const fileName = path.basename(photoUrl);
  // Evitar directory traversal
  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
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
