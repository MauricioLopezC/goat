"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changePassword } from "../actions";

export function ChangePasswordForm({
  mustChangePassword,
}: {
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!result.ok) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        } else {
          setErrorMessage(result.error.message);
        }
        return;
      }

      router.push("/portal");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errorMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">
          {mustChangePassword ? "Contraseña temporal" : "Contraseña actual"}
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.currentPassword)}
        />
        {fieldErrors.currentPassword && (
          <p className="text-body-sm text-destructive">
            {fieldErrors.currentPassword[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.newPassword)}
        />
        <p className="text-xs text-muted-foreground">
          Debe tener al menos 8 caracteres y ser diferente a la actual.
        </p>
        {fieldErrors.newPassword && (
          <p className="text-body-sm text-destructive">
            {fieldErrors.newPassword[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
        />
        {fieldErrors.confirmPassword && (
          <p className="text-body-sm text-destructive">
            {fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="gap-2">
        <KeyRound className="size-4" />
        {isPending ? "Guardando…" : "Actualizar contraseña"}
      </Button>
    </form>
  );
}
