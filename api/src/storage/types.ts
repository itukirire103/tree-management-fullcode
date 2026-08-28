import type { Readable } from "node:stream";

// ダウンロードの提供方法はストレージ種別によって最適解が異なる。
// ローカル: このサーバー自身がストリーミングして返す。
// R2/S3: 署名付きURLへ302リダイレクトし、実際の転送量をオブジェクトストレージ側に
//        逃がす(Renderの無料枠の帯域・メモリを消費しない)。
export type DownloadResolution =
  | { kind: "stream"; stream: Readable; mimeType?: string }
  | { kind: "redirect"; url: string };

export interface FileStorage {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  resolveDownload(key: string, filename: string, mimeType: string): Promise<DownloadResolution>;
  delete(key: string): Promise<void>;
}
