// 从运行配置装配媒体存储及限制，供请求入口使用。
import { useRuntimeConfig } from '#imports';
import {existsSync} from 'node:fs'
import { resolve } from 'node:path';
import { createLocalMediaStorage } from '../infrastructure/media-storage';
import { mediaHandlers } from '../http/handlers/media-handlers';
import { getDatabase } from '../db';
import { authRuntime } from './auth';
export function mediaStoragePath() {
    return resolve(useRuntimeConfig().mediaStoragePath || (existsSync(resolve('public')) ? resolve('public') : resolve('.output/public')));
}

export function mediaStorage() {return createLocalMediaStorage(mediaStoragePath());}

export function mediaRuntime() {return mediaHandlers(getDatabase(),authRuntime().options,mediaStorage());}
