import * as fs from "fs/promises";
import * as path from "path";
import { assertValidKey, InvalidStorageKeyError, StorageNotFoundError, type ObjectStorage } from "./types.js";

// Files in a folder: for development and tests. Production uses S3, because local
// disk is wiped on redeploys and not shared between servers.
export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(directory);
  }

  // A folder keeps no metadata, so contentType is not stored.
  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    const file = this.pathFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // "wx": fail if the file exists, so nothing is ever overwritten.
    await fs.writeFile(file, body, { flag: "wx", mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    const file = this.pathFor(key);
    let real: string;
    try {
      real = await fs.realpath(file);
    } catch {
      throw new StorageNotFoundError(key);
    }
    // realpath follows symlinks: a link planted inside the folder that points
    // outside it is refused.
    const realRoot = await fs.realpath(this.root).catch(() => this.root);
    if (!isInside(realRoot, real)) throw new InvalidStorageKeyError(key);
    return fs.readFile(real);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    assertValidKey(key);
    const file = path.resolve(this.root, key);
    if (!isInside(this.root, file)) throw new InvalidStorageKeyError(key);
    return file;
  }
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== "" && rel.split(path.sep)[0] !== ".." && !path.isAbsolute(rel);
}
