const express            = require('express');
const catalogRoutes      = require('./catalog');
const floorGuideRoutes   = require('./floor-guide');

const router = express.Router();

router.use('/catalog',     catalogRoutes);
router.use('/floor-guide', floorGuideRoutes);

module.exports = router;
