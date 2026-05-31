const { Notification, GuardianRelation } = require('../models');

/**
 * 내 알림 목록 조회
 * GET /api/notifications?unread=true
 * 인증: user 또는 guardian (recipient_id 기준)
 */
const listMyNotifications = async (req, res, next) => {
  try {
    const recipientId = req.user.id;
    const { unread } = req.query;

    const filter = { recipient_id: recipientId };
    if (unread === 'true') {
      filter.read_at = { $exists: false };
    }

    const notifications = await Notification.find(filter)
      .sort({ created_at: -1 })
      .limit(50)
      .select('report_id user_id risk_level channel message sent_at read_at created_at');

    const unreadCount = await Notification.countDocuments({
      recipient_id: recipientId,
      read_at: { $exists: false },
    });

    return res.status(200).json({
      count: notifications.length,
      unread_count: unreadCount,
      notifications,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 단일 알림 확인 처리 (UC-10 사후조건)
 * PATCH /api/notifications/:id/read
 * 인증: 본인(recipient)만 가능
 * 응답에 연결된 report_id를 포함해 프론트가 리포트 화면으로 이동
 */
const markAsRead = async (req, res, next) => {
  try {
    const recipientId = req.user.id;
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
    }
    // 수신자 본인만 확인 처리 가능
    if (notification.recipient_id.toString() !== recipientId) {
      return res.status(403).json({ message: '이 알림에 대한 권한이 없습니다.' });
    }

    // 이미 읽은 경우 read_at 유지 (멱등)
    if (!notification.read_at) {
      notification.read_at = new Date();
      await notification.save();
    }

    return res.status(200).json({
      message: '알림을 확인 처리했습니다.',
      notification: {
        id: notification._id,
        report_id: notification.report_id, // 프론트 → 리포트 화면 이동
        user_id: notification.user_id,      // 측정 당사자 (보호자용)
        risk_level: notification.risk_level,
        read_at: notification.read_at,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 모든 알림 일괄 확인 처리
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const recipientId = req.user.id;
    const result = await Notification.updateMany(
      { recipient_id: recipientId, read_at: { $exists: false } },
      { $set: { read_at: new Date() } }
    );
    return res.status(200).json({
      message: '모든 알림을 확인 처리했습니다.',
      updated: result.modifiedCount,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 미확인 알림 개수만 조회 (헤더 뱃지 등 경량 폴링용)
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient_id: req.user.id,
      read_at: { $exists: false },
    });
    return res.status(200).json({ unread_count: unreadCount });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
