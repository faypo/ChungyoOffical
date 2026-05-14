const express            = require('express');
const catalogRoutes      = require('./catalog');
const floorGuideRoutes   = require('./floor-guide');
const foodGuideRoutes    = require('./food-guide');
const winnersRoutes      = require('./winners');
const activityRoutes     = require('./activity');

const router = express.Router();

router.use('/catalog',     catalogRoutes);
router.use('/floor-guide', floorGuideRoutes);
router.use('/food-guide',  foodGuideRoutes);
router.use('/winners',     winnersRoutes);
router.use('/activity',    activityRoutes);

module.exports = router;
