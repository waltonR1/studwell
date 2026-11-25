import {describe, expect, it} from 'vitest'
import {taskFollowup} from '../../server/policies/task-followup'
import type {RunStatus} from '../../shared/types/admin/tasks'

const now = new Date('2026-10-29T00:00:00Z')
const task = {enabled: true, code: 'auth_cleanup' as const, schedule: {mode: 'interval', minutes: 15}}
const run = {attempt: 0, continuation: 0, groupId: 'fixture-group', counts: [{limitReached: true}]}

describe('执行结束后的有界调度策略', () => {
    it('失败与失联分别按一分钟、五分钟重试，耗尽后回到正常计划', () => {
        for (const status of ['failed', 'interrupted'] as const) {
            for (const [attempt, seconds] of [[0, 60], [1, 300]] as const) {
                expect(taskFollowup(task, {...run, attempt}, status, now)).toMatchObject({
                    nextRunAt: new Date(now.getTime() + seconds * 1000), pendingTrigger: 'retry',
                    pendingGroupId: run.groupId, pendingRetry: attempt + 1,
                })
            }
            expect(taskFollowup(task, {...run, attempt: 2}, status, now)).toMatchObject({
                nextRunAt: new Date(now.getTime() + 900_000), pendingTrigger: 'scheduled', pendingGroupId: null,
            })
        }
    })
    it('只有成功且达到批次预算才续批，续批次数有上限', () => {
        expect(taskFollowup(task, {...run, continuation: 1}, 'success', now)).toMatchObject({
            nextRunAt: new Date(now.getTime() + 60_000), pendingTrigger: 'continuation',
            pendingGroupId: run.groupId, pendingContinuation: 2,
        })
        for (const current of [{...run, continuation: 2}, {...run, counts: [{limitReached: false}]}]) {
            expect(taskFollowup(task, current, 'success', now).pendingTrigger).toBe('scheduled')
        }
    })
    it('主动停止或强制终止不重试、不续批；禁用任务不再安排执行', () => {
        for (const status of ['stopped', 'terminated'] as const) {
            expect(taskFollowup(task, run, status, now).pendingTrigger).toBe('scheduled')
        }
        for (const status of ['success', 'failed', 'interrupted', 'stopped', 'terminated'] satisfies RunStatus[]) {
            expect(taskFollowup({...task, enabled: false}, run, status, now)).toEqual({
                nextRunAt: null, pendingTrigger: 'scheduled', pendingGroupId: null,
                pendingRetry: 0, pendingContinuation: 0,
            })
        }
    })
})
