const { BAG_ITEMS } = require('./bag-data.js');

const STORAGE_KEY = 'pregnancy_bag_checks';

Page({
  data: {
    categories: [],
    checkedCount: 0,
    total: 0,
    progressPct: 0,
    progressText: '',
  },

  onLoad() {
    this.build();
    this.syncFromCloud();
  },

  onShow() {
    this.build();
  },

  // 构建展示数据
  build() {
    const checked = this.readChecked();
    const checkedSet = {};
    checked.forEach((id) => { checkedSet[id] = true; });

    const categories = BAG_ITEMS.map((cat) => {
      const items = cat.items.map((it) => ({
        ...it,
        checked: !!checkedSet[it.id],
      }));
      const doneCount = items.filter((it) => it.checked).length;
      return {
        key: cat.key,
        title: cat.title,
        emoji: cat.emoji,
        items,
        doneCount,
      };
    });

    const total = BAG_ITEMS.reduce((s, c) => s + c.items.length, 0);
    const checkedCount = checked.filter((id) => {
      const all = [];
      BAG_ITEMS.forEach((c) => c.items.forEach((it) => all.push(it.id)));
      return all.indexOf(id) !== -1;
    }).length;
    const progressPct = total ? Math.round((checkedCount / total) * 100) : 0;

    let progressText = '孕晚期前备齐更从容';
    if (checkedCount === 0) progressText = '一件还没备齐，慢慢来';
    else if (checkedCount === total) progressText = '全部备齐，安心待产 🎉';
    else if (progressPct >= 70) progressText = '快好啦，再加把劲';

    this.setData({ categories, checkedCount, total, progressPct, progressText });
  },

  readChecked() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || [];
    } catch (err) {
      return [];
    }
  },

  writeChecked(ids) {
    try {
      wx.setStorageSync(STORAGE_KEY, ids);
    } catch (err) {}
  },

  // 切换勾选
  toggleItem(e) {
    const id = e.currentTarget.dataset.id;
    let checked = this.readChecked();
    const idx = checked.indexOf(id);
    if (idx !== -1) checked.splice(idx, 1);
    else checked.push(id);
    this.writeChecked(checked);
    this.build();
    // 同步云端
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveBagChecks', bagChecks: checked },
    }).catch((err) => {
      console.warn('待产包同步云端失败', err);
    });
  },

  // 从云端拉取并合并
  async syncFromCloud() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getUserData' },
      });
      if (!result || !result.success || !result.data) return;
      const cloudChecked = result.data.bagChecks || [];
      const localChecked = this.readChecked();
      const localSet = {};
      localChecked.forEach((id) => { localSet[id] = true; });

      // 云端有、本地没有 → 合并到本地
      let changed = false;
      const merged = [...localChecked];
      cloudChecked.forEach((id) => {
        if (!localSet[id]) { merged.push(id); changed = true; }
      });

      // 本地有、云端没有 → 补传云端
      const cloudSet = {};
      cloudChecked.forEach((id) => { cloudSet[id] = true; });
      const needUpload = localChecked.some((id) => !cloudSet[id]);

      if (changed || needUpload) {
        this.writeChecked(merged);
        this.build();
        if (needUpload) {
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: { type: 'saveBagChecks', bagChecks: merged },
          }).catch(() => {});
        }
      }
    } catch (err) {
      // 静默降级
    }
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
