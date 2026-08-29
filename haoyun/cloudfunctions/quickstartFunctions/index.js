const cloud = require("wx-server-sdk");
const ids = require("./config-ids.js");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const PREGNANCY_COLLECTION = 'pregnancy_records';
const WEIGHT_COLLECTION = 'weight_records';
const TOOL_COLLECTION = 'tool_records';

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

// ============ 工具类记录管理（胎动/宫缩/日记） ============

// 获取用户某类工具记录（支持分页）
const getToolRecords = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { kind } = event;
  if (!kind) {
    return { success: false, error: '缺少 kind 参数' };
  }
  try {
    const countResult = await db.collection(TOOL_COLLECTION)
      .where({ _openid: OPENID, kind })
      .count();
    const total = countResult.total;
    const MAX_LIMIT = 100;
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection(TOOL_COLLECTION)
          .where({ _openid: OPENID, kind })
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

// 保存/更新单条工具记录（按 _openid + kind + localId 去重）
const saveToolRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { kind, record } = event;
  if (!kind || !record || !record.id) {
    return { success: false, error: '缺少参数' };
  }
  try {
    const existing = await db.collection(TOOL_COLLECTION)
      .where({ _openid: OPENID, kind, localId: record.id })
      .get();
    if (existing.data.length > 0) {
      await db.collection(TOOL_COLLECTION)
        .doc(existing.data[0]._id)
        .update({ data: { data: record, updatedAt: new Date() } });
    } else {
      await db.collection(TOOL_COLLECTION).add({
        data: {
          _openid: OPENID,
          kind,
          localId: record.id,
          data: record,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 删除单条工具记录
const deleteToolRecord = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { kind, localId } = event;
  if (!kind || !localId) {
    return { success: false, error: '缺少参数' };
  }
  try {
    const existing = await db.collection(TOOL_COLLECTION)
      .where({ _openid: OPENID, kind, localId })
      .get();
    for (const doc of existing.data) {
      await db.collection(TOOL_COLLECTION).doc(doc._id).remove();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 清空用户某类工具记录
const clearToolRecords = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { kind } = event;
  if (!kind) {
    return { success: false, error: '缺少 kind 参数' };
  }
  try {
    const existing = await db.collection(TOOL_COLLECTION)
      .where({ _openid: OPENID, kind })
      .get();
    for (const doc of existing.data) {
      await db.collection(TOOL_COLLECTION).doc(doc._id).remove();
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============ 待产包勾选管理 ============

// 保存待产包勾选状态（存入孕期档案文档）
const saveBagChecks = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { bagChecks } = event;
  try {
    const existing = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .get();
    if (existing.data.length > 0) {
      await db.collection(PREGNANCY_COLLECTION)
        .doc(existing.data[0]._id)
        .update({ data: { bagChecks: bagChecks || [], updatedAt: new Date() } });
    } else {
      await db.collection(PREGNANCY_COLLECTION).add({
        data: {
          _openid: OPENID,
          bagChecks: bagChecks || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============ 产检提醒订阅消息推送 ============

// 订阅消息模板ID（集中管理于 config-ids.js）
const CHECK_REMINDER_TEMPLATE_ID = ids.TEMPLATE_CHECK_REMINDER;

// 产检项定义（用于判断当前该做哪项）
const CHECK_ITEMS = [
  { name: '确认怀孕检查（血HCG、孕酮）', weekStart: 4, weekEnd: 5 },
  { name: 'B超检查（排除宫外孕）', weekStart: 5, weekEnd: 6 },
  { name: 'B超查胎心胎芽', weekStart: 6, weekEnd: 7 },
  { name: '建档检查（全面体检）', weekStart: 8, weekEnd: 12 },
  { name: 'NT检查', weekStart: 11, weekEnd: 13 },
  { name: '系统B超（大排畸）', weekStart: 20, weekEnd: 24 },
  { name: '糖耐量检查（OGTT）', weekStart: 24, weekEnd: 28 },
  { name: '小排畸B超', weekStart: 28, weekEnd: 32 },
  { name: '胎心监护（NST）', weekStart: 34, weekEnd: 40 },
  { name: '产前全面检查', weekStart: 37, weekEnd: 40 },
];

// 给当前用户发送一条产检提醒（用户点横幅授权后立即调用）
const sendMyCheckReminder = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!CHECK_REMINDER_TEMPLATE_ID) {
    return { success: false, error: '未配置模板ID' };
  }
  try {
    const res = await db.collection(PREGNANCY_COLLECTION)
      .where({ _openid: OPENID })
      .field({ firstDay: true, completedChecks: true })
      .get();
    if (!res.data.length || !res.data[0].firstDay) {
      return { success: false, error: '无怀孕记录' };
    }
    const record = res.data[0];
    const firstDate = new Date(record.firstDay);
    if (isNaN(firstDate.getTime())) {
      return { success: false, error: '日期无效' };
    }
    const now = new Date();
    const elapsedDays = Math.floor((now - firstDate) / 86400000);
    const week = Math.floor(elapsedDays / 7);
    const currentDay = week * 7 + (elapsedDays % 7);
    const completedChecks = record.completedChecks || [];

    const pending = CHECK_ITEMS.find((c) => {
      if (completedChecks.indexOf(c.name) !== -1) return false;
      return currentDay >= c.weekStart * 7 && currentDay <= c.weekEnd * 7 + 6;
    });
    if (!pending) {
      return { success: false, error: '当前无需提醒的产检' };
    }

    // 计算产检截止日期（firstDay + weekEnd*7 + 6 天）
    const dueDate = new Date(firstDate);
    dueDate.setDate(dueDate.getDate() + pending.weekEnd * 7 + 6);
    const dueDateStr = `${dueDate.getFullYear()}年${dueDate.getMonth() + 1}月${dueDate.getDate()}日`;

    await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: CHECK_REMINDER_TEMPLATE_ID,
      // 模板字段：姓名 / 预约项目 / 原预约时间 / 温馨提示
      data: {
        thing1: { value: record.userName || '准妈妈' },
        thing2: { value: pending.name },
        time3: { value: dueDateStr },
        thing4: { value: '建议尽快完成此项检查' },
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// 发送产检提醒（由定时触发器调用，遍历需要提醒的用户并发送）
const sendCheckReminders = async () => {
  if (!CHECK_REMINDER_TEMPLATE_ID) {
    return { success: false, error: '未配置模板ID' };
  }
  try {
    // 获取所有有怀孕记录的用户
    const MAX_LIMIT = 100;
    const countResult = await db.collection(PREGNANCY_COLLECTION).count();
    const total = countResult.total;
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection(PREGNANCY_COLLECTION)
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .field({ _openid: true, firstDay: true, userName: true, completedChecks: true })
          .get()
      );
    }
    const results = await Promise.all(tasks);
    const allUsers = results.reduce((acc, cur) => acc.concat(cur.data), []);

    const now = new Date();
    let sentCount = 0;

    for (const user of allUsers) {
      if (!user.firstDay) continue;
      const firstDate = new Date(user.firstDay);
      if (isNaN(firstDate.getTime())) continue;
      const elapsedDays = Math.floor((now - firstDate) / 86400000);
      const week = Math.floor(elapsedDays / 7);
      const currentDay = week * 7 + (elapsedDays % 7);

      // 判断是否有"当前需做且未完成"的产检项
      const completedChecks = user.completedChecks || [];
      const checks = [
        { name: '确认怀孕检查（血HCG、孕酮）', weekStart: 4, weekEnd: 5 },
        { name: 'B超检查（排除宫外孕）', weekStart: 5, weekEnd: 6 },
        { name: 'B超查胎心胎芽', weekStart: 6, weekEnd: 7 },
        { name: '建档检查（全面体检）', weekStart: 8, weekEnd: 12 },
        { name: 'NT检查', weekStart: 11, weekEnd: 13 },
        { name: '系统B超（大排畸）', weekStart: 20, weekEnd: 24 },
        { name: '糖耐量检查（OGTT）', weekStart: 24, weekEnd: 28 },
        { name: '小排畸B超', weekStart: 28, weekEnd: 32 },
        { name: '胎心监护（NST）', weekStart: 34, weekEnd: 40 },
        { name: '产前全面检查', weekStart: 37, weekEnd: 40 },
      ];
      const pending = checks.find((c) => {
        if (completedChecks.indexOf(c.name) !== -1) return false;
        return currentDay >= c.weekStart * 7 && currentDay <= c.weekEnd * 7 + 6;
      });
      if (!pending) continue;

      // 发送订阅消息
      try {
        const dueDate = new Date(firstDate);
        dueDate.setDate(dueDate.getDate() + pending.weekEnd * 7 + 6);
        const dueDateStr = `${dueDate.getFullYear()}年${dueDate.getMonth() + 1}月${dueDate.getDate()}日`;

        await cloud.openapi.subscribeMessage.send({
          touser: user._openid,
          templateId: CHECK_REMINDER_TEMPLATE_ID,
          data: {
            thing1: { value: user.userName || '准妈妈' },
            thing2: { value: pending.name },
            time3: { value: dueDateStr },
            thing4: { value: '建议尽快完成此项检查' },
          },
        });
        sentCount += 1;
      } catch (err) {
        // 用户未授权或配额不足时静默跳过
        console.warn('发送失败', user._openid, err.errMsg);
      }
    }
    return { success: true, sent: sentCount };
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
  // 定时触发器调用（event.Trigger 存在表示是定时触发）
  if (event.Trigger) {
    return await sendCheckReminders();
  }
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
    case 'getToolRecords':
      return await getToolRecords(event);
    case 'saveToolRecord':
      return await saveToolRecord(event);
    case 'deleteToolRecord':
      return await deleteToolRecord(event);
    case 'clearToolRecords':
      return await clearToolRecords(event);
    case 'saveBagChecks':
      return await saveBagChecks(event);
    case 'sendCheckReminders':
      return await sendCheckReminders();
    case 'sendMyCheckReminder':
      return await sendMyCheckReminder();
    default:
      return { success: false, error: '未知的请求类型: ' + event.type };
  }
};
