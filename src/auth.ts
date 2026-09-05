import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Single seeded demo merchant, compared against server-only env vars.
      // Not backed by the database — there is no multi-tenant user model in this app.
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const demoEmail = process.env.DEMO_EMAIL;
        const demoPassword = process.env.DEMO_PASSWORD;
        if (!demoEmail || !demoPassword) return null;

        const { email, password } = parsed.data;
        if (email !== demoEmail || password !== demoPassword) return null;

        return { id: "demo-merchant", email: demoEmail, name: "Demo Merchant" };
      },
    }),
  ],
});
