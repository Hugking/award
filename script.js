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
        this.useSphereMode = true; // 是否使用3D球体模式
        this.sphereElements = {}; // 存储每个奖项的球体数字元素
        this.sphereRotationFrameId = {}; // 存储每个奖项的旋转动画ID
        this.sphereRotationData = {}; // 存储每个奖项的旋转数据
        this.sphereRadius = CONFIG.sphere ? CONFIG.sphere.defaultRadius : 250; // 当前球体半径，从config读取默认值
        
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
        
        // 默认显示首页（会自动更新右侧奖品展示）
        this.selectAward('home');
        
        // 初始化鼠标滚轮调整球体大小
        this.initSphereWheelControl();
        
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
                <!-- 奖品跑马灯（默认显示） -->
                <div class="prize-marquee-container award-prize-marquee">
                    <div class="prize-marquee-track"></div>
                </div>
                <div class="lottery-animation award-animation" style="display: none;">
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
                <!-- 3D球体抽奖容器 -->
                <div class="sphere-lottery-container award-sphere-container" style="display: none;">
                    <div class="sphere-3d-wrapper">
                        <div class="sphere-3d" id="sphere3d-${awardId}"></div>
                    </div>
                    <!-- 中奖数字墙面 -->
                    <div class="winners-wall award-winners-wall"></div>
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
        // 隐藏所有面板
        document.querySelectorAll('.award-display-panel').forEach(panel => {
            panel.style.display = 'none';
            panel.classList.remove('active');
        });

        // 如果是首页，特殊处理
        if (awardType === 'home') {
            const panel = document.getElementById('awardPanel-home');
            if (panel) {
                panel.style.display = 'flex';
                panel.classList.add('active');
                // 初始化首页跑马灯，显示所有奖品
                this.initHomeMarquee();
            }
            // 更新右侧当前奖品展示（显示占位符）
            this.updateCurrentPrizeDisplay('home', 0);
            return;
        }

        // 检查是临时奖项还是常规奖项
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward ? { name: isTempAward.name, total: isTempAward.total } : CONFIG.awards[awardType];
        
        if (!award && !isTempAward) return;

        // 检查是否已经抽完
        const drawnForAward = this.getDrawnCountForAward(awardType);
        const isCompleted = drawnForAward >= award.total;

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
                animation.style.display = 'none';
                animation.classList.remove('rolling');
            }
            
            // 选择奖项时，隐藏跑马灯（只有首页显示跑马灯）
            const marqueeContainer = panel.querySelector('.prize-marquee-container');
            if (marqueeContainer) {
                marqueeContainer.style.display = 'none';
            }
            
            // 如果未抽奖且未在抽奖中，显示3D球体
            if (drawnForAward === 0 && !this.isRolling[awardType] && this.useSphereMode) {
                const sphereContainer = panel.querySelector('.award-sphere-container');
                if (sphereContainer) {
                    sphereContainer.style.display = 'flex';
                    // 创建或更新3D球体
                    this.createSphere(awardType);
                }
            }
            
            // 更新标题显示具体奖品名称
            this.updateTitleWithPrizeName(awardType, drawnForAward, true);
            
            // 显示右侧当前奖品展示
            this.updateCurrentPrizeDisplay(awardType, drawnForAward);
        }
    }
    
    // 初始化首页跑马灯（显示所有奖品）
    initHomeMarquee() {
        const panel = document.getElementById('awardPanel-home');
        if (!panel) return;
        
        const marqueeContainer = panel.querySelector('.prize-marquee-container');
        const marqueeTrack = panel.querySelector('.prize-marquee-track');
        if (!marqueeContainer || !marqueeTrack) return;
        
        // 应用config中的跑马灯配置
        const marqueeConfig = CONFIG.marquee || {};
        if (marqueeConfig.gap) {
            marqueeTrack.style.gap = marqueeConfig.gap + 'px';
        }
        if (marqueeConfig.speed) {
            marqueeTrack.style.animationDuration = marqueeConfig.speed + 's';
        }
        
        // 显示跑马灯
        marqueeContainer.style.display = 'flex';
        marqueeContainer.classList.remove('paused');
        
        // 跑马灯显示时，隐藏右侧当前奖品展示
        this.toggleCurrentPrizeDisplay(false);
        
        // 收集所有奖品，按照1、2、3等奖的顺序，并记录奖项类型
        let allPrizeImages = [];
        if (CONFIG.prizeImages) {
            // 按照指定顺序：一等奖、二等奖、三等奖、幸运奖
            const awardOrder = ['first', 'second', 'third', 'lucky'];
            awardOrder.forEach(awardType => {
                const prizeImages = CONFIG.prizeImages[awardType];
                if (prizeImages && prizeImages.length > 0) {
                    // 为每个奖品添加奖项类型标识
                    prizeImages.forEach(prize => {
                        allPrizeImages.push({
                            ...prize,
                            awardType: awardType
                        });
                    });
                }
            });
        }
        
        // 如果没有奖品，不显示跑马灯
        if (allPrizeImages.length === 0) {
            marqueeContainer.style.display = 'none';
            return;
        }
        
        // 生成跑马灯内容
        marqueeTrack.innerHTML = '';
        
        // 创建单个奖品元素的函数
        const createPrizeItem = (prize, awardType) => {
            const item = document.createElement('div');
            item.className = 'prize-marquee-item';
            // 添加奖项类型标识，用于概率跳动
            if (awardType) {
                item.dataset.awardType = awardType;
            }
            
            // 使用config中的尺寸配置
            const marqueeConfig = CONFIG.marquee || {};
            if (marqueeConfig.itemWidth) {
                item.style.width = marqueeConfig.itemWidth + 'px';
            }
            if (marqueeConfig.itemHeight) {
                item.style.height = marqueeConfig.itemHeight + 'px';
            }
            if (marqueeConfig.itemMinWidth) {
                item.style.minWidth = marqueeConfig.itemMinWidth + 'px';
            }
            
            const imgContainer = document.createElement('div');
            imgContainer.className = 'prize-marquee-image-container';
            
            // 如果图片src为空，直接显示文字占位符
            if (!prize.src || prize.src.trim() === '') {
                imgContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5);">${prize.name || prize.label}</div>`;
            } else {
                const img = document.createElement('img');
                img.src = prize.src;
                img.alt = prize.label;
                
                // 图片加载失败处理
                img.onerror = function() {
                    this.style.display = 'none';
                    imgContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5);">${prize.name || prize.label}</div>`;
                };
                
                imgContainer.appendChild(img);
            }
            
            item.appendChild(imgContainer);
            
            // 添加奖品名称标签
            const labelDiv = document.createElement('div');
            labelDiv.className = 'prize-marquee-label';
            labelDiv.textContent = prize.name || prize.label;
            item.appendChild(labelDiv);
            
            return item;
        };
        
        // 根据奖品数量动态调整重复次数
        let repeatCount;
        if (allPrizeImages.length <= 3) {
            repeatCount = 10;
        } else if (allPrizeImages.length <= 6) {
            repeatCount = 8;
        } else {
            repeatCount = 6;
        }
        
        // 重复添加内容，实现无缝循环
        const allItems = [];
        for (let i = 0; i < repeatCount; i++) {
            allPrizeImages.forEach(prize => {
                const item = createPrizeItem(prize, prize.awardType);
                marqueeTrack.appendChild(item);
                allItems.push(item);
            });
        }
        
        // 根据奖项概率添加心跳效果
        this.addRandomHeartbeat(allItems);
    }
    
    // 为跑马灯项目添加随机心跳效果（按照1、2、3等奖的概率）
    addRandomHeartbeat(items) {
        if (items.length === 0) return;
        
        // 定义各奖项的跳动概率（大奖概率更高）
        const awardProbabilities = {
            'first': 0.85,   // 一等奖：90%概率跳动（大奖，大家最想要）
            'second': 0.75,  // 二等奖：75%概率跳动
            'third': 0.75,   // 三等奖：55%概率跳动
            'lucky': 0.05    // 幸运奖：30%概率跳动（最低）
        };
        
        // 根据奖项类型，按概率为每个项目添加心跳效果
        items.forEach((item, index) => {
            const awardType = item.dataset.awardType || 'lucky'; // 默认为幸运奖
            const probability = awardProbabilities[awardType] || 0.15;
            
            // 根据概率决定是否添加心跳效果
            if (Math.random() < probability) {
                // 随机延迟，让心跳效果更自然（大奖延迟更短，更早出现）
                const baseDelay = awardType === 'first' ? 0.1 : 
                                 awardType === 'second' ? 0.3 : 
                                 awardType === 'third' ? 0.6 : 1.0;
                const delay = baseDelay + Math.random() * 0.5; // 在基础延迟上增加随机延迟
                
                setTimeout(() => {
                    item.classList.add('heartbeat');
                }, delay * 1000);
            }
        });
    }
    
    // 初始化奖品跑马灯（图片滚动）- 只在未抽奖时显示，显示所有奖品
    initPrizeMarquee(awardType) {
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        // 检查是否已抽过奖或正在抽奖
        const drawnForAward = this.getDrawnCountForAward(awardType);
        if (drawnForAward > 0 || this.isRolling[awardType]) {
            const marqueeContainer = panel.querySelector('.prize-marquee-container');
            if (marqueeContainer) {
                marqueeContainer.style.display = 'none';
            }
            return;
        }
        
        const marqueeContainer = panel.querySelector('.prize-marquee-container');
        const marqueeTrack = panel.querySelector('.prize-marquee-track');
        if (!marqueeContainer || !marqueeTrack) return;
        
        // 应用config中的跑马灯配置
        const marqueeConfig = CONFIG.marquee || {};
        if (marqueeConfig.gap) {
            marqueeTrack.style.gap = marqueeConfig.gap + 'px';
        }
        if (marqueeConfig.speed) {
            marqueeTrack.style.animationDuration = marqueeConfig.speed + 's';
        }
        
        // 显示跑马灯
        marqueeContainer.style.display = 'flex';
        marqueeContainer.classList.remove('paused');
        
        // 跑马灯显示时，隐藏右侧当前奖品展示
        this.toggleCurrentPrizeDisplay(false);
        
        // 收集所有奖品（所有跑马灯都显示所有奖品），按照1、2、3等奖的顺序，并记录奖项类型
        let allPrizeImages = [];
        if (CONFIG.prizeImages) {
            // 按照指定顺序：一等奖、二等奖、三等奖、幸运奖
            const awardOrder = ['first', 'second', 'third', 'lucky'];
            awardOrder.forEach(awardKey => {
                const prizeImages = CONFIG.prizeImages[awardKey];
                if (prizeImages && prizeImages.length > 0) {
                    // 为每个奖品添加奖项类型标识
                    prizeImages.forEach(prize => {
                        allPrizeImages.push({
                            ...prize,
                            awardType: awardKey
                        });
                    });
                }
            });
        }
        
        // 处理临时奖项
        const isTempAward = this.tempAwards[awardType];
        if (isTempAward) {
            const award = this.tempAwards[awardType];
            allPrizeImages.push(
                { src: `images/prizes/temp_${awardType}.jpg`, label: award.name, name: award.name, awardType: 'lucky' }
            );
        }
        
        // 如果没有奖品，不显示跑马灯
        if (allPrizeImages.length === 0) {
            marqueeContainer.style.display = 'none';
            return;
        }
        
        // 生成跑马灯内容（重复足够多次以实现无缝循环）
        // 为了无缝循环，需要至少重复2次，然后动画移动50%即可
        marqueeTrack.innerHTML = '';
        
        // 创建单个奖品元素的函数
        const createPrizeItem = (prize, awardType) => {
            const item = document.createElement('div');
            item.className = 'prize-marquee-item';
            // 添加奖项类型标识，用于概率跳动
            if (awardType) {
                item.dataset.awardType = awardType;
            }
            
            // 使用config中的尺寸配置
            const marqueeConfig = CONFIG.marquee || {};
            if (marqueeConfig.itemWidth) {
                item.style.width = marqueeConfig.itemWidth + 'px';
            }
            if (marqueeConfig.itemHeight) {
                item.style.height = marqueeConfig.itemHeight + 'px';
            }
            if (marqueeConfig.itemMinWidth) {
                item.style.minWidth = marqueeConfig.itemMinWidth + 'px';
            }
            
            const imgContainer = document.createElement('div');
            imgContainer.className = 'prize-marquee-image-container';
            
            // 如果图片src为空，直接显示文字占位符
            if (!prize.src || prize.src.trim() === '') {
                imgContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5);">${prize.name || prize.label}</div>`;
            } else {
                const img = document.createElement('img');
                img.src = prize.src;
                img.alt = prize.label;
                
                // 图片加载失败处理
                img.onerror = function() {
                    // 图片加载失败时，显示文字占位符
                    this.style.display = 'none';
                    imgContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.5);">${prize.name || prize.label}</div>`;
                };
                
                imgContainer.appendChild(img);
            }
            
            item.appendChild(imgContainer);
            
            // 添加奖品名称标签
            const labelDiv = document.createElement('div');
            labelDiv.className = 'prize-marquee-label';
            labelDiv.textContent = prize.name || prize.label;
            item.appendChild(labelDiv);
            
            return item;
        };
        
        // 根据奖品数量动态调整重复次数
        let repeatCount;
        if (allPrizeImages.length <= 3) {
            repeatCount = 10;
        } else if (allPrizeImages.length <= 6) {
            repeatCount = 6;
        } else {
            repeatCount = 4;
        }
        
        // 重复添加内容，实现无缝循环
        const allItems = [];
        for (let i = 0; i < repeatCount; i++) {
            allPrizeImages.forEach(prize => {
                const item = createPrizeItem(prize, prize.awardType);
                marqueeTrack.appendChild(item);
                allItems.push(item);
            });
        }
        
        // 根据奖项概率添加心跳效果
        this.addRandomHeartbeat(allItems);
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
            
            // 停止数字快速旋转
            const sphereNumbers = panel.querySelectorAll('.sphere-number');
            sphereNumbers.forEach(el => {
                el.classList.remove('lottery-spinning');
            });
            
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
            const marqueeContainer = panel.querySelector('.prize-marquee-container');
            
            // 结束抽奖后，隐藏跑马灯
            if (marqueeContainer) {
                marqueeContainer.style.display = 'none';
                // 跑马灯隐藏时，显示右侧当前奖品展示
                this.toggleCurrentPrizeDisplay(true);
            }
            
            // 更新标题显示具体奖品名称（使用抽奖前的数量，确保与开始抽奖时一致）
            this.updateTitleWithPrizeName(awardType, drawnForAward);
            
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
        
        // 更新标题显示具体奖品名称
        this.updateTitleWithPrizeName(awardType, drawnForAward);
        
        const animation = panel.querySelector('.award-animation');
        const multiContainer = panel.querySelector('.award-multi-numbers');
        const marqueeContainer = panel.querySelector('.prize-marquee-container');
        const sphereContainer = panel.querySelector('.award-sphere-container');
        const winnersWall = panel.querySelector('.award-winners-wall');
        
        // 隐藏跑马灯
        if (marqueeContainer) {
            marqueeContainer.style.display = 'none';
            // 跑马灯隐藏时，显示右侧当前奖品展示
            this.toggleCurrentPrizeDisplay(true);
        }
        
        // 清空之前的结果显示
        if (multiContainer) multiContainer.innerHTML = '';
        if (winnersWall) winnersWall.innerHTML = '';
        
        // 使用3D球体模式 - 显示球体，但跳过飞出动画，直接显示到墙面
        if (this.useSphereMode) {
            // 隐藏传统动画，显示3D球体
            if (animation) animation.style.display = 'none';
            if (multiContainer) multiContainer.style.display = 'none';
            if (sphereContainer) {
                sphereContainer.style.display = 'flex';
                // 显示球体容器
                const sphereWrapper = sphereContainer.querySelector('.sphere-3d-wrapper');
                if (sphereWrapper) sphereWrapper.style.display = 'block';
                // 创建或更新3D球体（保留球体视觉效果）
                this.createSphere(awardType);
            }
        } else {
            // 传统模式
            if (sphereContainer) sphereContainer.style.display = 'none';
            if (count === 1) {
                if (animation) animation.style.display = 'flex';
                if (multiContainer) multiContainer.style.display = 'none';
            } else {
                if (animation) animation.style.display = 'none';
                if (multiContainer) multiContainer.style.display = 'flex';
            }
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
        const sphereContainer = panel.querySelector('.award-sphere-container');
        const sphereWrapper = panel.querySelector('.sphere-3d-wrapper');
        
        // 获取未抽中的号码列表用于滚动显示
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        
        // 使用3D球体模式
        if (this.useSphereMode && sphereContainer && sphereContainer.style.display !== 'none') {
            // 优化：球体旋转由startSphereRotation统一管理，这里不需要重复创建动画
            // 只需要确保startSphereRotation已经启动即可（createSphere时会自动启动）
            // 速度控制通过修改sphereRotationData中的rotationSpeed来实现
            if (this.sphereRotationData && this.sphereRotationData[awardType]) {
                // 如果正在抽奖，直接设置目标速度
                if (this.isRolling[awardType]) {
                    this.sphereRotationData[awardType].targetSpeed = 10.0;
                } else {
                    this.sphereRotationData[awardType].targetSpeed = 0.5;
                }
            }
            
            // 不再随机高亮数字，避免卡顿，只让球体旋转
        } else {
            // 传统模式
            // 确保动画状态正确
            if (animation) {
                animation.classList.add('rolling');
            }
            
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
    
    // 创建3D球体
    createSphere(awardType) {
        const sphereElement = document.getElementById(`sphere3d-${awardType}`);
        if (!sphereElement) return;
        
        // 清空之前的球体
        sphereElement.innerHTML = '';
        this.sphereElements[awardType] = [];
        
        // 获取未抽中的号码
        const availableNumbers = this.availableNumbers.filter(num => !this.drawnNumbers.has(String(num)));
        
        if (availableNumbers.length === 0) {
            return;
        }
        
        // 球体参数（使用当前球体半径）
        const radius = this.sphereRadius;
        const numPoints = Math.min(availableNumbers.length, 250); // 优化：减少数字数量以提高性能，但仍保持球体效果
        
        // 使用斐波那契螺旋算法分布数字在球面上
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 黄金角度
        
        for (let i = 0; i < numPoints; i++) {
            const num = availableNumbers[i % availableNumbers.length];
            
            // 计算球面坐标
            const y = 1 - (i / (numPoints - 1)) * 2; // y从1到-1
            const radiusAtY = Math.sqrt(1 - y * y); // 在当前y高度的圆半径
            const theta = goldenAngle * i; // 角度
            
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            
            // 创建数字元素
            const numberEl = document.createElement('div');
            numberEl.className = 'sphere-number';
            numberEl.textContent = num;
            numberEl.dataset.number = num;
            
            // 创建数字容器（如果还没有）
            let numbersContainer = sphereElement.querySelector('.sphere-numbers-container');
            if (!numbersContainer) {
                numbersContainer = document.createElement('div');
                numbersContainer.className = 'sphere-numbers-container';
                sphereElement.appendChild(numbersContainer);
            }
            
            // 计算数字在3D球面上的位置
            const xPos = x * radius;
            const yPos = y * radius;
            const zPos = z * radius;
            
            // 存储3D位置数据
            numberEl.dataset.x = xPos;
            numberEl.dataset.y = yPos;
            numberEl.dataset.z = zPos;
            numberEl.dataset.initialX = x;
            numberEl.dataset.initialY = y;
            numberEl.dataset.initialZ = z;
            numberEl.dataset.initialAngle = theta;
            
            // 初始位置
            numberEl.style.transform = `translate3d(${xPos}px, ${yPos}px, ${zPos}px)`;
            
            // 根据z轴深度设置初始透明度（后面的数字稍微暗一点，但不要太暗）
            const depth = (zPos + radius) / (2 * radius); // 0到1之间
            const opacity = 0.5 + depth * 0.5; // 后面的0.5，前面的1.0（提高后面数字的可见度）
            numberEl.style.opacity = opacity;
            
            numbersContainer.appendChild(numberEl);
            this.sphereElements[awardType].push(numberEl);
        }
        
        // 更新容器大小
        this.updateSphereContainerSize();
        
        // 启动球体持续旋转动画
        this.startSphereRotation(awardType);
    }
    
    // 初始化鼠标滚轮调整球体大小
    initSphereWheelControl() {
        const sphereConfig = CONFIG.sphere || { defaultRadius: 250, minRadius: 150, maxRadius: 500, wheelStep: 10 };
        const minRadius = sphereConfig.minRadius || 150;
        const maxRadius = sphereConfig.maxRadius || 500;
        const wheelStep = sphereConfig.wheelStep || 10;
        
        // 监听鼠标滚轮事件（只在球体容器上）
        document.addEventListener('wheel', (e) => {
            // 检查是否在球体容器上
            const sphereContainer = e.target.closest('.sphere-lottery-container');
            if (!sphereContainer || sphereContainer.style.display === 'none') {
                return;
            }
            
            // 阻止默认滚动行为
            e.preventDefault();
            
            // 根据滚轮方向调整球体大小
            const delta = e.deltaY > 0 ? -wheelStep : wheelStep;
            const newRadius = Math.max(minRadius, Math.min(maxRadius, this.sphereRadius + delta));
            
            if (newRadius !== this.sphereRadius) {
                this.sphereRadius = newRadius;
                
                // 更新所有显示的球体
                Object.keys(this.sphereElements).forEach(awardType => {
                    if (this.sphereElements[awardType] && this.sphereElements[awardType].length > 0) {
                        // 重新创建球体以应用新的大小
                        this.createSphere(awardType);
                    }
                });
                
                // 更新CSS容器大小
                this.updateSphereContainerSize();
            }
        }, { passive: false });
    }
    
    // 更新球体容器大小
    updateSphereContainerSize() {
        // 容器大小应该是球体半径的1.8倍（留出空间）
        const containerSize = Math.ceil(this.sphereRadius * 1.8);
        document.querySelectorAll('.sphere-3d-wrapper').forEach(wrapper => {
            wrapper.style.width = containerSize + 'px';
            wrapper.style.height = containerSize + 'px';
        });
    }
    
    // 启动球体持续旋转
    startSphereRotation(awardType) {
        const sphereElement = document.getElementById(`sphere3d-${awardType}`);
        if (!sphereElement) return;
        
        // 如果已经有旋转动画在运行，先停止（避免重复创建动画）
        if (this.sphereRotationFrameId && this.sphereRotationFrameId[awardType]) {
            cancelAnimationFrame(this.sphereRotationFrameId[awardType]);
            this.sphereRotationFrameId[awardType] = null;
        }
        
        if (!this.sphereRotationFrameId) {
            this.sphereRotationFrameId = {};
        }
        if (!this.sphereRotationData) {
            this.sphereRotationData = {};
        }
        
        const radius = this.sphereRadius; // 使用当前球体半径
        let rotationY = 0; // Y轴旋转角度（弧度）
        let rotationX = 0; // X轴旋转角度（弧度）- 添加X轴旋转，避免极点不动
        const rotationSpeed = 0.5; // 基础旋转速度（弧度/秒）
        const rotationSpeedX = 0.3; // X轴旋转速度（稍慢一些，更自然）
        
        this.sphereRotationData[awardType] = {
            rotationY: rotationY,
            rotationX: rotationX, // 添加X轴旋转
            rotationSpeed: rotationSpeed,
            rotationSpeedX: rotationSpeedX, // X轴旋转速度
            targetSpeed: rotationSpeed, // 添加目标速度
            startTime: performance.now(),
            lastTime: performance.now() // 添加上次更新时间
        };
        
        const animate = (currentTime) => {
            const data = this.sphereRotationData[awardType];
            if (!data) {
                return;
            }
            
            const deltaTime = (currentTime - data.lastTime) / 1000; // 时间差（秒）
            data.lastTime = currentTime;
            
            // 根据抽奖状态设置目标速度
            if (this.isRolling[awardType]) {
                data.targetSpeed = 10.0; // 抽奖时目标速度
                data.targetSpeedX = 6.0; // X轴旋转速度（稍慢一些，保持自然）
            } else {
                data.targetSpeed = 0.5; // 不抽奖时基础速度
                data.targetSpeedX = 0.3; // X轴基础速度
            }
            
            // 平滑过渡到目标速度（加快加速和减速步长）
            if (data.rotationSpeed < data.targetSpeed) {
                data.rotationSpeed = Math.min(data.rotationSpeed + 0.1, data.targetSpeed); // 加速步长
            } else if (data.rotationSpeed > data.targetSpeed) {
                data.rotationSpeed = Math.max(data.rotationSpeed - 0.15, data.targetSpeed); // 减速步长
            }
            
            // X轴旋转速度也平滑过渡
            if (data.rotationSpeedX < data.targetSpeedX) {
                data.rotationSpeedX = Math.min(data.rotationSpeedX + 0.06, data.targetSpeedX);
            } else if (data.rotationSpeedX > data.targetSpeedX) {
                data.rotationSpeedX = Math.max(data.rotationSpeedX - 0.09, data.targetSpeedX);
            }
            
            // 更新旋转角度（使用累积角度，避免速度变化时出现倒转）
            data.rotationY += data.rotationSpeed * deltaTime;
            data.rotationX += data.rotationSpeedX * deltaTime; // X轴旋转
            
            // 保持角度在合理范围内（避免溢出）
            if (data.rotationY > Math.PI * 2) {
                data.rotationY -= Math.PI * 2;
            }
            if (data.rotationX > Math.PI * 2) {
                data.rotationX -= Math.PI * 2;
            }
            
            if (this.sphereElements[awardType] && this.sphereElements[awardType].length > 0) {
                // 优化：缓存三角函数计算结果，避免重复计算
                const cosY = Math.cos(data.rotationY);
                const sinY = Math.sin(data.rotationY);
                const cosX = Math.cos(data.rotationX);
                const sinX = Math.sin(data.rotationX);
                const radius2 = radius * 2; // 缓存2倍半径
                
                // 优化：使用for循环代替forEach，性能更好
                const elements = this.sphereElements[awardType];
                for (let i = 0; i < elements.length; i++) {
                    const el = elements[i];
                    // 获取初始球面坐标（归一化）
                    const initialX = parseFloat(el.dataset.initialX);
                    const initialY = parseFloat(el.dataset.initialY);
                    const initialZ = parseFloat(el.dataset.initialZ);
                    
                    // 先应用Y轴旋转（绕Y轴旋转）
                    let rotatedX = initialX * cosY - initialZ * sinY;
                    let rotatedZ = initialX * sinY + initialZ * cosY;
                    let rotatedY = initialY;
                    
                    // 再应用X轴旋转（绕X轴旋转），这样极点也会移动
                    const finalY = rotatedY * cosX - rotatedZ * sinX;
                    const finalZ = rotatedY * sinX + rotatedZ * cosX;
                    rotatedZ = finalZ;
                    rotatedY = finalY;
                    
                    // 计算3D位置
                    const xPos = rotatedX * radius;
                    const yPos = rotatedY * radius; // 使用旋转后的Y坐标
                    const zPos = rotatedZ * radius;
                    
                    // 更新位置（包含缩放）
                    const depth = (zPos + radius) / radius2; // 0到1之间
                    const scale = 0.7 + depth * 0.3; // 后面的0.7倍，前面的1.0倍（减少缩放差异）
                    el.style.transform = `translate3d(${xPos}px,${yPos}px,${zPos}px) scale(${scale})`;
                    
                    // 根据z轴深度更新透明度（后面的数字稍微暗一点，但不要太暗）
                    const opacity = 0.5 + depth * 0.5; // 后面的0.5，前面的1.0（提高后面数字的可见度）
                    el.style.opacity = opacity;
                }
            }
            
            this.sphereRotationFrameId[awardType] = requestAnimationFrame(animate);
        };
        
        this.sphereRotationFrameId[awardType] = requestAnimationFrame(animate);
    }
    
    // 更新标题显示具体奖品名称
    updateTitleWithPrizeName(awardType, drawnForAward, showPrizeName = true) {
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        const titleElement = panel.querySelector('.award-panel-title');
        if (!titleElement) return;
        
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward 
            ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total }
            : CONFIG.awards[awardType];
        
        if (!award) return;
        
        // 获取奖品图片配置
        let prizeImages = [];
        if (!isTempAward && CONFIG.prizeImages && CONFIG.prizeImages[awardType]) {
            prizeImages = CONFIG.prizeImages[awardType];
        }
        
        if (prizeImages.length === 0) {
            // 如果没有配置奖品图片，显示奖项名称
            titleElement.textContent = award.name;
            return;
        }
        
        // 幸运奖在默认页面（跑马灯）时，只显示"幸运奖"，不显示奖品名称
        if (awardType === 'lucky' && !showPrizeName) {
            titleElement.textContent = award.name;
            return;
        }
        
        // 根据已抽数量确定当前应该显示哪个奖品
        let prizeIndex = 0;
        if (awardType === 'lucky') {
            // 幸运奖：有3个奖品，根据已抽数量和distribution决定
            // distribution: [15, 15, 13]
            // 第1次抽15个（0-14）：显示第1个奖品
            // 第2次抽15个（15-29）：显示第2个奖品
            // 第3次抽13个（30-42）：显示第3个奖品
            const distribution = award.distribution || [];
            let accumulated = 0;
            for (let i = 0; i < distribution.length; i++) {
                const prevAccumulated = accumulated;
                accumulated += distribution[i];
                // 如果已抽数量在这个区间内（包括等于prevAccumulated的情况）
                if (drawnForAward >= prevAccumulated && drawnForAward < accumulated) {
                    prizeIndex = i;
                    break;
                }
            }
            // 如果已抽数量超过所有distribution的总和，显示最后一个奖品
            if (drawnForAward >= accumulated) {
                prizeIndex = distribution.length - 1;
            }
            // 确保索引不越界
            if (prizeIndex >= prizeImages.length) {
                prizeIndex = prizeImages.length - 1;
            }
        } else if (awardType === 'first') {
            // 一等奖：有两个奖品，根据已抽数量决定
            // 如果已抽数量为0，显示第一个；否则显示第二个
            prizeIndex = drawnForAward === 0 ? 0 : 1;
            if (prizeIndex >= prizeImages.length) {
                prizeIndex = prizeImages.length - 1;
            }
        } else {
            // 其他奖项：只有一个奖品，显示第一个
            prizeIndex = 0;
        }
        
        // 更新标题
        const prizeName = prizeImages[prizeIndex].label;
        titleElement.textContent = `${award.name} - ${prizeName}`;
        
        // 同时更新右侧当前奖品展示
        this.updateCurrentPrizeDisplay(awardType, drawnForAward);
    }
    
    // 控制右侧奖品展示的显示/隐藏
    toggleCurrentPrizeDisplay(show) {
        const prizeDisplay = document.getElementById('currentPrizeDisplay');
        if (prizeDisplay) {
            prizeDisplay.style.display = show ? 'flex' : 'none';
        }
    }
    
    // 更新右侧当前奖品展示（显示所有奖品，已抽中的变灰，当前奖品高亮）
    updateCurrentPrizeDisplay(awardType, drawnForAward) {
        const prizeDisplay = document.getElementById('currentPrizeDisplay');
        const prizeList = document.getElementById('currentPrizeList');
        
        if (!prizeDisplay || !prizeList) return;
        
        // 如果是首页，显示占位符
        if (awardType === 'home') {
            prizeList.innerHTML = '<div class="current-prize-placeholder">请选择奖项</div>';
            // 首页时隐藏右侧奖品展示
            this.toggleCurrentPrizeDisplay(false);
            return;
        }
        
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward 
            ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total }
            : CONFIG.awards[awardType];
        
        if (!award) return;
        
        // 获取奖品图片配置
        let prizeImages = [];
        if (!isTempAward && CONFIG.prizeImages && CONFIG.prizeImages[awardType]) {
            prizeImages = CONFIG.prizeImages[awardType];
        }
        
        if (prizeImages.length === 0) {
            // 如果没有配置奖品图片，显示占位符
            prizeList.innerHTML = `<div class="current-prize-placeholder">${award.name}</div>`;
            return;
        }
        
        // 根据已抽数量确定当前应该显示哪个奖品（与updateTitleWithPrizeName逻辑一致）
        let currentPrizeIndex = 0;
        if (awardType === 'lucky') {
            const distribution = award.distribution || [];
            let accumulated = 0;
            for (let i = 0; i < distribution.length; i++) {
                const prevAccumulated = accumulated;
                accumulated += distribution[i];
                if (drawnForAward >= prevAccumulated && drawnForAward < accumulated) {
                    currentPrizeIndex = i;
                    break;
                }
            }
            if (drawnForAward >= accumulated) {
                currentPrizeIndex = distribution.length - 1;
            }
            if (currentPrizeIndex >= prizeImages.length) {
                currentPrizeIndex = prizeImages.length - 1;
            }
        } else if (awardType === 'first') {
            currentPrizeIndex = drawnForAward === 0 ? 0 : 1;
            if (currentPrizeIndex >= prizeImages.length) {
                currentPrizeIndex = prizeImages.length - 1;
            }
        } else {
            currentPrizeIndex = 0;
        }
        
        // 计算每个奖品是否已抽中
        const distribution = award.distribution || [];
        let accumulated = 0;
        const prizeDrawnStatus = [];
        
        for (let i = 0; i < prizeImages.length; i++) {
            let isDrawn = false;
            
            if (awardType === 'lucky') {
                // 幸运奖：根据distribution判断
                // 第1个奖品：抽0-14个时显示，已抽数量>=15时已抽中
                // 第2个奖品：抽15-29个时显示，已抽数量>=30时已抽中
                // 第3个奖品：抽30-42个时显示，已抽数量>=43时已抽中
                let prevAccumulated = 0;
                for (let j = 0; j < i; j++) {
                    prevAccumulated += (distribution[j] || 0);
                }
                const currentAccumulated = prevAccumulated + (distribution[i] || 0);
                isDrawn = drawnForAward >= currentAccumulated;
            } else if (awardType === 'first') {
                // 一等奖：第一个奖品在抽0个时显示，第二个奖品在抽1个时显示
                // 第1个奖品：已抽数量>=1时已抽中
                // 第2个奖品：已抽数量>=5（total）时已抽中
                if (i === 0) {
                    isDrawn = drawnForAward >= 1;
                } else {
                    isDrawn = drawnForAward >= award.total;
                }
            } else {
                // 其他奖项只有一个奖品，已抽数量>=total时已抽中
                isDrawn = drawnForAward >= award.total;
            }
            
            prizeDrawnStatus.push({
                index: i,
                isDrawn: isDrawn,
                isCurrent: i === currentPrizeIndex
            });
        }
        
        // 清空列表
        prizeList.innerHTML = '';
        
        // 创建所有奖品项
        prizeImages.forEach((prize, index) => {
            const status = prizeDrawnStatus[index];
            const item = document.createElement('div');
            item.className = 'current-prize-item';
            
            // 添加状态类
            if (status.isDrawn) {
                item.classList.add('drawn');
            }
            if (status.isCurrent) {
                item.classList.add('current');
            }
            
            // 创建图片容器
            const imageContainer = document.createElement('div');
            imageContainer.className = 'current-prize-item-image';
            
            if (prize.src && prize.src.trim() !== '') {
                const img = document.createElement('img');
                img.src = prize.src;
                img.alt = prize.label || prize.name;
                img.onerror = function() {
                    // 图片加载失败时显示文字
                    imageContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 14px; color: ${status.isDrawn ? 'rgba(150, 150, 150, 0.8)' : '#00ffff'}; text-shadow: ${status.isDrawn ? 'none' : '0 0 5px rgba(0, 255, 255, 0.5)'};">${prize.name || prize.label}</div>`;
                };
                imageContainer.appendChild(img);
            } else {
                // 没有图片时显示文字
                imageContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 14px; color: ${status.isDrawn ? 'rgba(150, 150, 150, 0.8)' : '#00ffff'}; text-shadow: ${status.isDrawn ? 'none' : '0 0 5px rgba(0, 255, 255, 0.5)'};">${prize.name || prize.label}</div>`;
            }
            
            // 创建名称标签
            const nameLabel = document.createElement('div');
            nameLabel.className = 'current-prize-item-name';
            nameLabel.textContent = prize.name || prize.label || '';
            
            item.appendChild(imageContainer);
            item.appendChild(nameLabel);
            prizeList.appendChild(item);
        });
        
        // 检查跑马灯是否显示，如果显示则隐藏右侧奖品展示
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (panel) {
            const marqueeContainer = panel.querySelector('.prize-marquee-container');
            if (marqueeContainer && marqueeContainer.style.display !== 'none') {
                // 跑马灯显示时，隐藏右侧奖品展示
                this.toggleCurrentPrizeDisplay(false);
            } else {
                // 跑马灯未显示时，显示右侧奖品展示
                this.toggleCurrentPrizeDisplay(true);
            }
        } else {
            // 如果没有面板，默认显示
            this.toggleCurrentPrizeDisplay(true);
        }
    }

    showResults(awardType, winners, count) {
        const isTempAward = this.tempAwards[awardType];
        const award = isTempAward 
            ? { name: this.tempAwards[awardType].name, total: this.tempAwards[awardType].total }
            : CONFIG.awards[awardType];
        const panel = document.getElementById(`awardPanel-${awardType}`);
        if (!panel) return;
        
        const numberDisplay = panel.querySelector('.award-number');
        const multiContainer = panel.querySelector('.award-multi-numbers');
        const animation = panel.querySelector('.award-animation');
        const sphereContainer = panel.querySelector('.award-sphere-container');
        const winnersWall = panel.querySelector('.award-winners-wall');
        
        // 停止数字快速旋转
        if (this.sphereElements[awardType] && this.sphereElements[awardType].length > 0) {
            this.sphereElements[awardType].forEach(el => {
                el.classList.remove('lottery-spinning');
            });
        }

        // 使用3D球体模式 - 直接显示到墙面，不执行飞出动画
        if (this.useSphereMode && sphereContainer && sphereContainer.style.display !== 'none') {
            // 清除所有高亮
            if (this.sphereElements[awardType]) {
                this.sphereElements[awardType].forEach(el => {
                    el.classList.remove('selected');
                });
            }
            
            // 直接创建墙面卡片，跳过球体飞出动画
            winners.forEach((winner, index) => {
                setTimeout(() => {
                    // 直接创建墙面卡片
                    const wallCard = document.createElement('div');
                    wallCard.className = 'winner-number-card';
                    wallCard.textContent = winner;
                    winnersWall.appendChild(wallCard);
                    
                    // 添加出现动画
                    setTimeout(() => {
                        wallCard.style.animation = 'wallCardAppear 0.5s ease-out';
                    }, 10);
                }, index * 100); // 错开显示时间
            });
        } else {
            // 传统模式
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
        }

        // 记录已抽中的号码
        winners.forEach((winner) => {
            this.addToDrawnList(winner, awardType);
        });

        // 更新已抽中数量和面板计数
        this.updateAwardPanelCount(awardType);
        // 更新手动添加号码列表（因为已抽中的号码需要从列表中移除）
        this.updateManualNumbersList();
        
        // 更新右侧当前奖品展示（抽奖后可能会改变显示的奖品）
        const newDrawnCount = this.getDrawnCountForAward(awardType);
        this.updateCurrentPrizeDisplay(awardType, newDrawnCount);
        
        // 更新球体（移除已抽中的数字，延迟执行避免卡顿）
        if (this.useSphereMode && sphereContainer && sphereContainer.style.display !== 'none') {
            setTimeout(() => {
                this.createSphere(awardType);
            }, 1000); // 延迟1秒更新，避免立即更新造成卡顿
        }
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

