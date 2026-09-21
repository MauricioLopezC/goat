import type { Metadata } from "next";
import { listUsers, requirePageRole } from "@/lib/dal/auth";
import { ROLE_LABEL } from "@/lib/roles";
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
import { UserForm } from "./user-form";

export const metadata: Metadata = {
  title: "Usuarios · Goat",
};

export default async function UsersPage() {
  // Solo el gerente crea usuarios y asigna roles (HU-01).
  await requirePageRole("MANAGER");
  const users = await listUsers();

  return (
    <>
      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="text-headline-md">Nuevo usuario</CardTitle>
          <CardDescription>
            La contraseña inicial la elegís vos y se la das a la persona. No hay
            recuperación de contraseña: si la pierde, se la volvés a cargar acá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="text-headline-md">
            Usuarios del centro
          </CardTitle>
          <CardDescription>
            {users.length === 1
              ? "1 usuario."
              : `${users.length} usuarios, los inactivos al final.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.active ? "" : "opacity-60"}
                >
                  <TableCell className="font-medium">
                    {user.lastName}, {user.firstName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>{ROLE_LABEL[user.role]}</TableCell>
                  <TableCell>
                    <span
                      className={
                        user.active
                          ? "border-success-soft-border bg-success-soft text-success-soft-foreground text-label-sm inline-flex rounded-lg border px-2 py-1 uppercase"
                          : "border-border bg-tray text-muted-foreground text-label-sm inline-flex rounded-lg border px-2 py-1 uppercase"
                      }
                    >
                      {user.active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
