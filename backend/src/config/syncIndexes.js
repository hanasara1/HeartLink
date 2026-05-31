const models = require('../models');

/**
 * 모든 모델의 인덱스를 MongoDB에 동기화한다.
 * - 스키마에 선언된 index() 정의를 실제 컬렉션에 반영
 * - 앱 부팅 시 1회 호출하거나 seed 스크립트에서 호출
 */
const syncAllIndexes = async () => {
  console.log('[INDEX] 인덱스 동기화 시작...');
  const entries = Object.entries(models);

  for (const [name, Model] of entries) {
    try {
      await Model.syncIndexes();
      console.log(`[INDEX] ${name} 인덱스 동기화 완료`);
    } catch (err) {
      console.error(`[INDEX] ${name} 인덱스 동기화 실패:`, err.message);
    }
  }
  console.log('[INDEX] 전체 인덱스 동기화 종료');
};

module.exports = { syncAllIndexes };
