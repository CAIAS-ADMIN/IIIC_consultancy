import type { DefaultSession } from "next-auth";
import type { Role } from "@/db/schema/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      departmentId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    roles?: Role[];
    departmentId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    roles?: Role[];
    departmentId?: string | null;
  }
}
