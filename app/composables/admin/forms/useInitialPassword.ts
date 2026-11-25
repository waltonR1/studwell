import {nextTick, ref, toValue, watch, type MaybeRefOrGetter} from 'vue'
import {generateInitialPassword} from '~/utils/admin/auth/password.ts'

// 密码始终由表单持有；此处仅维护不含秘密的交互提示。
export function useInitialPassword(value: MaybeRefOrGetter<string>, update: (value: string) => void, disabled: MaybeRefOrGetter<boolean>, purpose: MaybeRefOrGetter<'create' | 'reset'>, length: MaybeRefOrGetter<number> = 20) {
    const notice = ref('')
    watch(() => toValue(value), () => {
        notice.value = ''
    }, {flush: 'sync'})

    async function generate() {
        if (toValue(disabled)) return
        const generated = generateInitialPassword(toValue(length))
        update(generated)
        await nextTick()
        if (toValue(value) === generated) notice.value = `已生成随机密码，请在${toValue(purpose) === 'reset' ? '重置' : '创建'}前复制。`
    }

    async function copy() {
        if (toValue(disabled) || !toValue(value)) return
        const current = toValue(value)
        try {
            await navigator.clipboard.writeText(current)
            if (toValue(value) === current) notice.value = '密码已复制，请在操作成功后交给账号使用者。'
        } catch {
            if (toValue(value) === current) notice.value = '复制失败，请检查浏览器剪贴板权限后重试。'
        }
    }

    return {notice, generate, copy}
}
