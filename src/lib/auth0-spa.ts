import { appConfig } from "@/lib/config";

const transactionKey = "nub-auth0-pkce";
let completionPromise: Promise<string> | null = null;

type Auth0Transaction = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
};

type Auth0TokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

function auth0BaseUrl() {
  if (!appConfig.auth0Domain || !appConfig.auth0ClientId) {
    throw new Error("Falta configurar NEXT_PUBLIC_AUTH0_DOMAIN y NEXT_PUBLIC_AUTH0_CLIENT_ID.");
  }
  const domain = appConfig.auth0Domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}`;
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  data.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(byteLength = 48) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function callbackUrl() {
  if (typeof window === "undefined") return `${appConfig.frontendUrl}/auth0/complete/`;
  return `${window.location.origin}/auth0/complete/`;
}

export async function startAuth0Login() {
  const state = randomString(32);
  const codeVerifier = randomString(64);
  const redirectUri = callbackUrl();
  const codeChallenge = base64Url(await sha256(codeVerifier));
  const params = new URLSearchParams({
    client_id: appConfig.auth0ClientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    connection: "google-oauth2",
  });

  sessionStorage.setItem(transactionKey, JSON.stringify({ state, codeVerifier, redirectUri }));
  window.location.assign(`${auth0BaseUrl()}/authorize?${params.toString()}`);
}

function readTransaction(): Auth0Transaction {
  const raw = sessionStorage.getItem(transactionKey);
  if (!raw) {
    throw new Error("No se encontro la sesion temporal de Auth0. Volve a iniciar sesion.");
  }
  return JSON.parse(raw) as Auth0Transaction;
}

export async function completeAuth0Login() {
  if (completionPromise) {
    return completionPromise;
  }
  completionPromise = exchangeAuth0Code();
  try {
    return await completionPromise;
  } finally {
    completionPromise = null;
  }
}

async function exchangeAuth0Code() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) {
    throw new Error(params.get("error_description") ?? error);
  }
  const code = params.get("code");
  const state = params.get("state");
  const transaction = readTransaction();
  if (!code || !state || state !== transaction.state) {
    throw new Error("Auth0 devolvio una respuesta invalida. Volve a intentar.");
  }

  const response = await fetch(`${auth0BaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appConfig.auth0ClientId,
      code,
      code_verifier: transaction.codeVerifier,
      redirect_uri: transaction.redirectUri,
    }),
  });
  const data = (await response.json()) as Auth0TokenResponse;
  sessionStorage.removeItem(transactionKey);
  if (!response.ok || !data.id_token) {
    throw new Error(data.error_description ?? data.error ?? "No se pudo intercambiar el codigo de Auth0.");
  }
  return data.id_token;
}

export function auth0LogoutUrl() {
  const returnTo = typeof window === "undefined" ? appConfig.frontendUrl : window.location.origin;
  const params = new URLSearchParams({
    client_id: appConfig.auth0ClientId,
    returnTo,
  });
  return `${auth0BaseUrl()}/v2/logout?${params.toString()}`;
}
