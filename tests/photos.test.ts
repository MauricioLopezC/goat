import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validatePhotoFile,
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

test("deleteProfessionalPhoto ignora rutas no válidas o ataques de path traversal", async () => {
  // No debe lanzar error ante rutas no válidas
  await assert.doesNotReject(async () => {
    await deleteProfessionalPhoto(null);
    await deleteProfessionalPhoto(undefined);
    await deleteProfessionalPhoto("");
    await deleteProfessionalPhoto("https://externo.com/foto.jpg");
    await deleteProfessionalPhoto("/uploads/professionals/../secret.txt");
  });
});
