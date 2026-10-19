import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validatePhotoFile,
  validatePhotoBytes,
  detectPhotoMimeType,
  readProfessionalPhoto,
  MAX_PHOTO_SIZE_BYTES,
  deleteProfessionalPhoto,
} from "../src/lib/storage/photos";
import {
  createProfessionalSchema,
  updateProfessionalSchema,
} from "../src/lib/validation/professional";

test("validatePhotoFile acepta imágenes válidas hasta 10 MB", () => {
  const validJpeg = { size: 5 * 1024 * 1024, type: "image/jpeg" };
  assert.deepEqual(validatePhotoFile(validJpeg), { ok: true });

  const validPng = { size: 10 * 1024 * 1024, type: "image/png" };
  assert.deepEqual(validatePhotoFile(validPng), { ok: true });

  const validWebp = { size: 1024, type: "image/webp" };
  assert.deepEqual(validatePhotoFile(validWebp), { ok: true });
});

test("validatePhotoFile rechaza archivos mayores a 10 MB", () => {
  const tooLarge = { size: MAX_PHOTO_SIZE_BYTES + 1, type: "image/jpeg" };
  const res = validatePhotoFile(tooLarge);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /10 MB/);
  }
});

test("validatePhotoFile rechaza formatos no permitidos", () => {
  const gif = { size: 1024, type: "image/gif" };
  const resGif = validatePhotoFile(gif);
  assert.equal(resGif.ok, false);
  if (!resGif.ok) {
    assert.match(resGif.error, /JPG, PNG o WebP/);
  }

  const pdf = { size: 1024, type: "application/pdf" };
  const resPdf = validatePhotoFile(pdf);
  assert.equal(resPdf.ok, false);
});

test("validatePhotoFile rechaza entradas nulas o malformadas", () => {
  assert.equal(validatePhotoFile(null).ok, false);
  assert.equal(validatePhotoFile(undefined).ok, false);
  assert.equal(validatePhotoFile("string").ok, false);
  assert.equal(validatePhotoFile({}).ok, false);
});

test("detectPhotoMimeType y validatePhotoBytes verifican la firma binaria (magic bytes)", () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectPhotoMimeType(jpegBytes), "image/jpeg");
  assert.deepEqual(validatePhotoBytes(jpegBytes, "image/jpeg"), { ok: true });

  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  assert.equal(detectPhotoMimeType(pngBytes), "image/png");
  assert.deepEqual(validatePhotoBytes(pngBytes, "image/png"), { ok: true });

  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectPhotoMimeType(webpBytes), "image/webp");
  assert.deepEqual(validatePhotoBytes(webpBytes, "image/webp"), { ok: true });

  // Contenido falso (ej. HTML o script disfrazado de image/jpeg)
  const fakeBytes = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(detectPhotoMimeType(fakeBytes), null);
  const fakeRes = validatePhotoBytes(fakeBytes, "image/jpeg");
  assert.equal(fakeRes.ok, false);

  // Discrepancia entre firma binaria real (PNG) y tipo declarado (JPEG)
  const mismatchRes = validatePhotoBytes(pngBytes, "image/jpeg");
  assert.equal(mismatchRes.ok, false);
});

test("createProfessionalSchema acepta photoUrl opcional, nula o string", () => {
  const baseInput = {
    firstName: "Laura",
    lastName: "Pérez",
    documentType: "DNI",
    documentNumber: "34567890",
    licenseNumber: "45678",
    titleIds: [1],
    serviceIds: [1],
  };

  const parsedWithPhoto = createProfessionalSchema.safeParse({
    ...baseInput,
    photoUrl: "/uploads/professionals/prof-123.jpg",
  });
  assert.equal(parsedWithPhoto.success, true);
  if (parsedWithPhoto.success) {
    assert.equal(
      parsedWithPhoto.data.photoUrl,
      "/uploads/professionals/prof-123.jpg",
    );
  }

  const parsedWithoutPhoto = createProfessionalSchema.safeParse({
    ...baseInput,
    photoUrl: "",
  });
  assert.equal(parsedWithoutPhoto.success, true);
  if (parsedWithoutPhoto.success) {
    assert.equal(parsedWithoutPhoto.data.photoUrl, null);
  }

  const parsedNull = createProfessionalSchema.safeParse({
    ...baseInput,
    photoUrl: null,
  });
  assert.equal(parsedNull.success, true);
  if (parsedNull.success) {
    assert.equal(parsedNull.data.photoUrl, null);
  }
});

test("updateProfessionalSchema acepta photoUrl y reason", () => {
  const updateInput = {
    id: 1,
    firstName: "Laura",
    lastName: "Pérez",
    documentType: "DNI",
    documentNumber: "34567890",
    licenseNumber: "45678",
    titleIds: [1],
    serviceIds: [1],
    photoUrl: "/uploads/professionals/prof-updated.jpg",
    reason: "Actualización de foto de perfil",
  };

  const result = updateProfessionalSchema.safeParse(updateInput);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(
      result.data.photoUrl,
      "/uploads/professionals/prof-updated.jpg",
    );
  }
});

test("deleteProfessionalPhoto y readProfessionalPhoto ignoran rutas no válidas o ataques de path traversal", async () => {
  // No debe lanzar error ante rutas no válidas
  await assert.doesNotReject(async () => {
    await deleteProfessionalPhoto(null);
    await deleteProfessionalPhoto(undefined);
    await deleteProfessionalPhoto("");
    await deleteProfessionalPhoto("https://externo.com/foto.jpg");
    await deleteProfessionalPhoto("/uploads/professionals/../secret.txt");
  });

  assert.equal(await readProfessionalPhoto("../secret.txt"), null);
  assert.equal(await readProfessionalPhoto("prof-123.svg"), null);
  assert.equal(
    await readProfessionalPhoto(
      "prof-00000000-0000-0000-0000-000000000000.jpg",
    ),
    null,
  );
});
