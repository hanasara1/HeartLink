/**
 * 초기 데이터 seed 스크립트
 *
 * 실행:
 *   node scripts/seed.js          (기존 데이터 유지하며 추가)
 *   node scripts/seed.js --fresh  (해당 컬렉션 비우고 새로 생성)
 *
 * ⚠️ --fresh 는 개발 환경 전용. 운영 DB에서 절대 사용 금지.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { connectDB } = require('../backend/src/config/db');
const { syncAllIndexes } = require('../backend/src/config/syncIndexes');
const {
  User, Admin, GuardianRelation, GuidelineDocument,
} = require('../backend/src/models');

const FRESH = process.argv.includes('--fresh');
const BCRYPT_COST = 10; // NFR-05: cost factor 10

const hash = (plain) => bcrypt.hash(plain, BCRYPT_COST);

const seed = async () => {
  await connectDB();

  // ── 환경 안전장치: 운영 환경에서 --fresh 차단 ──
  if (FRESH && process.env.NODE_ENV === 'production') {
    console.error('[SEED] 운영 환경에서는 --fresh 를 사용할 수 없습니다.');
    process.exit(1);
  }

  if (FRESH) {
    console.log('[SEED] --fresh: 기존 데이터 삭제');
    await Promise.all([
      User.deleteMany({}),
      Admin.deleteMany({}),
      GuardianRelation.deleteMany({}),
      GuidelineDocument.deleteMany({}),
    ]);
  }

  // 인덱스 먼저 동기화 (unique 제약이 seed 단계에서 적용되도록)
  await syncAllIndexes();

  // ─────────────────────────────────────────────
  // 1) 관리자 계정
  // ─────────────────────────────────────────────
  const adminExists = await Admin.findOne({ admin_email: 'admin@heartlink.dev' });
  if (!adminExists) {
    await Admin.create({
      admin_email: 'admin@heartlink.dev',
      password_hash: await hash('admin1234'),
      name: '시스템관리자',
      role: 'super',
    });
    console.log('[SEED] 관리자 계정 생성: admin@heartlink.dev / admin1234');
  }

  // ─────────────────────────────────────────────
  // 2) 사용자(고령자) 계정
  // ─────────────────────────────────────────────
  let elder = await User.findOne({ email: 'elder@heartlink.dev' });
  if (!elder) {
    elder = await User.create({
      email: 'elder@heartlink.dev',
      password_hash: await hash('test1234'),
      name: '김영자',
      phone: '010-1111-2222',
      role: 'user',
      profile: {
        age: 72,
        gender: 'F',
        height: 158,
        weight: 60,
        diseases: ['고혈압', '당뇨'],
        medications: ['암로디핀', '메트포르민'],
      },
    });
    console.log('[SEED] 사용자 계정 생성: elder@heartlink.dev / test1234');
  }

  // ─────────────────────────────────────────────
  // 3) 보호자(자녀) 계정
  // ─────────────────────────────────────────────
  let guardian = await User.findOne({ email: 'guardian@heartlink.dev' });
  if (!guardian) {
    guardian = await User.create({
      email: 'guardian@heartlink.dev',
      password_hash: await hash('test1234'),
      name: '김보호',
      phone: '010-3333-4444',
      role: 'guardian',
    });
    console.log('[SEED] 보호자 계정 생성: guardian@heartlink.dev / test1234');
  }

  // ─────────────────────────────────────────────
  // 4) 보호자 연계 관계 (사용자 ↔ 보호자)
  // ─────────────────────────────────────────────
  const relExists = await GuardianRelation.findOne({
    user_id: elder._id,
    guardian_id: guardian._id,
  });
  if (!relExists) {
    await GuardianRelation.create({
      user_id: elder._id,
      guardian_id: guardian._id,
      relation_type: 'CHILD',
      alert_permission: { high: true, mid: true, low: false },
      status: 'ACTIVE',
      linked_at: new Date(),
    });
    console.log('[SEED] 보호자 연계 관계 생성 (김영자 ↔ 김보호 / CHILD)');
  }

  // ─────────────────────────────────────────────
  // 5) 가이드라인 문서 (RAG 지식베이스 샘플)
  // ─────────────────────────────────────────────
  const guidelineSamples = [
    {
      title: 'KSC 심방세동 관리 가이드라인 2024',
      source: 'KSC',
      version: '2024',
      section: 'AF Management 4.2',
      content: '65세 이상에서 심방세동이 확인되면 뇌졸중 위험 평가(CHA2DS2-VASc)를 시행하고, 위험 점수에 따라 항응고 치료를 고려한다.',
      embedding_vector_id: 'faiss_ksc_af_0001',
      language: 'KO',
      published_at: new Date('2024-01-01'),
    },
    {
      title: 'ESC Guidelines for Atrial Fibrillation',
      source: 'ESC',
      version: '2024',
      section: 'AF Diagnosis 3.1',
      content: 'A single-lead ECG tracing of 30 seconds or more showing absence of P waves with irregular RR intervals is sufficient to diagnose AF.',
      embedding_vector_id: 'faiss_esc_af_0001',
      language: 'EN',
      published_at: new Date('2024-01-01'),
    },
  ];

  for (const g of guidelineSamples) {
    const exists = await GuidelineDocument.findOne({ embedding_vector_id: g.embedding_vector_id });
    if (!exists) {
      await GuidelineDocument.create(g);
      console.log(`[SEED] 가이드라인 문서 생성: ${g.title}`);
    }
  }

  console.log('\n[SEED] ✅ 초기 데이터 seed 완료');
  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('[SEED] 오류 발생:', err);
  await mongoose.connection.close();
  process.exit(1);
});
