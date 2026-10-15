import argon2, { type HashOptions } from "argon2";

const HASH_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export class PasswordService {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, HASH_OPTIONS);
  }

  async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    if (!plainPassword || !storedHash || typeof storedHash !== "string") {
      return false;
    }
    try {
      return await argon2.verify(storedHash, plainPassword);
    } catch {
      // Malformed hash (e.g. missing hash component, legacy hash, corrupted string)
      return false;
    }
  }
}
