import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  signInReturnToPath: "/auth0/complete",
  authorizationParameters: {
    scope: "openid profile email",
  },
});
