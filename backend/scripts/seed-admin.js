require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/db');

// 修改這裡設定初始帳號
const EMPLOYEE_ID = 'admin';
const PASSWORD    = 'changeme';
const ROLE_NAME   = 'super_admin';

async function main() {
  const role = await prisma.roles.findUnique({ where: { name: ROLE_NAME } });
  if (!role) {
    console.error(`找不到 role: ${ROLE_NAME}`);
    process.exit(1);
  }

  const existing = await prisma.users.findUnique({ where: { employee_id: EMPLOYEE_ID } });
  if (existing) {
    console.log(`帳號 "${EMPLOYEE_ID}" 已存在，略過。`);
    return;
  }

  const password_hash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.users.create({
    data: { employee_id: EMPLOYEE_ID, password_hash, role_id: role.id },
  });

  console.log(`✓ 建立帳號成功`);
  console.log(`  employee_id : ${user.employee_id}`);
  console.log(`  role        : ${ROLE_NAME}`);
  console.log(`  密碼請登入後立刻修改`);
}

main().finally(() => prisma.$disconnect());
