const toolRecords = require('../../../utils/tool-records.js');

const KIND = 'contraction';

Page({
  data: {
    running: false,
    elapsedText: '00:00',
    list: [],
    patternAlert: false,
  },

  onLoad() {
    this.render(toolRecords.readLocal(KIND));
    toolRecords.syncWithCloud(KIND, (rs) => this.render(rs));
  },

  onShow() {
    this.render(toolRecords.readLocal(KIND));
  },

  onUnload() {
    this.stopTimer();
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatClock(d) {
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  },

  formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}秒`;
    if (s === 0) return `${m}分`;
    return `${m}分${s}秒`;
  },

  // 渲染今日宫缩列表
  render(allRecords) {
    const today = this.formatDate(new Date());
    const todayList = allRecords
      .filter((r) => r.date === today)
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    const list = todayList.map((r, i) => ({
      ...r,
      index: i + 1,
      durationText: this.formatDuration(r.durationSec),
      intervalText: r.intervalSec != null ? this.formatDuration(r.intervalSec) : '—',
    }));
    this.setData({ list });
    this.checkPattern(list);
  },

  // 5-1-1 规律检测：最近 6 次平均间隔 ≤ 5 分钟 且 平均持续 ≥ 45 秒
  checkPattern(list) {
    if (list.length < 6) {
      this.setData({ patternAlert: false });
      return;
    }
    const recent = list.slice(-6);
    const intervals = recent.filter((r) => r.intervalSec != null).map((r) => r.intervalSec);
    const durations = recent.map((r) => r.durationSec);
    if (intervals.length === 0) {
      this.setData({ patternAlert: false });
      return;
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    this.setData({ patternAlert: avgInterval <= 300 && avgDuration >= 45 });
  },

  // 主按钮：开始/结束
  onTapMain() {
    if (!this.data.running) {
      this.startContraction();
    } else {
      this.stopContraction();
    }
  },

  startContraction() {
    this._startTime = Date.now();
    this.setData({ running: true, elapsedText: '00:00' });
    this._timer = setInterval(() => this.updateElapsed(), 1000);
    wx.vibrateShort({ type: 'light' });
  },

  updateElapsed() {
    const sec = Math.floor((Date.now() - this._startTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    this.setData({ elapsedText: `${mm}:${ss}` });
  },

  stopContraction() {
    this.stopTimer();
    const durationSec = Math.floor((Date.now() - this._startTime) / 1000);
    const now = new Date();

    // 计算与上一次宫缩的间隔（start-to-start）：取本次之前最近的一条，不限同一天，避免跨日漏算
    const today = this.formatDate(now);
    const allRecords = toolRecords.readLocal(KIND);
    const beforeThis = allRecords
      .filter((r) => {
        // 比本次开始时间早的（按日期+时间字符串比较）
        const thisKey = today + ' ' + this.formatClock(now);
        return (r.date + ' ' + r.start) < thisKey;
      })
      .sort((a, b) => ((a.date + ' ' + a.start) < (b.date + ' ' + b.start) ? 1 : -1));
    let intervalSec = null;
    if (beforeThis.length > 0) {
      const last = beforeThis[0];
      // 上次 start 距这次 start 的秒数：按各自日期+时间构造本地时间戳
      const lp = last.date.split('-').map(Number);
      const [lh, lmi, ls] = last.start.split(':').map(Number);
      const lastTs = new Date(lp[0], lp[1] - 1, lp[2], lh, lmi, ls).getTime();
      intervalSec = Math.max(0, Math.floor((this._startTime - lastTs) / 1000));
    }

    const record = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: today,
      start: this.formatClock(now),
      durationSec,
      intervalSec,
    };
    const records = toolRecords.readLocal(KIND);
    records.push(record);
    toolRecords.writeLocal(KIND, records);
    toolRecords.uploadRecord(KIND, record);

    this.setData({ running: false, elapsedText: '00:00' });
    this.render(records);
    wx.vibrateShort({ type: 'light' });
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  clearToday() {
    if (this.data.list.length === 0) return;
    wx.showModal({
      title: '清空今日宫缩',
      content: '确定清空今天的宫缩记录吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        const today = this.formatDate(new Date());
        const keep = toolRecords.readLocal(KIND).filter((r) => r.date !== today);
        toolRecords.writeLocal(KIND, keep);
        toolRecords.clearCloudRecords(KIND);
        this.render(keep);
        wx.showToast({ title: '已清空', icon: 'none' });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },
});
