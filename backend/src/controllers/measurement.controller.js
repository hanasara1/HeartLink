const { Measurement } = require('../models');
const { computeFileHash, uploadToS3, deleteFromS3 } = require('../services/s3.service');
const { requestAnalysis } = require('../services/aiClient.service');
const { writeAccessLog } = require('../services/accessLog.service');
const { FILE_FORMATS, DEVICE_TYPES, SIGNAL_TYPES } = require('../models/constants');
const path = require('path');

// 확장자 → file_format 매핑
const extToFormat = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  if (['.dat', '.hea', '.atr', '.wfdb'].includes(ext)) return 'WFDB';
  if (ext === '.edf') return 'EDF';
  if (ext === '.csv') return 'CSV';
  return null;
};

/**
 * ECG/PPG 데이터 업로드 (UC-04)
 * POST /api/measurements (multipart/form-data)
 * file 필드: ecgFile
 * body: { device_type, signal_type, measured_at, duration_sec }
 * 인증: role=user
 */
const uploadMeasurement = async (req, res, next) => {
  let uploadedKey = null;
  try {
    const userId = req.user.id;
    const file = req.file;
    const { device_type, signal_type, measured_at, duration_sec } = req.body;

    // 1) 파일 존재 검증
    if (!file) {
      return res.status(400).json({ message: '업로드할 파일이 없습니다.' });
    }

    // 2) 메타데이터 유효성 검증
    const file_format = extToFormat(file.originalname);
    if (!FILE_FORMATS.includes(file_format)) {
      return res.status(400).json({ message: '지원하지 않는 파일 형식입니다.' });
    }
    if (!DEVICE_TYPES.includes(device_type)) {
      return res.status(400).json({ message: '유효하지 않은 디바이스 유형입니다.' });
    }
    if (!SIGNAL_TYPES.includes(signal_type)) {
      return res.status(400).json({ message: '신호 유형은 ECG / PPG / BOTH 여야 합니다.' });
    }
    if (!measured_at || !duration_sec) {
      return res.status(400).json({ message: '측정 시각과 측정 시간은 필수입니다.' });
    }

    // 3) 무결성 검증: SHA-256 해시 + 중복 업로드 방지 (FR-04)
    const file_hash = computeFileHash(file.buffer);
    const duplicate = await Measurement.findOne({ file_hash });
    if (duplicate) {
      return res.status(409).json({
        message: '이미 업로드된 동일한 파일입니다.',
        measurement_id: duplicate._id,
      });
    }

    // 4) S3 업로드 (SSE-S3 암호화)
    const { key, fileUrl } = await uploadToS3({
      userId,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
    });
    uploadedKey = key; // 후처리 실패 시 롤백용

    // 5) measurements 문서 생성
    const measurement = await Measurement.create({
      user_id: userId,
      file_url: fileUrl,
      file_format,
      file_size: file.size,
      device_type,
      signal_type,
      measured_at: new Date(measured_at),
      duration_sec: Number(duration_sec),
      file_hash,
      status: 'UPLOADED',
    });

    await writeAccessLog({
      userId, actionType: 'UPLOAD', req, targetResource: measurement._id.toString(),
    });

    // 6) AI 서버에 분석 요청 (비동기 — 응답을 기다리지 않음)
    //    UC-04 사후조건: "AI 분석 큐에 등록됨", 이후 자동 진행
    requestAnalysis(measurement._id).catch((err) => {
      // 실패는 aiClient.service 내부에서 status=FAILED + SystemLog 처리됨
      console.error('[Measurement] 백그라운드 분석 실패:', err.message);
    });

    // 7) 업로드 완료 즉시 응답 (분석은 백그라운드 진행)
    return res.status(202).json({
      message: '업로드가 완료되었습니다. AI 분석이 진행 중입니다.',
      measurement: {
        id: measurement._id,
        file_format: measurement.file_format,
        signal_type: measurement.signal_type,
        status: measurement.status,
      },
    });
  } catch (err) {
    // S3 업로드 후 DB 저장 실패 시 S3 객체 롤백
    if (uploadedKey) await deleteFromS3(uploadedKey);
    return next(err);
  }
};

/**
 * 분석 상태 폴링 (프론트가 진행 상태 확인용)
 * GET /api/measurements/:id/status
 */
const getStatus = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({
      _id: req.params.id,
      user_id: req.user.id,
    }).select('status created_at');
    if (!measurement) {
      return res.status(404).json({ message: '측정 데이터를 찾을 수 없습니다.' });
    }
    return res.status(200).json({
      measurement_id: measurement._id,
      status: measurement.status, // UPLOADED / PREPROCESSING / PROCESSED / FAILED
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 내 측정 이력 목록 (FR-20)
 * GET /api/measurements
 */
const listMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ user_id: req.user.id })
      .sort({ measured_at: -1 })
      .select('-file_hash');
    return res.status(200).json({ count: measurements.length, measurements });
  } catch (err) {
    return next(err);
  }
};

module.exports = { uploadMeasurement, getStatus, listMeasurements };
