"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  updateProfessional,
  deactivateProfessional,
  reactivateProfessional,
  type ProfessionalMutationState,
} from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { documentNumberFormat } from "@/lib/validation/document-number";
import { getTodayDateString } from "@/lib/utils";

type Professional = {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  licenseNumber: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  deactivatedAt: string | null;
  titles: { id: number; name: string }[];
  services: { id: number; name: string; durationMinutes: number }[];
};

function Submit({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

function DeactivateSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={disabled || pending}>
      {pending ? "Dando de baja…" : "Confirmar baja"}
    </Button>
  );
}

function Feedback({ state }: { state: ProfessionalMutationState }) {
  if (!state) return null;
  return (
    <Alert variant={state.ok ? "default" : "destructive"} role="status">
      <AlertDescription>
        {state.ok ? "Cambio guardado correctamente." : state.error.message}
      </AlertDescription>
    </Alert>
  );
}

export function ProfessionalEditor({
  professional,
  titles,
  services,
}: {
  professional: Professional;
  titles: { id: number; name: string }[];
  services: { id: number; name: string; durationMinutes: number }[];
}) {
  const [updateState, updateAction] = useActionState(updateProfessional, null);
  const [deactivateState, deactivateAction] = useActionState(
    deactivateProfessional,
    null,
  );
  const [reactivateState, reactivateAction] = useActionState(
    reactivateProfessional,
    null,
  );
  const [confirm, setConfirm] = useState(false);
  const [documentType, setDocumentType] = useState(professional.documentType);
  const documentFormat = documentNumberFormat(documentType);
  const currentTitles = new Set(professional.titles.map((title) => title.id));
  const currentServices = new Set(
    professional.services.map((service) => service.id),
  );
  const active = professional.active;
  const fieldErrors =
    updateState?.ok === false ? updateState.error.fieldErrors : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Modificar profesional</CardTitle>
          <CardDescription>
            Todos los cambios requieren un motivo y quedan en el historial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={professional.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["firstName", "Nombre", professional.firstName],
                  ["lastName", "Apellido", professional.lastName],
                  [
                    "documentType",
                    "Tipo de documento",
                    professional.documentType,
                  ],
                  [
                    "documentNumber",
                    "Número de documento",
                    professional.documentNumber,
                  ],
                  ["licenseNumber", "Matrícula", professional.licenseNumber],
                  ["phone", "Teléfono", professional.phone ?? ""],
                  ["email", "Email", professional.email ?? ""],
                  ["notes", "Observaciones", professional.notes ?? ""],
                ] as const
              ).map(([name, label, value]) => (
                <div key={name} className="flex flex-col gap-2">
                  <Label htmlFor={name}>{label}</Label>
                  {name === "documentType" ? (
                    <Select
                      name={name}
                      value={documentType}
                      onValueChange={setDocumentType}
                    >
                      <SelectTrigger
                        id={name}
                        aria-invalid={Boolean(fieldErrors?.[name])}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {["DNI", "LC", "LE", "CI", "PASSPORT"].map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={name}
                      name={name}
                      type={
                        name === "email"
                          ? "email"
                          : name === "phone"
                            ? "tel"
                            : "text"
                      }
                      defaultValue={value}
                      required={[
                        "firstName",
                        "lastName",
                        "documentNumber",
                        "licenseNumber",
                      ].includes(name)}
                      pattern={
                        name === "documentNumber"
                          ? documentFormat.pattern
                          : name === "licenseNumber"
                            ? "[0-9]{1,8}"
                            : undefined
                      }
                      maxLength={
                        name === "documentNumber"
                          ? documentFormat.maxLength
                          : name === "licenseNumber"
                            ? 8
                            : name === "firstName" || name === "lastName"
                              ? 100
                              : name === "phone"
                                ? 30
                                : name === "notes"
                                  ? 500
                                  : undefined
                      }
                      inputMode={
                        name === "documentNumber"
                          ? documentFormat.inputMode
                          : name === "licenseNumber"
                            ? "numeric"
                            : undefined
                      }
                      aria-invalid={Boolean(fieldErrors?.[name])}
                      aria-describedby={
                        name === "documentNumber"
                          ? "documentNumber-format"
                          : undefined
                      }
                    />
                  )}
                  {name === "documentNumber" && (
                    <p
                      id="documentNumber-format"
                      className="text-sm text-muted-foreground"
                    >
                      Formato: {documentFormat.hint}.
                    </p>
                  )}
                  {fieldErrors?.[name]?.[0] && (
                    <p className="text-destructive text-sm">
                      {fieldErrors[name][0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">Títulos profesionales</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {titles.map((title) => (
                  <label key={title.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="titleIds"
                      value={title.id}
                      defaultChecked={currentTitles.has(title.id)}
                    />
                    {title.name}
                  </label>
                ))}
              </div>
              {fieldErrors?.titleIds?.[0] && (
                <p className="text-destructive text-sm">
                  {fieldErrors.titleIds[0]}
                </p>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="font-medium">Servicios</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="serviceIds"
                      value={service.id}
                      defaultChecked={currentServices.has(service.id)}
                    />
                    {service.name} ({service.durationMinutes} min)
                  </label>
                ))}
              </div>
              {fieldErrors?.serviceIds?.[0] && (
                <p className="text-destructive text-sm">
                  {fieldErrors.serviceIds[0]}
                </p>
              )}
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="updateReason">Motivo de la modificación *</Label>
              <Input
                id="updateReason"
                name="reason"
                required
                maxLength={500}
                aria-invalid={Boolean(fieldErrors?.reason)}
              />
              {fieldErrors?.reason?.[0] && (
                <p className="text-destructive text-sm">
                  {fieldErrors.reason[0]}
                </p>
              )}
            </div>
            <Feedback state={updateState} />
            <div>
              <Submit>Guardar cambios</Submit>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{active ? "Dar de baja" : "Reactivar"}</CardTitle>
          <CardDescription>
            {active
              ? `Esta acción dejará a ${professional.firstName} ${professional.lastName} fuera de los turnos nuevos. Debés cancelar antes sus turnos programados.`
              : "La reactivación permite volver a asignar turnos cuando tenga disponibilidad."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active ? (
            <form action={deactivateAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={professional.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="deactivatedAt">Fecha de baja *</Label>
                <Input
                  id="deactivatedAt"
                  name="deactivatedAt"
                  type="date"
                  defaultValue={getTodayDateString()}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deactivateReason">Motivo *</Label>
                <Input
                  id="deactivateReason"
                  name="reason"
                  required
                  maxLength={500}
                />
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(event) => setConfirm(event.target.checked)}
                />
                Confirmo la baja de {professional.firstName}{" "}
                {professional.lastName}; dejará de recibir turnos nuevos.
              </label>
              <Feedback state={deactivateState} />
              <div className="flex gap-3">
                <DeactivateSubmit disabled={!confirm} />
                <Button asChild variant="outline">
                  <Link href="#future-appointments">
                    Ver turnos programados
                  </Link>
                </Button>
              </div>
            </form>
          ) : (
            <form action={reactivateAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={professional.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="reactivateReason">
                  Motivo de reactivación *
                </Label>
                <Input
                  id="reactivateReason"
                  name="reason"
                  required
                  maxLength={500}
                />
              </div>
              <Feedback state={reactivateState} />
              <div>
                <Submit>Reactivar profesional</Submit>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
