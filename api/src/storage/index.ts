import path from "node:path";
import type { FileStorage } from "./types.js";
import { LocalFileStorage } from "./localStorage.js";
import { S3FileStorage } from "./s3Storage.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function createFileStorage(): FileStorage {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    return new S3FileStorage({
      endpoint: requireEnv("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "auto",
      bucket: requireEnv("S3_BUCKET"),
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    });
  }
  return new LocalFileStorage(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage"));
}

export const fileStorage: FileStorage = createFileStorage();
export type { FileStorage, DownloadResolution } from "./types.js";
