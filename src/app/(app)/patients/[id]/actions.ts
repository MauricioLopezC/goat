"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import {
  patientAccessSchema,
  updatePatientSchema,
} from "@/lib/validation/patients";
import * as dal from "@/lib/dal/patients";

export const updatePatient = defineAction({
  roles: [Role.RECEPTIONIST, Role.MANAGER],
  input: updatePatientSchema,
  handler: async (input, actor) => {
    const result = await dal.updatePatient(input, actor);
    revalidatePath("/patients");
    revalidatePath(`/patients/${input.id}`);
    revalidatePath(`/patients/${input.id}/edit`);
    return result;
  },
});

export const enablePatientAccess = defineAction({
  roles: [Role.RECEPTIONIST, Role.MANAGER],
  input: patientAccessSchema,
  handler: async (input, actor) => {
    const result = await dal.enablePatientAccess(input, actor);
    revalidatePath(`/patients/${input.patientId}`);
    return result;
  },
});

export const disablePatientAccess = defineAction({
  roles: [Role.RECEPTIONIST, Role.MANAGER],
  input: patientAccessSchema,
  handler: async (input, actor) => {
    const result = await dal.disablePatientAccess(input, actor);
    revalidatePath(`/patients/${input.patientId}`);
    return result;
  },
});
