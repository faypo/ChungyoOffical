const express            = require('express');
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

const router = express.Router();

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

module.exports = router;
