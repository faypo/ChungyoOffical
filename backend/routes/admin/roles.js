const express = require('express');
const prisma  = require('../../utils/db');

const router = express.Router();

router.use((req, res, next) => {
  if (req.user?.roleName !== 'super_admin') {
    return res.status(403).json({ error: '權限不足' });
  }
  next();
});

// GET /api/admin/roles
router.get('/', async (req, res) => {
  const [roles, permissions] = await Promise.all([
    prisma.roles.findMany({
      include: {
        role_permissions: { select: { permission_id: true } },
        _count: { select: { users: true } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.permissions.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    }),
  ]).catch(() => [null, null]);

  if (!roles) return res.status(500).json({ error: '查詢失敗' });

  res.json({
    roles: roles.map(r => ({
      id:             r.id,
      name:           r.name,
      description:    r.description,
      user_count:     r._count.users,
      permission_ids: r.role_permissions.map(rp => rp.permission_id),
    })),
    permissions,
  });
});

// POST /api/admin/roles
router.post('/', async (req, res) => {
  const { name, description, permission_ids = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '請提供角色名稱' });

  const existing = await prisma.roles.findUnique({ where: { name: name.trim() } }).catch(() => null);
  if (existing) return res.status(409).json({ error: '角色名稱已存在' });

  try {
    const role = await prisma.roles.create({
      data: {
        name:        name.trim(),
        description: description?.trim() || null,
        role_permissions: {
          create: permission_ids.map(pid => ({ permission_id: Number(pid) })),
        },
      },
    });
    res.status(201).json({
      id:             role.id,
      name:           role.name,
      description:    role.description,
      user_count:     0,
      permission_ids: permission_ids.map(Number),
    });
  } catch {
    res.status(500).json({ error: '建立失敗' });
  }
});

// PUT /api/admin/roles/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '無效的角色 ID' });

  const { name, description, permission_ids } = req.body;

  const role = await prisma.roles.findUnique({ where: { id } }).catch(() => null);
  if (!role) return res.status(404).json({ error: '角色不存在' });

  if (role.name === 'super_admin' && name && name.trim() !== 'super_admin') {
    return res.status(400).json({ error: '無法修改 super_admin 角色名稱' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.roles.update({
        where: { id },
        data: {
          name:        name?.trim()          ?? role.name,
          description: description !== undefined
            ? (description?.trim() || null)
            : role.description,
        },
      });

      if (Array.isArray(permission_ids)) {
        await tx.role_permissions.deleteMany({ where: { role_id: id } });
        if (permission_ids.length > 0) {
          await tx.role_permissions.createMany({
            data: permission_ids.map(pid => ({ role_id: id, permission_id: Number(pid) })),
          });
        }
      }
    });
    res.json({ message: '已更新' });
  } catch {
    res.status(500).json({ error: '更新失敗' });
  }
});

// DELETE /api/admin/roles/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '無效的角色 ID' });

  const role = await prisma.roles.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  }).catch(() => null);
  if (!role) return res.status(404).json({ error: '角色不存在' });

  if (role.name === 'super_admin') {
    return res.status(400).json({ error: '無法刪除 super_admin 角色' });
  }
  if (role._count.users > 0) {
    return res.status(400).json({ error: `此角色下還有 ${role._count.users} 位使用者，請先調整後再刪除` });
  }

  const deleted = await prisma.roles.delete({ where: { id } }).catch(() => null);
  if (!deleted) return res.status(500).json({ error: '刪除失敗' });
  res.json({ message: '角色已刪除' });
});

module.exports = router;
