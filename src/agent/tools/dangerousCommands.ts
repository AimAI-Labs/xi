export interface DangerousCheckResult {
  isDangerous: boolean
  reason?: string
}

export interface DangerousPattern {
  pattern: RegExp
  reason: string
}

export const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // 1. Linux/macOS 文件与目录删除指令 (包含单文件与递归删除)
  {
    pattern: /\b(rm|unlink)\s+/i,
    reason: '检测到文件/目录删除指令 (rm / unlink)',
  },
  // 2. Windows 文件与目录删除指令 (包含单文件与递归删除)
  {
    pattern: /\b(del|erase)\s+/i,
    reason: '检测到 Windows 文件删除指令 (del / erase)',
  },
  {
    pattern: /\b(rd|rmdir)\s+/i,
    reason: '检测到目录删除指令 (rd / rmdir)',
  },
  {
    pattern: /\bRemove-Item\b/i,
    reason: '检测到 PowerShell 删除指令 (Remove-Item)',
  },
  // 3. 磁盘格式化与底层扇区直接写入
  {
    pattern: /\bformat\s+[a-zA-Z]:/i,
    reason: '检测到磁盘格式化指令 (format)',
  },
  {
    pattern: /\bmkfs(\.[a-zA-Z0-9]+)?\b/i,
    reason: '检测到文件系统创建/重置指令 (mkfs)',
  },
  {
    pattern: /\bdd\s+.*if=/i,
    reason: '检测到低级扇区直接写入指令 (dd)',
  },
  {
    pattern: />\s*\/dev\/sd[a-z0-9]*/i,
    reason: '检测到直接覆盖块设备指令',
  },
  // 4. 系统关机、重启与破坏性提权
  {
    pattern: /\b(shutdown|reboot|poweroff|init\s+0|init\s+6)\b/i,
    reason: '检测到系统关机/重启指令',
  },
  {
    pattern: /\b(Stop-Computer|Restart-Computer)\b/i,
    reason: '检测到 PowerShell 关机/重启指令',
  },
  {
    pattern: /chmod\s+(-R\s+)?777\s+\//i,
    reason: '检测到根目录危险权限变更 (chmod 777 /)',
  },
  {
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: '检测到 Fork 炸弹代码',
  },
  // 5. 危险 Git 操作
  {
    pattern: /\bgit\s+push\s+.*(--force|-f)\b/i,
    reason: '检测到 Git 强制推流指令 (git push -f)',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/i,
    reason: '检测到 Git 硬重置指令 (git reset --hard)',
  },
  // 6. 数据库破坏性指令
  {
    pattern: /\b(drop|truncate)\s+(database|table)\b/i,
    reason: '检测到破坏性数据库删除指令 (DROP/TRUNCATE)',
  },
]

export function checkDangerousCommand(command: string): DangerousCheckResult {
  const trimmed = command.trim()
  for (const item of DANGEROUS_PATTERNS) {
    if (item.pattern.test(trimmed)) {
      return { isDangerous: true, reason: item.reason }
    }
  }
  return { isDangerous: false }
}
