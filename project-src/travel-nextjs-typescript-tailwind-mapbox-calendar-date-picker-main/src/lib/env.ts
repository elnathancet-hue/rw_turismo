type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
};

type SupabasePublicEnv = Pick<PublicEnv, "supabaseUrl" | "supabaseAnonKey">;

type SupabaseAdminEnv = SupabasePublicEnv & {
  supabaseServiceRoleKey: string;
};

type StripeCheckoutEnv = {
  stripeSecretKey: string;
};

type StripeInternalWebhookEnv = StripeCheckoutEnv & {
  stripeInternalWebhookSecret: string;
};

type ExternalApiEnv = {
  mapboxApiKey: string;
  rapidApiKey: string;
};

type ServerEnv = PublicEnv & {
  supabaseServiceRoleKey: string;
  stripeSecretKey: string;
  mapboxApiKey: string;
  rapidApiKey: string;
};

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const assertServer = () => {
  if (typeof window !== "undefined") {
    throw new Error("Server-only environment variables cannot be read in the browser.");
  }
};

export const getPublicEnv = (): PublicEnv => ({
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  siteUrl: requireEnv("NEXT_PUBLIC_SITE_URL"),
});

export const getSupabasePublicEnv = (): SupabasePublicEnv => ({
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

export const getSupabaseAdminEnv = (): SupabaseAdminEnv => {
  assertServer();

  return {
    ...getSupabasePublicEnv(),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
};

export const getStripeCheckoutEnv = (): StripeCheckoutEnv => {
  assertServer();

  return {
    stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
  };
};

export const getStripeInternalWebhookEnv = (): StripeInternalWebhookEnv => {
  assertServer();

  return {
    stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
    stripeInternalWebhookSecret: requireEnv("STRIPE_INTERNAL_WEBHOOK_SECRET"),
  };
};

export const getExternalApiEnv = (): ExternalApiEnv => {
  assertServer();

  return {
    mapboxApiKey: requireEnv("MAPBOX_API_KEY"),
    rapidApiKey: requireEnv("RAPIDAPI_KEY"),
  };
};

export const getServerEnv = (): ServerEnv => {
  assertServer();

  return {
    ...getPublicEnv(),
    ...getSupabaseAdminEnv(),
    ...getStripeCheckoutEnv(),
    ...getExternalApiEnv(),
  };
};
