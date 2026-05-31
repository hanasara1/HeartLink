// ─────────────────────────────────────────────
// 공통 ENUM 상수 (여러 모델에서 재사용)
// ─────────────────────────────────────────────
module.exports = {
  USER_ROLES: ['user', 'guardian'],
  ADMIN_ROLES: ['super', 'operator'],
  RELATION_TYPES: ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'CAREGIVER', 'OTHER'],
  RELATION_STATUS: ['PENDING', 'ACTIVE', 'REJECTED', 'REVOKED'],
  FILE_FORMATS: ['WFDB', 'EDF', 'CSV'],
  DEVICE_TYPES: ['APPLE_WATCH', 'GALAXY_WATCH', 'FITBIT', 'KARDIA', 'OTHER'],
  SIGNAL_TYPES: ['ECG', 'PPG', 'BOTH'],
  MEASUREMENT_STATUS: ['UPLOADED', 'PREPROCESSING', 'PROCESSED', 'FAILED'],
  PREPROCESS_STATUS: ['SUCCESS', 'LOW_QUALITY', 'FAILED'],
  ARRHYTHMIA_CLASSES: ['N', 'SVEB', 'VEB', 'F', 'Q'], // AAMI EC57 5종
  RISK_LEVELS: ['HIGH', 'MID', 'LOW'],
  NOTI_CHANNELS: ['FCM', 'SMS'],
  DELIVERY_STATUS: ['PENDING', 'SUCCESS', 'FAILED', 'RETRYING'],
  GUIDELINE_SOURCES: ['KSC', 'ESC', 'OTHER'],
  LANGUAGES: ['KO', 'EN'],
  ACCESS_ACTIONS: [
    'LOGIN', 'LOGOUT', 'VIEW_REPORT', 'DOWNLOAD_PDF',
    'UPDATE_PROFILE', 'LINK_GUARDIAN', 'REVOKE_GUARDIAN',
  ],
  AUDIT_ACTOR_ROLES: ['user', 'guardian', 'admin', 'system'],
  AUDIT_ACTIONS: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'],
  GENDERS: ['M', 'F', 'O'],
  EVENT_TYPES: ['ERROR', 'WARN', 'INFO', 'DEBUG'],
  SEVERITIES: ['CRITICAL', 'HIGH', 'MID', 'LOW'],
  SERVICE_NAMES: ['API_SERVER', 'AI_SERVER', 'LLM_SERVER', 'FCM', 'TWILIO_SMS', 'DB', 'S3'],
};

const DISCLAIMER_DEFAULT =
  '본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다.';

module.exports.DISCLAIMER_DEFAULT = DISCLAIMER_DEFAULT;
