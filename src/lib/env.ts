// Validación de las variables de entorno que la app necesita para arrancar.
// `instrumentation.ts` la corre una vez al iniciar el servidor, así un `.env`
// roto se ve en la terminal de `npm run dev` con todos sus problemas juntos,
// y no como un 500 en cada página.

type Env = Record<string, string | undefined>;

type EnvRule = {
  name: string;
  /// Devuelve qué está mal del valor, o `null` si está bien.
  check?: (value: string) => string | null;
};

export const MIN_SESSION_SECRET_LENGTH = 32;

const RULES: EnvRule[] = [
  {
    name: "DATABASE_URL",
    check: (value) =>
      /^postgres(ql)?:\/\//.test(value)
        ? null
        : 'no es una URL de PostgreSQL (tiene que empezar con "postgresql://").',
  },
  {
    name: "SESSION_SECRET",
    check: (value) =>
      value.length >= MIN_SESSION_SECRET_LENGTH
        ? null
        : `tiene ${value.length} caracteres y necesita al menos ${MIN_SESSION_SECRET_LENGTH}. Generá una con: openssl rand -base64 32`,
  },
];

/// Qué está mal de la variable `name`, o `null` si está bien. Si falta pero
/// existe con otras mayúsculas (`session_secret`), lo dice: en Linux son
/// variables distintas y es un error difícil de ver a simple vista.
export function envVarProblem(name: string, env: Env): string | null {
  const value = env[name];
  if (!value) {
    const miscased = Object.keys(env).find(
      (key) => key !== name && key.toUpperCase() === name,
    );
    if (miscased) {
      return `${name}: no está definida, pero en el .env aparece como "${miscased}". Los nombres distinguen mayúsculas y minúsculas: tiene que ser ${name}.`;
    }
    return `${name}: no está definida.`;
  }

  const rule = RULES.find((r) => r.name === name);
  const problem = rule?.check?.(value);
  return problem ? `${name}: ${problem}` : null;
}

export function findEnvProblems(env: Env): string[] {
  return RULES.map((rule) => envVarProblem(rule.name, env)).filter(
    (problem): problem is string => problem !== null,
  );
}

export function formatEnvProblems(problems: string[]): string {
  return [
    "Configuración de entorno inválida. Revisá el archivo .env:",
    ...problems.map((problem) => `  - ${problem}`),
    "La plantilla con todas las variables está en .env.example.",
  ].join("\n");
}

/// El valor de `name`, o un error que dice qué arreglar en el .env.
export function requireEnv(name: string, env: Env = process.env): string {
  const problem = envVarProblem(name, env);
  const value = env[name];
  if (problem || !value) {
    throw new Error(
      formatEnvProblems([problem ?? `${name}: no está definida.`]),
    );
  }
  return value;
}

export function assertValidEnv(env: Env = process.env): void {
  const problems = findEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(formatEnvProblems(problems));
  }
}
