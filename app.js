// ============================================================
// 韩语学习工作台 - 主应用逻辑
// ============================================================

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const Store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

const App = {
  currentModule: 'hangul',
  currentScene: 'greeting',
  currentHangul: null,
  currentPractice: { type: 'vocab', qIndex: 0, score: 0, total: 0, questions: [] },
  canvasCtx: null,
  isDrawing: false,

  init() {
    this.bindEvents();
    this.switchModule('hangul');
  },

  bindEvents() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.switchModule(item.dataset.module));
    });
    $('#menuToggle').addEventListener('click', () => {
      $('#sidebar').classList.add('open');
      $('#sidebarOverlay').classList.add('show');
    });
    $('#sidebarOverlay').addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('#sidebarOverlay').classList.remove('show');
    });
  },

  switchModule(mod) {
    this.currentModule = mod;
    $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.module === mod));
    const titles = {
      hangul: ['🔤', '四十音学习'], grammar: ['📖', '语法学习'], practice: ['✏️', '练习测试'],
      vocab: ['📚', '单词学习'], dialogue: ['💬', '对话练习'], spelling: ['✒️', '拼写法则'],
      culture: ['🎎', '韩国文化'], video: ['🎬', 'B站视频']
    };
    const [icon, title] = titles[mod] || ['', ''];
    $('#moduleIcon').textContent = icon;
    $('#moduleTitle').textContent = title;
    if (window.innerWidth <= 768) {
      $('#sidebar').classList.remove('open');
      $('#sidebarOverlay').classList.remove('show');
    }
    const c = $('#mainContent');
    c.scrollTop = 0;
    ({ hangul: () => this.renderHangul(c), grammar: () => this.renderGrammar(c),
       practice: () => this.renderPractice(c), vocab: () => this.renderVocab(c),
       dialogue: () => this.renderDialogue(c), spelling: () => this.renderSpelling(c),
       culture: () => this.renderCulture(c), video: () => this.renderVideo(c) }[mod] || (() => {}))();
  },

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2000);
  },

  escape(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  // ===== 韩语发音（Web Speech API，ko-KR语音） =====
  speak(text, rate = 0.8) {
    if (!window.speechSynthesis) { this.toast('浏览器不支持语音'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = rate;
    // 尝试使用韩语语音
    const voices = window.speechSynthesis.getVoices();
    const krVoice = voices.find(v => v.lang.startsWith('ko'));
    if (krVoice) u.voice = krVoice;
    window.speechSynthesis.speak(u);
  },

  // ============================================================
  // 模块1: 四十音学习（听标准读音 + 手写练习 + 检验纠正）
  // ============================================================
  renderHangul(c) {
    const tab = Store.get('kr_hangul_tab', 'all'); // all/consonant/vowel/batchim
    c.innerHTML = `
      <div class="hangul-tabs">
        <div class="hangul-tab ${tab==='all'?'active':''}" data-tab="all">全部40音</div>
        <div class="hangul-tab ${tab==='consonant'?'active':''}" data-tab="consonant">辅音19个</div>
        <div class="hangul-tab ${tab==='vowel'?'active':''}" data-tab="vowel">元音21个</div>
        <div class="hangul-tab ${tab==='batchim'?'active':''}" data-tab="batchim">收音法则</div>
      </div>
      <div id="hangulContent"></div>
    `;
    $$('.hangul-tab').forEach(t => {
      t.addEventListener('click', () => { Store.set('kr_hangul_tab', t.dataset.tab); this.renderHangul(c); });
    });
    const hc = $('#hangulContent');
    if (tab === 'batchim') {
      this.renderBatchim(hc);
    } else {
      let list = window.HANGUL_ALL;
      if (tab === 'consonant') list = window.HANGUL_CONSONANTS;
      else if (tab === 'vowel') list = window.HANGUL_VOWELS;
      let html = `<div class="card"><div class="card-title">📌 点击任意音节查看详情、听发音、练习手写</div><div class="hangul-grid" id="hangulGrid"></div></div>`;
      if (tab === 'all' || tab === 'consonant') {
        html += `<div class="card"><div class="card-title">🔤 辅音发音对照（松音/送气音/紧音）</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div class="hangul-detail-info-item"><div class="hangul-detail-info-label">松音（기본）</div><div class="hangul-detail-info-value">ㄱ ㄷ ㅂ ㅅ ㅈ</div></div>
            <div class="hangul-detail-info-item"><div class="hangul-detail-info-label">送气音（격음）</div><div class="hangul-detail-info-value">ㅋ ㅌ ㅍ ㅊ ㅎ</div></div>
            <div class="hangul-detail-info-item"><div class="hangul-detail-info-label">紧音（경음）</div><div class="hangul-detail-info-value">ㄲ ㄸ ㅃ ㅆ ㅉ</div></div>
          </div>
          <div style="font-size:12px;color:#8b7a5c;margin-top:10px;line-height:1.6;">
            💡 <b>松音</b>：气流自然呼出，力度轻；<b>送气音</b>：强烈送气；<b>紧音</b>：声门紧闭，发音硬而急促。
          </div>
        </div>`;
      }
      hc.innerHTML = html;
      const grid = $('#hangulGrid');
      list.forEach(ch => {
        const card = document.createElement('div');
        card.className = 'hangul-card';
        card.innerHTML = `
          <span class="tag tag-primary hangul-type-tag">${ch.type === 'consonant' ? '辅' : '元'}</span>
          <div class="hangul-char">${ch.char}</div>
          <div class="hangul-roman">${ch.roman}</div>
          <div class="hangul-sound">${ch.sound.split('（')[0]}</div>
        `;
        card.addEventListener('click', () => this.showHangulDetail(ch));
        grid.appendChild(card);
      });
    }
  },

  renderBatchim(c) {
    c.innerHTML = `
      <div class="card">
        <div class="card-title">📝 收音法则（27种字形→7种发音）</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          韩语虽然有27种收音字形，但实际只发7种收音：ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ。
          收音基本不爆破，气流在口腔内阻断。点击下方任意一组听发音。
        </p>
        <div id="batchimList"></div>
      </div>
    `;
    const list = $('#batchimList');
    window.HANGUL_BATCHIM.forEach(b => {
      const item = document.createElement('div');
      item.className = 'grammar-item';
      item.innerHTML = `
        <div class="grammar-item-header">
          <span class="grammar-item-title">收音 ${b.repr} → 发 "${b.sound}" 音</span>
          <button class="btn btn-soft btn-small play-sound" data-sound="${b.repr}">🔊 听发音</button>
        </div>
        <div class="grammar-item-pattern">包含字形：${b.chars}</div>
        <div class="grammar-item-meaning">${b.desc}</div>
      `;
      item.querySelector('.play-sound').addEventListener('click', () => this.speak(b.repr));
      list.appendChild(item);
    });
  },

  showHangulDetail(ch) {
    this.currentHangul = ch;
    const modal = $('#modal');
    const mc = $('#modalContent');
    mc.innerHTML = `
      <div class="modal-header">
        <h2>${ch.char} - 详细学习</h2>
        <button class="modal-close" id="closeHangulDetail">×</button>
      </div>
      <div class="modal-body">
        <div class="hangul-detail">
          <div class="hangul-detail-char">${ch.char}</div>
          <div style="text-align:center;margin:10px 0;">
            <button class="play-btn play-btn-large" id="playHangul">🔊</button>
            <p style="font-size:12px;color:#8b7a5c;margin-top:6px;">点击听标准发音</p>
          </div>
          <div class="hangul-detail-info">
            <div class="hangul-detail-info-item">
              <div class="hangul-detail-info-label">罗马音</div>
              <div class="hangul-detail-info-value">${ch.roman}</div>
            </div>
            <div class="hangul-detail-info-item">
              <div class="hangul-detail-info-label">发音标注</div>
              <div class="hangul-detail-info-value">${ch.sound}</div>
            </div>
            <div class="hangul-detail-info-item">
              <div class="hangul-detail-info-label">类型</div>
              <div class="hangul-detail-info-value">${ch.type === 'consonant' ? '辅音' : '元音'}</div>
            </div>
            <div class="hangul-detail-info-item">
              <div class="hangul-detail-info-label">顺序</div>
              <div class="hangul-detail-info-value">第 ${ch.order} 个</div>
            </div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:12px;margin-top:10px;">
            <div style="font-size:12px;color:#8b7a5c;margin-bottom:4px;">📖 发音详解</div>
            <div style="font-size:13px;color:#5d4e37;line-height:1.6;">${ch.desc}</div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <div style="font-size:15px;font-weight:700;color:#5d4e37;margin-bottom:10px;">✍️ 手写练习</div>
          <div class="write-canvas-wrap">
            <canvas class="write-canvas" id="writeCanvas"></canvas>
            <div class="write-controls">
              <button class="btn btn-soft btn-small" id="clearCanvas">🗑️ 清空</button>
              <button class="btn btn-primary btn-small" id="checkWriting">✅ 检验书写</button>
              <button class="btn btn-soft btn-small" id="showReference">👁️ 显示范例</button>
            </div>
            <div id="writeResult" style="margin-top:12px;text-align:center;"></div>
          </div>
          <div style="font-size:12px;color:#8b7a5c;margin-top:10px;line-height:1.6;">
            💡 <b>手写检验说明</b>：在画布上书写后点击"检验书写"，系统会分析你书写的笔画覆盖区域，与标准字形进行比对。<br>
            📝 <b>书写提示</b>：${this.getWritingTip(ch)}
          </div>
        </div>
      </div>
    `;
    modal.classList.add('show');
    $('#closeHangulDetail').addEventListener('click', () => modal.classList.remove('show'));
    $('#playHangul').addEventListener('click', () => this.speak(ch.char));
    this.setupCanvas(ch);
    $('#clearCanvas').addEventListener('click', () => this.clearCanvas());
    $('#checkWriting').addEventListener('click', () => this.checkWriting(ch));
    $('#showReference').addEventListener('click', () => this.showReference(ch));
  },

  getWritingTip(ch) {
    const tips = {
      'ㄱ': '从左到右画一横，再从右端向下画一竖。共2画。',
      'ㄴ': '从左到右画一横，再从左端向下画一竖。共2画。',
      'ㄷ': '先画一横，再从左端向下画竖，从右端向下画竖。共3画。',
      'ㄹ': '先画一横，再画一竖，再画一横，再画一竖。共4画（像"Z"形）。',
      'ㅁ': '先画一横，左竖，下横，右竖。共4画（方形）。',
      'ㅂ': '先画一竖，再画一横，中间一竖，下面一横。共4画。',
      'ㅅ': '从上到下画一斜，再从上到右下画一斜。共2画。',
      'ㅇ': '画一个圆圈。共1画。',
      'ㅈ': '先画一横，再画一竖，最后画一横在底部。共3画。',
      'ㅊ': '先画一短横在上方，再画ㅈ。共4画。',
      'ㅋ': '先画ㄱ，再在中间画一短横。共3画。',
      'ㅌ': '先画一横，再画一竖，再画一横在底部。共3画。',
      'ㅍ': '先画一短横，一竖，一长横，一竖。共4画。',
      'ㅎ': '先画ㅇ，再在下方画ㅎ的横竖部分。共3画。',
      'ㅏ': '先画一竖，再在中间右侧画一短横。共2画。',
      'ㅑ': '先画一竖，再在中间右侧画两短横。共3画。',
      'ㅓ': '先画一竖，再在中间左侧画一短横。共2画。',
      'ㅕ': '先画一竖，再在中间左侧画两短横。共3画。',
      'ㅗ': '先画一横，再在中间上方画一短竖。共2画。',
      'ㅛ': '先画一横，再在中间上方画两短竖。共3画。',
      'ㅜ': '先画一横，再在中间下方画一短竖。共2画。',
      'ㅠ': '先画一横，再在中间下方画两短竖。共3画。',
      'ㅡ': '画一横。共1画。',
      'ㅣ': '画一竖。共1画。',
    };
    return tips[ch.char] || '请参考标准字形书写。';
  },

  setupCanvas(ch) {
    const canvas = $('#writeCanvas');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f5a623';
    this.canvasCtx = ctx;
    this.canvasStrokes = [];
    this.currentStroke = [];

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x, y };
    };
    const start = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      this.currentStroke = [];
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      this.currentStroke.push(p);
    };
    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      this.currentStroke.push(p);
    };
    const end = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.currentStroke.length > 1) this.canvasStrokes.push(this.currentStroke);
    };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', end);
  },

  clearCanvas() {
    const canvas = $('#writeCanvas');
    const ctx = this.canvasCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.canvasStrokes = [];
    $('#writeResult').innerHTML = '';
  },

  showReference(ch) {
    const canvas = $('#writeCanvas');
    const ctx = this.canvasCtx;
    const w = canvas.width / 2;
    const h = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#f5a623';
    ctx.font = '120px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.char, w / 2, h / 2);
    ctx.restore();
    this.canvasStrokes = [];
    $('#writeResult').innerHTML = '<div style="color:#8b7a5c;font-size:13px;">范例已显示（浅色），请在上方描红练习书写 ✍️</div>';
  },

  checkWriting(ch) {
    if (this.canvasStrokes.length === 0) {
      $('#writeResult').innerHTML = '<div class="practice-feedback wrong" style="padding:10px;">请先在画布上书写 ✍️</div>';
      return;
    }
    // 分析书写内容：将画布转为像素，计算覆盖率和中心匹配度
    const canvas = $('#writeCanvas');
    const ctx = this.canvasCtx;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let drawnPixels = 0;
    let refPixels = 0;
    let matchedPixels = 0;
    // 生成参考字形的像素
    const refCanvas = document.createElement('canvas');
    refCanvas.width = canvas.width;
    refCanvas.height = canvas.height;
    const refCtx = refCanvas.getContext('2d');
    refCtx.fillStyle = '#000';
    refCtx.font = '180px "Noto Sans KR", sans-serif';
    refCtx.textAlign = 'center';
    refCtx.textBaseline = 'middle';
    refCtx.fillText(ch.char, canvas.width / 2, canvas.height / 2);
    const refData = refCtx.getImageData(0, 0, canvas.width, canvas.height).data;

    // 采样检测
    const step = 4;
    for (let i = 0; i < data.length; i += 4 * step) {
      const drawn = data[i + 3] > 50; // 用户书写（含透明范例）
      const ref = refData[i + 3] > 50; // 参考字
      if (drawn) drawnPixels++;
      if (ref) refPixels++;
      if (drawn && ref) matchedPixels++;
    }

    const coverage = drawnPixels > 0 ? (matchedPixels / drawnPixels) : 0; // 书写的像素中有多少落在参考字上
    const completeness = refPixels > 0 ? (matchedPixels / refPixels) : 0; // 参考字中有多少被覆盖
    // 综合得分
    const score = Math.round((coverage * 0.5 + completeness * 0.5) * 100);

    const result = $('#writeResult');
    let feedback = '';
    let tips = [];
    if (score >= 75) {
      feedback = `<div class="practice-feedback correct">🎉 很好！书写正确！得分 ${score}分<br><span style="font-size:12px;">覆盖率: ${Math.round(coverage*100)}% | 完整度: ${Math.round(completeness*100)}%</span></div>`;
    } else if (score >= 50) {
      feedback = `<div class="practice-feedback" style="background:#fff3cd;color:#8b7a5c;">🤔 还不错，但还有提升空间。得分 ${score}分<br><span style="font-size:12px;">覆盖率: ${Math.round(coverage*100)}% | 完整度: ${Math.round(completeness*100)}%</span></div>`;
      tips = this.getWritingCorrections(ch, coverage, completeness);
    } else {
      feedback = `<div class="practice-feedback wrong">❌ 书写不够准确，需要纠正。得分 ${score}分<br><span style="font-size:12px;">覆盖率: ${Math.round(coverage*100)}% | 完整度: ${Math.round(completeness*100)}%</span></div>`;
      tips = this.getWritingCorrections(ch, coverage, completeness);
    }
    let html = feedback;
    if (tips.length > 0) {
      html += '<div style="background:#fff3cd;padding:12px;border-radius:8px;margin-top:10px;text-align:left;">';
      html += '<div style="font-size:12px;font-weight:700;color:#e8941a;margin-bottom:6px;">📝 纠正建议</div>';
      tips.forEach(t => { html += `<div style="font-size:13px;color:#5d4e37;padding:3px 0;">• ${t}</div>`; });
      html += '</div>';
    }
    result.innerHTML = html;
  },

  getWritingCorrections(ch, coverage, completeness) {
    const tips = [];
    if (completeness < 0.5) {
      tips.push('笔画不完整，请确保书写了所有的笔画。');
      tips.push(`参考提示：${this.getWritingTip(ch)}`);
    }
    if (coverage < 0.5) {
      tips.push('书写位置偏离标准字形较多，请尝试在画布中央书写。');
      tips.push('可以点击"显示范例"查看标准字形后描红练习。');
    }
    if (this.canvasStrokes.length < 2 && ch.char.length === 1) {
      const expectedStrokes = this.getExpectedStrokes(ch.char);
      if (expectedStrokes > 2) {
        tips.push(`这个字需要 ${expectedStrokes} 画，你只画了 ${this.canvasStrokes.length} 笔，请补全笔画。`);
      }
    }
    return tips;
  },

  getExpectedStrokes(char) {
    const map = { 'ㄱ':2,'ㄴ':2,'ㄷ':3,'ㄹ':4,'ㅁ':4,'ㅂ':4,'ㅅ':2,'ㅇ':1,'ㅈ':3,'ㅊ':4,'ㅋ':3,'ㅌ':3,'ㅍ':4,'ㅎ':3,
      'ㅏ':2,'ㅑ':3,'ㅓ':2,'ㅕ':3,'ㅗ':2,'ㅛ':3,'ㅜ':2,'ㅠ':3,'ㅡ':1,'ㅣ':1 };
    return map[char] || 2;
  },

  // ============================================================
  // 模块2: 语法学习
  // ============================================================
  renderGrammar(c) {
    const level = Store.get('kr_grammar_level', 'all');
    c.innerHTML = `
      <div class="card">
        <div class="card-title">📖 韩语语法大全</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          涵盖从基础到高级的韩语语法，按TOPIK考级分类。包含助词、动词变形、句型等，每条语法都配有例句和详细说明。
        </p>
        <div class="grammar-filters">
          <div class="grammar-filter ${level==='all'?'active':''}" data-level="all">全部</div>
          <div class="grammar-filter ${level==='1'?'active':''}" data-level="1">1-2级基础</div>
          <div class="grammar-filter ${level==='3'?'active':''}" data-level="3">3-4级中级</div>
          <div class="grammar-filter ${level==='5'?'active':''}" data-level="5">5-6级高级</div>
        </div>
        <div style="font-size:12px;color:#b8a88a;margin-bottom:10px;">共 ${level==='all' ? window.KOREAN_GRAMMAR.length : window.KOREAN_GRAMMAR.filter(g => g.level <= Number(level)+1 && g.level >= Number(level)).length} 条语法</div>
      </div>
      <div id="grammarList"></div>
    `;
    $$('.grammar-filter').forEach(f => {
      f.addEventListener('click', () => { Store.set('kr_grammar_level', f.dataset.level); this.renderGrammar(c); });
    });
    const list = $('#grammarList');
    let grammars = window.KOREAN_GRAMMAR;
    if (level !== 'all') {
      const lv = Number(level);
      grammars = grammars.filter(g => g.level >= lv && g.level <= lv + 1);
    }
    grammars.forEach(g => list.appendChild(this.createGrammarItem(g)));
  },

  createGrammarItem(g) {
    const div = document.createElement('div');
    div.className = 'grammar-item';
    div.innerHTML = `
      <div class="grammar-item-header">
        <span class="grammar-item-title">${this.escape(g.title)}</span>
        <div>
          <span class="tag ${g.level <= 2 ? 'tag-green' : g.level <= 4 ? 'tag-blue' : 'tag-purple'}">TOPIK ${g.level}级</span>
          <span class="tag tag-primary">${this.escape(g.category)}</span>
        </div>
      </div>
      <div class="grammar-item-pattern">句型：${this.escape(g.pattern)}</div>
      <div class="grammar-item-meaning">${this.escape(g.meaning)}</div>
      <div class="grammar-item-examples">
        <div style="font-size:12px;color:#8b7a5c;margin-bottom:6px;">例句：</div>
        ${g.examples.map(ex => `<div class="grammar-example">${this.escape(ex)} <span class="play-btn" style="display:inline-flex;width:24px;height:24px;font-size:12px;vertical-align:middle;margin-left:4px;" data-speak="${this.escape(ex.split('（')[0].trim())}">🔊</span></div>`).join('')}
      </div>
      <div class="grammar-note">💡 ${this.escape(g.note)}</div>
    `;
    div.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => this.speak(btn.dataset.speak));
    });
    return div;
  },

  // ============================================================
  // 模块3: 练习测试
  // ============================================================
  renderPractice(c) {
    c.innerHTML = `
      <div class="card">
        <div class="card-title">✏️ 练习测试</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:16px;">
          四种练习题型，自动出题，即时判分。帮助你巩固词汇和语法。
        </p>
        <div class="practice-types" id="practiceTypes">
          <div class="practice-type-card" data-type="vocab">
            <div class="practice-type-icon">📚</div>
            <div class="practice-type-name">词汇抽查</div>
            <div class="practice-type-desc">韩语选中文</div>
          </div>
          <div class="practice-type-card" data-type="vocab2">
            <div class="practice-type-icon">🇰🇷</div>
            <div class="practice-type-name">词汇抽查</div>
            <div class="practice-type-desc">中文选韩语</div>
          </div>
          <div class="practice-type-card" data-type="grammar">
            <div class="practice-type-icon">📖</div>
            <div class="practice-type-name">语法练习</div>
            <div class="practice-type-desc">语法填空</div>
          </div>
          <div class="practice-type-card" data-type="kr2cn">
            <div class="practice-type-icon">🔄</div>
            <div class="practice-type-name">韩译中</div>
            <div class="practice-type-desc">韩语翻译中文</div>
          </div>
          <div class="practice-type-card" data-type="cn2kr">
            <div class="practice-type-icon">🔁</div>
            <div class="practice-type-name">中译韩</div>
            <div class="practice-type-desc">中文翻译韩语</div>
          </div>
        </div>
        <div id="practiceArea">
          <div class="empty"><div class="empty-icon">👆</div><div>选择一种练习类型开始</div></div>
        </div>
      </div>
    `;
    $$('.practice-type-card').forEach(card => {
      card.addEventListener('click', () => this.startPractice(card.dataset.type));
    });
  },

  startPractice(type) {
    $$('.practice-type-card').forEach(card => card.classList.toggle('active', card.dataset.type === type));
    const allVocab = window.DAILY_VOCAB_ALL.concat(
      Object.entries(window.TOPIK_VOCAB).flatMap(([lv, list]) => list.map(v => ({ ...v, level: lv })))
    );
    let questions = [];
    if (type === 'vocab') {
      // 韩语选中文
      const shuffled = this.shuffle([...allVocab]).slice(0, 10);
      questions = shuffled.map(v => {
        const options = this.shuffle([v, ...this.shuffle(allVocab.filter(x => x !== v)).slice(0, 3)]);
        return { q: v.word, qRoman: v.roman, answer: v.meaning, options: options.map(o => o.meaning), speak: v.word };
      });
    } else if (type === 'vocab2') {
      // 中文选韩语
      const shuffled = this.shuffle([...allVocab]).slice(0, 10);
      questions = shuffled.map(v => {
        const options = this.shuffle([v, ...this.shuffle(allVocab.filter(x => x !== v)).slice(0, 3)]);
        return { q: v.meaning, answer: v.word, options: options.map(o => o.word), speak: v.word };
      });
    } else if (type === 'grammar') {
      // 语法填空
      const grammars = this.shuffle([...window.KOREAN_GRAMMAR]).slice(0, 10);
      questions = grammars.map(g => {
        const ex = g.examples[0];
        const parts = ex.split('（');
        return { q: `填空：${g.title}`, qSub: parts[0] + '（？）', answer: parts[1] ? parts[1].replace('）', '') : '', input: true, hint: g.meaning };
      });
    } else if (type === 'kr2cn') {
      // 韩译中
      const shuffled = this.shuffle([...allVocab]).slice(0, 10);
      questions = shuffled.map(v => {
        const options = this.shuffle([v, ...this.shuffle(allVocab.filter(x => x !== v)).slice(0, 3)]);
        return { q: v.word, qRoman: v.roman, answer: v.meaning, options: options.map(o => o.meaning), speak: v.word };
      });
    } else if (type === 'cn2kr') {
      // 中译韩
      const shuffled = this.shuffle([...allVocab]).slice(0, 10);
      questions = shuffled.map(v => {
        const options = this.shuffle([v, ...this.shuffle(allVocab.filter(x => x !== v)).slice(0, 3)]);
        return { q: v.meaning, answer: v.word, options: options.map(o => o.word), speak: v.word };
      });
    }
    this.currentPractice = { type, qIndex: 0, score: 0, total: questions.length, questions };
    this.showQuestion();
  },

  showQuestion() {
    const p = this.currentPractice;
    if (p.qIndex >= p.total) { this.showPracticeResult(); return; }
    const q = p.questions[p.qIndex];
    const area = $('#practiceArea');
    let html = `
      <div class="practice-box">
        <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
          <span class="tag tag-primary">第 ${p.qIndex + 1} / ${p.total} 题</span>
          <span class="tag tag-green">得分 ${p.score}</span>
        </div>
        <div class="practice-question">${this.escape(q.q)}</div>
    `;
    if (q.qRoman) {
      html += `<div class="practice-hangul">${this.escape(q.qRoman)}</div>`;
      html += `<div style="text-align:center;margin:10px 0;"><button class="play-btn" id="practiceSpeak">🔊 听发音</button></div>`;
    }
    if (q.qSub) {
      html += `<div class="practice-hangul">${this.escape(q.qSub)}</div>`;
    }
    if (q.input) {
      html += `
        <input type="text" class="practice-input" id="practiceInput" placeholder="请输入答案..." />
        <div style="text-align:center;margin-top:12px;">
          <button class="btn btn-primary" id="submitInput">提交答案</button>
        </div>
        <div style="font-size:12px;color:#8b7a5c;text-align:center;margin-top:8px;">提示：${this.escape(q.hint || '')}</div>
      `;
    } else {
      html += `<div class="practice-options" id="practiceOptions">`;
      q.options.forEach((opt, i) => {
        html += `<div class="practice-option" data-opt="${this.escape(opt)}">${this.escape(opt)}</div>`;
      });
      html += `</div>`;
    }
    html += `<div id="practiceFeedback"></div>`;
    html += `</div>`;
    area.innerHTML = html;
    if (q.speak) {
      const btn = $('#practiceSpeak');
      if (btn) btn.addEventListener('click', () => this.speak(q.speak));
    }
    if (q.input) {
      const submit = () => {
        const val = $('#practiceInput').value.trim();
        this.judgeAnswer(val, q.answer, true);
      };
      $('#submitInput').addEventListener('click', submit);
      $('#practiceInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
    } else {
      $$('.practice-option').forEach(opt => {
        opt.addEventListener('click', () => {
          $$('.practice-option').forEach(o => o.style.pointerEvents = 'none');
          this.judgeAnswer(opt.dataset.opt, q.answer, false);
        });
      });
    }
  },

  judgeAnswer(user, answer, isInput) {
    const correct = user === answer || (isInput && answer.includes(user) && user.length > 0);
    const fb = $('#practiceFeedback');
    if (correct) {
      this.currentPractice.score++;
      fb.innerHTML = `<div class="practice-feedback correct">✅ 正确！</div>`;
    } else {
      fb.innerHTML = `<div class="practice-feedback wrong">❌ 错误。正确答案：${this.escape(answer)}</div>`;
    }
    if (!isInput) {
      $$('.practice-option').forEach(opt => {
        if (opt.dataset.opt === answer) opt.classList.add('correct');
        else if (opt.dataset.opt === user) opt.classList.add('wrong');
      });
    }
    setTimeout(() => { this.currentPractice.qIndex++; this.showQuestion(); }, 1500);
  },

  showPracticeResult() {
    const p = this.currentPractice;
    const percent = Math.round(p.score / p.total * 100);
    let grade = '需努力';
    if (percent >= 90) grade = '优秀 🌟';
    else if (percent >= 75) grade = '良好 👍';
    else if (percent >= 60) grade = '及格';
    $('#practiceArea').innerHTML = `
      <div class="practice-box" style="text-align:center;">
        <div style="font-size:48px;margin-bottom:10px;">${percent >= 75 ? '🎉' : '💪'}</div>
        <div style="font-size:20px;font-weight:700;color:#5d4e37;margin-bottom:8px;">练习完成！</div>
        <div style="font-size:36px;font-weight:700;color:#f5a623;margin:10px 0;">${p.score} / ${p.total}</div>
        <div style="font-size:14px;color:#8b7a5c;">正确率 ${percent}% · ${grade}</div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
          <button class="btn btn-soft" id="practiceAgain">再做一组</button>
          <button class="btn btn-primary" id="practiceBack">返回选择</button>
        </div>
      </div>
    `;
    $('#practiceAgain').addEventListener('click', () => this.startPractice(p.type));
    $('#practiceBack').addEventListener('click', () => {
      $$('.practice-type-card').forEach(c => c.classList.remove('active'));
      $('#practiceArea').innerHTML = '<div class="empty"><div class="empty-icon">👆</div><div>选择一种练习类型开始</div></div>';
    });
  },

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // ============================================================
  // 模块4: 单词学习
  // ============================================================
  renderVocab(c) {
    const level = Store.get('kr_vocab_level', '1');
    c.innerHTML = `
      <div class="card">
        <div class="card-title">📚 单词学习</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          包含TOPIK考级词书（1-6级）和日常生活常用单词（按主题分类）。词汇丰富，覆盖面广。点击🔊听发音。
        </p>
        <div class="vocab-levels">
          <div class="vocab-level ${level==='topik1'?'active':''}" data-level="topik1">TOPIK 1级</div>
          <div class="vocab-level ${level==='topik2'?'active':''}" data-level="topik2">TOPIK 2级</div>
          <div class="vocab-level ${level==='topik3'?'active':''}" data-level="topik3">TOPIK 3级</div>
          <div class="vocab-level ${level==='topik4'?'active':''}" data-level="topik4">TOPIK 4级</div>
          <div class="vocab-level ${level==='topik5'?'active':''}" data-level="topik5">TOPIK 5级</div>
          <div class="vocab-level ${level==='topik6'?'active':''}" data-level="topik6">TOPIK 6级</div>
          ${Object.keys(window.DAILY_VOCAB).map(cat => `<div class="vocab-level ${level===cat?'active':''}" data-level="${cat}">${cat}</div>`).join('')}
        </div>
        <input type="text" class="vocab-search" id="vocabSearch" placeholder="🔍 搜索单词或释义..." />
      </div>
      <div id="vocabList" class="vocab-list"></div>
    `;
    $$('.vocab-level').forEach(lv => {
      lv.addEventListener('click', () => { Store.set('kr_vocab_level', lv.dataset.level); this.renderVocab(c); });
    });
    $('#vocabSearch').addEventListener('input', () => this.filterVocab(level));
    this.renderVocabList(level);
  },

  renderVocabList(level) {
    let list = [];
    if (level.startsWith('topik')) {
      const lv = Number(level.replace('topik', ''));
      list = window.TOPIK_VOCAB[lv] || [];
    } else {
      list = window.DAILY_VOCAB[level] || [];
    }
    const container = $('#vocabList');
    container.innerHTML = `<div style="grid-column:1/-1;font-size:12px;color:#b8a88a;margin-bottom:8px;">共 ${list.length} 个单词</div>`;
    list.forEach(v => container.appendChild(this.createVocabCard(v)));
  },

  filterVocab(level) {
    const keyword = $('#vocabSearch').value.trim().toLowerCase();
    let list = [];
    if (level.startsWith('topik')) {
      const lv = Number(level.replace('topik', ''));
      list = window.TOPIK_VOCAB[lv] || [];
    } else {
      list = window.DAILY_VOCAB[level] || [];
    }
    if (keyword) {
      list = list.filter(v =>
        v.word.toLowerCase().includes(keyword) ||
        (v.meaning || '').toLowerCase().includes(keyword) ||
        (v.roman || '').toLowerCase().includes(keyword)
      );
    }
    const container = $('#vocabList');
    container.innerHTML = `<div style="grid-column:1/-1;font-size:12px;color:#b8a88a;margin-bottom:8px;">找到 ${list.length} 个单词</div>`;
    if (list.length === 0) {
      container.innerHTML += '<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">🔍</div><div>没有找到匹配的单词</div></div>';
      return;
    }
    list.forEach(v => container.appendChild(this.createVocabCard(v)));
  },

  createVocabCard(v) {
    const div = document.createElement('div');
    div.className = 'vocab-card';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div class="vocab-word">${this.escape(v.word)} <span class="play-btn" style="display:inline-flex;width:28px;height:28px;font-size:13px;vertical-align:middle;margin-left:4px;" data-speak="${this.escape(v.word)}">🔊</span></div>
          ${v.roman ? `<div class="vocab-roman">${this.escape(v.roman)}</div>` : ''}
          ${v.pos ? `<span class="vocab-pos">${this.escape(v.pos)}</span>` : ''}
          <div class="vocab-meaning">${this.escape(v.meaning)}</div>
        </div>
      </div>
      ${v.example ? `<div class="vocab-example">📝 ${this.escape(v.example)} <span class="play-btn" style="display:inline-flex;width:22px;height:22px;font-size:11px;vertical-align:middle;" data-speak="${this.escape(v.example)}">🔊</span></div>` : ''}
    `;
    div.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => this.speak(btn.dataset.speak));
    });
    return div;
  },

  // ============================================================
  // 模块5: 对话练习（场景切换联动）
  // ============================================================
  renderDialogue(c) {
    c.innerHTML = `
      <div class="card">
        <div class="card-title">💬 日常对话练习</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          ${window.DIALOGUE_SCENES.length}个日常场景对话，切换场景后下方对话内容随之变化。每句对话都有韩语、罗马音、中文翻译和语法说明。点击🔊听标准发音。
        </p>
      </div>
      <div class="scene-selector" id="sceneSelector">
        ${window.DIALOGUE_SCENES.map(s => `
          <div class="scene-btn ${s.id===this.currentScene?'active':''}" data-scene="${s.id}">
            <div class="scene-btn-icon">${s.icon}</div>
            <div class="scene-btn-name">${this.escape(s.name)}</div>
          </div>
        `).join('')}
      </div>
      <div id="sceneDetail"></div>
    `;
    $$('.scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentScene = btn.dataset.scene;
        $$('.scene-btn').forEach(b => b.classList.toggle('active', b.dataset.scene === this.currentScene));
        this.renderSceneDetail();
      });
    });
    this.renderSceneDetail();
  },

  renderSceneDetail() {
    const scene = window.DIALOGUE_SCENES.find(s => s.id === this.currentScene);
    if (!scene) return;
    const detail = $('#sceneDetail');
    detail.innerHTML = `
      <div class="scene-detail">
        <div class="scene-header">
          <div class="scene-icon">${scene.icon}</div>
          <div>
            <div class="scene-title">${this.escape(scene.name)}</div>
            <div class="scene-desc">${this.escape(scene.description)}</div>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <button class="btn btn-soft btn-small" id="playAllDialogues">🔊 播放全部对话</button>
        </div>
        <div class="dialogue-list">
          ${scene.dialogues.map((d, i) => `
            <div class="dialogue-item ${d.speaker.toLowerCase().startsWith('y') || d.speaker === 'You' ? 'b' : 'a'}">
              <div class="dialogue-speaker">
                <span>${this.escape(d.speaker)}</span>
                <span class="dialogue-play" data-speak="${this.escape(d.kr)}">🔊</span>
              </div>
              <div class="dialogue-kr">${this.escape(d.kr)}</div>
              <div class="dialogue-roman">${this.escape(d.roman)}</div>
              <div class="dialogue-zh">${this.escape(d.zh)}</div>
              <div class="dialogue-note">💡 ${this.escape(d.note)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    detail.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => this.speak(btn.dataset.speak));
    });
    $('#playAllDialogues').addEventListener('click', () => {
      scene.dialogues.forEach((d, i) => {
        setTimeout(() => this.speak(d.kr, 0.7), i * 3000);
      });
    });
  },

  // ============================================================
  // 模块6: 拼写法则
  // ============================================================
  renderSpelling(c) {
    c.innerHTML = `
      <div class="card">
        <div class="card-title">✒️ 拼写发音法则</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          收录韩语全部拼写发音法则，包括收音化、连音、鼻音化、紧音化、送气化等。这是韩语发音的核心，掌握后能正确读出任何韩语单词。
        </p>
        <div style="font-size:12px;color:#b8a88a;">共 ${window.SPELLING_RULES.length} 条法则</div>
      </div>
      <div id="rulesList"></div>
    `;
    const list = $('#rulesList');
    window.SPELLING_RULES.forEach(r => list.appendChild(this.createRuleItem(r)));
  },

  createRuleItem(r) {
    const div = document.createElement('div');
    div.className = 'rule-item';
    div.innerHTML = `
      <div class="grammar-item-header">
        <span class="rule-item-title">${this.escape(r.title)}</span>
        <span class="tag tag-primary">${this.escape(r.category)}</span>
      </div>
      <div class="rule-item-desc">${this.escape(r.desc)}</div>
      <div class="rule-examples">
        <div style="font-size:12px;color:#8b7a5c;margin-bottom:6px;">示例：</div>
        ${r.examples.map(ex => `<div class="rule-example">${this.escape(ex)}</div>`).join('')}
      </div>
      <div class="rule-detail">📖 ${this.escape(r.detail)}</div>
    `;
    return div;
  },

  // ============================================================
  // 模块7: 韩国文化风俗
  // ============================================================
  renderCulture(c) {
    const cat = Store.get('kr_culture_cat', 'all');
    const categories = ['all', ...new Set(window.KOREA_CULTURE.map(x => x.category))];
    c.innerHTML = `
      <div class="card">
        <div class="card-title">🎎 韩国文化风俗大全</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          全面收录韩国文化风俗，包括饮食文化、传统节日、社交礼仪、日常生活、现代流行、传统艺术、历史传统等。帮助你深入了解韩国文化。
        </p>
        <div class="culture-filters">
          ${categories.map(cc => `<div class="culture-filter ${cat===cc?'active':''}" data-cat="${cc}">${cc === 'all' ? '全部' : cc}</div>`).join('')}
        </div>
        <div style="font-size:12px;color:#b8a88a;">共 ${window.KOREA_CULTURE.length} 篇</div>
      </div>
      <div id="cultureList"></div>
    `;
    $$('.culture-filter').forEach(f => {
      f.addEventListener('click', () => { Store.set('kr_culture_cat', f.dataset.cat); this.renderCulture(c); });
    });
    const list = $('#cultureList');
    let items = window.KOREA_CULTURE;
    if (cat !== 'all') items = items.filter(x => x.category === cat);
    items.forEach(item => list.appendChild(this.createCultureItem(item)));
  },

  createCultureItem(item) {
    const div = document.createElement('div');
    div.className = 'culture-item';
    div.innerHTML = `
      <div class="culture-item-header">
        <span class="culture-item-title">${this.escape(item.title)}</span>
        <span class="tag tag-primary">${this.escape(item.category)}</span>
      </div>
      <div class="culture-item-content">${this.escape(item.content)}</div>
      <div class="culture-tips">
        <div class="culture-tips-title">要点提示</div>
        ${item.tips.map(t => `<div class="culture-tip">${this.escape(t)}</div>`).join('')}
      </div>
    `;
    return div;
  },

  // ============================================================
  // 模块8: B站视频
  // ============================================================
  renderVideo(c) {
    c.innerHTML = `
      <div class="card">
        <div class="card-title">🎬 B站韩语学习视频</div>
        <p style="font-size:13px;color:#8b7a5c;line-height:1.6;margin-bottom:14px;">
          精选B站优质韩语教学视频，涵盖四十音、语法、词汇、对话、TOPIK备考、韩国文化等。点击视频卡片在B站观看。
          <br>📡 <b>持续更新中</b>：我们会定期补充最新的优质韩语教学内容。
        </p>
        <div class="grammar-filters" id="videoFilters">
          ${Object.keys(window.BILIBILI_VIDEOS).map((cat, i) => `<div class="grammar-filter ${i===0?'active':''}" data-cat="${cat}">${cat}</div>`).join('')}
        </div>
      </div>
      <div id="videoGrid" class="video-grid"></div>
    `;
    $$('#videoFilters .grammar-filter').forEach(f => {
      f.addEventListener('click', () => {
        $$('#videoFilters .grammar-filter').forEach(x => x.classList.remove('active'));
        f.classList.add('active');
        this.renderVideoGrid(f.dataset.cat);
      });
    });
    this.renderVideoGrid(Object.keys(window.BILIBILI_VIDEOS)[0]);
  },

  renderVideoGrid(cat) {
    const videos = window.BILIBILI_VIDEOS[cat] || [];
    const grid = $('#videoGrid');
    grid.innerHTML = '';
    videos.forEach(v => grid.appendChild(this.createVideoCard(v)));
  },

  createVideoCard(v) {
    const div = document.createElement('div');
    div.className = 'video-card';
    const icons = { '四十音发音': '🔤', '语法讲解': '📖', '词汇学习': '📚', '日常对话': '💬', 'TOPIK备考': '📝', '韩国文化': '🎎' };
    const icon = icons[Object.keys(window.BILIBILI_VIDEOS).find(k => window.BILIBILI_VIDEOS[k].includes(v))] || '🎬';
    div.innerHTML = `
      <div class="video-thumb">${icon}<span class="video-duration">${this.escape(v.duration)}</span></div>
      <div class="video-info">
        <div class="video-title">${this.escape(v.title)}</div>
        <div class="video-up">UP主：${this.escape(v.up)}</div>
        <div class="video-desc">${this.escape(v.desc)}</div>
      </div>
      <button class="video-play-btn" data-bvid="${v.bvid}">▶ 在B站观看</button>
    `;
    div.querySelector('.video-play-btn').addEventListener('click', () => {
      window.open(`https://www.bilibili.com/video/${v.bvid}`, '_blank');
    });
    return div;
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
// 预加载语音列表
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
