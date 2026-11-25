// 通用媒体测试夹具，不导入站点初始化资料。
export default {
  "contain": {
    "mobileEditable": true,
    "maxZoom": 3,
    "opacity": {
      "value": 1,
      "min": 0.2,
      "max": 1,
      "editable": true
    },
    "brightness": {
      "value": 1,
      "min": 0.5,
      "max": 1.5,
      "editable": true
    },
    "label": "完整图片",
    "fit": "contain",
    "desktopRatio": 1.3333333333333333,
    "mobileRatio": 1.3333333333333333,
    "overlay": false
  },
  "icon": {
    "label": "浏览器图标",
    "fit": "contain",
    "desktopRatio": 1,
    "mobileRatio": 1,
    "mobileEditable": false,
    "maxZoom": 1,
    "opacity": {
      "value": 1,
      "min": 1,
      "max": 1,
      "editable": false
    },
    "brightness": {
      "value": 1,
      "min": 1,
      "max": 1,
      "editable": false
    },
    "overlay": false
  },
  "photo": {
    "mobileEditable": true,
    "maxZoom": 3,
    "opacity": {
      "value": 1,
      "min": 0.2,
      "max": 1,
      "editable": true
    },
    "brightness": {
      "value": 1,
      "min": 0.5,
      "max": 1.5,
      "editable": true
    },
    "label": "图片",
    "fit": "cover",
    "desktopRatio": 1.7777777777777777,
    "mobileRatio": 1.7777777777777777,
    "overlay": false
  },
  "cover": {
    "mobileEditable": true,
    "maxZoom": 3,
    "opacity": {
      "value": 1,
      "min": 0.2,
      "max": 1,
      "editable": true
    },
    "brightness": {
      "value": 1,
      "min": 0.5,
      "max": 1.5,
      "editable": true
    },
    "label": "图片",
    "fit": "cover",
    "desktopRatio": 1.7777777777777777,
    "mobileRatio": 1.7777777777777777,
    "overlay": false
  }
} as const
