// 后台 URL 分页与列表查询输入；原始字符串和解析后的数值类型分别由 Zod 推导。
import {z} from 'zod'
import {ADMIN_PAGE_SIZES, DEFAULT_ADMIN_PAGE_SIZE} from '../../config/admin/pagination'

// 数字查询必须是单个十进制字符串，拒绝数组、空值、指数、小数及隐式转换。
const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
export const paginationShape = {
    // 未提供字段时的基础解析默认值；非法输入仍校验失败，不回退。schema 不读取数据库。
    // 消费方可在未提供 pageSize 时采用数据库有效参数；显式传入的分页值优先，不受此默认值影响。
    page: positiveInteger.default(1),
    pageSize: positiveInteger.pipe(z.literal(ADMIN_PAGE_SIZES)).default(DEFAULT_ADMIN_PAGE_SIZE),
}
export const paginationSchema = z.strictObject(paginationShape).refine(
    value => Number.isSafeInteger((value.page - 1) * value.pageSize),
    {path: ['page'], message: '页码超出范围'},
)

// 各模块通过 .safeExtend 声明筛选白名单，保留溢出约束；不提供任意 SQL 字段或排序参数。
export const listQuerySchema = paginationSchema.safeExtend({search: z.string().trim().max(100).optional()})

export type PaginationInput = z.input<typeof paginationSchema>
export type PaginationQuery = z.output<typeof paginationSchema>
