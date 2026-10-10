import "server-only";
import { betterAuth } from "better-auth/minimal";
import { env } from "@/config/env";
import { db } from "@/db";
import { authOptions } from "./options";

export const auth = betterAuth(authOptions({ db, secret: env.betterAuthSecret, baseURL: env.authBaseUrl }));
