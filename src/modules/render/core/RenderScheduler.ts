export class RenderScheduler {
  private pending = false
  private rafId: number | null = null
  schedule(cb: () => void): void {
    if (this.pending) return
    this.pending = true
    this.rafId = requestAnimationFrame(() => {
      this.pending = false
      this.rafId = null
      cb()
    })
  }
  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
      this.pending = false
    }
  }
}
