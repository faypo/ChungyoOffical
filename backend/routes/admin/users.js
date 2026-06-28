const express = require('express');
const bcrypt  = require('bcryptjs');
const prisma  = require('../../utils/db');

const router = express.Router();

// 僅 super_admin 可存取所有 /users 路由
router.use((req, res, next) => {
  if (req.user?.roleName !== 'super_admin') {
    return res.status(403).json({ error: '權限不足' });
  }
  next();
});

// GET /api/admin/users/roles
router.get('/roles', async (req, res) => {
  const roles = await prisma.roles.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { id: 'asc' },
  }).catch(() => null);
  if (!roles) return res.status(500).json({ error: '查詢失敗' });
  res.json(roles);
});

// GET /api/admin/users
router.get('/', async (req, res) => {
  const users = await prisma.users.findMany({
    select: {
      id: true,
      employee_id: true,
      is_active: true,
      must_change_password: true,
      last_login_at: true,
      created_at: true,
      roles: { select: { id: true, name: true } },
    },
    orderBy: { created_at: 'asc' },
  }).catch(() => null);

  if (!users) return res.status(500).json({ error: '查詢失敗' });
  res.json(users);
});

// POST /api/admin/users
router.post('/', async (req, res) => {
  const { employee_id, password, role_id } = req.body;

  if (!employee_id || !password || !role_id) {
    return res.status(400).json({ error: '請提供員工編號、密碼與角色' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '密碼至少需要 8 個字元' });
  }

  const role = await prisma.roles.findUnique({ where: { id: Number(role_id) } }).catch(() => null);
  if (!role) return res.status(400).json({ error: '角色不存在' });

  const existing = await prisma.users.findUnique({ where: { employee_id } }).catch(() => null);
  if (existing) return res.status(409).json({ error: '員工編號已存在' });

  const password_hash = await bcrypt.hash(password, 12);
  const user = await prisma.users.create({
    data: { employee_id, password_hash, role_id: Number(role_id), must_change_password: true },
    select: {
      id: true,
      employee_id: true,
      is_active: true,
      must_change_password: true,
      created_at: true,
      roles: { select: { id: true, name: true } },
    },
  }).catch(() => null);

  if (!user) return res.status(500).json({ error: '建立失敗' });
  res.status(201).json(user);
});

// PATCH /api/admin/users/:id
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '無效的使用者 ID' });

  const { role_id, is_active } = req.body;
  const data = {};

  if (role_id !== undefined) {
    const role = await prisma.roles.findUnique({ where: { id: Number(role_id) } }).catch(() => null);
    if (!role) return res.status(400).json({ error: '角色不存在' });
    data.role_id = Number(role_id);
  }
  if (is_active !== undefined) {
    data.is_active = Boolean(is_active);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: '未提供任何可更新的欄位' });
  }

  data.updated_at = new Date();

  const user = await prisma.users.update({
    where: { id },
    data,
    select: {
      id: true,
      employee_id: true,
      is_active: true,
      must_change_password: true,
      updated_at: true,
      roles: { select: { id: true, name: true } },
    },
  }).catch(() => null);

  if (!user) return res.status(404).json({ error: '使用者不存在' });
  res.json(user);
});

// POST /api/admin/users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '無效的使用者 ID' });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: '新密碼至少需要 8 個字元' });
  }

  const user = await prisma.users.findUnique({ where: { id } }).catch(() => null);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  const password_hash = await bcrypt.hash(new_password, 12);
  await prisma.users.update({
    where: { id },
    data: { password_hash, must_change_password: true, updated_at: new Date() },
  });

  await prisma.user_sessions.deleteMany({ where: { user_id: id } });

  res.json({ message: '密碼已重設，該使用者下次登入需設定新密碼' });
});

// DELETE /api/admin/users/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '無效的使用者 ID' });

  if (id === req.user.id) {
    return res.status(400).json({ error: '無法刪除自己的帳號' });
  }

  const user = await prisma.users.delete({ where: { id } }).catch(() => null);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  res.json({ message: '使用者已刪除' });
});

module.exports = router;
