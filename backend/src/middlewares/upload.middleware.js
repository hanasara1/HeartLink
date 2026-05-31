const multer = require('multer');
const path = require('path');

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
// WFDB는 .dat/.hea/.atr 묶음이지만, 업로드 단위로는 확장자 기반 1차 검증
const ALLOWED_EXT = ['.dat', '.hea', '.atr', '.edf', '.csv', '.wfdb'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error('지원하지 않는 파일 형식입니다. (WFDB/EDF/CSV)'), false);
  }
  return cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(), // S3로 바로 보내기 위해 메모리 저장
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Multer 에러를 사용자 친화적 메시지로 변환 (UC-04: 실패 원인 명확히 안내)
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: '파일 용량이 100MB를 초과했습니다.' });
    }
    return res.status(400).json({ message: `업로드 오류: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  return next();
};

module.exports = { upload, handleUploadError };
