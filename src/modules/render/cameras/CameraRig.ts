import type { CameraMode } from '../types'

export class CameraRig {
  mode: CameraMode
  constructor(mode: CameraMode) {
    this.mode = mode
  }
  setMode(mode: CameraMode): void {
    this.mode = mode
  }
}
