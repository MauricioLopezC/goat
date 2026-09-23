// Datos del seed (`prisma/seed.ts`). Solo datos: la lógica vive en el seed.
//
// Son fijos y escritos a mano para que la demo sea reproducible. El centro
// está en Salta: teléfonos con característica 387 y obras sociales de la zona.
// Todo pasa las mismas validaciones que la UI (`src/lib/validation/`).
//
// Los emails de personas usan el dominio reservado `example.com`, para no
// apuntar a casillas reales.

import {
  DocumentType,
  Gender,
  Role,
  Weekday,
} from "../src/generated/prisma/enums";

// ───────────────────────────── Usuarios ──────────────────────────────

export const SEED_USERS = [
  {
    email: "gerente@goat.local",
    firstName: "Laura",
    lastName: "Gómez",
    role: Role.MANAGER,
    active: true,
  },
  {
    email: "mesa@goat.local",
    firstName: "Marcos",
    lastName: "Díaz",
    role: Role.RECEPTIONIST,
    active: true,
  },
  {
    email: "mesa2@goat.local",
    firstName: "Carla",
    lastName: "Vargas",
    role: Role.RECEPTIONIST,
    active: true,
  },
  {
    email: "profesional@goat.local",
    firstName: "Julia",
    lastName: "Ferrari",
    role: Role.PROFESSIONAL,
    active: true,
  },
  {
    email: "rarias@goat.local",
    firstName: "Ricardo",
    lastName: "Arias",
    role: Role.PROFESSIONAL,
    active: true,
  },
  {
    email: "lzerpa@goat.local",
    firstName: "Lucía",
    lastName: "Zerpa",
    role: Role.PROFESSIONAL,
    active: true,
  },
  // Inactivo: para probar que el login lo rechaza (HU-01).
  {
    email: "exmesa@goat.local",
    firstName: "Paula",
    lastName: "Ibarra",
    role: Role.RECEPTIONIST,
    active: false,
  },
];

export const MANAGER_EMAIL = "gerente@goat.local";

// ─────────────────────── Catálogos del centro ────────────────────────

export const TITLES = [
  { name: "Médico Traumatólogo", active: true },
  { name: "Licenciado en Kinesiología y Fisiatría", active: true },
  { name: "Médico Cirujano Ortopédico", active: true },
  // Inactivo: el centro ya no tiene terapista ocupacional.
  { name: "Licenciado en Terapia Ocupacional", active: false },
];

export const SPECIALTIES = [
  { name: "Columna", active: true },
  { name: "Rodilla", active: true },
  { name: "Hombro y codo", active: true },
  { name: "Mano y muñeca", active: true },
  { name: "Cadera", active: true },
  { name: "Tobillo y pie", active: true },
  { name: "Traumatología infantil", active: true },
  { name: "Traumatología deportiva", active: true },
  { name: "Kinesiología y rehabilitación", active: true },
  { name: "Medicina del dolor", active: false },
];

/// `price` queda en null: en el Inc. 1 no se cobra.
export const SERVICES: {
  name: string;
  description: string;
  durationMinutes: number;
  requiresReferral: boolean;
  specialty: string | null;
  active: boolean;
}[] = [
  {
    name: "Consulta traumatológica general",
    description: "Primera consulta o seguimiento con el traumatólogo.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: null,
    active: true,
  },
  {
    name: "Consulta de columna",
    description: "Lumbalgia, cervicalgia, hernia de disco y escoliosis.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: "Columna",
    active: true,
  },
  {
    name: "Consulta de rodilla",
    description: "Lesiones meniscales, ligamentarias y artrosis de rodilla.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: "Rodilla",
    active: true,
  },
  {
    name: "Consulta de traumatología infantil",
    description: "Pacientes de 0 a 15 años, siempre con un adulto responsable.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: "Traumatología infantil",
    active: true,
  },
  {
    name: "Control post-quirúrgico",
    description: "Control de la evolución después de una cirugía.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: null,
    active: true,
  },
  {
    name: "Curación y retiro de puntos",
    description: "Curación de heridas quirúrgicas y retiro de suturas.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: null,
    active: true,
  },
  {
    name: "Colocación y retiro de yeso",
    description: "Inmovilización con yeso o férula, y su retiro.",
    durationMinutes: 30,
    requiresReferral: false,
    specialty: null,
    active: true,
  },
  {
    name: "Infiltración articular",
    description: "Infiltración con corticoides o ácido hialurónico.",
    durationMinutes: 30,
    requiresReferral: true,
    specialty: null,
    active: true,
  },
  {
    name: "Ondas de choque",
    description: "Tendinopatías y fascitis plantar. Se indica por sesiones.",
    durationMinutes: 30,
    requiresReferral: true,
    specialty: "Traumatología deportiva",
    active: true,
  },
  {
    name: "Evaluación kinesiológica inicial",
    description: "Evaluación funcional y plan de tratamiento kinésico.",
    durationMinutes: 60,
    requiresReferral: true,
    specialty: "Kinesiología y rehabilitación",
    active: true,
  },
  {
    name: "Sesión de kinesiología motora",
    description: "Sesión de tratamiento dentro de un plan kinésico.",
    durationMinutes: 30,
    requiresReferral: true,
    specialty: "Kinesiología y rehabilitación",
    active: true,
  },
  {
    name: "Rehabilitación deportiva",
    description: "Readaptación al deporte después de una lesión.",
    durationMinutes: 60,
    requiresReferral: true,
    specialty: "Traumatología deportiva",
    active: true,
  },
  // Inactivo: para probar la reactivación (HU-06).
  {
    name: "Magnetoterapia",
    description: "Se dejó de ofrecer al retirar el equipo.",
    durationMinutes: 30,
    requiresReferral: true,
    specialty: "Kinesiología y rehabilitación",
    active: false,
  },
];

// ─────────────────────────── Profesionales ───────────────────────────

const TRAUMATOLOGIST = "Médico Traumatólogo";
const KINESIOLOGIST = "Licenciado en Kinesiología y Fisiatría";
const ORTHOPEDIC_SURGEON = "Médico Cirujano Ortopédico";

export type SeedProfessional = {
  lastName: string;
  firstName: string;
  documentType: DocumentType;
  documentNumber: string;
  licenseNumber: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  titles: string[];
  services: string[];
  /// Email del usuario con el que ingresa, si tiene cuenta.
  userEmail: string | null;
  /// Baja lógica (HU-03), si corresponde. `date` en AAAA-MM-DD.
  deactivation: { date: string; reason: string } | null;
};

export const PROFESSIONALS: SeedProfessional[] = [
  {
    lastName: "Ferrari",
    firstName: "Julia",
    documentType: DocumentType.DNI,
    documentNumber: "27845123",
    licenseNumber: "4521",
    phone: "387 431-2210",
    email: "julia.ferrari@example.com",
    notes: "Rodilla y artroscopía.",
    titles: [TRAUMATOLOGIST],
    services: [
      "Consulta traumatológica general",
      "Consulta de rodilla",
      "Control post-quirúrgico",
      "Infiltración articular",
    ],
    userEmail: "profesional@goat.local",
    deactivation: null,
  },
  {
    lastName: "Arias",
    firstName: "Ricardo Martín",
    documentType: DocumentType.DNI,
    documentNumber: "20456789",
    licenseNumber: "2873",
    phone: "387 422-8765",
    email: "ricardo.arias@example.com",
    notes: "Patología de columna. Cirugías programadas los viernes.",
    titles: [TRAUMATOLOGIST, ORTHOPEDIC_SURGEON],
    services: [
      "Consulta traumatológica general",
      "Consulta de columna",
      "Control post-quirúrgico",
      "Infiltración articular",
    ],
    userEmail: "rarias@goat.local",
    deactivation: null,
  },
  {
    lastName: "Tolaba",
    firstName: "Gabriela",
    documentType: DocumentType.DNI,
    documentNumber: "30987654",
    licenseNumber: "5610",
    phone: "387 154-6632",
    email: "gabriela.tolaba@example.com",
    notes: null,
    titles: [TRAUMATOLOGIST],
    services: [
      "Consulta traumatológica general",
      "Consulta de traumatología infantil",
      "Colocación y retiro de yeso",
    ],
    userEmail: null,
    deactivation: null,
  },
  {
    lastName: "Cruz",
    firstName: "Martín Ignacio",
    documentType: DocumentType.DNI,
    documentNumber: "33214567",
    licenseNumber: "6344",
    phone: "387 155-0921",
    email: "martin.cruz@example.com",
    notes: "Médico de planta de un club de rugby local.",
    titles: [TRAUMATOLOGIST],
    services: [
      "Consulta traumatológica general",
      "Ondas de choque",
      "Infiltración articular",
    ],
    userEmail: null,
    deactivation: null,
  },
  {
    lastName: "Saravia",
    firstName: "Fernando José",
    documentType: DocumentType.DNI,
    documentNumber: "23654789",
    licenseNumber: "3312",
    phone: "387 421-3398",
    email: null,
    notes: null,
    titles: [ORTHOPEDIC_SURGEON, TRAUMATOLOGIST],
    services: [
      "Consulta traumatológica general",
      "Control post-quirúrgico",
      "Curación y retiro de puntos",
      "Colocación y retiro de yeso",
    ],
    userEmail: null,
    deactivation: null,
  },
  {
    lastName: "Zerpa",
    firstName: "Lucía",
    documentType: DocumentType.DNI,
    documentNumber: "36547891",
    licenseNumber: "8120",
    phone: "387 156-4410",
    email: "lucia.zerpa@example.com",
    notes: null,
    titles: [KINESIOLOGIST],
    services: [
      "Evaluación kinesiológica inicial",
      "Sesión de kinesiología motora",
      "Rehabilitación deportiva",
    ],
    userEmail: "lzerpa@goat.local",
    deactivation: null,
  },
  {
    lastName: "Guzmán",
    firstName: "Diego Alejandro",
    documentType: DocumentType.DNI,
    documentNumber: "34120987",
    licenseNumber: "7985",
    phone: "387 154-7789",
    email: "diego.guzman@example.com",
    notes: null,
    titles: [KINESIOLOGIST],
    services: [
      "Evaluación kinesiológica inicial",
      "Sesión de kinesiología motora",
    ],
    userEmail: null,
    deactivation: null,
  },
  {
    lastName: "Colmenares",
    firstName: "Andrea Carolina",
    documentType: DocumentType.PASSPORT,
    documentNumber: "154872369",
    licenseNumber: "9054",
    phone: "+54 9 387 512-3344",
    email: "andrea.colmenares@example.com",
    notes: "Título revalidado en Argentina.",
    titles: [KINESIOLOGIST],
    services: ["Sesión de kinesiología motora", "Rehabilitación deportiva"],
    userEmail: null,
    deactivation: null,
  },
  // Dado de baja: para ver un inactivo en el listado (HU-03).
  {
    lastName: "Lamas",
    firstName: "Hugo Ernesto",
    documentType: DocumentType.DNI,
    documentNumber: "11456123",
    licenseNumber: "1187",
    phone: "387 431-0045",
    email: null,
    notes: null,
    titles: [TRAUMATOLOGIST],
    services: ["Consulta traumatológica general", "Consulta de columna"],
    userEmail: null,
    deactivation: { date: "2026-06-30", reason: "Se jubiló." },
  },
];

// ──────────────────────────── Agenda (HU-05) ──────────────────────────

/// Consultorios. En el Inc. 1 cada profesional atiende en el suyo.
export const ROOMS = [
  { name: "Consultorio 1" },
  { name: "Consultorio 2" },
  { name: "Consultorio 3" },
  { name: "Consultorio 4" },
  { name: "Consultorio 5" },
  { name: "Gimnasio de kinesiología" },
  { name: "Box de kinesiología" },
];

export type SeedWindow = {
  weekday: Weekday;
  /// `HH:MM`, como en el formulario.
  startTime: string;
  endTime: string;
  room: string | null;
  /// Servicios habilitados. Vacío: todos los del profesional.
  services: string[];
};

const { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY } = Weekday;

function weekly(
  weekdays: Weekday[],
  startTime: string,
  endTime: string,
  room: string,
  services: string[] = [],
): SeedWindow[] {
  return weekdays.map((weekday) => ({
    weekday,
    startTime,
    endTime,
    room,
    services,
  }));
}

/// Franjas por matrícula del profesional. Lamas (inactivo) no tiene.
export const AVAILABILITY: Record<string, SeedWindow[]> = {
  // Ferrari: dos franjas el mismo día (lunes) y una restringida a rodilla.
  "4521": [
    ...weekly([MONDAY, WEDNESDAY], "09:00", "13:00", "Consultorio 1"),
    ...weekly([MONDAY], "16:00", "20:00", "Consultorio 1"),
    ...weekly([THURSDAY], "16:00", "19:00", "Consultorio 1", [
      "Consulta de rodilla",
      "Infiltración articular",
    ]),
  ],
  // Arias opera los viernes: no atiende en consultorio.
  "2873": weekly([TUESDAY, THURSDAY], "08:00", "12:00", "Consultorio 2"),
  "5610": weekly(
    [MONDAY, WEDNESDAY, FRIDAY],
    "14:00",
    "18:00",
    "Consultorio 3",
  ),
  "6344": [
    ...weekly([TUESDAY], "17:00", "21:00", "Consultorio 4"),
    ...weekly([SATURDAY], "09:00", "12:00", "Consultorio 4"),
  ],
  "3312": weekly([MONDAY, THURSDAY], "09:00", "13:00", "Consultorio 5"),
  "8120": weekly(
    [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],
    "08:00",
    "12:00",
    "Gimnasio de kinesiología",
  ),
  "7985": weekly(
    [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],
    "15:00",
    "19:00",
    "Gimnasio de kinesiología",
  ),
  "9054": weekly([TUESDAY, THURSDAY], "10:00", "14:00", "Box de kinesiología"),
};

/// Feriados nacionales desde el alta del seed hasta el primer trimestre de
/// 2027, con los trasladables ya movidos (Ley 27.399). Datos de prueba: el
/// calendario oficial lo fija cada año un decreto.
export const HOLIDAYS = [
  {
    date: "2026-10-12",
    description: "Día del Respeto a la Diversidad Cultural",
  },
  { date: "2026-11-23", description: "Día de la Soberanía Nacional" },
  { date: "2026-12-08", description: "Inmaculada Concepción de María" },
  { date: "2026-12-25", description: "Navidad" },
  { date: "2027-01-01", description: "Año Nuevo" },
  { date: "2027-02-08", description: "Carnaval" },
  { date: "2027-02-09", description: "Carnaval" },
  {
    date: "2027-03-24",
    description: "Día Nacional de la Memoria por la Verdad y la Justicia",
  },
  { date: "2027-03-26", description: "Viernes Santo" },
];

// ────────────────────── Obras sociales y planes ──────────────────────

export const HEALTH_INSURERS: {
  name: string;
  active: boolean;
  plans: { name: string; active: boolean }[];
}[] = [
  {
    name: "IPS Salud",
    active: true,
    plans: [
      { name: "Afiliado obligatorio", active: true },
      { name: "Afiliado voluntario", active: true },
    ],
  },
  {
    name: "OSDE",
    active: true,
    plans: [
      { name: "210", active: true },
      { name: "310", active: true },
      { name: "410", active: true },
      { name: "510", active: true },
    ],
  },
  {
    name: "Swiss Medical",
    active: true,
    plans: [
      { name: "SMG02", active: false },
      { name: "SMG20", active: true },
      { name: "SMG30", active: true },
      { name: "SMG40", active: true },
    ],
  },
  {
    name: "Galeno",
    active: true,
    plans: [
      { name: "Azul 220", active: true },
      { name: "Plata 330", active: true },
      { name: "Oro 440", active: true },
    ],
  },
  {
    name: "Sancor Salud",
    active: true,
    plans: [
      { name: "1000", active: true },
      { name: "2000", active: true },
      { name: "3000", active: true },
    ],
  },
  {
    name: "PAMI",
    active: true,
    plans: [{ name: "Único", active: true }],
  },
  {
    name: "OSECAC",
    active: true,
    plans: [{ name: "Obligatorio", active: true }],
  },
  {
    name: "Medifé",
    active: true,
    plans: [
      { name: "Bronce", active: true },
      { name: "Plata", active: true },
      { name: "Oro", active: true },
    ],
  },
  // Inactiva: el centro dio de baja el convenio. No debe aparecer al elegir.
  {
    name: "OSPRERA",
    active: false,
    plans: [{ name: "Obligatorio", active: true }],
  },
];

// ───────────────────────────── Pacientes ─────────────────────────────

export type SeedPatient = {
  lastName: string;
  firstName: string;
  gender: Gender;
  documentType: DocumentType;
  documentNumber: string;
  /// AAAA-MM-DD, como lo recibe `createPatient`.
  birthDate: string;
  phone: string;
  email: string;
  /// null = particular.
  coverage: { insurer: string; plan: string; memberNumber: string } | null;
  /// Obligatorio para menores de 16 años.
  guardian: { name: string; phone: string } | null;
  /// Email del usuario que lo registró.
  createdBy: string;
};

const MESA = "mesa@goat.local";
const MESA2 = "mesa2@goat.local";

export const PATIENTS: SeedPatient[] = [
  {
    lastName: "Guaymás",
    firstName: "María Eugenia",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "28456123",
    birthDate: "1980-05-14",
    phone: "3874123456",
    email: "maria.guaymas@example.com",
    coverage: { insurer: "OSDE", plan: "310", memberNumber: "61 284561 2 01" },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Mamaní",
    firstName: "Rubén Darío",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "22134987",
    birthDate: "1971-11-02",
    phone: "3875234871",
    email: "ruben.mamani@example.com",
    coverage: {
      insurer: "IPS Salud",
      plan: "Afiliado obligatorio",
      memberNumber: "0221349870",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Choque",
    firstName: "Elena",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "35678210",
    birthDate: "1990-08-21",
    phone: "+5493874561230",
    email: "elena.choque@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Tolaba",
    firstName: "Sergio Andrés",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "31245678",
    birthDate: "1985-02-09",
    phone: "3874789012",
    email: "sergio.tolaba@example.com",
    coverage: {
      insurer: "Swiss Medical",
      plan: "SMG30",
      memberNumber: "80002 312456 00",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Vilte",
    firstName: "Rosa Beatriz",
    gender: Gender.FEMALE,
    documentType: DocumentType.LC,
    documentNumber: "4789123",
    birthDate: "1944-06-30",
    phone: "3874215567",
    email: "rosa.vilte@example.com",
    coverage: {
      insurer: "PAMI",
      plan: "Único",
      memberNumber: "15047891230 00",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Quispe Condori",
    firstName: "Juan Carlos",
    gender: Gender.MALE,
    documentType: DocumentType.PASSPORT,
    documentNumber: "C4587213",
    birthDate: "1988-03-17",
    phone: "+59171234567",
    email: "juan.quispe@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Chocobar",
    firstName: "Luis Alberto",
    gender: Gender.MALE,
    documentType: DocumentType.LE,
    documentNumber: "7654321",
    birthDate: "1948-09-12",
    phone: "3874310098",
    email: "luis.chocobar@example.com",
    coverage: {
      insurer: "PAMI",
      plan: "Único",
      memberNumber: "15076543210 00",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Aramayo",
    firstName: "Florencia",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "42567891",
    birthDate: "2000-01-25",
    phone: "3875098123",
    email: "florencia.aramayo@example.com",
    coverage: {
      insurer: "Galeno",
      plan: "Plata 330",
      memberNumber: "425678910 01",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Liendro",
    firstName: "Matías",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "38912345",
    birthDate: "1995-07-04",
    phone: "3876123987",
    email: "matias.liendro@example.com",
    coverage: {
      insurer: "Sancor Salud",
      plan: "2000",
      memberNumber: "38912345/01",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Figueroa",
    firstName: "Ana Laura",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "33456789",
    birthDate: "1988-12-01",
    phone: "3874567812",
    email: "ana.figueroa@example.com",
    coverage: {
      insurer: "Medifé",
      plan: "Plata",
      memberNumber: "334567890",
    },
    guardian: null,
    createdBy: MESA,
  },
  // Menores de 16: el tutor es obligatorio (HU-07).
  {
    lastName: "Cruz",
    firstName: "Tomás",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "55123456",
    birthDate: "2015-04-18",
    phone: "3874987654",
    email: "veronica.cruz@example.com",
    coverage: { insurer: "OSDE", plan: "210", memberNumber: "61 551234 5 03" },
    guardian: { name: "Verónica Cruz", phone: "3874987654" },
    createdBy: MESA,
  },
  {
    lastName: "Mamaní",
    firstName: "Sofía Belén",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "57345678",
    birthDate: "2018-10-03",
    phone: "3875234871",
    email: "ruben.mamani@example.com",
    coverage: {
      insurer: "IPS Salud",
      plan: "Afiliado obligatorio",
      memberNumber: "0221349872",
    },
    guardian: { name: "Rubén Darío Mamaní", phone: "3875234871" },
    createdBy: MESA2,
  },
  {
    lastName: "Flores",
    firstName: "Benjamín",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "53987654",
    birthDate: "2013-06-22",
    phone: "3876011223",
    email: "carolina.rios@example.com",
    coverage: null,
    guardian: { name: "Carolina Ríos", phone: "3876011223" },
    createdBy: MESA,
  },
  {
    lastName: "Gutiérrez",
    firstName: "Valentina",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "56234512",
    birthDate: "2016-12-11",
    phone: "+5493875443322",
    email: "pablo.gutierrez@example.com",
    coverage: {
      insurer: "Swiss Medical",
      plan: "SMG20",
      memberNumber: "80002 562345 02",
    },
    guardian: { name: "Pablo Gutiérrez", phone: "+5493875443322" },
    createdBy: MESA,
  },
  {
    lastName: "Romero",
    firstName: "Joaquín",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "52876543",
    birthDate: "2012-02-28",
    phone: "3874665544",
    email: "andrea.morales@example.com",
    coverage: {
      insurer: "Sancor Salud",
      plan: "1000",
      memberNumber: "52876543/02",
    },
    guardian: { name: "Andrea Morales", phone: "3874665544" },
    createdBy: MESA2,
  },
  // 16 años recién cumplidos: ya no necesita tutor (borde de la regla).
  {
    lastName: "Ontiveros",
    firstName: "Lucas Ezequiel",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "50123987",
    birthDate: "2010-03-15",
    phone: "3875876543",
    email: "lucas.ontiveros@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Cardozo",
    firstName: "Ramón Esteban",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "13456789",
    birthDate: "1959-08-07",
    phone: "3874223311",
    email: "ramon.cardozo@example.com",
    coverage: {
      insurer: "OSECAC",
      plan: "Obligatorio",
      memberNumber: "134567890/00",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Saravia",
    firstName: "Gloria Inés",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "11987654",
    birthDate: "1955-04-23",
    phone: "3874319876",
    email: "gloria.saravia@example.com",
    coverage: {
      insurer: "PAMI",
      plan: "Único",
      memberNumber: "15119876540 00",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "López",
    firstName: "Nicolás",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "40123456",
    birthDate: "1997-09-30",
    phone: "3876234590",
    email: "nicolas.lopez@example.com",
    coverage: {
      insurer: "Swiss Medical",
      plan: "SMG40",
      memberNumber: "80002 401234 00",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Rodríguez",
    firstName: "Camila Andrea",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "43789012",
    birthDate: "2001-06-12",
    phone: "3875345678",
    email: "camila.rodriguez@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Fernández",
    firstName: "Marcelo Fabián",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "24567890",
    birthDate: "1975-03-19",
    phone: "3874456123",
    email: "marcelo.fernandez@example.com",
    coverage: { insurer: "OSDE", plan: "410", memberNumber: "61 245678 9 01" },
    guardian: null,
    createdBy: MANAGER_EMAIL,
  },
  {
    lastName: "Sánchez",
    firstName: "Patricia Noemí",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "17890123",
    birthDate: "1966-01-08",
    phone: "3874338899",
    email: "patricia.sanchez@example.com",
    coverage: {
      insurer: "IPS Salud",
      plan: "Afiliado voluntario",
      memberNumber: "0178901230",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Díaz",
    firstName: "Alejandro",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "29345612",
    birthDate: "1982-10-27",
    phone: "3875567890",
    email: "alejandro.diaz@example.com",
    coverage: {
      insurer: "Galeno",
      plan: "Azul 220",
      memberNumber: "293456120 01",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Torres",
    firstName: "Micaela",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "39456781",
    birthDate: "1996-02-14",
    phone: "3876345012",
    email: "micaela.torres@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Herrera",
    firstName: "Gonzalo",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "36789123",
    birthDate: "1992-11-05",
    phone: "3874901234",
    email: "gonzalo.herrera@example.com",
    coverage: {
      insurer: "Sancor Salud",
      plan: "3000",
      memberNumber: "36789123/01",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Morales",
    firstName: "Luciana",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "41234567",
    birthDate: "1998-08-18",
    phone: "3875112233",
    email: "luciana.morales@example.com",
    coverage: {
      insurer: "Medifé",
      plan: "Bronce",
      memberNumber: "412345670",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Ríos",
    firstName: "Alex",
    gender: Gender.OTHER,
    documentType: DocumentType.DNI,
    documentNumber: "44567812",
    birthDate: "2002-05-09",
    phone: "3876789012",
    email: "alex.rios@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Zapata",
    firstName: "Héctor Hugo",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "10234567",
    birthDate: "1952-12-20",
    phone: "3874227788",
    email: "hector.zapata@example.com",
    coverage: {
      insurer: "PAMI",
      plan: "Único",
      memberNumber: "15102345670 00",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Burgos",
    firstName: "Natalia Soledad",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "30123789",
    birthDate: "1983-07-01",
    phone: "3874671234",
    email: "natalia.burgos@example.com",
    coverage: { insurer: "OSDE", plan: "510", memberNumber: "61 301237 8 01" },
    guardian: null,
    createdBy: MANAGER_EMAIL,
  },
  {
    lastName: "Condorí",
    firstName: "Walter",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "26789345",
    birthDate: "1978-04-11",
    phone: "3875990011",
    email: "walter.condori@example.com",
    coverage: {
      insurer: "IPS Salud",
      plan: "Afiliado obligatorio",
      memberNumber: "0267893450",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Villagra",
    firstName: "Carla",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "34567123",
    birthDate: "1989-09-09",
    phone: "3874780099",
    email: "carla.villagra@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Arce",
    firstName: "Diego Martín",
    gender: Gender.MALE,
    documentType: DocumentType.DNI,
    documentNumber: "37890456",
    birthDate: "1993-01-30",
    phone: "3876456781",
    email: "diego.arce@example.com",
    coverage: {
      insurer: "Galeno",
      plan: "Oro 440",
      memberNumber: "378904560 01",
    },
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Nieva",
    firstName: "Julieta",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "45678123",
    birthDate: "2004-03-03",
    phone: "3875223344",
    email: "julieta.nieva@example.com",
    coverage: {
      insurer: "Swiss Medical",
      plan: "SMG20",
      memberNumber: "80002 456781 01",
    },
    guardian: null,
    createdBy: MESA2,
  },
  {
    lastName: "Barrios",
    firstName: "Raúl Oscar",
    gender: Gender.MALE,
    documentType: DocumentType.CI,
    documentNumber: "8765432",
    birthDate: "1950-10-14",
    phone: "3874216655",
    email: "raul.barrios@example.com",
    coverage: null,
    guardian: null,
    createdBy: MESA,
  },
  {
    lastName: "Paz",
    firstName: "Mariana",
    gender: Gender.FEMALE,
    documentType: DocumentType.DNI,
    documentNumber: "32456178",
    birthDate: "1986-06-26",
    phone: "3874553210",
    email: "mariana.paz@example.com",
    coverage: {
      insurer: "Sancor Salud",
      plan: "1000",
      memberNumber: "32456178/01",
    },
    guardian: null,
    createdBy: MESA,
  },
];
