import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "fallback-secret-change-me"
);

export async function createAdminToken(payload: {
  adminId: string;
  email: string;
  role: string;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as {
      adminId: string;
      email: string;
      role: string;
    };
  } catch {
    return null;
  }
}
