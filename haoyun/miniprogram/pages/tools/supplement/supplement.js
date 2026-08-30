const STORAGE_FIRST_DAY = 'pregnancy_first_day';
const STORAGE_DATA = 'pregnancy_supplement_data';

// 叶酸建议服用期：孕0-12周（孕早期），12周后页面提示停服
const FOLIC_STOP_WEEK = 12;

Page({
  data: {
    week: 0,
    folicStopWeek: FOLIC_STOP_WEEK,
    folicPhase: '', // 'active' | 'review'
    folicTip: '',
    progesteroneOn: false,
    progesteroneDays: 0,
    progesteroneLeft: 0,
    progesteroneTip: '',
    progesteronePerDay: 1,
    progDots: [],
    progTodayDone: 0,
    today: '',
    todayDate: '',
    folicToday: false,
    progToday: false,
    streak: 0,
    recentDays: [], // 最近7天打卡情况
  },

  onLoad() {
    const now = new Date();
    const dateStr = this.formatDate(now);
    const dateCN = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    this.setData({ today: dateStr, todayDate: dateCN });
    this.calcWeek();
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  calcWeek() {
    let firstDay = '';
    try { firstDay = wx.getStorageSync(STORAGE_FIRST_DAY) || ''; } catch (e) {}
    if (!firstDay) return;
    // 修正时区：按本地日期解析
    const parts = firstDay.split('-').map(Number);
    const firstDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(firstDate.getTime())) return;
    const elapsedDays = Math.max(0, Math.floor((Date.now() - firstDate.getTime()) / 86400000));
    const week = Math.floor(elapsedDays / 7);
    this.setData({ week });
  },

  loadData() {
    let data = {};
    try { data = wx.getStorageSync(STORAGE_DATA) || {}; } catch (e) { data = {}; }
    const today = this.data.today;
    const records = data.records || {};
    const todayRecord = records[today] || {};

    // 叶酸阶段判断
    let folicPhase = 'active';
    let folicTip = '';
    if (this.data.week >= FOLIC_STOP_WEEK) {
      folicPhase = 'review';
      folicTip = '已满孕12周，建议遵医嘱评估是否继续服用叶酸';
    } else {
      folicTip = `孕早期（0-12周）是补叶酸关键期，还剩 ${(FOLIC_STOP_WEEK - this.data.week)} 周`;
    }

    // 孕酮疗程
    const progOn = data.progesteroneOn || false;
    const progDays = data.progesteroneDays || 0;
    const progPerDay = data.progesteronePerDay || 1;
    const progStart = data.progesteroneStart || '';
    let progLeft = 0;
    let progTip = '';
    if (progOn && progStart) {
      // 修正时区：把日期字符串当作本地日期 00:00 解析，避免 UTC 偏移导致天数少算
      const parts = progStart.split('-').map(Number);
      const start = new Date(parts[0], parts[1] - 1, parts[2]);
      const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000);
      progLeft = Math.max(0, progDays - elapsed);
      progTip = `疗程还剩 ${progLeft} 天，每日 ${progPerDay} 次，请遵医嘱`;
    } else if (progOn) {
      progTip = '请设置疗程开始日期';
    }

    // 孕酮今日打卡状态
    const progDoneArr = (todayRecord.progDots || []);
    const progDoneCount = progDoneArr.filter(Boolean).length;
    const progAllDone = progOn && progDoneCount >= progPerDay && progPerDay > 0;
    const progDots = [];
    for (let i = 0; i < progPerDay; i++) {
      progDots.push({ idx: i, on: !!progDoneArr[i] });
    }

    // 连续打卡天数（叶酸）
    let streak = 0;
    const today0 = new Date(today);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today0);
      d.setDate(d.getDate() - i);
      const ds = this.formatDate(d);
      if (records[ds] && records[ds].folic) streak++;
      else break;
    }

    // 最近7天
    const recent = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today0);
      d.setDate(d.getDate() - i);
      const ds = this.formatDate(d);
      const r = records[ds] || {};
      const progCnt = r.progDots ? r.progDots.filter(Boolean).length : (r.prog ? 1 : 0);
      let progState = 'none';
      if (progCnt > 0 && progCnt < this.data.progesteronePerDay) progState = 'partial';
      else if (progCnt >= this.data.progesteronePerDay && this.data.progesteronePerDay > 0) progState = 'done';
      else if (r.prog && this.data.progesteronePerDay <= 1) progState = 'done';
      recent.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        weekday: ['日','一','二','三','四','五','六'][d.getDay()],
        folic: !!r.folic,
        prog: !!r.prog,
        progCount: progCnt,
        progState,
        isToday: ds === today,
      });
    }

    this.setData({
      folicPhase,
      folicTip,
      folicToday: !!todayRecord.folic,
      progesteroneOn: progOn,
      progesteroneDays: progDays,
      progesteronePerDay: progPerDay,
      progesteroneLeft: progLeft,
      progesteroneTip: progTip,
      progDots,
      progTodayDone: progDoneCount,
      progAllDone,
      streak,
      recentDays: recent,
    });
  },

  // 打卡叶酸
  toggleFolic() {
    if (this.data.folicPhase === 'review') {
      wx.showToast({ title: '已过建议服用期，请遵医嘱', icon: 'none' });
      return;
    }
    const data = this.readData();
    const records = data.records || {};
    const today = this.data.today;
    if (!records[today]) records[today] = {};
    records[today].folic = !records[today].folic;
    data.records = records;
    this.writeData(data);
    this.loadData();
    if (records[today].folic) {
      wx.vibrateShort({ type: 'light' });
      wx.showToast({ title: '叶酸已打卡 ✓', icon: 'success' });
    }
  },

  // 孕酮单次打卡（按每日次数的第 idx 个）
  tapProgDot(e) {
    if (!this.data.progesteroneOn) {
      wx.showToast({ title: '请先开启孕酮疗程', icon: 'none' });
      return;
    }
    const idx = e.currentTarget.dataset.idx;
    const data = this.readData();
    const records = data.records || {};
    const today = this.data.today;
    if (!records[today]) records[today] = {};
    if (!records[today].progDots) records[today].progDots = [];
    // 点击切换该次状态
    records[today].progDots[idx] = !records[today].progDots[idx];
    // 兼容旧字段 prog
    records[today].prog = records[today].progDots.some(Boolean);
    data.records = records;
    this.writeData(data);
    this.loadData();
    if (records[today].progDots[idx]) {
      wx.vibrateShort({ type: 'light' });
      const done = records[today].progDots.filter(Boolean).length;
      if (done === this.data.progesteronePerDay) {
        wx.showToast({ title: '今日孕酮已服完 ✓', icon: 'success' });
      }
    }
  },

  readData() {
    try { return wx.getStorageSync(STORAGE_DATA) || {}; } catch (e) { return {}; }
  },

  writeData(data) {
    try { wx.setStorageSync(STORAGE_DATA, data); } catch (e) {}
  },

  // 开启孕酮疗程（先选每日次数，再选疗程天数）
  openProgSheet() {
    const that = this;
    wx.showActionSheet({
      itemList: ['每日 1 次', '每日 2 次', '每日 3 次', '每日 4 次', '关闭孕酮'],
      success: (res) => {
        const data = that.readData();
        if (res.tapIndex === 4) {
          data.progesteroneOn = false;
          data.progesteroneDays = 0;
          data.progesteroneStart = '';
          data.progesteronePerDay = 1;
          that.writeData(data);
          that.loadData();
          wx.showToast({ title: '已关闭孕酮', icon: 'none' });
          return;
        }
        const perDay = res.tapIndex + 1;
        // 选完次数再选疗程天数
        wx.showActionSheet({
          itemList: ['7 天疗程', '14 天疗程', '30 天疗程', '自定义'],
          success: (r2) => {
            if (r2.tapIndex === 3) {
              // 自定义疗程天数
              wx.showModal({
                title: '疗程天数',
                editable: true,
                placeholderText: '输入天数',
                success: (m) => {
                  if (m.confirm) {
                    const days = parseInt(m.content, 10);
                    if (!days || days <= 0) {
                      wx.showToast({ title: '天数无效', icon: 'none' });
                      return;
                    }
                    that.applyProg(data, perDay, days);
                  }
                },
              });
              return;
            }
            const days = [7, 14, 30][r2.tapIndex];
            that.applyProg(data, perDay, days);
          },
        });
      },
    });
  },

  applyProg(data, perDay, days) {
    data.progesteroneOn = true;
    data.progesteronePerDay = perDay;
    data.progesteroneDays = days;
    data.progesteroneStart = this.data.today;
    this.writeData(data);
    this.loadData();
    wx.showToast({ title: `已开启：每日${perDay}次/共${days}天`, icon: 'success' });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
