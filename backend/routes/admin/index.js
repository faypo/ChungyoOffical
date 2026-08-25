const express            = require('express');
const authRoutes         = require('./auth');
const requireAdmin       = require('../../middleware/auth');
const catalogRoutes      = require('./catalog');
const floorGuideRoutes   = require('./floor-guide');
const foodGuideRoutes    = require('./food-guide');
const winnersRoutes      = require('./winners');
const activityRoutes     = require('./activity');
const galleryRoutes      = require('./gallery');
const bannerRoutes       = require('./banner');
const homeEventRoutes    = require('./home-event');
const homeFBRoutes       = require('./home-fb');
const homePromoRoutes    = require('./home-promo');
const logosRoutes            = require('./logos');
const sustainabilityRoutes   = require('./sustainability');
const serviceRoutes          = require('./service');
const usersRoutes            = require('./users');
const rolesRoutes            = require('./roles');
const faqRoutes              = require('./faq');
const awsUsageRoutes         = require('./awsUsage');

const router = express.Router();

router.use('/auth', authRoutes);

router.use(requireAdmin);

// 依 path 對應 module，統一做 permissions 檢查
const MODULE_PATH_MAP = {
  '/banner':         'banner',
  '/home-event':     'home_event',
  '/home-promo':     'home_promo',
  '/home-fb':        'home_fb',
  '/logos':          'logo',
  '/catalog':        'dm',
  '/floor-guide':    'floor',
  '/food-guide':     'food',
  '/winners':        'winners',
  '/activity':       'activity',
  '/gallery':        'gallery',
  '/service':        'service',
  '/sustainability': 'sustainability',
  '/stats':          'stats',
  '/users':          'user',
  '/faq':            'faq',
  '/aws-usage':      'aws_usage',
};

router.use((req, res, next) => {
  const module = Object.entries(MODULE_PATH_MAP)
    .find(([prefix]) => req.path.startsWith(prefix))?.[1];
  if (!module) return next(); // /roles 有自己的 super_admin 判斷

  const action = req.method === 'DELETE' ? 'delete'
               : req.method === 'GET'    ? 'read'
               : 'write';

  if (!req.user.permissions.has(`${module}:${action}`)) {
    return res.status(403).json({ error: '權限不足' });
  }
  next();
});

router.use('/catalog',     catalogRoutes);
router.use('/floor-guide', floorGuideRoutes);
router.use('/food-guide',  foodGuideRoutes);
router.use('/winners',     winnersRoutes);
router.use('/activity',    activityRoutes);
router.use('/gallery',     galleryRoutes);
router.use('/banner',      bannerRoutes);
router.use('/home-event',  homeEventRoutes);
router.use('/home-fb',     homeFBRoutes);
router.use('/home-promo',  homePromoRoutes);
router.use('/logos',            logosRoutes);
router.use('/sustainability',   sustainabilityRoutes);
router.use('/service',         serviceRoutes);
router.use('/users',           usersRoutes);
router.use('/roles',           rolesRoutes);
router.use('/faq',             faqRoutes);
router.use('/aws-usage',       awsUsageRoutes);

module.exports = router;
