export class SceneHost {
  private mounted = false
  mount(container: HTMLElement): void {
    void container
    this.mounted = true
  }
  unmount(): void {
    this.mounted = false
  }
  setSize(width: number, height: number): void {
    void width
    void height
  }
  requestRender(): void {
    if (!this.mounted) return
  }
}
