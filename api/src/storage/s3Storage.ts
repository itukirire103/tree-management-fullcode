import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DownloadResolution, FileStorage } from "./types.js";

type S3StorageOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const SIGNED_URL_EXPIRES_SECONDS = 60 * 5;

// Cloudflare R2はS3互換APIを提供するため、AWS SDKのS3Clientをそのまま使い、
// endpointだけR2のものに差し替える構成にしている(R2専用SDKは不要)。
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(opts: S3StorageOptions) {
    this.bucket = opts.bucket;
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: mimeType })
    );
  }

  async resolveDownload(key: string, filename: string, mimeType: string): Promise<DownloadResolution> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ResponseContentType: mimeType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: SIGNED_URL_EXPIRES_SECONDS });
    return { kind: "redirect", url };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
