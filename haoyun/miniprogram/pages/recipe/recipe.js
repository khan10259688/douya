const { MEAL_DATA } = require('./recipe-data.js');

const STORAGE_FIRST_DAY = 'pregnancy_first_day';

// 三餐展示配置
const MEAL_KEYS = [
  { key: 'breakfast', label: '早餐', emoji: '🌅', accent: 'breakfast' },
  { key: 'lunch', label: '午餐', emoji: '☀️', accent: 'lunch' },
  { key: 'dinner', label: '晚餐', emoji: '🌙', accent: 'dinner' },
];

Page({
  data: {
    isReady: false,
    month: 1,
    monthText: '',
    weekText: '',
    nutrients: [],
    nutrientTip: '',
    meals: [],
    changeCount: {},
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    // 每次进入都重新计算（首页可能刚设置/修改了日期）
    this.initPage();
  },

  // 初始化：获取怀孕日期 → 计算孕周孕月 → 生成推荐
  async initPage() {
    let firstDay = '';
    try {
      firstDay = wx.getStorageSync(STORAGE_FIRST_DAY) || '';
    } catch (err) {}

    // 本地没有时尝试云端档案
    if (!firstDay) {
      try {
        const { result } = await wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'getUserData' },
        });
        if (result && result.success && result.data && result.data.firstDay) {
          firstDay = result.data.firstDay;
          try {
            wx.setStorageSync(STORAGE_FIRST_DAY, firstDay);
          } catch (err) {}
        }
      } catch (err) {}
    }

    if (!firstDay) {
      this.setData({ isReady: false });
      return;
    }

    const firstDate = new Date(firstDay);
    if (isNaN(firstDate.getTime())) {
      this.setData({ isReady: false });
      return;
    }

    const elapsedDays = Math.max(0, Math.floor((Date.now() - firstDate.getTime()) / 86400000));
    const week = Math.floor(elapsedDays / 7);
    const month = Math.max(1, Math.min(10, Math.floor(week / 4) + 1));

    this.setData({
      isReady: true,
      month,
      monthText: `孕${month}月`,
      weekText: `孕${week}周`,
    }, () => {
      this.buildMeals();
    });
  },

  // 生成三餐推荐：按日期取种子，同一天推荐稳定
  buildMeals() {
    const data = MEAL_DATA[this.data.month - 1];
    if (!data) return;

    // 日期种子：一年中的第几天
    const now = new Date();
    const daySeed = Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 0)) / 86400000
    );

    const changeCount = this.data.changeCount || {};
    const meals = MEAL_KEYS.map((cfg, mi) => {
      const combos = data.meals[cfg.key];
      const idx = (daySeed + mi * 3 + (changeCount[cfg.key] || 0)) % combos.length;
      return {
        key: cfg.key,
        label: cfg.label,
        emoji: cfg.emoji,
        accent: cfg.accent,
        dishes: combos[idx],
      };
    });

    this.setData({
      nutrients: data.nutrients,
      nutrientTip: data.tip,
      meals,
    });
  },

  // 换一批（单餐）
  onChangeMeal(e) {
    const key = e.currentTarget.dataset.key;
    const changeCount = { ...(this.data.changeCount || {}) };
    changeCount[key] = (changeCount[key] || 0) + 1;
    this.setData({ changeCount }, () => {
      this.buildMeals();
    });
  },

  // 跳转首页设置
  goHome() {
    wx.switchTab({
      url: '/pages/home/home',
    });
  },
});
