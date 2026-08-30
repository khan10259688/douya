const STORAGE_KEY = 'pregnancy_weight_records';
const REGISTER_KEY = 'pregnancy_register_weight';

// 记录类型定义
const RECORD_TYPES = [
  { key: 'morning', tag: '推荐', emoji: '🍳', label: '晨起空腹', desc: '适合看长期趋势' },
  { key: 'daytime', tag: '补充', emoji: '🍚', label: '日间任意时段', desc: '仅作参考' },
];

// 归一化记录类型（兼容旧的五时段数据：morning→晨起，其余→日间）
function normalizeType(periodKey) {
  return periodKey === 'morning' ? 'morning' : 'daytime';
}

// 在指定 2d 上下文绘制晨起趋势图（显示与导出共用）
// days: [{ date, morning|null }]；opts: { title, subtitle }
// 返回布局信息 { left, step, count }，供页面点击检测使用
function renderTrendChart(ctx, days, width, height, opts) {
  const { title, subtitle, selectedIndex } = opts || {};
  const hasHeader = !!title;

  const padding = {
    top: hasHeader ? 76 : 28,
    right: hasHeader ? 24 : 20,
    bottom: hasHeader ? 48 : 46,
    left: hasHeader ? 52 : 48,
  };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // 背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 标题区（导出图用）
  if (hasHeader) {
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, padding.left, 30);
    if (subtitle) {
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.fillText(subtitle, padding.left, 50);
    }
  }

  const xStep = days.length > 1 ? plotW / (days.length - 1) : plotW;
  const toX = (i) => padding.left + (days.length > 1 ? i * xStep : plotW / 2);

  // y 轴范围（仅晨起值）
  let min = Infinity;
  let max = -Infinity;
  days.forEach((d) => {
    if (d.morning === null || d.morning === undefined) return;
    if (d.morning < min) min = d.morning;
    if (d.morning > max) max = d.morning;
  });
  const hasAny = isFinite(min) && isFinite(max);

  let toY = null;
  if (hasAny) {
    // 标准刻度：按 1/2/5/10kg 步长取整，网格为标准整数值，
    // 刻度稳定，不随单日体重波动而漂移
    const rawSpan = max - min;
    let step = 1;
    if (rawSpan > 25) step = 10;
    else if (rawSpan > 10) step = 5;
    else if (rawSpan > 5) step = 2;

    const yMin = Math.max(0, Math.floor(min / step) * step - step);
    const yMax = Math.ceil(max / step) * step + step;
    toY = (w) => padding.top + (1 - (w - yMin) / (yMax - yMin)) * plotH;

    // 网格线 + y 轴刻度（标准步长）
    ctx.strokeStyle = '#F0E8E8';
    ctx.lineWidth = 1;
    const gridCount = Math.round((yMax - yMin) / step);
    for (let i = 0; i <= gridCount; i++) {
      const val = yMin + i * step;
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#B0A0A0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(val), padding.left - 6, y + 3);
    }
  } else {
    // 范围内无晨起记录
    ctx.fillStyle = '#C0B0B0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('该范围内暂无晨起空腹记录', padding.left + plotW / 2, padding.top + plotH / 2);
  }

  // x 轴日期刻度（过多时间隔显示）
  ctx.fillStyle = '#B0A0A0';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = days.length > 7 ? Math.ceil(days.length / 7) : 1;
  days.forEach((d, i) => {
    if (i % labelSkip !== 0 && i !== days.length - 1) return;
    const parts = d.date.split('-');
    ctx.fillText(`${parseInt(parts[1])}/${parseInt(parts[2])}`, toX(i), height - padding.bottom + 16);
  });

  // 缺失晨起数据的日期：在日期下方画小灰点
  const dotY = height - padding.bottom + 32;
  days.forEach((d, i) => {
    if (d.morning !== null && d.morning !== undefined) return;
    ctx.beginPath();
    ctx.arc(toX(i), dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#D8C8C8';
    ctx.fill();
  });

  // 晨起折线（橙色，连接有数据的日期）
  if (hasAny) {
    const pts = [];
    days.forEach((d, i) => {
      if (d.morning === null || d.morning === undefined) return;
      pts.push({ x: toX(i), y: toY(d.morning), idx: i });
    });
    ctx.strokeStyle = '#FF9F43';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    pts.forEach((p) => {
      const selected = selectedIndex === p.idx;
      ctx.beginPath();
      ctx.arc(p.x, p.y, selected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF9F43';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 选中点的体重气泡提示
    const sel = selectedIndex;
    if (sel !== null && sel !== undefined && days[sel] && days[sel].morning !== null && days[sel].morning !== undefined) {
      const px = toX(sel);
      const py = toY(days[sel].morning);
      const text = `${days[sel].morning} kg`;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(text).width;
      const bw = tw + 24;
      const bh = 30;
      // 气泡位置：默认在点上方，靠左/右/上边界时收敛
      let bx = px - bw / 2;
      bx = Math.max(4, Math.min(width - bw - 4, bx));
      let by = py - bh - 12;
      if (by < 4) by = py + 14;
      // 气泡体
      ctx.fillStyle = 'rgba(51, 51, 51, 0.92)';
      ctx.beginPath();
      const r = 6;
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
      ctx.lineTo(bx + r, by + bh);
      ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
      ctx.lineTo(bx, by + r);
      ctx.arcTo(bx, by, bx + r, by, r);
      ctx.closePath();
      ctx.fill();
      // 小三角指向数据点
      const tipX = Math.max(bx + 10, Math.min(bx + bw - 10, px));
      ctx.beginPath();
      if (by + bh < py) {
        ctx.moveTo(tipX - 6, by + bh);
        ctx.lineTo(tipX + 6, by + bh);
        ctx.lineTo(px, py - 6);
      } else {
        ctx.moveTo(tipX - 6, by);
        ctx.lineTo(tipX + 6, by);
        ctx.lineTo(px, py + 6);
      }
      ctx.closePath();
      ctx.fill();
      // 文字
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(text, bx + bw / 2, by + bh / 2 + 4);
    }
  }

  // 图例（仅晨起空腹）
  const legendY = hasHeader ? 26 : 12;
  const legendX = hasHeader ? Math.max(padding.left, width - padding.right - 100) : padding.left;
  ctx.strokeStyle = '#FF9F43';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + 22, legendY);
  ctx.stroke();
  ctx.fillStyle = '#666666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('晨起空腹', legendX + 28, legendY + 4);

  return { left: padding.left, step: xStep, count: days.length };
}

Page({
  data: {
    recordTypes: RECORD_TYPES,
    recordType: 'morning',
    showSheet: false,
    weightInput: '',
    today: '',
    todayISO: '',
    recordDate: '',
    recordDateCN: '',
    latestWeight: 0,
    totalCount: 0,
    todayCount: 0,
    weightDiff: 0,
    diffText: '',
    latestLabel: '',
    daytimeFluct: '',
    hasRecords: false,
    chartDays: [],
    chartReady: false,
    tapIndex: null,
    registerWeight: 0,
    registerDate: '',
    registerHeight: 0,
    bmiCategory: '',
    totalGain: '',
    gainClass: '',
    gainMaxKg: 16,
    showRegisterSheet: false,
    regWeightInput: '',
    regHeightInput: '',
    regDate: '',
    regDateCN: '',
    showDownloadModal: false,
    rangeType: '14',
    customStart: '',
    customEnd: '',
    downloading: false,
    keyboardHeight: 0,
  },

  onLoad() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const todayISO = this.formatDate(now);
    this.setData({
      today: todayStr,
      todayISO,
      recordDate: todayISO,
      recordDateCN: todayStr,
    });
    this.loadRegisterInfo();
    this.loadRecords();

    // 监听键盘弹起，推高抽屉底部，避免保存按钮被遮挡
    this._kbListener = (res) => {
      this.setData({ keyboardHeight: res.height || 0 });
    };
    wx.onKeyboardHeightChange && wx.onKeyboardHeightChange(this._kbListener);
  },

  onUnload() {
    if (this._kbListener) {
      wx.offKeyboardHeightChange && wx.offKeyboardHeightChange(this._kbListener);
    }
  },

  onShow() {
    this.loadRecords();
  },

  // 格式化日期为 YYYY-MM-DD
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // 读取本地记录
  readLocalRecords() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || [];
    } catch (err) {
      return [];
    }
  },

  // 写入本地记录
  writeLocalRecords(records) {
    try {
      wx.setStorageSync(STORAGE_KEY, records);
      return true;
    } catch (err) {
      return false;
    }
  },

  // 加载体重记录：先渲染本地，再后台同步云端
  loadRecords() {
    const records = this.readLocalRecords();
    this.renderRecords(records);
    this.syncWithCloud();
  },

  // 渲染记录到页面
  renderRecords(records) {
    // 按时间排序（新→旧）
    const sorted = [...records].sort((a, b) => {
      const ta = `${a.date} ${a.periodKey}`;
      const tb = `${b.date} ${b.periodKey}`;
      return ta < tb ? 1 : -1;
    }).map((r) => {
      const type = normalizeType(r.periodKey);
      return {
        ...r,
        typeLabel: type === 'morning' ? '晨起' : '日间',
        typeClass: type === 'morning' ? 'tag-morning' : 'tag-daytime',
      };
    });

    const todayStr = this.formatDate(new Date());
    const todayCount = records.filter((r) => r.date === todayStr).length;

    // 统计以晨起记录为准
    const morningSorted = sorted.filter((r) => normalizeType(r.periodKey) === 'morning');

    let latestWeight = 0;
    let weightDiff = 0;
    let diffText = '';
    let latestLabel = '';

    if (morningSorted.length > 0) {
      const latest = morningSorted[0];
      latestWeight = latest.weight;
      latestLabel = `${latest.date} 晨起`;
      if (morningSorted.length > 1) {
        const prev = morningSorted[1];
        weightDiff = +(latest.weight - prev.weight).toFixed(1);
        if (weightDiff > 0) diffText = `+${weightDiff.toFixed(1)}`;
        else diffText = weightDiff.toFixed(1);
      }
    }

    // 图表数据：最近 14 个自然日的晨起体重（含缺失）
    const chartDays = this.buildChartDays(records, 14);
    // 本周日间平均波动
    const daytimeFluct = this.computeDaytimeFluct(records);

    // 相对建档体重的总增重（以最新晨重为准）
    // 注：只呈现事实和医学参考范围，不做"偏快/偏慢"评判，避免给孕妇制造焦虑
    let totalGain = '';
    let gainClass = '';
    let gainPct = 0;
    let gainTarget = '';
    let gainMaxKg = 16;
    let gainMinKg = 11.5;
    let bmiCategory = '';
    if (this.data.registerWeight > 0 && latestWeight > 0) {
      const gain = +(latestWeight - this.data.registerWeight).toFixed(1);
      totalGain = gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1);
      gainClass = gain > 0 ? 'gain-up' : (gain < 0 ? 'gain-down' : '');

      // 根据身高+建档体重算 BMI，按 IOM 指南确定增重参考范围
      const height = this.data.registerHeight || 0;
      let bmiMin = 11.5, bmiMax = 16; // 默认正常 BMI
      if (height > 0) {
        const bmi = this.data.registerWeight / Math.pow(height / 100, 2);
        if (bmi < 18.5) { bmiMin = 12.5; bmiMax = 18; bmiCategory = '偏瘦'; }
        else if (bmi < 24) { bmiMin = 11.5; bmiMax = 16; bmiCategory = '正常'; }
        else if (bmi < 28) { bmiMin = 7; bmiMax = 11.5; bmiCategory = '超重'; }
        else { bmiMin = 5; bmiMax = 9; bmiCategory = '肥胖'; }
      }
      gainMaxKg = bmiMax;
      gainMinKg = bmiMin;
      // 进度条只展示当前增重占推荐范围的比例，不做评判
      gainPct = Math.min(100, Math.max(0, (gain / bmiMax) * 100));

      // 中性文案：只展示参考范围，不评判速度
      gainTarget = `孕期参考 ${bmiMin}~${bmiMax}kg`;
    }

    this.setData({
      records: sorted,
      latestWeight,
      totalCount: records.length,
      todayCount,
      weightDiff,
      diffText,
      latestLabel,
      daytimeFluct,
      totalGain,
      gainClass,
      gainPct,
      gainTarget,
      gainMaxKg,
      gainMinKg,
      bmiCategory,
      hasRecords: records.length > 0,
      chartDays,
      tapIndex: null,
    }, () => {
      this.drawChart();
    });
  },

  // 与云端同步：拉取云端记录，与本地合并（本地多出的补传云端，云端多出的合并到本地）
  async syncWithCloud() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getWeightRecords' },
      });
      if (!result || !result.success || !result.data) return;

      const localRecords = this.readLocalRecords();
      const cloudRecords = result.data.map((d) => ({
        id: d.localId,
        date: d.date,
        time: d.time,
        periodKey: d.periodKey,
        periodLabel: d.periodLabel,
        weight: d.weight,
      }));

      const cloudIds = {};
      cloudRecords.forEach((r) => { cloudIds[r.id] = true; });
      const localIds = {};
      localRecords.forEach((r) => { localIds[r.id] = true; });

      // 本地有、云端没有 → 补传到云端
      const toUpload = localRecords.filter((r) => !cloudIds[r.id]);
      for (const r of toUpload) {
        this.uploadRecord(r);
      }

      // 合并：以本地为基础，补上云端多出的记录
      const merged = [...localRecords];
      for (const r of cloudRecords) {
        if (!localIds[r.id]) merged.push(r);
      }

      if (toUpload.length > 0 || merged.length !== localRecords.length) {
        this.writeLocalRecords(merged);
        this.renderRecords(merged);
      }
    } catch (err) {
      // 云端不可用时静默降级，仅使用本地数据
      console.warn('云端同步失败，使用本地数据', err);
    }
  },

  // 上传单条记录到云端（异步，失败静默）
  uploadRecord(record) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveWeightRecord', record },
    }).catch((err) => {
      console.warn('体重记录上传云端失败', err);
    });
  },

  // ========== 建档体重 ==========

  // 读取建档体重（本地优先，再后台同步云端档案）
  loadRegisterInfo() {
    try {
      const info = wx.getStorageSync(REGISTER_KEY);
      if (info && info.weight) {
        this.setData({
          registerWeight: info.weight,
          registerDate: info.date || '',
          registerHeight: info.height || 0,
        });
      }
    } catch (err) {}
    this.syncRegisterInfo();
  },

  // 从云端档案拉取建档体重
  async syncRegisterInfo() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getUserData' },
      });
      if (!result || !result.success || !result.data) return;
      const { registerWeight, registerDate, registerHeight } = result.data;
      if (registerWeight > 0) {
        const changed = registerWeight !== this.data.registerWeight || registerDate !== this.data.registerDate || (registerHeight || 0) !== this.data.registerHeight;
        if (changed) {
          this.setData({ registerWeight, registerDate: registerDate || '', registerHeight: registerHeight || 0 });
          try {
            wx.setStorageSync(REGISTER_KEY, { weight: registerWeight, date: registerDate || '', height: registerHeight || 0 });
          } catch (err) {}
          this.renderRecords(this.readLocalRecords());
        }
      } else if (this.data.registerWeight > 0) {
        // 云端没有、本地有 → 补传云端
        this.uploadRegisterInfo(this.data.registerWeight, this.data.registerDate, this.data.registerHeight);
      }
    } catch (err) {
      // 静默降级
    }
  },

  // 上传建档体重到云端
  uploadRegisterInfo(weight, date, height) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'saveRegisterWeight', registerWeight: weight, registerDate: date, registerHeight: height || 0 },
    }).catch((err) => {
      console.warn('建档体重上传云端失败', err);
    });
  },

  // 打开建档体重设置抽屉
  openRegisterSheet() {
    const { registerWeight, registerDate, registerHeight, todayISO, today } = this.data;
    this.setData({
      showRegisterSheet: true,
      regWeightInput: registerWeight > 0 ? String(registerWeight) : '',
      regHeightInput: registerHeight > 0 ? String(registerHeight) : '',
      regDate: registerDate || todayISO,
      regDateCN: registerDate ? this.formatDateCN(registerDate) : today,
    });
  },

  // 关闭建档体重设置抽屉
  closeRegisterSheet() {
    this.setData({ showRegisterSheet: false }, () => this.drawChart());
  },

  // 格式化显示日期
  formatDateCN(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  },

  // 建档日期选择
  onRegDateChange(e) {
    const value = e.detail.value;
    if (value > this.data.todayISO) {
      wx.showToast({ title: '不能选择未来日期', icon: 'none' });
      return;
    }
    this.setData({ regDate: value, regDateCN: this.formatDateCN(value) });
  },

  // 建档体重输入
  onRegWeightInput(e) {
    let value = e.detail.value;
    value = value.replace(/[^\d.]/g, '');
    this.setData({ regWeightInput: value });
  },

  onRegHeightInput(e) {
    let value = e.detail.value;
    value = value.replace(/[^\d.]/g, '');
    this.setData({ regHeightInput: value });
  },

  // 保存建档体重
  saveRegisterInfo() {
    const { regWeightInput, regHeightInput, regDate } = this.data;
    const weight = parseFloat(regWeightInput);
    const height = parseFloat(regHeightInput);

    if (!regWeightInput || isNaN(weight) || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    if (weight < 30 || weight > 150) {
      wx.showToast({ title: '体重数值不太合理', icon: 'none' });
      return;
    }

    const w = +weight.toFixed(1);
    const h = (height && !isNaN(height) && height > 0) ? Math.round(height) : 0;
    if (regHeightInput && (height < 100 || height > 250)) {
      wx.showToast({ title: '身高数值不太合理', icon: 'none' });
      return;
    }

    this.setData({
      registerWeight: w,
      registerDate: regDate,
      registerHeight: h,
      showRegisterSheet: false,
      regWeightInput: '',
      regHeightInput: '',
    });
    try {
      wx.setStorageSync(REGISTER_KEY, { weight: w, date: regDate, height: h });
    } catch (err) {}
    this.uploadRegisterInfo(w, regDate, h);
    this.renderRecords(this.readLocalRecords());
    wx.showToast({ title: '已保存 ✓', icon: 'success' });
  },

  // ========== 图表数据构建 ==========

  // 日期 → 晨起体重 映射（当日多条取第一条）
  buildMorningMap(records) {
    const map = {};
    for (const r of records) {
      if (normalizeType(r.periodKey) !== 'morning') continue;
      if (map[r.date] === undefined) map[r.date] = r.weight;
    }
    return map;
  },

  // 最近 N 个自然日（含今天）的晨起体重序列
  buildChartDays(records, dayCount) {
    const map = this.buildMorningMap(records);
    const days = [];
    const today = new Date();
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const ds = this.formatDate(d);
      days.push({ date: ds, morning: map[ds] !== undefined ? map[ds] : null });
    }
    return days;
  },

  // 指定起止日期的晨起体重序列
  buildChartDaysRange(records, startISO, endISO) {
    const map = this.buildMorningMap(records);
    const days = [];
    const sp = startISO.split('-').map(Number);
    const ep = endISO.split('-').map(Number);
    const cur = new Date(sp[0], sp[1] - 1, sp[2]);
    const end = new Date(ep[0], ep[1] - 1, ep[2]);
    while (cur <= end) {
      const ds = this.formatDate(cur);
      days.push({ date: ds, morning: map[ds] !== undefined ? map[ds] : null });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  },

  // 本周日间平均波动：近 7 天内有「晨起+日间」记录的日期，日间均值与晨起差值的平均
  computeDaytimeFluct(records) {
    const byDate = {};
    for (const r of records) {
      const type = normalizeType(r.periodKey);
      if (!byDate[r.date]) byDate[r.date] = { morning: null, daySum: 0, dayCount: 0 };
      if (type === 'morning') {
        if (byDate[r.date].morning === null) byDate[r.date].morning = r.weight;
      } else {
        byDate[r.date].daySum += r.weight;
        byDate[r.date].dayCount += 1;
      }
    }

    const diffs = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const day = byDate[this.formatDate(d)];
      if (day && day.morning !== null && day.dayCount > 0) {
        diffs.push(day.daySum / day.dayCount - day.morning);
      }
    }
    if (diffs.length === 0) return '';
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return `± ${Math.abs(avg).toFixed(1)} kg`;
  },

  // ========== 记录抽屉 ==========

  noop() {},

  // 打开记录抽屉（默认今天、晨起）
  openSheet() {
    const now = new Date();
    const todayISO = this.formatDate(now);
    this.setData({
      showSheet: true,
      recordType: 'morning',
      recordDate: todayISO,
      recordDateCN: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
    });
  },

  // 关闭记录抽屉
  closeSheet() {
    this.setData({ showSheet: false }, () => this.drawChart());
  },

  // 选择记录类型
  onSelectType(e) {
    this.setData({ recordType: e.currentTarget.dataset.key });
  },

  // 选择记录日期（不允许未来）
  onRecordDateChange(e) {
    const value = e.detail.value;
    if (value > this.data.todayISO) {
      wx.showToast({ title: '不能记录未来日期', icon: 'none' });
      return;
    }
    const parts = value.split('-');
    this.setData({
      recordDate: value,
      recordDateCN: `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`,
    });
  },

  // 输入体重
  onWeightInput(e) {
    let value = e.detail.value;
    value = value.replace(/[^\d.]/g, '');
    this.setData({ weightInput: value });
  },

  // 保存记录
  saveRecord() {
    const { recordType, weightInput, recordDate, todayISO } = this.data;
    const weight = parseFloat(weightInput);

    if (!recordDate) {
      wx.showToast({ title: '请选择记录日期', icon: 'none' });
      return;
    }
    if (recordDate > todayISO) {
      wx.showToast({ title: '不能记录未来日期', icon: 'none' });
      return;
    }
    if (!weightInput || isNaN(weight) || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    if (weight < 20 || weight > 300) {
      wx.showToast({ title: '体重数值不太合理', icon: 'none' });
      return;
    }

    const typeInfo = RECORD_TYPES.find((t) => t.key === recordType) || RECORD_TYPES[0];
    const now = new Date();
    const record = {
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: recordDate,
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      periodKey: typeInfo.key,
      periodLabel: typeInfo.label,
      weight: +weight.toFixed(1),
    };

    const records = this.readLocalRecords();
    records.push(record);
    if (!this.writeLocalRecords(records)) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      return;
    }

    // 同步到云端（本地优先，云端失败不影响使用）
    this.uploadRecord(record);

    this.setData({ weightInput: '', showSheet: false });
    this.renderRecords(records);
    wx.showToast({ title: '已记录 ✓', icon: 'success' });
  },

  // 删除记录
  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条体重记录吗？',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        let records = this.readLocalRecords();
        records = records.filter((r) => r.id !== id);
        if (!this.writeLocalRecords(records)) {
          wx.showToast({ title: '删除失败', icon: 'none' });
          return;
        }
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'deleteWeightRecord', localId: id },
        }).catch((err) => {
          console.warn('云端删除失败', err);
        });
        this.renderRecords(records);
        wx.showToast({ title: '已删除', icon: 'none' });
      },
    });
  },

  // 跳转到全部记录页
  goHistory() {
    wx.navigateTo({
      url: '/pages/weight/history/history',
    });
  },

  // 清空所有记录
  clearAll() {
    wx.showModal({
      title: '清空记录',
      content: '确定要清空所有体重记录吗？此操作不可恢复。',
      confirmColor: '#FF6B81',
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync(STORAGE_KEY);
        } catch (err) {}
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { type: 'clearWeightRecords' },
        }).catch((err) => {
          console.warn('云端清空失败', err);
        });
        this.renderRecords([]);
        wx.showToast({ title: '已清空', icon: 'success' });
      },
    });
  },

  onShareAppMessage() {
    return {
      title: '🌸 好孕日记 · 陪伴你的孕期每一天',
      path: '/pages/home/home',
    };
  },

  // ========== 趋势图 ==========

  // 绘制晨起趋势图（最近 14 个自然日）
  drawChart(selectedIndex) {
    const { chartDays } = this.data;
    if (chartDays.length === 0) return;

    const query = wx.createSelectorQuery();
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio;
        const width = res[0].width;
        const height = res[0].height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.chartMeta = renderTrendChart(ctx, chartDays, width, height, {
          selectedIndex: selectedIndex !== undefined ? selectedIndex : this.data.tapIndex,
        });
        this.setData({ chartReady: true });
      });
  },

  // 点击图表：点中体重点显示对应体重；点灰点提示未记录
  onChartTap(e) {
    const meta = this.chartMeta;
    const days = this.data.chartDays;
    if (!meta || !days.length) return;
    let idx = 0;
    if (meta.count > 1) {
      idx = Math.round((e.detail.x - meta.left) / meta.step);
      idx = Math.max(0, Math.min(days.length - 1, idx));
    }
    const day = days[idx];
    if (!day) return;

    if (day.morning === null || day.morning === undefined) {
      const parts = day.date.split('-');
      wx.showToast({
        title: `${parseInt(parts[1])}月${parseInt(parts[2])}日未记录空腹体重，已自动忽略`,
        icon: 'none',
      });
      this.setData({ tapIndex: null });
      this.drawChart(null);
      return;
    }

    // 再次点击同一点则取消选中，否则显示该点体重气泡
    const next = this.data.tapIndex === idx ? null : idx;
    this.setData({ tapIndex: next });
    this.drawChart(next);
  },

  // ========== 下载趋势图 ==========

  // 打开下载弹窗
  showDownloadModal() {
    this.setData({ showDownloadModal: true });
  },

  // 关闭下载弹窗
  hideDownloadModal() {
    this.setData({ showDownloadModal: false }, () => this.drawChart());
  },

  // 选择时间范围
  onRangeTypeChange(e) {
    this.setData({ rangeType: e.currentTarget.dataset.v });
  },

  // 自定义开始日期
  onCustomStartChange(e) {
    this.setData({ customStart: e.detail.value });
  },

  // 自定义结束日期
  onCustomEndChange(e) {
    this.setData({ customEnd: e.detail.value });
  },

  // 按范围构建图表数据，返回 { days, label }
  filterTrendByRange() {
    const { rangeType, customStart, customEnd, todayISO } = this.data;
    const all = this.readLocalRecords();

    if (rangeType === 'all') {
      if (all.length === 0) return { days: [], label: '全部记录' };
      let earliest = all[0].date;
      all.forEach((r) => { if (r.date < earliest) earliest = r.date; });
      return { days: this.buildChartDaysRange(all, earliest, todayISO), label: '全部记录' };
    }
    if (rangeType === 'custom') {
      if (!customStart || !customEnd) {
        wx.showToast({ title: '请选择起止日期', icon: 'none' });
        return null;
      }
      if (customStart > customEnd) {
        wx.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' });
        return null;
      }
      return {
        days: this.buildChartDaysRange(all, customStart, customEnd),
        label: `${customStart} 至 ${customEnd}`,
      };
    }
    const n = parseInt(rangeType, 10);
    return { days: this.buildChartDays(all, n), label: `近${n}天` };
  },

  // 确认下载
  confirmDownload() {
    if (this.data.downloading) return;
    const filtered = this.filterTrendByRange();
    if (!filtered) return;
    if (filtered.days.length === 0) {
      wx.showToast({ title: '该范围内暂无记录', icon: 'none' });
      return;
    }
    this.setData({ downloading: true });
    this.exportChart(filtered.days, filtered.label);
  },

  // 绘制到离屏画布并保存到相册
  exportChart(days, rangeLabel) {
    const query = wx.createSelectorQuery();
    query.select('#exportCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const finish = (msg, icon) => {
          this.setData({ downloading: false, showDownloadModal: false }, () => this.drawChart());
          wx.hideLoading();
          wx.showToast({ title: msg, icon: icon || 'none' });
        };

        if (!res || !res[0] || !res[0].node) {
          finish('生成失败，请重试');
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio;
        const W = 700;
        const H = 460;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        wx.showLoading({ title: '生成图片...' });

        renderTrendChart(ctx, days, W, H, {
          title: '好孕日记 · 晨起体重趋势',
          subtitle: `时间范围：${rangeLabel}（仅晨起空腹）`,
        });

        wx.canvasToTempFilePath({
          canvas,
          success: (r) => {
            wx.saveImageToPhotosAlbum({
              filePath: r.tempFilePath,
              success: () => finish('已保存到相册', 'success'),
              fail: (err) => {
                this.setData({ downloading: false, showDownloadModal: false }, () => this.drawChart());
                wx.hideLoading();
                if (err.errMsg && err.errMsg.indexOf('auth') !== -1) {
                  wx.showModal({
                    title: '需要相册权限',
                    content: '请在设置中允许保存图片到相册',
                    confirmText: '去设置',
                    confirmColor: '#FF6B81',
                    success: (m) => {
                      if (m.confirm) wx.openSetting();
                    },
                  });
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' });
                }
              },
            });
          },
          fail: () => finish('生成失败，请重试'),
        });
      });
  },
});
