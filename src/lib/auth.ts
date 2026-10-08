import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readJson, updateJson } from "./jsonStore";
import { scalewayClient, SCALEWAY_BUCKET } from "./api";
import { signSessionToken, verifySessionToken, type SessionClaims } from "./sessionJwt";

const USERS_FILE_KEY = "auth/users.json";

export interface User {
  id: string;
  email: string;
  /** Legacy password hashes from blue; unused on green (magic link only). */
  password?: string;
  createdAt: string;
  lastLogin?: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: string | null;
}

export type UserPayload = SessionClaims;

export async function getUsers(): Promise<User[]> {
  return (await readJson<User[]>(USERS_FILE_KEY, [])).data;
}

export async function saveUsers(users: User[]): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: SCALEWAY_BUCKET,
    Key: USERS_FILE_KEY,
    Body: JSON.stringify(users, null, 2),
    ContentType: "application/json",
  });

  await scalewayClient.send(command);
}

export async function generateToken(user: UserPayload): Promise<string> {
  return signSessionToken(user);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  return verifySessionToken(token);
}

async function createUserRecord(email: string): Promise<User> {
  const normalized = email.toLowerCase();
  const newUser: User = {
    id: Date.now().toString(),
    email: normalized,
    createdAt: new Date().toISOString(),
  };

  await updateJson<User[]>(USERS_FILE_KEY, [], (users) => {
    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new Error("User already exists");
    }
    return [...users, newUser];
  });

  return newUser;
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

function findUserByEmail(users: User[], email: string): User | undefined {
  const normalized = email.toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized);
}

/** Allowlisted magic-link sign-in: existing bucket user or provision without password auth. */
export async function resolveUserForMagicLink(email: string): Promise<UserPayload> {
  const normalized = email.toLowerCase();
  const users = await getUsers();
  const existing = findUserByEmail(users, normalized);
  if (existing) {
    const lastLogin = new Date().toISOString();
    await updateJson<User[]>(USERS_FILE_KEY, [], (current) =>
      current.map((u) => (u.id === existing.id ? { ...u, lastLogin } : u)),
    );
    return { id: existing.id, email: existing.email };
  }
  const created = await createUserRecord(normalized);
  return { id: created.id, email: created.email };
}
