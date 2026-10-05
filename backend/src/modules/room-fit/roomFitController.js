const roomFitService = require('./roomFitService');

const analyzeFit = (req, res, next) => {
  try {
    const { roomWidth, roomLength, furnitureWidth, furnitureDepth, minimumWalkway } = req.body;
    
    const result = roomFitService.analyzeFit({
      roomWidth: Number(roomWidth),
      roomLength: Number(roomLength),
      furnitureWidth: Number(furnitureWidth),
      furnitureDepth: Number(furnitureDepth),
      minimumWalkway: Number(minimumWalkway)
    });
    
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  analyzeFit
};
