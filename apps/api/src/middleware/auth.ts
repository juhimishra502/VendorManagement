import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { UserRole } from "@vendor-management/shared";
import { prisma } from "@vendor-management/db";
import { auth } from "../routes/auth.js";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

// Express 5 typing: augment the request with our authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Require a valid Better Auth session. Loads the user's role from the database
 * (never trusts a client-supplied role) and attaches it to `req.auth`.
 */
export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user) {
      response.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      response.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    request.auth = { userId: user.id, email: user.email, name: user.name, role: user.role as UserRole };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require the authenticated user to hold one of the allowed roles.
 * Must run after `requireAuth`.
 */
export function requireRole(...allowed: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.auth) {
      response.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    if (!allowed.includes(request.auth.role)) {
      response.status(403).json({
        success: false,
        error: `Forbidden: requires role ${allowed.join(" or ")}`,
      });
      return;
    }
    next();
  };
}
