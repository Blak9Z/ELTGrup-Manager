import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storageClient() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadDocumentFile(file: File) {
  if (!file || file.size === 0) throw new Error("Fisierul este obligatoriu.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Fisierul depaseste 20MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeName(file.name || "document.bin");
  const objectKey = `${new Date().getFullYear()}/${randomUUID()}-${safeName}`;

  const bucket = process.env.STORAGE_BUCKET;
  const client = storageClient();

  if (client && bucket) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    return {
      fileName: safeName,
      storagePath: `s3://${bucket}/${objectKey}`,
      mimeType: file.type || "application/octet-stream",
    };
  }

  const localDir = path.join(process.cwd(), "public", "uploads", String(new Date().getFullYear()));
  await mkdir(localDir, { recursive: true });
  const localName = `${randomUUID()}-${safeName}`;
  const fullPath = path.join(localDir, localName);
  await writeFile(fullPath, bytes);

  return {
    fileName: safeName,
    storagePath: `/uploads/${new Date().getFullYear()}/${localName}`,
    mimeType: file.type || "application/octet-stream",
  };
}
