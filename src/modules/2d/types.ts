export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface CellData {
  char: string
  color: string
  bgColor?: string
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  data: Map<string, CellData> // Key is "x,y"
}

export interface Frame {
  id: string
  layers: Layer[]
}

export type ToolType = 'brush' | 'eraser' | 'fill' | 'select' | 'line' | 'rectangle' | 'circle' | 'eyedropper' | 'gradient'
