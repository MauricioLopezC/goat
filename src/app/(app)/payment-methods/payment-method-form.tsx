"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  type PaymentMethodResult,
} from "./actions";

export interface EditingPaymentMethod {
  id: number;
  name: string;
  active: boolean;
}

interface PaymentMethodFormProps {
  editingMethod?: EditingPaymentMethod | null;
  onCancel?: () => void;
  onSuccess?: (result: { name: string; isEditing: boolean }) => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? isEditing
          ? "Guardando cambios…"
          : "Creando medio de pago…"
        : isEditing
          ? "Guardar cambios"
          : "Agregar medio de pago"}
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

export function PaymentMethodForm({
  editingMethod,
  onCancel,
  onSuccess,
}: PaymentMethodFormProps) {
  const isEditing = Boolean(editingMethod);

  const [state, formAction] = useActionState<
    PaymentMethodResult | null,
    FormData
  >(isEditing ? updatePaymentMethodAction : createPaymentMethodAction, null);

  const created = state?.ok ? state.data : undefined;
  const failed = state?.ok === false ? state.error : undefined;
  const fields = failed?.fieldErrors;

  useEffect(() => {
    if (created && onSuccess) {
      onSuccess({ name: created.name, isEditing });
    }
  }, [created, onSuccess, isEditing]);

  const defaultName = editingMethod?.name ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {created && (
        <Alert
          role="status"
          className="border-success-soft-border bg-success-soft text-success-soft-foreground"
        >
          <CheckCircle2 className="size-5 text-success" />
          <AlertDescription>
            {isEditing
              ? `Se actualizó el medio de pago "${created.name}".`
              : `Se agregó el medio de pago "${created.name}".`}
          </AlertDescription>
        </Alert>
      )}

      {failed && failed.code !== "VALIDATION" && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-5" />
          <AlertDescription>{failed.message}</AlertDescription>
        </Alert>
      )}

      <div
        key={`${created ? "ok" : "form"}-${editingMethod?.id ?? "new"}`}
        className="grid gap-5 sm:grid-cols-2"
      >
        {isEditing && (
          <input type="hidden" name="id" value={editingMethod!.id} />
        )}

        {/* Nombre */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="pm-name">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pm-name"
            name="name"
            defaultValue={defaultName}
            placeholder="Ej. Efectivo"
            required
            aria-invalid={Boolean(fields?.name)}
            aria-describedby={fields?.name ? "pm-name-error" : undefined}
          />
          <FieldError id="pm-name-error" errors={fields?.name} />
        </div>

        {/* Estado (solo al editar) */}
        {isEditing && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-tray cursor-pointer select-none transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/30">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editingMethod!.active}
                value="true"
                className="size-4 mt-0.5 rounded border-input text-primary focus:ring-primary accent-primary"
              />
              <div className="flex flex-col">
                <span className="text-body-sm font-medium text-foreground">
                  Medio de pago activo
                </span>
                <span className="text-label-sm text-muted-foreground">
                  Un medio inactivo no se ofrece al cobrar, pero permanece en
                  los cobros ya registrados.
                </span>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="size-4 mr-1.5" />
            Cancelar
          </Button>
        )}
        <SubmitButton isEditing={isEditing} />
      </div>
    </form>
  );
}
