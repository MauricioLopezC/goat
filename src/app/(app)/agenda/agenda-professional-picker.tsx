import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export interface ProfessionalPickerOption {
  id: number;
  firstName: string;
  lastName: string;
  titles?: Array<{ name: string }> | null;
}

export function AgendaProfessionalPicker({
  professionals,
  date,
  view,
}: {
  professionals: ProfessionalPickerOption[];
  date?: string;
  view?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg">Agenda de profesionales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consultá los turnos y la disponibilidad de cualquier profesional del
          centro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar profesional</CardTitle>
          <CardDescription>
            Elegí un profesional para acceder a su agenda completa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/agenda" method="GET" className="flex flex-col gap-4">
            {date && <input type="hidden" name="date" value={date} />}
            {view && <input type="hidden" name="view" value={view} />}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="professionalId">Profesional</FieldLabel>
                <NativeSelect
                  id="professionalId"
                  name="professionalId"
                  required
                  defaultValue={professionals[0]?.id ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="" disabled>
                    Elegí un profesional...
                  </NativeSelectOption>
                  {professionals.map((p) => {
                    const titlesStr = p.titles?.map((t) => t.name).join(", ");
                    return (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.lastName}, {p.firstName}
                        {titlesStr ? ` (${titlesStr})` : ""}
                      </NativeSelectOption>
                    );
                  })}
                </NativeSelect>
              </Field>
            </FieldGroup>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="submit">Ver agenda</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
