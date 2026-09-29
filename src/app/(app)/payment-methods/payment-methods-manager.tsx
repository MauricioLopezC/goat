"use client";

import { useState, useEffect, useActionState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Plus,
  PowerOff,
  RotateCcw,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

function ToggleSubmitButton({
  active,
  disabled,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending || disabled}
      title={title}
      className={
        active
          ? "text-destructive hover:bg-destructive-soft hover:text-destructive-soft-foreground disabled:opacity-50"
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

function ToggleActiveButton({
  method,
  isLastActive,
  onError,
  onSuccess,
}: {
  method: PaymentMethodListItem;
  isLastActive: boolean;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [state, formAction] = useActionState<
    PaymentMethodResult | null,
    FormData
  >(updatePaymentMethodAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      onSuccess(
        state.data.active
          ? `Se activó el medio de pago "${state.data.name}".`
          : `Se desactivó el medio de pago "${state.data.name}".`,
      );
    } else {
      onError(state.error.message);
    }
  }, [state, onError, onSuccess]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={method.id} />
      <input type="hidden" name="name" value={method.name} />
      {/* active se invierte: el botón actúa sobre el estado opuesto */}
      <input
        type="hidden"
        name="active"
        value={method.active ? "false" : "true"}
      />
      <ToggleSubmitButton
        active={method.active}
        disabled={isLastActive}
        title={
          isLastActive
            ? "No se puede desactivar el único medio de pago activo"
            : undefined
        }
      />
    </form>
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeCount = methods.filter((m) => m.active).length;

  const handleEdit = (method: PaymentMethodListItem) => {
    setFeedback(null);
    setErrorMessage(null);
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
    setErrorMessage(null);
    setFeedback(
      item.isEditing
        ? `Se actualizó el medio de pago "${item.name}".`
        : `Se agregó el medio de pago "${item.name}".`,
    );
  };

  const handleToggleError = (message: string) => {
    setFeedback(null);
    setErrorMessage(message);
  };

  const handleToggleSuccess = (message: string) => {
    setErrorMessage(null);
    setFeedback(message);
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

      {/* Banner de error global */}
      {errorMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-5" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{errorMessage}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setErrorMessage(null)}
              className="h-7 px-2 text-xs hover:bg-destructive/10"
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
                  setErrorMessage(null);
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
                        <ToggleActiveButton
                          method={method}
                          isLastActive={method.active && activeCount <= 1}
                          onError={handleToggleError}
                          onSuccess={handleToggleSuccess}
                        />
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
