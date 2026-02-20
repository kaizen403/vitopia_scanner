import net from "node:net";

export type DatabaseReadiness = {
  connected: boolean;
  error?: string;
};

type DatabaseUrlValidation =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

export const validateDatabaseUrl = (databaseUrl: string | undefined): DatabaseUrlValidation => {
  if (!databaseUrl) {
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return { ok: false, error: "DATABASE_URL is not a valid URL" };
  }

  if (!parsedUrl.hostname) {
    return { ok: false, error: "DATABASE_URL must include a host" };
  }

  const port = Number(parsedUrl.port || 5432);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    return { ok: false, error: "DATABASE_URL has an invalid port" };
  }

  return { ok: true };
};

const DB_PROBE_TIMEOUT_MS = 1200;

export const getDatabaseReadiness = async (): Promise<DatabaseReadiness> => {
  const databaseUrl = process.env.DATABASE_URL;
  const configValidation = validateDatabaseUrl(databaseUrl);
  if (!configValidation.ok) {
    return { connected: false, error: configValidation.error };
  }

  const parsedUrl = new URL(databaseUrl as string);
  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || 5432);

  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ connected: false, error: "Database probe timed out" });
    }, DB_PROBE_TIMEOUT_MS);

    const finish = (result: DatabaseReadiness) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => finish({ connected: true }));
    socket.once("error", (err) => finish({ connected: false, error: err.message }));
  });
};
