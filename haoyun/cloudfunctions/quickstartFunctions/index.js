const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const PREGNANCY_COLLECTION = 'pregnancy_records';

// ============ 用户数据管理 ============

// 获取用户孕期数据
const getUserData = async () => {
  const { OPENID } = cloud.getWXContext();
  try {
    const res = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();
    if (res.data.length > 0) {
      const record = res.data[0];
      return {
        success: true,
        data: {
          firstDay: record.firstDay,
          userName: record.userName || '准妈妈',
          lastUpdate: record.lastUpdate || '',
          completedChecks: record.completedChecks || [],
        },
      };
    }
    return { success: false, data: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 保存怀孕日期
const savePregnancyDate = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { firstDay, userName } = event;

  if (!firstDay) {
    return { success: false, error: '缺少日期参数' };
  }

  try {
    const existing = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();

    const now = new Date();
    const data = {
      firstDay,
      userName: userName || '准妈妈',
      lastUpdate: now.toISOString(),
      updatedAt: now,
    };

    if (existing.data.length > 0) {
      await db.collection(PREGNANCY_COLLECTION)
        .doc(existing.data[0]._id)
        .update({ data });
    } else {
      await db.collection(PREGNANCY_COLLECTION).add({
        data: {
          _openid: OPENID,
          ...data,
          createdAt: now,
        },
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 删除用户数据
const deleteUserData = async () => {
  const { OPENID } = cloud.getWXContext();
  try {
    const existing = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();
    if (existing.data.length > 0) {
      await db.collection(PREGNANCY_COLLECTION)
        .doc(existing.data[0]._id)
        .remove();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 保存已完成的检查项
const saveCompletedChecks = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { completedChecks } = event;

  try {
    const existing = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();

    if (existing.data.length > 0) {
      await db.collection(PREGNANCY_COLLECTION)
        .doc(existing.data[0]._id)
        .update({
          data: {
            completedChecks: completedChecks || [],
            updatedAt: new Date(),
          },
        });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 保存反馈意见
const saveFeedback = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { feedback } = event;

  try {
    const FEEDBACK_COLLECTION = 'pregnancy_feedback';
    await db.collection(FEEDBACK_COLLECTION).add({
      data: {
        _openid: OPENID,
        feedback,
        createdAt: new Date(),
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============ 云函数入口 ============

exports.main = async (event, context) => {
  switch (event.type) {
    case 'getUserData':
      return await getUserData();
    case 'savePregnancyDate':
      return await savePregnancyDate(event);
    case 'saveCompletedChecks':
      return await saveCompletedChecks(event);
    case 'saveFeedback':
      return await saveFeedback(event);
    case 'deleteUserData':
      return await deleteUserData();
    default:
      return { success: false, error: '未知的请求类型: ' + event.type };
  }
};
