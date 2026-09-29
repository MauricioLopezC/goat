export type ServiceOption = {
  id: number;
  name: string;
  durationMinutes: number;
  specialty: { id: number; name: string } | null;
};

export const NO_SPECIALTY_GROUP = "Sin especialidad";

/**
 * Normaliza texto eliminando diacríticos/tildes, espacios redundantes y pasando a minúsculas.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra servicios comparando la búsqueda contra el nombre del servicio o el de su especialidad.
 * Si la búsqueda está vacía o solo contiene espacios, devuelve todos los servicios.
 */
export function filterServices<T extends ServiceOption>(
  services: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return services;

  const words = normalizedQuery.split(/\s+/).filter(Boolean);

  return services.filter((service) => {
    const normalizedName = normalizeSearchText(service.name);
    const normalizedSpecialty = service.specialty
      ? normalizeSearchText(service.specialty.name)
      : "";

    return words.every(
      (word) =>
        normalizedName.includes(word) || normalizedSpecialty.includes(word),
    );
  });
}

export type ServiceGroup<T extends ServiceOption = ServiceOption> = {
  specialtyName: string;
  services: T[];
};

/**
 * Agrupa los servicios por especialidad.
 * Las especialidades y los servicios dentro de cada grupo se ordenan según es-AR.
 */
export function groupServicesBySpecialty<T extends ServiceOption>(
  services: T[],
): ServiceGroup<T>[] {
  const groupsMap = new Map<string, T[]>();

  for (const service of services) {
    const groupKey = service.specialty?.name ?? NO_SPECIALTY_GROUP;
    const existing = groupsMap.get(groupKey);
    if (existing) {
      existing.push(service);
    } else {
      groupsMap.set(groupKey, [service]);
    }
  }

  for (const groupServices of groupsMap.values()) {
    groupServices.sort((a, b) =>
      a.name.localeCompare(b.name, "es-AR", { sensitivity: "base" }),
    );
  }

  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) =>
    a.localeCompare(b, "es-AR", { sensitivity: "base" }),
  );

  return sortedKeys.map((key) => ({
    specialtyName: key,
    services: groupsMap.get(key)!,
  }));
}
