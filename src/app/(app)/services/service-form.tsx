"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
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
import {
  createServiceAction,
  updateServiceAction,
  type ServiceFormState,
} from "./actions";

interface SpecialtyOption {
  id: number;
  name: string;
}

export interface EditingService {
  id: number;
  name: string;
  durationMinutes: number;
  requiresReferral: boolean;
  description: string | null;
  specialtyId: number | null;
}

interface ServiceFormProps {
  specialties: SpecialtyOption[];
  editingService?: EditingService | null;
  onCancel?: () => void;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? isEditing
          ? "Guardando cambios…"
          : "Creando servicio…"
        : isEditing
          ? "Guardar cambios"
          : "Crear servicio"}
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

export function ServiceForm({
  specialties,
  editingService,
  onCancel,
}: ServiceFormProps) {
  const isEditing = Boolean(editingService);

  const [state, formAction] = useActionState<ServiceFormState, FormData>(
    isEditing ? updateServiceAction : createServiceAction,
    null,
  );

  const created = state?.ok ? state.data : undefined;
  const failed = state?.ok === false ? state.error : undefined;
  const fields = failed?.fieldErrors;

  // Valores enviados que fallaron para preservar lo escrito
  const values = state?.values;

  const attempt = state ? (created ? "ok" : "error") : "inicial";

  // Valores iniciales según estemos editando o creando
  const defaultName = values?.name ?? editingService?.name ?? "";
  const defaultDuration =
    values?.durationMinutes ?? String(editingService?.durationMinutes ?? "30");
  const defaultReferral =
    values !== undefined
      ? values.requiresReferral
      : (editingService?.requiresReferral ?? false);
  const defaultDescription =
    values?.description ?? editingService?.description ?? "";
  const defaultSpecialty =
    values?.specialtyId ??
    (editingService?.specialtyId ? String(editingService.specialtyId) : "none");

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
              ? `Se actualizaron los datos del servicio "${created.name}".`
              : `Se creó exitosamente el servicio "${created.name}".`}
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
        key={`${attempt}-${editingService?.id ?? "new"}`}
        className="grid gap-5 sm:grid-cols-2"
      >
        {isEditing && (
          <input type="hidden" name="id" value={editingService!.id} />
        )}

        {/* Nombre del servicio */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">
            Nombre del servicio <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            defaultValue={defaultName}
            placeholder="Ej. Consulta traumatológica general"
            required
            aria-invalid={Boolean(fields?.name)}
            aria-describedby={fields?.name ? "name-error" : undefined}
          />
          <FieldError id="name-error" errors={fields?.name} />
        </div>

        {/* Área o especialidad */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="specialtyId">Área / Especialidad (opcional)</Label>
          <Select name="specialtyId" defaultValue={defaultSpecialty}>
            <SelectTrigger id="specialtyId" className="w-full">
              <SelectValue placeholder="Sin área asignada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin área asignada</SelectItem>
              {specialties.map((spec) => (
                <SelectItem key={spec.id} value={String(spec.id)}>
                  {spec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="specialtyId-error" errors={fields?.specialtyId} />
        </div>

        {/* Duración en minutos */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="durationMinutes">
              Duración <span className="text-destructive">*</span>
            </Label>
            <span className="text-label-sm text-muted-foreground">
              Múltiplo de 30 min
            </span>
          </div>
          <Select name="durationMinutes" defaultValue={defaultDuration}>
            <SelectTrigger id="durationMinutes" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutos (Estándar Inc. 1)</SelectItem>
              <SelectItem value="60">60 minutos (2 bloques)</SelectItem>
              <SelectItem value="90">90 minutos (3 bloques)</SelectItem>
            </SelectContent>
          </Select>
          <FieldError
            id="durationMinutes-error"
            errors={fields?.durationMinutes}
          />
        </div>

        {/* Requiere derivación u orden médica */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="flex items-start gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-tray cursor-pointer select-none transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/30">
            <input
              type="checkbox"
              name="requiresReferral"
              defaultChecked={defaultReferral}
              className="size-4 mt-0.5 rounded border-input text-primary focus:ring-primary accent-primary"
            />
            <div className="flex flex-col">
              <span className="text-body-sm font-medium text-foreground">
                Requiere derivación u orden médica
              </span>
              <span className="text-label-sm text-muted-foreground">
                Si está marcado, mesa de entradas deberá validar la orden del
                médico derivante al otorgar el turno.
              </span>
            </div>
          </label>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Descripción clínica (opcional)</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaultDescription}
            placeholder="Indicaciones sobre la prestación, requerimientos o características..."
            className="w-full rounded-lg border border-input bg-card p-3 text-body-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />
          <FieldError id="description-error" errors={fields?.description} />
        </div>
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
