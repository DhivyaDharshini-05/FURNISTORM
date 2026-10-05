const analyzeFit = (params) => {
  const { roomWidth, roomLength, furnitureWidth, furnitureDepth, minimumWalkway } = params;

  const roomArea = roomWidth * roomLength;
  const furnitureArea = furnitureWidth * furnitureDepth;
  const utilizationPercentage = (furnitureArea / roomArea) * 100;

  // Calculate clearances assuming furniture is placed in the center (just for simplicity)
  // or assuming it's placed in a corner. Let's assume center for worst-case walkway on all sides,
  // OR standard fit analysis (e.g. room - furniture).
  // Actually, standard clearance calculation:
  const clearanceWidth = roomWidth - furnitureWidth;
  const clearanceLength = roomLength - furnitureDepth;

  // Assuming furniture is placed in a corner, we have clearanceWidth and clearanceLength available on two sides.
  // If placed in center, it's divided by 2. Let's provide total left/right and front/back clearances.
  const leftRightClearance = clearanceWidth / 2;
  const frontBackClearance = clearanceLength / 2;

  // Does the furniture physically fit?
  const physicallyFits = roomWidth >= furnitureWidth && roomLength >= furnitureDepth;

  // Is minimum walkway satisfied?
  // Let's assume the user wants at least minimumWalkway on all accessible sides.
  // If placed in a corner, 2 sides need the walkway. We'll use the corner assumption:
  // actually, let's just check if the remaining clearance on the "tightest" side is >= minimumWalkway.
  const tightestClearance = Math.min(clearanceWidth, clearanceLength);
  const walkwaySatisfied = physicallyFits && (tightestClearance >= minimumWalkway);

  let status = 'DOES_NOT_FIT';
  if (physicallyFits) {
    if (walkwaySatisfied) {
      status = 'FITS_WELL';
    } else {
      status = 'TIGHT_FIT';
    }
  }

  return {
    roomArea,
    furnitureArea,
    utilizationPercentage,
    clearance: {
      leftRight: leftRightClearance,
      frontBack: frontBackClearance,
      totalWidthClearance: clearanceWidth,
      totalLengthClearance: clearanceLength
    },
    physicallyFits,
    walkwaySatisfied,
    status
  };
};

module.exports = {
  analyzeFit
};
