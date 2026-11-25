# 离线密码拒绝数据

源：[SecLists](https://github.com/danielmiessler/SecLists)，MIT 许可见本目录 SecLists-LICENSE.txt；固定提交及源/输出 SHA-256 见 password-blocklist-source.json。

导入该提交的 xato-net-10-million-passwords-100000.txt（前 100,000 条常见密码）。由于应用已拒绝不足 6 字符的口令，只保留 6–128 字符的 84,016 个不重复小写 SHA-256 摘要。摘要仅用于拒绝名单匹配，绝不是用户密码存储方案；实际密码仍使用随机盐 Argon2id。运行时不联网，不将账号密码或其摘要发往外部。

这不是全部已泄露密码库，也不代表名单之外的密码安全。更新时人工审查新的上游提交、许可证与来源路径，修改 scripts/update-password-blocklist.mjs 后执行 `npm run password:blocklist:update`、复核元数据及测试并手动提交。该命令联网下载并覆盖本地名单、来源记录和许可证；不修改固定提交号时只是重新导入同一版本，不会自动获取最新名单。不在安装、构建或定时任务中自动更新。长度规则始终执行；手写拒绝项与离线数据均仅在开关开启时检查。Root 初始化始终跳过两类名单。

导入时大文件直链曾超时/连接重置；最终使用同一固定提交的前 100,000 条文件经 GitHub Contents API 获取，未将失败下载内容或原始口令文件留在仓库。
