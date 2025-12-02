import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

// Initialize S3 Client
const s3Client = new S3Client({
  region: "eu-north-1", // Change to your region
});

// Upload a file
async function uploadFile(filePath, bucketName, key) {
  const fileContent = readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: "application/octet-stream", // Change based on file type
  });

  try {
    const response = await s3Client.send(command);
    console.log("File uploaded successfully:", response);
    return response;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}
