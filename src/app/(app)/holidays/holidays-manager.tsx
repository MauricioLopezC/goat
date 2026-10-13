"use client";

import type { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMinute } from "@/lib/schedule";
import { deleteHoliday } from "./actions";
import { CloseCenterForm } from "./close-center-form";

type Holiday = {
  id: number;
  startDate?: string;
  endDate?: string;
  startMinute?: number | null;
  endMinute?: number | null;
  date: string;
  description: string;
};

function formatHolidayPeriod(holiday: Holiday) {
  const start = holiday.startDate ?? holiday.date;
  const end = holiday.endDate ?? holiday.date;
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} al ${formatDate(end)}`;
}

function formatHolidayHours(holiday: Holiday) {
  return holiday.startMinute === null ||
    holiday.endMinute === null ||
    holiday.startMinute === undefined ||
    holiday.endMinute === undefined
    ? "Día completo"
    : `${formatMinute(holiday.startMinute)}–${formatMinute(holiday.endMinute)}`;
}

/// Cierres del centro de hoy en adelante, por feriado o día excepcional
/// (HU-05, HU-14, HU-23). `MANAGER` y `RECEPTIONIST` los cargan y quitan.
/// `holidays` es la página visible; `pagination`, su pie ya armado.
export function HolidaysManager({
  holidays,
  canEdit,
  pagination,
}: {
  holidays: Holiday[];
  canEdit: boolean;
  pagination: ReactNode;
}) {
  return (
    <>
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Cerrar el centro</CardTitle>
          </CardHeader>
          <CardContent>
            <CloseCenterForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Próximos cierres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {holidays.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay cierres cargados de hoy en adelante.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Descripción</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => {
                  const periodLabel = formatHolidayPeriod(holiday);
                  const hoursLabel = formatHolidayHours(holiday);
                  return (
                    <TableRow key={holiday.id}>
                      <TableCell className="capitalize tabular-nums">
                        {periodLabel}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {hoursLabel}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {holiday.description}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <ConfirmDelete
                            action={deleteHoliday}
                            fields={{ id: holiday.id }}
                            title="Quitar cierre"
                            confirmLabel="Quitar cierre"
                            trigger={
                              <Button type="button" variant="outline" size="sm">
                                <CalendarCheck data-icon="inline-start" />
                                Quitar cierre
                              </Button>
                            }
                            description={`Durante ${periodLabel} (${hoursLabel.toLowerCase()}) el centro vuelve a ofrecer turnos según las franjas de cada profesional.`}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {pagination}
        </CardContent>
      </Card>
    </>
  );
}
