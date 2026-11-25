// 公开上传文件的静态路径兜底，支持构建后上传及视频Range；不是官网内容API。
import {defineEventHandler} from 'h3';
import {mediaRuntime} from '../../runtime/media';
export default defineEventHandler(event=>mediaRuntime().file(event,true));
