class PolySegWasmShim {
  instance = {
    convertContourRoiToSurface: async () => ({ points: [], polys: [] }),
    convertLabelmapToSurface: () => ({ points: [], polys: [] }),
    convertSurfaceToLabelmap: () => ({
      data: new Uint8Array(),
      dimensions: [0, 0, 0] as [number, number, number],
      spacing: [1, 1, 1] as [number, number, number],
      direction: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ],
      origin: [0, 0, 0] as [number, number, number],
    }),
  };

  async initialize(): Promise<void> {
    // This project does not use poly segmentation features.
  }
}

export default PolySegWasmShim;
