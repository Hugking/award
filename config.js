// 抽奖系统配置
const CONFIG = {
    // 奖项配置
    awards: {
        lucky: {
            name: '幸运奖',                    // 奖项名称（必填）
            total: 43,                         // 奖项总名额（必填）
            distribution: [15, 15, 13]        // 每次抽取的数量分配（必填）
            // 例如：[15, 15, 13] 表示：
            //   第1次抽15个，第2次抽15个，第3次抽13个，共43个
        },
        third: {
            name: '三等奖',
            total: 20,
            distribution: [10, 10]            // 第1次抽10个，第2次抽10个
        },
        second: {
            name: '二等奖',
            total: 9,
            distribution: [9]                 // 只抽1次，抽9个
        },
        first: {
            name: '一等奖',
            total: 5,
            distribution: [5]                 // 只抽1次，抽5个
        }
    },
    
    // 默认抽奖号码配置（用户未上传Excel时使用）
    defaultNumbers: {
        start: 1,      // 起始号码
        end: 180,      // 结束号码
        format: '000'  // 格式化格式（三位数，前面补0，生成：001, 002, ..., 180）
    }
};

