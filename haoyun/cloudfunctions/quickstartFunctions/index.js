const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const PREGNANCY_COLLECTION = 'pregnancy_records';
const WEIGHT_COLLECTION = 'weight_records';

// ============ 体重记录管理 ============

// 获取用户全部体重记录（支持分页，突破单批 100 条限制）
const getWeightRecords = async () => {
  const { OPENID } = cloud.getWXContext();
  try {
    const countResult = await db.collection(WEIGHT_COLLECTION)
      .where({ _openid: OPENID })
      .count();
    const total = countResult.total;
    const MAX_LIMIT = 100;
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection(WEIGHT_COLLECTION)
          .where({ _openid: OPENID })
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get()
      );
    }
    const results = await Promise.all(tasks);
    const data = results.reduce((acc, cur) => acc.concat(cur.data), []);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 保存/更新单条体重记录（按 _openid + localId 去重）
const saveWeightRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { record } = event;

  if (!record || !record.id) {
    return { success: false, error: '缺少记录参数' };
  }

  try {
    const existing = await db.collection(WEIGHT_COLLECTION)
      .where({ _openid: OPENID, localId: record.id })
      .get();

    const data = {
      localId: record.id,
      date: record.date,
      time: record.time || '',
      periodKey: record.periodKey || '',
      periodLabel: record.periodLabel || '',
      weight: record.weight,
      updatedAt: new Date(),
    };

    if (existing.data.length > 0) {
      await db.collection(WEIGHT_COLLECTION)
        .doc(existing.data[0]._id)
        .update({ data });
    } else {
      await db.collection(WEIGHT_COLLECTION).add({
        data: {
          _openid: OPENID,
          ...data,
          createdAt: new Date(),
        },
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 删除单条体重记录
const deleteWeightRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { localId } = event;

  if (!localId) {
    return { success: false, error: '缺少 localId 参数' };
  }

  try {
    const existing = await db.collection(WEIGHT_COLLECTION)
      .where({ _openid: OPENID, localId })
      .get();
    for (const doc of existing.data) {
      await db.collection(WEIGHT_COLLECTION).doc(doc._id).remove();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 清空用户全部体重记录
const clearWeightRecords = async () => {
  const { OPENID } = cloud.getWXContext();
  try {
    const existing = await db.collection(WEIGHT_COLLECTION)
      .where({ _openid: OPENID })
      .get();
    for (const doc of existing.data) {
      await db.collection(WEIGHT_COLLECTION).doc(doc._id).remove();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

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
          registerWeight: record.registerWeight || 0,
          registerDate: record.registerDate || '',
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

// 保存建档体重（存入孕期档案文档，与 firstDay 同集合）
const saveRegisterWeight = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { registerWeight, registerDate } = event;

  if (!registerWeight) {
    return { success: false, error: '缺少体重参数' };
  }

  try {
    const existing = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();

    const data = {
      registerWeight,
      registerDate: registerDate || '',
      updatedAt: new Date(),
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
          createdAt: new Date(),
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
    case 'saveRegisterWeight':
      return await saveRegisterWeight(event);
    case 'saveFeedback':
      return await saveFeedback(event);
    case 'deleteUserData':
      return await deleteUserData();
    case 'getWeightRecords':
      return await getWeightRecords();
    case 'saveWeightRecord':
      return await saveWeightRecord(event);
    case 'deleteWeightRecord':
      return await deleteWeightRecord(event);
    case 'clearWeightRecords':
      return await clearWeightRecords();
    default:
      return { success: false, error: '未知的请求类型: ' + event.type };
  }
};
