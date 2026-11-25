// 协调咨询邮件投递及发送状态，实际传输由注入接口执行。
import type {InquiryMailKind, InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import type {InquiryTransport} from '../core/inquiry-mail'
import type {Database} from '../db/transaction'
import {inquiryMailRepository as repo} from '../repositories/inquiry-mail'
import {readInquirySettings} from '../repositories/inquiry-settings'

export function enabledInquiryMailKinds(mail: InquirySettings['mail']) {
    const kinds: InquiryMailKind[] = []
    if (mail.forwardEnabled) kinds.push('forward')
    if (mail.replyEnabled) kinds.push('reply')
    if (mail.assignmentEnabled) kinds.push('assignment')
    return kinds
}

export async function deliverInquiryMail(db: Database, send: InquiryTransport, clock = () => new Date()) {
    const now = clock()
    const job = await db.transaction(async tx => {
        const {settings} = await readInquirySettings(tx, 'share')
        await repo.expire(tx, now)
        return repo.claim(tx, now, enabledInquiryMailKinds(settings.mail))
    }, {isolationLevel: 'read committed'})
    if (!job) return false
    // Unexpected transport interruptions may occur after acceptance. Never retry those automatically.
    const result = await send(job).catch(() => 'uncertain' as const)
    const finished = clock()
    const delays = [60_000, 300_000]
    const delay = result === 'retry' ? delays[job.attempts - 1] : undefined
    await repo.finish(db, job.id, job.attempts, {
        status: delay ? 'queued' : result === 'retry' ? 'failed' : result,
        sentAt: result === 'sent' ? finished : null,
        availableAt: new Date(finished.getTime() + (delay ?? 0)),
    })
    return true
}
