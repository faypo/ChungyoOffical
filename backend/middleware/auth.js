const jwt    = require('jsonwebtoken');
const prisma = require('../utils/db');

async function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = await prisma.user_sessions.findUnique({ where: { token: payload.sessionId } }).catch(() => null);
  if (!session || session.expires_at < new Date()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = {
    id:          payload.userId,
    employeeId:  payload.employeeId,
    roleId:      payload.roleId,
    roleName:    payload.roleName,
    permissions: new Set(payload.permissions ?? []),
  };

  next();
}

module.exports = requireAdmin;
