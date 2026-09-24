"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import { Role } from "@/generated/prisma/enums";
import { updatePatientSchema } from "@/lib/validation/patients";
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
