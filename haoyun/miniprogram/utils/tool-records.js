// 工具类记录通用存取与云端同步（胎动/宫缩/日记）
const PREFIX = 'pregnancy_tool_';

function readLocal(kind) {
  try {
    return wx.getStorageSync(PREFIX + kind) || [];
  } catch (err) {
    return [];
  }
}

function writeLocal(kind, records) {
  try {
    wx.setStorageSync(PREFIX + kind, records);
    return true;
  } catch (err) {
    return false;
  }
}

// 上传单条记录到云端（异步，失败静默，下次进入页面自动补传）
function uploadRecord(kind, record) {
  return wx.cloud.callFunction({
    name: 'quickstartFunctions',
    data: { type: 'saveToolRecord', kind, record },
  }).catch((err) => {
    console.warn('工具记录上传云端失败', err);
  });
}

// 删除云端单条记录
function deleteCloudRecord(kind, localId) {
  return wx.cloud.callFunction({
    name: 'quickstartFunctions',
    data: { type: 'deleteToolRecord', kind, localId },
  }).catch((err) => {
    console.warn('云端删除失败', err);
  });
}

// 清空云端某类记录
function clearCloudRecords(kind) {
  return wx.cloud.callFunction({
    name: 'quickstartFunctions',
    data: { type: 'clearToolRecords', kind },
  }).catch((err) => {
    console.warn('云端清空失败', err);
  });
}

// 与云端同步合并：本地多出的补传云端，云端多出的合并到本地
async function syncWithCloud(kind, renderFn) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getToolRecords', kind },
    });
    if (!result || !result.success || !result.data) return;

    const localRecords = readLocal(kind);
    const cloudRecords = result.data.map((d) => ({ ...d.data, id: d.localId }));

    const cloudIds = {};
    cloudRecords.forEach((r) => { cloudIds[r.id] = true; });
    const localIds = {};
    localRecords.forEach((r) => { localIds[r.id] = true; });

    const toUpload = localRecords.filter((r) => !cloudIds[r.id]);
    toUpload.forEach((r) => uploadRecord(kind, r));

    const merged = [...localRecords];
    cloudRecords.forEach((r) => {
      if (!localIds[r.id]) merged.push(r);
    });

    if (toUpload.length > 0 || merged.length !== localRecords.length) {
      writeLocal(kind, merged);
      if (renderFn) renderFn(merged);
    }
  } catch (err) {
    console.warn('云端同步失败，使用本地数据', err);
  }
}

module.exports = {
  readLocal,
  writeLocal,
  uploadRecord,
  deleteCloudRecord,
  clearCloudRecords,
  syncWithCloud,
};
