"use client";

import { useState } from "react";
import { CheckCircle2, Edit2, Plus } from "lucide-react";
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
import { ServiceForm, type EditingService } from "./service-form";
import {
  DeactivateServiceButton,
  ActivateServiceButton,
} from "./deactivate-button";

interface SpecialtyOption {
  id: number;
  name: string;
}

export interface ServiceListItem {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  requiresReferral: boolean;
  active: boolean;
  specialtyId: number | null;
  specialty: {
    id: number;
    name: string;
  } | null;
}

interface ServicesManagerProps {
  services: ServiceListItem[];
  specialties: SpecialtyOption[];
  isManager: boolean;
}

export function ServicesManager({
  services,
  specialties,
  isManager,
}: ServicesManagerProps) {
  const [editingService, setEditingService] = useState<EditingService | null>(
    null,
  );
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleEdit = (service: ServiceListItem) => {
    setFeedback(null);
    setEditingService({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      requiresReferral: service.requiresReferral,
      description: service.description,
      specialtyId: service.specialtyId,
    });
    setIsFormVisible(true);
    // Scroll suave hacia el formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelForm = () => {
    setEditingService(null);
    setIsFormVisible(false);
  };

  const handleSuccess = (item: { name: string; isEditing: boolean }) => {
    setEditingService(null);
    setIsFormVisible(false);
    setFeedback(
      item.isEditing
        ? `Se actualizaron correctamente los datos del servicio "${item.name}".`
        : `Se creó exitosamente el servicio "${item.name}".`,
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
                {editingService ? "Editar servicio" : "Nuevo servicio"}
              </CardTitle>
              <CardDescription>
                {editingService
                  ? `Modificando los parámetros del servicio #${editingService.id}`
                  : "Defina las prestaciones habilitadas para turnos en el policonsultorio (HU-06)."}
              </CardDescription>
            </div>
            {!isFormVisible && (
              <Button
                onClick={() => {
                  setFeedback(null);
                  setEditingService(null);
                  setIsFormVisible(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" />
                Nuevo servicio
              </Button>
            )}
          </CardHeader>

          {isFormVisible && (
            <CardContent>
              <ServiceForm
                key={editingService ? `edit-${editingService.id}` : "create"}
                specialties={specialties}
                editingService={editingService}
                onCancel={handleCancelForm}
                onSuccess={handleSuccess}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Tabla del catálogo */}
      <Card className="rounded-xl border-border bg-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-headline-md">
            Catálogo de prestaciones
          </CardTitle>
          <CardDescription>
            {services.length === 1
              ? "1 servicio registrado."
              : `${services.length} servicios registrados en el centro.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestación</TableHead>
                <TableHead>Área / Especialidad</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Orden médica</TableHead>
                <TableHead>Estado</TableHead>
                {isManager && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow
                  key={service.id}
                  className={service.active ? "" : "opacity-60 bg-tray/40"}
                >
                  <TableCell className="font-medium">
                    <div>
                      <span className="font-semibold text-foreground">
                        {service.name}
                      </span>
                      {service.description && (
                        <p className="text-body-sm text-muted-foreground line-clamp-1">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {service.specialty ? (
                      <Badge
                        variant="secondary"
                        className="bg-info-soft text-info-soft-foreground border-info-soft-border text-label-sm"
                      >
                        {service.specialty.name}
                      </Badge>
                    ) : (
                      <span className="text-label-sm text-muted-foreground">
                        General
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-body-sm font-mono font-medium">
                      {service.durationMinutes} min
                    </span>
                  </TableCell>
                  <TableCell>
                    {service.requiresReferral ? (
                      <Badge
                        variant="outline"
                        className="border-warning-soft-border bg-warning-soft text-warning-soft-foreground text-label-sm"
                      >
                        Requiere orden
                      </Badge>
                    ) : (
                      <span className="text-body-sm text-muted-foreground">
                        No requiere
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        service.active
                          ? "border-success-soft-border bg-success-soft text-success-soft-foreground text-label-sm inline-flex rounded-lg border px-2 py-1 uppercase"
                          : "border-border bg-tray text-muted-foreground text-label-sm inline-flex rounded-lg border px-2 py-1 uppercase"
                      }
                    >
                      {service.active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(service)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-3.5 mr-1" />
                          Editar
                        </Button>
                        {service.active ? (
                          <DeactivateServiceButton
                            serviceId={service.id}
                            serviceName={service.name}
                          />
                        ) : (
                          <ActivateServiceButton
                            serviceId={service.id}
                            serviceName={service.name}
                          />
                        )}
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
