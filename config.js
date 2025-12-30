// 抽奖系统配置
const CONFIG = {
    // 奖项配置
    awards: {
        lucky: {
            name: '幸运奖',                    // 奖项名称（必填）
            total: 43,                         // 奖项总名额（必填）
            distribution: [13, 15, 15]        // 每次抽取的数量分配（必填）
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
    },
    
    // 球体配置
    sphere: {
        defaultRadius: 400,        // 默认球体半径（像素）
        minRadius: 150,            // 最小半径
        maxRadius: 800,            // 最大半径
        wheelStep: 10              // 滚轮调整步长（像素）
    },
    
    // 跑马灯配置
    marquee: {
        itemWidth: 300,            // 跑马灯项目宽度（像素）
        itemHeight: 300,           // 跑马灯项目高度（像素）
        itemMinWidth: 300,         // 跑马灯项目最小宽度（像素）
        gap: 40,                   // 项目之间的间距（像素）
        speed: 40                  // 跑马灯滚动速度（秒，数值越小越快）
    },
    
    // 奖品图片路径配置
    prizeImages: {
        // 幸运奖：3种奖品
        lucky: [
            { src: 'images/prizes/lucky_3.jpg', label: '科大讯飞降噪会议耳机' , name: '科大讯飞降噪会议耳机'},
            { src: 'images/prizes/lucky_1.jpg', label: '东芝电饭锅' , name: '东芝电饭锅'},
            { src: 'images/prizes/lucky_2.jpg', label: '追觅高速吹风机套装' , name: '追觅高速吹风机套装'},
        ],
        // 三等奖：大疆 action4
        third: [
            { src: 'images/prizes/third.jpg', label: '大疆 action4' , name: '大疆 action4'}
        ],
        // 二等奖：大疆 poket3
        second: [
            { src: 'images/prizes/second.jpg', label: '大疆 Pocket3' , name: '大疆 Pocket3'}
        ],
        // 一等奖：苹果手机17（256G）＋ 苹果AirPods 4
        first: [
            { src: 'images/prizes/first.jpg', label: '苹果手机17(256G)＋苹果AirPods 4' , name: '苹果手机17(256G)套装'}
        ]
    }
};

