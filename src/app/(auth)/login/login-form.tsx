"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signIn, type SignInState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Ingresando…" : "Ingresar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signIn,
    null,
  );

  const failed = state?.ok === false ? state.error : undefined;
  const fieldErrors = failed?.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {failed && failed.code !== "VALIDATION" && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription>{failed.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(fieldErrors?.email)}
          aria-describedby={fieldErrors?.email ? "email-error" : undefined}
        />
        {fieldErrors?.email && (
          <p id="email-error" className="text-body-sm text-destructive">
            {fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors?.password)}
          aria-describedby={
            fieldErrors?.password ? "password-error" : undefined
          }
        />
        {fieldErrors?.password && (
          <p id="password-error" className="text-body-sm text-destructive">
            {fieldErrors.password[0]}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
