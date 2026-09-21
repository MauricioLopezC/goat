"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL, STAFF_ROLES } from "@/lib/roles";
import { createUser, type CreateUserState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creando…" : "Crear usuario"}
    </Button>
  );
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-body-sm text-destructive">
      {errors[0]}
    </p>
  );
}

export function UserForm() {
  const [state, formAction] = useActionState<CreateUserState, FormData>(
    createUser,
    null,
  );

  const created = state?.ok ? state.data : undefined;
  const failed = state?.ok === false ? state.error : undefined;
  const fields = failed?.fieldErrors;

  // Lo que se había cargado, cuando el intento falló. React vacía un formulario
  // no controlado al terminar la acción, así que sin esto el gerente perdería
  // todo por un error en un solo campo. En un alta exitosa no viene nada y el
  // formulario arranca limpio.
  const values = state?.values;

  // Remontar los campos en cada intento para que `defaultValue` vuelva a
  // aplicarse; si no, React conserva el nodo y los deja vacíos.
  const attempt = state ? (created ? "ok" : "error") : "inicial";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {created && (
        <Alert role="status">
          <CheckCircle2 />
          <AlertDescription>
            Se creó el usuario de {created.firstName} {created.lastName} (
            {created.email}). Ya puede ingresar con la contraseña que le diste.
          </AlertDescription>
        </Alert>
      )}

      {failed && failed.code !== "VALIDATION" && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>{failed.message}</AlertDescription>
        </Alert>
      )}

      <div key={attempt} className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={values?.firstName ?? ""}
            required
            aria-invalid={Boolean(fields?.firstName)}
            aria-describedby={fields?.firstName ? "firstName-error" : undefined}
          />
          <FieldError id="firstName-error" errors={fields?.firstName} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={values?.lastName ?? ""}
            required
            aria-invalid={Boolean(fields?.lastName)}
            aria-describedby={fields?.lastName ? "lastName-error" : undefined}
          />
          <FieldError id="lastName-error" errors={fields?.lastName} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={values?.email ?? ""}
            required
            aria-invalid={Boolean(fields?.email)}
            aria-describedby={fields?.email ? "email-error" : undefined}
          />
          <FieldError id="email-error" errors={fields?.email} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Teléfono interno (opcional)</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={values?.phone ?? ""}
            aria-invalid={Boolean(fields?.phone)}
            aria-describedby={fields?.phone ? "phone-error" : undefined}
          />
          <FieldError id="phone-error" errors={fields?.phone} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña inicial</Label>
          {/* Nunca se devuelve desde el servidor: se vuelve a escribir. */}
          <Input
            id="password"
            name="password"
            type="password"
            required
            aria-invalid={Boolean(fields?.password)}
            aria-describedby={fields?.password ? "password-error" : undefined}
          />
          <FieldError id="password-error" errors={fields?.password} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Rol</Label>
          <Select name="role" defaultValue={values?.role || "RECEPTIONIST"}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABEL[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="role-error" errors={fields?.role} />
        </div>
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
