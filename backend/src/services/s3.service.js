const crypto = require('crypto');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, AWS_S3_BUCKET, AWS_REGION } = require('../config/s3');

/**
 * 파일 버퍼의 SHA-256 해시 계산 (FR-04: 중복 업로드 방지)
 */
const computeFileHash = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * S3에 ECG/PPG 원본 파일 업로드 (NFR-06: SSE-S3, AES-256 암호화)
 */
const uploadToS3 = async ({ userId, buffer, originalName, mimeType }) => {
  // 키 형식: ecg/{userId}/{timestamp}_{원본파일명}
  const safeName = originalName.replace(/[^\w.\-]/g, '_');
  const key = `ecg/${userId}/${Date.now()}_${safeName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256', // SSE-S3
    })
  );

  const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
  return { key, fileUrl };
};

/**
 * S3 객체 삭제 (업로드 후처리 실패 시 롤백, 측정 이력 삭제 시 사용)
 */
const deleteFromS3 = async (key) => {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }));
  } catch (err) {
    console.error('[S3] 삭제 실패:', err.message);
  }
};

module.exports = { computeFileHash, uploadToS3, deleteFromS3 };
