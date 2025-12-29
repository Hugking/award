// 抽奖系统主逻辑
class LotterySystem {
    constructor() {
        this.availableNumbers = []; // 可抽奖的号码列表（从Excel导入）
        this.drawnNumbers = new Set(); // 已抽中的号码
        this.drawnNumbersByAward = {}; // 按奖项分类的已抽中号码，存储对象 {number: 号码, time: 时间, award: 奖项}
        this.animationIntervals = {}; // 存储每个奖项的动画interval
        this.isRolling = {}; // 记录每个奖项是否在滚动
        this.tempAwards = {}; // 临时奖项列表 {awardType: {name, total}}
        this.tempAwardThemeColor = '#ff6b9d'; // 临时奖项统一主题色（粉红色）
        this.entropyPool = []; // 熵池：收集系统熵用于增强随机性
        this.lcgSeed = Date.now(); // LCG随机数生成器种子
        
        // 初始化每个奖项的已抽中列表
        Object.keys(CONFIG.awards).forEach(awardType => {
            this.drawnNumbersByAward[awardType] = [];
        });
        
        // 初始化默认抽奖号码 001-180
        this.initDefaultNumbers();
        
        this.init();
    }

    // 初始化默认抽奖号码（从 CONFIG 中读取配置）
    initDefaultNumbers() {
        if (this.availableNumbers.length === 0 && CONFIG.defaultNumbers) {
            // 只有在没有号码时才初始化默认号码
            const { start, end, format } = CONFIG.defaultNumbers;
            const paddingLength = format.length; // 从格式字符串获取位数（如 '000' 表示3位）
            
            for (let i = start; i <= end; i++) {
                // 格式化为指定位数，前面补0（如 001, 002, ..., 180）
                const formattedNum = String(i).padStart(paddingLength, '0');
                this.availableNumbers.push(formattedNum);
            }
            this.updateNumbersCount();
        }
    }

    init() {
        // Excel导入功能
        const excelImport = document.getElementById('excelImport');
        excelImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importExcel(file);
            }
        });

        // 下载模板功能
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
            this.downloadTemplate();
        });

        // 创建临时奖项功能
        const createTempAwardBtn = document.getElementById('createTempAwardBtn');
        const tempAwardNameInput = document.getElementById('tempAwardNameInput');

        const tempAwardCountInput = document.getElementById('tempAwardCountInput');
        
        createTempAwardBtn.addEventListener('click', () => {
            const awardName = tempAwardNameInput.value.trim();
            const awardCount = parseInt(tempAwardCountInput.value) || 1;
            
            if (!awardName) {
                alert('请输入奖项名称！');
                return;
            }
            
            if (awardCount < 1) {
                alert('号码数量必须大于0！');
                return;
            }
            
            this.createTempAward(awardName, awardCount);
            tempAwardNameInput.value = '';
            tempAwardCountInput.value = '1'; // 重置为1
        });

        // 导出抽奖结果
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportResults();
        });

        // 背景图片上传
        const backgroundInput = document.getElementById('backgroundInput');
        const backgroundImage = document.getElementById('backgroundImage');
        backgroundInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    backgroundImage.src = event.target.result;
                    backgroundImage.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        // 重置按钮
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('确定要重置所有抽奖结果吗？')) {
                this.reset();
            }
        });

        // 奖项按钮事件（悬浮按钮）
        document.querySelectorAll('.award-btn-floating').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const awardType = e.currentTarget.dataset.award;
                this.selectAward(awardType);
            });
        });

        // 设置面板切换
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        
        if (settingsToggle && settingsPanel) {
            settingsToggle.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                settingsPanel.classList.toggle('show');
            });
        }
        
        if (closeSettingsBtn && settingsPanel) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsPanel.classList.remove('show');
            });
        }
        
        // 点击设置面板内部时，阻止关闭
        if (settingsPanel) {
            settingsPanel.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，防止点击面板内部时关闭
            });
        }
        
        // 点击空白处关闭设置面板
        document.addEventListener('click', (e) => {
            if (settingsPanel && settingsPanel.classList.contains('show')) {
                // 如果点击的不是设置面板和设置按钮，则关闭面板
                if (!settingsPanel.contains(e.target) && e.target !== settingsToggle) {
                    settingsPanel.classList.remove('show');
                }
            }
        });

        // 初始化显示
        this.updateDisplay();
        
        // 默认显示第一个奖项（幸运奖）
        this.selectAward('lucky');
        
        // 初始化开始抽奖按钮
        document.querySelectorAll('.btn-start').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const awardType = e.currentTarget.dataset.award;
                this.startLottery(awardType);
            });
        });
        
        // 初始化结束抽奖按钮
        document.querySelectorAll('.btn-stop').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const awardType = e.currentTarget.dataset.award;
                this.stopLottery(awardType);
            });
        });
    }
    
    startLottery(awardType) {
        // 检查是临时奖项还是常规奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total } : CONFIG.awards[awardType];
        
        if (!award && !isTempAward) return;

        // 检查是否已经抽完（包括临时奖项）
        const drawnForAward = this.getDrawnCountForAward(awardType);
        if (drawnForAward >= award.total) {
            // 奖项已抽完，直接返回（按钮应该已被禁用）
            return;
        }

        // 如果正在抽奖，先停止
        if (this.isRolling[awardType]) {
            return;
        }

        
        // 隐藏所有面板
        document.querySelectorAll('.award-display-panel').forEach(panel => {
            panel.style.display = 'none';
            panel.classList.remove('active');
        });

        // 显示当前奖项面板
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            panel.style.display = 'flex';
            panel.classList.add('active');
        }
        
        // 临时奖项一次性抽完所有名额，常规奖项根据distribution决定
        let countToDraw;
        if (isTempAward) {
            // 临时奖项：一次性抽完所有剩余名额
            const remaining = award.total - drawnForAward;
            countToDraw = remaining > 0 ? remaining : 0;
        } else {
            // 常规奖项：根据distribution决定每次抽取数量
            countToDraw = 1;
            const distribution = award.distribution;
            
            // 找到当前应该抽取的数量
            let accumulated = 0;
            
            for (let i = 0; i < distribution.length; i++) {
                const prevAccumulated = accumulated;
                accumulated += distribution[i];
                
                // 如果已抽数量在这个区间内（包括等于prevAccumulated的情况）
                if (drawnForAward >= prevAccumulated && drawnForAward < accumulated) {
                    countToDraw = distribution[i] - (drawnForAward - prevAccumulated);
                    break;
                }
            }
            
            // 如果没找到（理论上不应该发生），使用第一个distribution
            if (countToDraw <= 0) {
                countToDraw = distribution[0];
            }
            
            // 确保不超过剩余数量
            const remaining = award.total - drawnForAward;
            if (countToDraw > remaining) {
                countToDraw = remaining;
            }
        }
        
        
        // 切换按钮显示
        const startBtn = panel.querySelector('.btn-start');
        const stopBtn = panel.querySelector('.btn-stop');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
        
        // 开始抽奖
        this.drawLottery(awardType, countToDraw);
    }
    
    // 下载Excel模板（包含001-180号）
    downloadTemplate() {
        try {
            // 准备模板数据：第一列是号码（001-180，格式化为三位数）
            const templateData = [];
            templateData.push(['号码']); // 表头
            for (let i = 1; i <= 180; i++) {
                // 格式化为三位数，前面补0（001, 002, ..., 180）
                const formattedNum = String(i).padStart(3, '0');
                templateData.push([formattedNum]);
            }
            
            // 创建Excel工作簿
            const ws = XLSX.utils.aoa_to_sheet(templateData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '抽奖号码');
            
            // 设置列宽
            ws['!cols'] = [{ wch: 15 }];
            
            // 导出文件
            const fileName = '抽奖号码模板.xlsx';
            XLSX.writeFile(wb, fileName);
            
            alert('模板下载成功！文件包含001-180号（三位数格式），您可以直接使用或修改。');
        } catch (error) {
            console.error('下载模板失败:', error);
            alert('下载模板失败，请重试！');
        }
    }
    
    // Excel导入功能
    importExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                // 提取第一列的数据作为号码（跳过表头）
                const numbers = [];
                jsonData.forEach((row, index) => {
                    if (row && row[0] !== undefined && row[0] !== null && row[0] !== '') {
                        const num = String(row[0]).trim();
                        // 跳过表头行（第一行且内容是"号码"或非数字）
                        if (index === 0 && (num === '号码' || num.toLowerCase() === 'number' || isNaN(Number(num)))) {
                            return; // 跳过表头
                        }
                        // 只添加有效的号码（非空且不是表头）
                        if (num && num !== '号码' && num.toLowerCase() !== 'number') {
                            numbers.push(num);
                        }
                    }
                });
                
                if (numbers.length === 0) {
                    alert('Excel文件中没有找到有效的号码数据！');
                    return;
                }
                
                // 如果用户上传了Excel，替换现有号码（使用用户上传的）
                // 如果用户没有上传，使用默认号码 001-180
                this.availableNumbers = numbers.sort((a, b) => {
                    // 尝试数字排序，如果失败则字符串排序
                    const numA = Number(a);
                    const numB = Number(b);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return String(a).localeCompare(String(b));
                });
                
                this.updateNumbersCount();
                this.updateManualNumbersList(); // 更新手动添加号码列表
                alert(`成功导入 ${numbers.length} 个号码，当前共有 ${this.availableNumbers.length} 个号码`);
            } catch (error) {
                console.error('导入Excel失败:', error);
                alert('导入Excel失败，请检查文件格式！');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // 更新手动添加号码列表显示
    updateManualNumbersList() {
        const listContainer = document.getElementById('manualNumbersList');
        if (!listContainer) return;

        // 获取未抽中的号码
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        
        if (availableNumbers.length === 0) {
            listContainer.innerHTML = '<div style="color: #999; font-size: 12px;">暂无未抽中号码（请先导入号码或所有号码已抽完）</div>';
            return;
        }

        // 生成号码按钮列表
        listContainer.innerHTML = '';
        availableNumbers.forEach(num => {
            const numStr = String(num);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'manual-number-btn';
            btn.textContent = numStr;
            btn.dataset.number = numStr;
            btn.style.cssText = 'padding: 6px 12px; border: 2px solid #ddd; background: white; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
            btn.addEventListener('click', function() {
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    this.style.background = '#4CAF50';
                    this.style.color = 'white';
                    this.style.borderColor = '#4CAF50';
                } else {
                    this.style.background = 'white';
                    this.style.color = 'black';
                    this.style.borderColor = '#ddd';
                }
            });
            listContainer.appendChild(btn);
        });
    }

    // 创建临时奖项（创建后可以抽奖）
    createTempAward(awardName, total) {
        // 生成临时奖项ID
        const tempAwardId = `temp_${Date.now()}`;
        
        // 存储临时奖项信息
        this.tempAwards[tempAwardId] = {
            name: awardName,
            total: total // 设置奖项的号码总数
        };
        
        // 初始化临时奖项的已抽中列表
        this.drawnNumbersByAward[tempAwardId] = [];

        // 动态创建悬浮按钮（传入总数）
        this.createTempAwardButton(tempAwardId, awardName, total);
        
        // 动态创建显示面板（支持抽奖功能）
        this.createTempAwardPanel(tempAwardId, awardName);

        // 更新显示
        this.updateDisplay();

        // 自动切换到新创建的临时奖项
        this.selectAward(tempAwardId);

        alert(`成功创建临时奖项"${awardName}"，共 ${total} 个名额！现在可以开始抽奖了。`);
    }

    // 创建临时奖项悬浮按钮
    createTempAwardButton(awardId, awardName, total) {
        const buttonContainer = document.querySelector('.award-selector-floating');
        if (!buttonContainer) {
            console.error('找不到奖项选择按钮容器');
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'award-btn-floating';
        btn.dataset.award = awardId;
        btn.title = awardName;
        
        // 设置临时奖项的特殊样式（使用新的主题色 #ff6b9d）
        const themeColor = this.tempAwardThemeColor; // #ff6b9d
        const themeColorRgb = '255, 107, 157'; // RGB值
        btn.style.borderColor = `rgba(${themeColorRgb}, 0.5)`;
        btn.style.boxShadow = `0 0 15px rgba(${themeColorRgb}, 0.3), inset 0 0 15px rgba(138, 43, 226, 0.1)`;
        btn.style.background = `linear-gradient(135deg, rgba(${themeColorRgb}, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'award-name';
        nameSpan.textContent = awardName;
        nameSpan.style.color = themeColor; // 使用主题色
        nameSpan.style.textShadow = `0 0 5px rgba(${themeColorRgb}, 0.8)`;
        
        const countSpan = document.createElement('span');
        countSpan.className = 'award-count';
        const drawnCount = this.getDrawnCountForAward(awardId);
        countSpan.textContent = `${drawnCount}/${total}名`;
        countSpan.style.color = `rgba(${themeColorRgb}, 0.8)`;
        
        btn.appendChild(nameSpan);
        btn.appendChild(countSpan);
        
        // 添加点击事件
        btn.addEventListener('click', () => {
            this.selectAward(awardId);
        });
        
        // 添加到容器中（添加到现有按钮之后）
        buttonContainer.appendChild(btn);
    }

    // 创建临时奖项显示面板（支持抽奖功能）
    createTempAwardPanel(awardId, awardName) {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        const panel = document.createElement('div');
        panel.className = 'award-display-panel fullscreen';
        panel.dataset.award = awardId;
        panel.id = `awardPanel-${awardId}`;
        panel.style.display = 'none';

        panel.innerHTML = `
            <div class="award-panel-header">
                <h3 class="award-panel-title" style="color: ${this.tempAwardThemeColor};">${awardName}</h3>
            </div>
            <div class="award-panel-content">
                <div class="flash-effect award-flash"></div>
                <div class="lottery-animation award-animation">
                    <div class="lottery-glow"></div>
                    <div class="lottery-number award-number">?</div>
                    <div class="lottery-sparkles">
                        <span class="sparkle"></span>
                        <span class="sparkle"></span>
                        <span class="sparkle"></span>
                        <span class="sparkle"></span>
                        <span class="sparkle"></span>
                        <span class="sparkle"></span>
                    </div>
                </div>
                <div class="multi-numbers-container award-multi-numbers"></div>
            </div>
            <div class="award-panel-buttons">
                <button class="btn-start" data-award="${awardId}">开始抽奖</button>
                <button class="btn-stop" data-award="${awardId}" style="display: none;">结束抽奖</button>
            </div>
        `;

        mainContent.appendChild(panel);

        // 应用主题色到开始抽奖按钮
        const startBtn = panel.querySelector('.btn-start');
        if (startBtn) {
            startBtn.style.background = `linear-gradient(135deg, ${this.tempAwardThemeColor} 0%, ${this.darkenColor(this.tempAwardThemeColor, 10)} 100%)`;
            startBtn.style.boxShadow = `0 6px 25px ${this.tempAwardThemeColor}50`;
        }

        // 绑定开始抽奖按钮事件
        const startButton = panel.querySelector('.btn-start');
        if (startButton) {
            startButton.addEventListener('click', (e) => {
                const awardType = e.currentTarget.dataset.award;
                this.startLottery(awardType);
            });
        }

        // 绑定结束抽奖按钮事件
        const stopButton = panel.querySelector('.btn-stop');
        if (stopButton) {
            stopButton.addEventListener('click', (e) => {
                const awardType = e.currentTarget.dataset.award;
                this.stopLottery(awardType);
            });
        }
    }

    // 更新号码总数显示
    updateNumbersCount() {
        const countElement = document.getElementById('totalNumbersCount');
        if (countElement) {
            countElement.textContent = this.availableNumbers.length;
        }
        // 同时更新手动添加号码列表
        this.updateManualNumbersList();
    }

    // 导出抽奖结果到Excel
    exportResults() {
        if (this.drawnNumbers.size === 0) {
            alert('还没有抽奖结果可以导出！');
            return;
        }

        try {
            // 准备导出数据
            const exportData = [];
            exportData.push(['奖项', '号码', '抽奖时间']);
            
            // 按奖项导出（常规奖项）
            Object.keys(CONFIG.awards).forEach(awardType => {
                const award = CONFIG.awards[awardType];
                const drawnList = this.drawnNumbersByAward[awardType] || [];
                drawnList.forEach(item => {
                    exportData.push([
                        award.name,
                        item.number || item,
                        item.time || new Date().toLocaleString()
                    ]);
                });
            });
            
            // 导出临时奖项
            Object.keys(this.tempAwards).forEach(awardType => {
                const tempAward = this.tempAwards[awardType];
                const drawnList = this.drawnNumbersByAward[awardType] || [];
                drawnList.forEach(item => {
                    exportData.push([
                        tempAward.name,
                        item.number || item,
                        item.time || new Date().toLocaleString()
                    ]);
                });
            });
            
            // 创建Excel工作簿
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '抽奖结果');
            
            // 导出文件
            const fileName = `抽奖结果_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            alert('抽奖结果导出成功！');
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请重试！');
        }
    }

    // 应用主题色
    // 颜色加深工具函数（用于临时奖项按钮样式）
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    selectAward(awardType) {
        // 检查是临时奖项还是常规奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward ? { name: isTempAward.name, total: isTempAward.total } : CONFIG.awards[awardType];
        
        if (!award && !isTempAward) return;

        // 检查是否已经抽完
        const drawnForAward = this.getDrawnCountForAward(awardType);
        const isCompleted = drawnForAward >= award.total;

        // 隐藏所有面板
        document.querySelectorAll('.award-display-panel').forEach(panel => {
            panel.style.display = 'none';
            panel.classList.remove('active');
        });

        // 显示当前奖项面板
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            panel.style.display = 'flex';
            panel.classList.add('active');
            
            // 临时奖项和常规奖项都显示抽奖按钮
            const startBtn = panel.querySelector('.btn-start');
            const stopBtn = panel.querySelector('.btn-stop');
            if (startBtn) {
                startBtn.style.display = 'block';
                // 如果奖项已抽完，禁用开始抽奖按钮（临时奖项不会抽完）
                if (isCompleted) {
                    startBtn.disabled = true;
                    startBtn.classList.add('disabled');
                } else {
                    startBtn.disabled = false;
                    startBtn.classList.remove('disabled');
                }
            }
            if (stopBtn) stopBtn.style.display = 'none';
            
            // 重置显示
            const numberDisplay = panel.querySelector('.award-number');
            const multiContainer = panel.querySelector('.award-multi-numbers');
            if (numberDisplay) numberDisplay.textContent = '?';
            if (multiContainer) {
                multiContainer.innerHTML = '';
                multiContainer.style.display = 'none';
            }
            const animation = panel.querySelector('.award-animation');
            if (animation) {
                animation.style.display = 'flex';
                animation.classList.remove('rolling');
            }
        }
    }
    
    stopLottery(awardType) {
        if (!this.isRolling[awardType]) return;
        
        // 停止所有动画
        if (this.animationIntervals[awardType]) {
            this.animationIntervals[awardType].forEach(interval => clearInterval(interval));
            this.animationIntervals[awardType] = [];
        }
        
        // 停止所有动画
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            const animation = panel.querySelector('.award-animation');
            if (animation) {
                animation.classList.remove('rolling');
            }
            
            // 停止多个号码的滚动
            const multiContainer = panel.querySelector('.award-multi-numbers');
            if (multiContainer) {
                const numberItems = multiContainer.querySelectorAll('.multi-number-item');
                numberItems.forEach(item => {
                    // 停止该元素的动画
                    item.style.animation = 'none';
                });
            }
        }
        
        this.isRolling[awardType] = false;
        
        // 立即生成结果
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total } : CONFIG.awards[awardType];
        const drawnForAward = this.getDrawnCountForAward(awardType);
        
        // 临时奖项一次性抽完所有名额，常规奖项根据distribution决定
        let countToDraw;
        if (isTempAward) {
            // 临时奖项：一次性抽完所有剩余名额
            const remaining = award.total - drawnForAward;
            countToDraw = remaining > 0 ? remaining : 0;
        } else {
            // 常规奖项：根据distribution决定每次抽取数量
            countToDraw = 1;
            const distribution = award.distribution;
            
            let accumulated = 0;
            for (let i = 0; i < distribution.length; i++) {
                const prevAccumulated = accumulated;
                accumulated += distribution[i];
                if (drawnForAward >= prevAccumulated && drawnForAward < accumulated) {
                    countToDraw = distribution[i] - (drawnForAward - prevAccumulated);
                    break;
                }
            }
            if (countToDraw <= 0) {
                countToDraw = distribution[0];
            }
            
            const remaining = award.total - drawnForAward;
            if (countToDraw > remaining) {
                countToDraw = remaining;
            }
        }
        
        const winners = this.generateWinners(countToDraw, awardType);
        this.showResults(awardType, winners, countToDraw);
        
        // 重新计算已抽数量（因为刚刚抽了新的）
        const newDrawnCount = this.getDrawnCountForAward(awardType);
        const isCompleted = newDrawnCount >= award.total;
        
        // 更新面板状态 - 显示开始抽奖按钮，隐藏结束抽奖按钮
        // 确保按钮状态正确切换
        if (panel) {
            const startBtn = panel.querySelector('.btn-start');
            const stopBtn = panel.querySelector('.btn-stop');
            
            // 显示开始抽奖按钮
            if (startBtn) {
                startBtn.style.display = 'block';
                // 如果奖项已抽完，禁用按钮；否则启用按钮
                if (isCompleted) {
                    startBtn.disabled = true;
                    startBtn.classList.add('disabled');
                } else {
                    startBtn.disabled = false;
                    startBtn.classList.remove('disabled');
                }
            }
            
            // 隐藏结束抽奖按钮
            if (stopBtn) {
                stopBtn.style.display = 'none';
            }
        }
        
        // 如果奖项已抽完，调用 completeAward 进行完整处理
        if (isCompleted) {
            this.completeAward(awardType);
        }
    }

    getDrawnCountForAward(awardType) {
        // 从按奖项分类的已抽中列表中统计
        if (this.drawnNumbersByAward[awardType]) {
            return this.drawnNumbersByAward[awardType].length;
        }
        return 0;
    }

    // 重置按钮状态到初始状态
    resetButtonState(awardType) {
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            // 重置按钮显示状态
            const startBtn = panel.querySelector('.btn-start');
            const stopBtn = panel.querySelector('.btn-stop');
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            
            // 移除滚动动画类
            const animation = panel.querySelector('.award-animation');
            if (animation) {
                animation.classList.remove('rolling');
            }
            
            // 停止多个号码的滚动动画
            const multiContainer = panel.querySelector('.award-multi-numbers');
            if (multiContainer) {
                const numberItems = multiContainer.querySelectorAll('.multi-number-item');
                numberItems.forEach(item => {
                    item.style.animation = 'none';
                });
            }
        }
        // 重置滚动状态
        this.isRolling[awardType] = false;
        // 停止所有动画间隔
        if (this.animationIntervals[awardType]) {
            this.animationIntervals[awardType].forEach(interval => clearInterval(interval));
            this.animationIntervals[awardType] = [];
        }
    }

    drawLottery(awardType, count = 1) {
        // 确保count有效
        if (!count || count <= 0) {
            console.error('抽取数量无效:', count);
            alert('抽取数量无效，请重试！');
            this.resetButtonState(awardType);
            return;
        }
        
        // 检查是否是临时奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward 
            ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total }
            : CONFIG.awards[awardType];
        
        // 如果奖项不存在，重置按钮状态并返回
        if (!award) {
            console.error('奖项不存在:', awardType);
            alert('奖项配置不存在，请重试！');
            this.resetButtonState(awardType);
            return;
        }
        
        const drawnForAward = this.getDrawnCountForAward(awardType);
        const remaining = award.total - drawnForAward;

        if (remaining <= 0) {
            alert(`${award.name}已经全部抽完！`);
            this.resetButtonState(awardType);
            return;
        }

        // 检查是否还有可抽的号码
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        const availableCount = availableNumbers.length;
        if (availableCount < count) {
            alert(`可抽号码不足！剩余 ${availableCount} 个号码，需要 ${count} 个。请先导入号码或添加号码。`);
            this.resetButtonState(awardType);
            return;
        }
        
        if (this.availableNumbers.length === 0) {
            alert('请先导入抽奖号码！');
            this.resetButtonState(awardType);
            return;
        }
        

        // 获取当前奖项的面板元素
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        const animation = panel.querySelector('.award-animation');
        const multiContainer = panel.querySelector('.award-multi-numbers');
        
        // 清空之前的结果显示
        if (multiContainer) multiContainer.innerHTML = '';
        
        // 设置显示模式
        if (count === 1) {
            if (animation) animation.style.display = 'flex';
            if (multiContainer) multiContainer.style.display = 'none';
        } else {
            if (animation) animation.style.display = 'none';
            if (multiContainer) multiContainer.style.display = 'flex';
        }

        // 标记为正在滚动
        this.isRolling[awardType] = true;
        this.animationIntervals[awardType] = [];

        // 开始抽奖动画（持续滚动，直到用户点击结束）
        this.startAnimation(awardType, count);
    }

    // 收集熵（系统随机性）
    collectEntropy() {
        // 收集各种系统熵
        const entropy = [
            performance.now() % 1,
            Date.now() % 1,
            Math.random(),
            (window.innerWidth + window.innerHeight) % 1,
            (new Date().getMilliseconds()) / 1000
        ];
        this.entropyPool.push(...entropy);
        // 保持熵池大小在合理范围
        if (this.entropyPool.length > 100) {
            this.entropyPool = this.entropyPool.slice(-50);
        }
    }

    // 加密级随机数生成器（使用Web Crypto API）
    getCryptoRandom(max) {
        if (window.crypto && window.crypto.getRandomValues) {
            // 使用Web Crypto API获取加密级随机数（最高质量）
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            // 使用模运算确保均匀分布
            return array[0] % max;
        }
        return null;
    }

    // 混合随机数生成器（结合多种算法）
    getMixedRandom(max) {
        // 优先使用加密级随机数
        const cryptoRandom = this.getCryptoRandom(max);
        if (cryptoRandom !== null) {
            // 添加熵池扰动
            this.collectEntropy();
            if (this.entropyPool.length > 0) {
                const entropy = this.entropyPool[this.entropyPool.length - 1];
                const perturbation = Math.floor(entropy * max * 0.1); // 10%的扰动
                return (cryptoRandom + perturbation) % max;
            }
            return cryptoRandom;
        }
        
        // 降级方案：使用改进的线性同余生成器
        return this.getLCGRandom(max);
    }

    // 线性同余生成器（LCG）- 作为降级方案
    getLCGRandom(max) {
        // LCG参数（使用常用的参数组合）
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        
        this.lcgSeed = (a * this.lcgSeed + c) % m;
        const random = this.lcgSeed / m;
        
        // 结合Math.random()增加随机性
        const mathRandom = Math.random();
        const combined = (random + mathRandom) / 2;
        
        return Math.floor(combined * max);
    }

    // Knuth洗牌算法（Fisher-Yates的优化版）- 业界标准
    knuthShuffle(array) {
        const shuffled = [...array];
        const n = shuffled.length;
        
        // 从后往前遍历，每次随机选择一个位置交换
        for (let i = n - 1; i > 0; i--) {
            // 使用加密级随机数
            const j = this.getMixedRandom(i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled;
    }

    // 蓄水池算法（Reservoir Sampling）- 适合动态抽取
    reservoirSampling(array, k) {
        if (array.length <= k) {
            return [...array];
        }
        
        // 初始化蓄水池：前k个元素
        const reservoir = array.slice(0, k);
        
        // 从第k+1个元素开始处理
        for (let i = k; i < array.length; i++) {
            // 生成0到i之间的随机数
            const j = this.getMixedRandom(i + 1);
            
            // 如果随机数小于k，替换蓄水池中的对应元素
            if (j < k) {
                reservoir[j] = array[i];
            }
        }
        
        return reservoir;
    }

    // 获取高质量随机数（用于动画显示）
    getHighQualityRandom(max) {
        return this.getMixedRandom(max);
    }

    generateWinners(count, awardType) {
        // 获取未抽中的号码列表
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        
        if (availableNumbers.length < count) {
            console.error(`可抽号码不足：需要 ${count} 个，但只有 ${availableNumbers.length} 个`);
            return [];
        }
        
        // 收集熵，增强随机性
        this.collectEntropy();
        
        let winners = [];
        
        // 根据数据量选择最优算法
        if (availableNumbers.length <= 1000) {
            // 小数据集：使用Knuth洗牌算法（业界标准）
            const shuffled = this.knuthShuffle(availableNumbers);
            winners = shuffled.slice(0, count);
        } else {
            // 大数据集：使用蓄水池算法（更高效，O(n)时间复杂度）
            winners = this.reservoirSampling(availableNumbers, count);
        }
        
        // 将选中的号码添加到已抽中列表
        winners.forEach(num => {
            this.drawnNumbers.add(String(num));
        });
        
        
        // 返回排序后的结果
        return winners.map(String).sort((a, b) => {
            const numA = Number(a);
            const numB = Number(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(a).localeCompare(String(b));
        });
    }

    startAnimation(awardType, count) {
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        const animation = panel.querySelector('.award-animation');
        const numberDisplay = panel.querySelector('.award-number');
        const multiContainer = panel.querySelector('.award-multi-numbers');
        
        // 确保动画状态正确
        if (animation) {
            animation.classList.add('rolling');
        }
        
        // 获取未抽中的号码列表用于滚动显示
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        
        if (count === 1) {
            // 单个号码滚动效果
            if (numberDisplay) {
                numberDisplay.textContent = '?';
            }
            
            const interval = setInterval(() => {
                if (!this.isRolling[awardType]) {
                    clearInterval(interval);
                    return;
                }
                if (availableNumbers.length > 0) {
                    const randomIndex = this.getHighQualityRandom(availableNumbers.length);
                    const randomNum = availableNumbers[randomIndex];
                    if (numberDisplay) numberDisplay.textContent = randomNum;
                }
            }, 50); // 快速滚动，每50ms更新一次

            this.animationIntervals[awardType].push(interval);
        } else {
            // 多个号码的滚动效果
            if (multiContainer) {
                multiContainer.innerHTML = '';
                multiContainer.style.display = 'flex';
                
                for (let i = 0; i < count; i++) {
                    const numberItem = document.createElement('div');
                    numberItem.className = 'multi-number-item';
                    numberItem.textContent = '?';
                    multiContainer.appendChild(numberItem);
                }
                
                // 快速滚动数字，每个号码独立滚动
                const numberItems = multiContainer.querySelectorAll('.multi-number-item');
                
                numberItems.forEach((item, index) => {
                    // 错开开始时间，更有层次感
                    setTimeout(() => {
                        const interval = setInterval(() => {
                            if (!this.isRolling[awardType]) {
                                clearInterval(interval);
                                return;
                            }
                            if (availableNumbers.length > 0) {
                                const randomIndex = this.getHighQualityRandom(availableNumbers.length);
                                const randomNum = availableNumbers[randomIndex];
                                item.textContent = randomNum;
                            }
                        }, 50); // 快速滚动
                        this.animationIntervals[awardType].push(interval);
                    }, index * 30);
                });
            }
        }
        
        // 闪光效果
        const flashEffect = panel.querySelector('.award-flash');
        if (flashEffect) {
            flashEffect.style.animation = 'none';
            setTimeout(() => {
                flashEffect.style.animation = 'flash 0.3s ease-out';
            }, 10);
        }
    }
    

    showResults(awardType, winners, count) {
        const award = CONFIG.awards[awardType];
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        const numberDisplay = panel.querySelector('.award-number');
        const multiContainer = panel.querySelector('.award-multi-numbers');
        const animation = panel.querySelector('.award-animation');

        // 停止动画
        if (animation) {
            animation.classList.remove('rolling');
        }

        // 更新显示
        if (count === 1) {
            if (numberDisplay) numberDisplay.textContent = winners[0];
        } else {
            // 更新多个号码显示
            if (multiContainer) {
                const numberItems = multiContainer.querySelectorAll('.multi-number-item');
                winners.forEach((winner, index) => {
                    if (numberItems[index]) {
                        setTimeout(() => {
                            numberItems[index].textContent = winner;
                            numberItems[index].style.animation = 'numberPop 0.5s ease-out';
                        }, index * 100); // 错开显示时间
                    }
                });
            }
        }

        // 记录已抽中的号码
        winners.forEach((winner) => {
            this.addToDrawnList(winner, awardType);
        });

        // 更新已抽中数量和面板计数
        this.updateAwardPanelCount(awardType);
        // 更新手动添加号码列表（因为已抽中的号码需要从列表中移除）
        this.updateManualNumbersList();
    }
    
    updateAwardPanelCount(awardType) {
        // 检查是临时奖项还是常规奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward ? { name: isTempAward.name, total: this.tempAwards[awardType].total } : CONFIG.awards[awardType];
        
        if (!award && !isTempAward) return;
        
        const drawnCount = this.getDrawnCountForAward(awardType);
        
        // 更新悬浮按钮上的计数
        const floatingBtn = document.querySelector(`.award-btn-floating[data-award="${awardType}"]`);
        if (floatingBtn) {
            const countSpan = floatingBtn.querySelector('.award-count');
            if (countSpan) {
                countSpan.textContent = `${drawnCount}/${award.total}名`;
            }
        }
    }

    addToDrawnList(number, awardType) {
        // 记录到已抽中列表（用于统计和导出）
        // 已抽中的号码已经记录在 drawnNumbers Set 中
        // 同时记录到按奖项分类的数组中，用于统计每个奖项的已抽中数量和导出
        if (this.drawnNumbersByAward[awardType]) {
            // 获取奖项名称（临时奖项或常规奖项）
            const isTempAward = this.tempAwards[awardType];
            const awardName = isTempAward ? isTempAward.name : (CONFIG.awards[awardType] ? CONFIG.awards[awardType].name : '未知奖项');
            
            this.drawnNumbersByAward[awardType].push({
                number: String(number),
                time: new Date().toLocaleString('zh-CN'),
                award: awardName
            });
        }
        const isTempAward = this.tempAwards[awardType];
        const awardName = isTempAward ? isTempAward.name : (CONFIG.awards[awardType] ? CONFIG.awards[awardType].name : '未知奖项');
    }


    completeAward(awardType) {
        // 检查是临时奖项还是常规奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward 
            ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total }
            : CONFIG.awards[awardType];
        
        if (!award) return;
        
        // 奖项抽完时不再显示弹框提示
        
        // 禁用对应的奖项按钮（左侧悬浮按钮）
        const awardBtn = document.querySelector(`.award-btn-floating[data-award="${awardType}"]`);
        if (awardBtn) {
            awardBtn.classList.add('disabled');
        }
        
        // 更新面板状态
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            const startBtn = panel.querySelector('.btn-start');
            const stopBtn = panel.querySelector('.btn-stop');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.classList.add('disabled');
            }
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    updateDisplay() {
        // 更新号码总数显示
        this.updateNumbersCount();
        
        // 检查并禁用已完成的奖项，更新面板计数
        Object.keys(CONFIG.awards).forEach(awardType => {
            const award = CONFIG.awards[awardType];
            const drawnCount = this.getDrawnCountForAward(awardType);
            
            // 更新面板计数
            this.updateAwardPanelCount(awardType);
            
            if (drawnCount >= award.total) {
                const awardBtn = document.querySelector(`.award-btn-floating[data-award="${awardType}"]`);
                if (awardBtn) {
                    awardBtn.classList.add('disabled');
                }
                // 禁用开始抽奖按钮
                const panel = document.getElementById(`awardPanel-${awardType}`);
                if (panel) {
                    const startBtn = panel.querySelector('.btn-start');
                    if (startBtn) {
                        startBtn.disabled = true;
                        startBtn.classList.add('disabled');
                    }
                }
            }
        });
    }

    reset() {
        if (!confirm('确定要重置所有抽奖结果吗？此操作不可恢复！注意：不会清空已导入的号码列表。')) {
            return;
        }

        this.drawnNumbers.clear();
        // 清空所有奖项的已抽中列表
        Object.keys(CONFIG.awards).forEach(awardType => {
            if (this.drawnNumbersByAward[awardType]) {
                this.drawnNumbersByAward[awardType] = [];
            }
        });
        this.isRolling = {};
        this.animationIntervals = {};

        // 清空所有奖项面板的显示
        Object.keys(CONFIG.awards).forEach(awardType => {
            const panel = document.getElementById(`awardPanel-${awardType}`);
            if (panel) {
                const numberDisplay = panel.querySelector('.award-number');
                const multiContainer = panel.querySelector('.award-multi-numbers');
                const animation = panel.querySelector('.award-animation');
                const startBtn = panel.querySelector('.btn-start');
                const stopBtn = panel.querySelector('.btn-stop');
                
                if (numberDisplay) numberDisplay.textContent = '?';
                if (multiContainer) {
                    multiContainer.innerHTML = '';
                    multiContainer.style.display = 'none';
                }
                if (animation) {
                    animation.classList.remove('rolling');
                    animation.style.display = 'flex';
                }
                if (startBtn) startBtn.style.display = 'block';
                if (stopBtn) stopBtn.style.display = 'none';
                panel.classList.remove('active');
                panel.style.display = 'none';
            }
        });

        // 恢复所有奖项按钮
        document.querySelectorAll('.award-btn-floating').forEach(btn => {
            btn.classList.remove('disabled');
        });

        this.updateDisplay();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 抑制浏览器扩展相关的错误提示（不影响功能）
    window.addEventListener('error', (event) => {
        if (event.message && event.message.includes('runtime.lastError')) {
            event.preventDefault();
            return false;
        }
    });
    
    // 捕获未处理的Promise拒绝（浏览器扩展相关）
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && event.reason.message.includes('runtime.lastError')) {
            event.preventDefault();
            return false;
        }
    });
    
    new LotterySystem();
});

