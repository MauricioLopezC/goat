"use client";

import { useState } from "react";
import { CheckCircle2, Edit2, Plus, PowerOff, RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PaymentMethodForm,
  type EditingPaymentMethod,
} from "./payment-method-form";
import { updatePaymentMethodAction, type PaymentMethodResult } from "./actions";

export interface PaymentMethodListItem {
  id: number;
  name: string;
  active: boolean;
}

interface PaymentMethodsManagerProps {
  methods: PaymentMethodListItem[];
  isManager: boolean;
}

// ─────────────── Botón de activar/desactivar ───────────────────────────

function ToggleSubmitButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending}
      className={
        active
          ? "text-destructive hover:bg-destructive-soft hover:text-destructive-soft-foreground"
          : "text-success hover:bg-success-soft hover:text-success-soft-foreground"
      }
    >
      {active ? (
        <>
          <PowerOff className="size-3.5 mr-1" />
          {pending ? "Desactivando…" : "Desactivar"}
        </>
      ) : (
        <>
          <RotateCcw className="size-3.5 mr-1" />
          {pending ? "Activando…" : "Activar"}
        </>
      )}
    </Button>
  );
}

function ToggleActiveButton({ method }: { method: PaymentMethodListItem }) {
  const [state, formAction] = useActionState<
    PaymentMethodResult | null,
    FormData
  >(updatePaymentMethodAction, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={method.id} />
        <input type="hidden" name="name" value={method.name} />
        {/* active se invierte: el botón actúa sobre el estado opuesto */}
        <input
          type="hidden"
          name="active"
          value={method.active ? "false" : "true"}
        />
        <ToggleSubmitButton active={method.active} />
      </form>
      {error && (
        <Alert variant="destructive" className="py-1 px-2 text-xs">
          <AlertCircle className="size-3 mr-1" />
          <AlertDescription className="text-xs">
            {error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─────────────── Componente principal ─────────────────────────────────

export function PaymentMethodsManager({
  methods,
  isManager,
}: PaymentMethodsManagerProps) {
  const [editingMethod, setEditingMethod] =
    useState<EditingPaymentMethod | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleEdit = (method: PaymentMethodListItem) => {
    setFeedback(null);
    setEditingMethod({
      id: method.id,
      name: method.name,
      active: method.active,
    });
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelForm = () => {
    setEditingMethod(null);
    setIsFormVisible(false);
  };

  const handleSuccess = (item: { name: string; isEditing: boolean }) => {
    setEditingMethod(null);
    setIsFormVisible(false);
    setFeedback(
      item.isEditing
        ? `Se actualizó el medio de pago "${item.name}".`
        : `Se agregó el medio de pago "${item.name}".`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner de confirmación global */}
      {feedback && (
        <Alert
          role="status"
          className="border-success-soft-border bg-success-soft text-success-soft-foreground"
        >
          <CheckCircle2 className="size-5 text-success" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{feedback}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFeedback(null)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Panel de formulario (exclusivo para MANAGER) */}
      {isManager && (
        <Card className="rounded-xl border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-headline-md">
                {editingMethod ? "Editar medio de pago" : "Nuevo medio de pago"}
              </CardTitle>
              <CardDescription>
                {editingMethod
                  ? `Modificando "${editingMethod.name}"`
                  : "Agregue un nuevo medio de pago aceptado por el centro."}
              </CardDescription>
            </div>
            {!isFormVisible && (
              <Button
                onClick={() => {
                  setFeedback(null);
                  setEditingMethod(null);
                  setIsFormVisible(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                Nuevo medio de pago
              </Button>
            )}
          </CardHeader>

          {isFormVisible && (
            <CardContent>
              <PaymentMethodForm
                key={editingMethod ? `edit-${editingMethod.id}` : "create"}
                editingMethod={editingMethod}
                onCancel={handleCancelForm}
                onSuccess={handleSuccess}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Tabla de medios de pago */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-headline-md">Medios de pago</CardTitle>
          <CardDescription>
            {methods.length === 1
              ? "1 medio de pago registrado."
              : `${methods.length} medios de pago registrados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                {isManager && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow
                  key={method.id}
                  className={method.active ? "" : "opacity-60 bg-tray/40"}
                >
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell>
                    {method.active ? (
                      <Badge
                        variant="outline"
                        className="border-success-soft-border bg-success-soft text-success-soft-foreground text-label-sm"
                      >
                        Activo
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-border bg-tray text-muted-foreground text-label-sm"
                      >
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(method)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-3.5 mr-1" />
                          Editar
                        </Button>
                        <ToggleActiveButton method={method} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
