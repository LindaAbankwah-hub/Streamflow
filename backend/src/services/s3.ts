import "dotenv/config";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const isLocal = process.env.NODE_ENV !== "production";

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(isLocal && {
    endpoint: "http://localhost:4566",
    forcePathStyle: true,
    credentials: {
      accessKeyId:     "test",
      secretAccessKey: "test",
    },
  }),
});

export const RAW_BUCKET = process.env.RAW_BUCKET ?? "raw-videos";
export const HLS_BUCKET = process.env.HLS_BUCKET ?? "hls-segments";
export const CDN_BASE   = process.env.CDN_BASE   ?? "http://localhost:4566/hls-segments";

export async function presignedGetUrl(bucket: string, key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType: string
) {
  await s3.send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    })
  );
}
