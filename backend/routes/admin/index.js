const express            = require('express');
const catalogRoutes      = require('./catalog');
const floorGuideRoutes   = require('./floor-guide');
const foodGuideRoutes    = require('./food-guide');
const winnersRoutes      = require('./winners');

const router = express.Router();

router.use('/catalog',     catalogRoutes);
router.use('/floor-guide', floorGuideRoutes);
router.use('/food-guide',  foodGuideRoutes);
router.use('/winners',     winnersRoutes);

module.exports = router;
