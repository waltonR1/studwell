// MySQL 实体乐观锁使用 uint32；写入时为 version + 1 预留空间。
export const MAX_ENTITY_VERSION = 4294967295
export const MAX_WRITABLE_ENTITY_VERSION = MAX_ENTITY_VERSION - 1
