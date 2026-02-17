import { z } from "zod";

const envSchema = z.object({
  TARGET_STORE: z.enum(["dev", "prod"]).default("dev"),
  PRODUCTION_WRITES_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  BC_DEV_STORE_HASH: z.string().optional(),
  BC_DEV_ACCESS_TOKEN: z.string().optional(),
  BC_DEV_CLIENT_ID: z.string().optional(),
  BC_DEV_CLIENT_SECRET: z.string().optional(),

  BC_PROD_STORE_HASH: z.string().optional(),
  BC_PROD_ACCESS_TOKEN: z.string().optional(),
  BC_PROD_CLIENT_ID: z.string().optional(),
  BC_PROD_CLIENT_SECRET: z.string().optional(),

  DATABASE_URL: z.string(),
  ENCRYPTION_KEY: z.string().min(32),

  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string().default("tpp-wholesale-docs"),
  R2_ENDPOINT: z.string(),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().default("no-reply@wholesale.theperfectpart.net"),

  CLAMAV_HOST: z.string(),
  CLAMAV_PORT: z.string().transform(Number),

  JWT_SECRET: z.string().min(16),
  ADMIN_ALLOWLIST: z.string().default("adam@theperfectpart.net"),

  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3001"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function env(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
      throw new Error("Invalid environment variables");
    }
    _env = result.data;
  }
  return _env;
}

/**
 * Guard against writes to production.
 * Call this before ANY BigCommerce write operation.
 */
export function guardWrite(operation: string): void {
  const e = env();
  if (e.TARGET_STORE === "prod" && !e.PRODUCTION_WRITES_ENABLED) {
    throw new Error(
      `🚫 BLOCKED: "${operation}" against PRODUCTION. ` +
        `Set PRODUCTION_WRITES_ENABLED=true to allow production writes.`
    );
  }
}

/** Get BigCommerce credentials for the active store */
export function bcCredentials() {
  const e = env();
  if (e.TARGET_STORE === "prod") {
    return {
      storeHash: e.BC_PROD_STORE_HASH!,
      accessToken: e.BC_PROD_ACCESS_TOKEN!,
      clientId: e.BC_PROD_CLIENT_ID!,
      clientSecret: e.BC_PROD_CLIENT_SECRET!,
    };
  }
  return {
    storeHash: e.BC_DEV_STORE_HASH!,
    accessToken: e.BC_DEV_ACCESS_TOKEN!,
    clientId: e.BC_DEV_CLIENT_ID!,
    clientSecret: e.BC_DEV_CLIENT_SECRET!,
  };
}

/** Check if an email is in the admin allowlist */
export function isAdmin(email: string): boolean {
  const list = env()
    .ADMIN_ALLOWLIST.split(",")
    .map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}
