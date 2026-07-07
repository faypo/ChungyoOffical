const express       = require('express');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const prisma        = require('../../utils/db');
const requireAdmin  = require('../../middleware/auth');

const router = express.Router();

const SESSION_HOURS = 2;

function checkPwComplexity(pw) {
  if (pw.length < 8) return false;
  return [/[A-Z]/, /[a-z]/, /[0-9]/].filter(r => r.test(pw)).length >= 2;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure:   process.env.NODE_ENV === 'production',
  maxAge:   SESSION_HOURS * 60 * 60 * 1000,
};

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({ error: '請提供帳號與密碼' });
  }

  const user = await prisma.users.findUnique({
    where: { employee_id },
    include: { roles: true },
  }).catch(() => null);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  const token = jwt.sign(
    { userId: user.id, employeeId: user.employee_id, roleId: user.role_id, roleName: user.roles.name },
    process.env.JWT_SECRET,
    { expiresIn: `${SESSION_HOURS}h` }
  );

  await prisma.user_sessions.create({
    data: { user_id: user.id, token, expires_at: expiresAt },
  });

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  res.cookie('admin_token', token, COOKIE_OPTIONS);
  res.json({
    must_change_password: user.must_change_password ?? false,
    user: {
      id:          user.id,
      employee_id: user.employee_id,
      role:        user.roles.name,
    },
  });
});

// POST /api/admin/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (token) {
    await prisma.user_sessions.deleteMany({ where: { token } }).catch(() => null);
  }
  res.clearCookie('admin_token', { ...COOKIE_OPTIONS, maxAge: undefined });
  res.json({ message: '已登出' });
});

// PUT /api/admin/auth/change-password  （一般改密碼，需要舊密碼）
router.put('/change-password', requireAdmin, async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ error: '請提供舊密碼與新密碼' });
  }
  if (!checkPwComplexity(new_password)) {
    return res.status(400).json({ error: '新密碼至少 8 碼，且須包含大寫英文、小寫英文、數字中的至少兩種' });
  }

  const user = await prisma.users.findUnique({ where: { id: req.user.id } }).catch(() => null);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  const valid = await bcrypt.compare(old_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '舊密碼不正確' });

  const password_hash = await bcrypt.hash(new_password, 12);
  await prisma.users.update({
    where: { id: user.id },
    data: { password_hash, must_change_password: false, updated_at: new Date() },
  });

  await prisma.user_sessions.deleteMany({ where: { user_id: user.id } });
  res.clearCookie('admin_token', { ...COOKIE_OPTIONS, maxAge: undefined });

  res.json({ message: '密碼已更新，請重新登入' });
});

// PUT /api/admin/auth/force-change-password  （首次/重設後強制改密碼，不需舊密碼）
router.put('/force-change-password', requireAdmin, async (req, res) => {
  const { new_password } = req.body;

  if (!new_password || !checkPwComplexity(new_password)) {
    return res.status(400).json({ error: '新密碼至少 8 碼，且須包含大寫英文、小寫英文、數字中的至少兩種' });
  }

  const password_hash = await bcrypt.hash(new_password, 12);

  try {
    await prisma.users.update({
      where: { id: req.user.id },
      data: { password_hash, must_change_password: false, updated_at: new Date() },
    });
  } catch {
    return res.status(500).json({ error: '密碼更新失敗，請稍後再試' });
  }

  await prisma.user_sessions.deleteMany({ where: { user_id: req.user.id } });
  res.clearCookie('admin_token', { ...COOKIE_OPTIONS, maxAge: undefined });

  res.json({ message: '密碼已設定，請重新登入' });
});

module.exports = router;
