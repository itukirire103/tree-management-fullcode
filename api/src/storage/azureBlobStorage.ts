import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import type { DownloadResolution, FileStorage } from "./types.js";

type AzureBlobStorageOptions = {
  accountName: string;
  accountKey: string;
  containerName: string;
};

const SIGNED_URL_EXPIRES_MINUTES = 5;

// R2(S3互換)はAWS SDKのS3Clientをそのまま使えたが、Azure Blob StorageはS3プロトコルを
// 話さないため専用SDK(@azure/storage-blob)で実装する。FileStorageインターフェース自体は
// 変更不要(ローカル/R2/Azureを差し替え可能にするための抽象化が効いている)。
export class AzureBlobFileStorage implements FileStorage {
  private readonly serviceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly credential: StorageSharedKeyCredential;

  constructor(opts: AzureBlobStorageOptions) {
    this.containerName = opts.containerName;
    this.credential = new StorageSharedKeyCredential(opts.accountName, opts.accountKey);
    this.serviceClient = new BlobServiceClient(
      `https://${opts.accountName}.blob.core.windows.net`,
      this.credential
    );
  }

  private containerClient() {
    return this.serviceClient.getContainerClient(this.containerName);
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<void> {
    const blockBlobClient = this.containerClient().getBlockBlobClient(key);
    await blockBlobClient.uploadData(data, { blobHTTPHeaders: { blobContentType: mimeType } });
  }

  async resolveDownload(key: string, filename: string, mimeType: string): Promise<DownloadResolution> {
    const blockBlobClient = this.containerClient().getBlockBlobClient(key);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(Date.now() + SIGNED_URL_EXPIRES_MINUTES * 60 * 1000),
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        contentType: mimeType,
      },
      this.credential
    ).toString();
    return { kind: "redirect", url: `${blockBlobClient.url}?${sas}` };
  }

  async delete(key: string): Promise<void> {
    await this.containerClient().getBlockBlobClient(key).deleteIfExists();
  }
}
