import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { DownloadResolution, FileStorage } from "./types.js";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly baseDir: string) {}

  // keyはアップロード時にサーバー側(randomUUID)で生成した値のみを受け付ける想定。
  // それでも将来の呼び出しミスでパストラバーサルが混入しないよう、
  // 解決後のパスがbaseDir配下であることを常に確認する。
  private resolvePath(key: string): string {
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, key);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error("不正なファイルキーです。");
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, data);
  }

  async resolveDownload(key: string, _filename: string, mimeType: string): Promise<DownloadResolution> {
    const filePath = this.resolvePath(key);
    return { kind: "stream", stream: fs.createReadStream(filePath), mimeType };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fsp.rm(filePath, { force: true });
  }
}
