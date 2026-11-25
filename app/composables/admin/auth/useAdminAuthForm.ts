// 认证表单的秘密输入、校验和路由接线；身份状态由 session store 持有。
import {ref, reactive, computed, watch, onMounted, onBeforeUnmount} from 'vue'
import {DEFAULT_PASSWORD_POLICY} from '#shared/config/admin/password'
import {isPasswordLengthValid} from '#shared/utils/admin/password'
import {useAdminRequestStore} from '~/stores/admin/request'
import {safeAdminRedirect} from '~/utils/admin/auth/redirect'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminSessionStore} from '~/stores/admin/session'
import {storeToRefs} from 'pinia'

export function useAdminAuthForm(props: Readonly<{
    mode: 'login' | 'password'
}>) {
    const api = useAdminRequestStore()
    const {write, refreshSession, login} = api
    const {session} = storeToRefs(useAdminSessionStore())
    const route = useRoute()
    // 会话接口返回服务端有效密码策略后优先使用；未取得策略时仅以共享默认范围做表单预检，提交仍由服务端裁决。
    const policy = computed(() => session.value?.passwordPolicy ?? DEFAULT_PASSWORD_POLICY)
    const returnTo = computed(() => safeAdminRedirect(route.query.redirect))
    const forcedChange = computed(() => props.mode === 'password' && !!session.value?.mustChangePassword)
    const leaving = ref(false)
    let disposed = false

    function clearSecrets() {
        username.value = '';
        password.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    }

    onBeforeUnmount(() => { disposed = true; clearSecrets() })
    const username = ref('')
    const password = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const {notification, show} = useAdminToast()
    onMounted(async () => {
        if (props.mode !== 'login' || route.query.passwordChanged !== '1')
            return
        show('密码已修改，请使用新密码重新登录。')
        const query = {...route.query}
        delete query.passwordChanged
        await navigateTo({path: route.path, query}, {replace: true})
    })
    const loading = ref(false)
    const error = ref('')
    const fieldErrors = reactive({newPassword: '', confirmPassword: ''})
    watch(newPassword, () => {
        fieldErrors.newPassword = '';
        fieldErrors.confirmPassword = '';
    })
    watch(confirmPassword, () => {
        fieldErrors.confirmPassword = '';
    })
    const dirty = computed(() => !!(username.value || password.value || newPassword.value || confirmPassword.value))
    useAdminUnsavedGuard(dirty, '本次填写的内容尚未提交，离开后将清空。', () => !leaving.value)

    async function logout() {
        if (loading.value)
            return
        loading.value = true
        try {
            await write('logout')
            if (disposed) return
            clearSecrets()
            leaving.value = true
            await navigateTo('/admin/login')
        } catch (cause) {
            if (disposed) return
            error.value = api.message(cause)
        } finally {
            loading.value = false
        }
    }

    async function submit() {
        if (loading.value)
            return
        error.value = ''
        if (props.mode === 'password') {
            fieldErrors.newPassword = !isPasswordLengthValid(newPassword.value, policy.value) ? '新密码须为 ' + policy.value.minLength + '–' + policy.value.maxLength + ' 个字符。' : ''
            fieldErrors.confirmPassword = newPassword.value !== confirmPassword.value ? '两次输入的新密码不一致。' : ''
            if (fieldErrors.newPassword || fieldErrors.confirmPassword)
                return
        }
        loading.value = true
        try {
            if (props.mode === 'login') {
                const state = await login({username: username.value, password: password.value})
                if (disposed) return
                clearSecrets()
                leaving.value = true
                await navigateTo(state.mustChangePassword ? {
                    path: '/admin/change-password', query: {redirect: returnTo.value},
                } : returnTo.value)
                return
            } else
                await write('password', {oldPassword: password.value, newPassword: newPassword.value})
            if (disposed) return
            clearSecrets()
            leaving.value = true
            if (props.mode === 'password') {
                await navigateTo({
                    path: '/admin/login',
                    query: {...(route.query.redirect ? {redirect: returnTo.value} : {}), passwordChanged: '1'}
                })
                return
            }
        } catch (cause) {
            if (disposed) return
            error.value = api.message(cause)
            await refreshSession().catch(() => {
            })
        } finally {
            loading.value = false
        }
    }

    return {
        session,
        policy,
        returnTo,
        forcedChange,
        username,
        password,
        newPassword,
        confirmPassword,
        notification,
        loading,
        error,
        fieldErrors,
        logout,
        submit
    }
}
