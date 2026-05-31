const { S3Client } = require('@aws-sdk/client-s3');

const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = { s3Client, AWS_S3_BUCKET, AWS_REGION };
