# data/profiles — 合婚档案（可选）

`divination/marriage.js` 支持两种调用方式：

```bash
# A. 直接传八字（推荐，无需档案文件）
node divination/marriage.js 张三 "癸酉 乙卯 庚寅 戊子" 李四 "壬申 丙午 甲子 辛未"

# B. 传 userId（从本目录读 {userId}.json）
node divination/marriage.js 111111 222222
```

方式 B 需要的档案格式见 `sample.json`。档案不入库（`*.json` 除 sample 外请在 .gitignore 中排除），
以避免真实出生信息进公开仓库。
