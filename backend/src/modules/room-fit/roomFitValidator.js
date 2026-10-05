const validateAnalyzeFit = (req, res, next) => {
  const { roomWidth, roomLength, furnitureWidth, furnitureDepth, minimumWalkway } = req.body;

  const fields = [roomWidth, roomLength, furnitureWidth, furnitureDepth, minimumWalkway];

  for (const field of fields) {
    if (field === undefined || field === null || isNaN(Number(field)) || Number(field) <= 0) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All dimensions must be positive numbers'
        }
      });
    }
  }

  next();
};

module.exports = {
  validateAnalyzeFit
};
