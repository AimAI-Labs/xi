import test from 'ava'

import { checkDangerousCommand } from '../../../src/agent/tools/dangerousCommands.js'

test('正确识别 Linux / macOS 下各类删除指令 (含单文件与递归)', (t) => {
  const dangerous = [
    'rm -rf /',
    'rm -fr /var/log',
    'rm -r -f ./node_modules',
    'rm --recursive --force /tmp',
    'sudo rm -rf ~',
    'rm test.txt',
    'rm ./file.log',
    'unlink session.sock',
  ]

  for (const cmd of dangerous) {
    const result = checkDangerousCommand(cmd)
    t.true(result.isDangerous, `应该拦截: ${cmd}`)
    t.truthy(result.reason)
  }
})

test('正确识别 Windows 下各类删除指令 (含单文件与递归)', (t) => {
  const dangerous = [
    'del "C:\\Users\\Aimony\\Desktop\\test.txt"',
    'del "C:\\Users\\Aimony\\Desktop\\test.txt" && echo "删除成功"',
    'del test.txt',
    'del /f /s /q C:\\Users\\temp',
    'del /s /f test.txt',
    'erase document.pdf',
    'rd /s /q build',
    'rd /s dist',
    'rd temp_folder',
    'rmdir /s /q out',
    'Remove-Item -Recurse -Force ./target',
    'Remove-Item path -Recurse',
    'Remove-Item test.txt',
  ]

  for (const cmd of dangerous) {
    const result = checkDangerousCommand(cmd)
    t.true(result.isDangerous, `应该拦截: ${cmd}`)
    t.truthy(result.reason)
  }
})

test('正确识别磁盘格式化与底层扇区直接写入指令', (t) => {
  const dangerous = [
    'format D: /fs:NTFS',
    'format C:',
    'mkfs.ext4 /dev/sda1',
    'mkfs /dev/sdb',
    'dd if=/dev/zero of=/dev/sda bs=1M',
    'echo "hello" > /dev/sda',
  ]

  for (const cmd of dangerous) {
    const result = checkDangerousCommand(cmd)
    t.true(result.isDangerous, `应该拦截: ${cmd}`)
  }
})

test('正确识别系统关机、重启与破坏性提权指令', (t) => {
  const dangerous = [
    'shutdown -h now',
    'reboot',
    'poweroff',
    'init 0',
    'Stop-Computer',
    'Restart-Computer',
    'chmod -R 777 /',
    ':(){ :|:& };:',
  ]

  for (const cmd of dangerous) {
    const result = checkDangerousCommand(cmd)
    t.true(result.isDangerous, `应该拦截: ${cmd}`)
  }
})

test('正确识别高危 Git 操作与数据库清除指令', (t) => {
  const dangerous = [
    'git push origin main --force',
    'git push -f upstream main',
    'git reset --hard HEAD~1',
    'git reset --hard origin/master',
    'DROP TABLE users',
    'drop database production',
    'TRUNCATE TABLE session_logs',
  ]

  for (const cmd of dangerous) {
    const result = checkDangerousCommand(cmd)
    t.true(result.isDangerous, `应该拦截: ${cmd}`)
  }
})

test('正常只读与常用开发指令不应被误判为危险命令', (t) => {
  const safe = [
    'git status',
    'git diff',
    'git log -n 5',
    'git branch',
    'git checkout -b feature/test',
    'node -v',
    'npm run build',
    'npm test',
    'ls -la',
    'dir',
    'pwd',
    'echo "hello world"',
    'cat package.json',
  ]

  for (const cmd of safe) {
    const result = checkDangerousCommand(cmd)
    t.false(result.isDangerous, `不应拦截安全命令: ${cmd}`)
    t.is(result.reason, undefined)
  }
})
