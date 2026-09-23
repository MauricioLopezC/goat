"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { createPatientSchema } from "@/lib/validation/patients";
import * as dal from "@/lib/dal/patients";

export const createPatient = defineAction({
  roles: [Role.RECEPTIONIST, Role.MANAGER],
  input: createPatientSchema,
  handler: async (input, actor) => {
    const result = await dal.createPatient(input, actor);
    revalidatePath("/patients");
    return result;
  },
});
