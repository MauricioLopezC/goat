import type { Metadata } from "next";
import { listUsers, requirePageRole } from "@/lib/dal/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { parsePageParam } from "@/lib/pagination";
import { ListPagination } from "@/components/list-pagination";
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

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  // Solo el gerente crea usuarios y asigna roles (HU-01). La página redirige a
  // otro rol; `listUsers` vuelve a verificarlo por su cuenta.
  const actor = await requirePageRole("MANAGER");
  const { page } = await searchParams;
  const usersPage = await listUsers(parsePageParam(page), actor);
  const users = usersPage.items;

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
            {usersPage.total === 1
              ? "1 usuario."
              : `${usersPage.total} usuarios, los inactivos al final.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          <ListPagination
            page={usersPage}
            pathname="/users"
            label="Páginas de usuarios"
          />
        </CardContent>
      </Card>
    </>
  );
}
