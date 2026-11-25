// 开发/测试不执行任务；生产只启动调度控制器，删除工作在独立进程中。
import {useRuntimeConfig} from '#imports'
import {closeDatabase, getDatabase} from '../db'
import {startTaskRunner} from '../tasks/runner'
import {createInquirySmtp} from '../infrastructure/inquiry-smtp'
import {deliverInquiryMail} from '../services/inquiry-mail'

export default defineNitroPlugin(nitro => {
    const stop = !import.meta.dev && process.env.NODE_ENV !== 'test'
        ? startTaskRunner(getDatabase, () => useRuntimeConfig().databaseUrl)
        : undefined
    const send = createInquirySmtp(useRuntimeConfig().inquirySmtpUrl)
    let delivery: Promise<unknown> | undefined
    const timer = send && setInterval(() => {
        if (!delivery) delivery = Promise.resolve().then(() => deliverInquiryMail(getDatabase(), send))
            .catch(() => console.error('[inquiry-mail] 邮件队列处理失败'))
            .finally(() => {delivery = undefined})
    }, 3_000)
    timer?.unref()
    nitro.hooks.hook('close', async () => {
        if (timer) clearInterval(timer)
        await delivery
        await stop?.();
        await closeDatabase()
    })
})
