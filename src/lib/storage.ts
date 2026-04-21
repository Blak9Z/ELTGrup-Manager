import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

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

function resolveLocalObjectPath(storagePath: string) {
  if (storagePath.startsWith("local://")) {
    const localKey = storagePath.slice("local://".length).replace(/^\/+/, "");
    if (localKey.includes("..")) {
      throw new Error("Cale locala invalida pentru document.");
    }
    return path.join(LOCAL_STORAGE_ROOT, localKey);
  }

  // Backward compatibility with old public upload paths.
  if (storagePath.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", storagePath);
  }

  return null;
}

function parseS3StoragePath(storagePath: string) {
  if (!storagePath.startsWith("s3://")) return null;
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(storagePath);
  if (!match) {
    throw new Error("Cale S3 invalida pentru document.");
  }
  return { bucket: match[1], key: match[2] };
}

export async function readDocumentFile(storagePath: string) {
  const s3Target = parseS3StoragePath(storagePath);
  if (s3Target) {
    const client = storageClient();
    if (!client) {
      throw new Error("Configuratia storage S3 lipseste.");
    }
    const response = await client.send(
      new GetObjectCommand({
        Bucket: s3Target.bucket,
        Key: s3Target.key,
      }),
    );
    if (!response.Body) {
      throw new Error("Documentul nu contine date.");
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const localPath = resolveLocalObjectPath(storagePath);
  if (!localPath) {
    throw new Error("Tip de stocare document necunoscut.");
  }
  return readFile(localPath);
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

  const year = String(new Date().getFullYear());
  const localDir = path.join(LOCAL_STORAGE_ROOT, year);
  await mkdir(localDir, { recursive: true });
  const localName = `${randomUUID()}-${safeName}`;
  const fullPath = path.join(localDir, localName);
  await writeFile(fullPath, bytes);

  return {
    fileName: safeName,
    storagePath: `local://${year}/${localName}`,
    mimeType: file.type || "application/octet-stream",
  };
}
