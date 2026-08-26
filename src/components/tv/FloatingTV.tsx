'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Minimize2, Maximize2, GripVertical, Volume2, VolumeX } from 'lucide-react'
import TVDisplay from './TVDisplay'

interface FloatingTVProps {
  onClose: () => void
}

export default function FloatingTV({ onClose }: FloatingTVProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 80 })
  const [size, setSize] = useState({ width: 480, height: 360 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return
    setIsDragging(true)
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.preventDefault()
  }, [position, isMaximized])

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: Math.max(0, e.clientX - dragOffset.current.x),
      y: Math.max(0, e.clientY - dragOffset.current.y),
    })
  }, [isDragging])

  const onDragEnd = useCallback(() => setIsDragging(false), [])

  // Resize handlers
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return
    setIsResizing(true)
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }
    e.preventDefault()
    e.stopPropagation()
  }, [size, isMaximized])

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    setSize({
      width: Math.max(320, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
      height: Math.max(240, resizeStart.current.h + (e.clientY - resizeStart.current.y)),
    })
  }, [isResizing])

  const onResizeEnd = useCallback(() => setIsResizing(false), [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDragMove)
      window.addEventListener('mouseup', onDragEnd)
      return () => {
        window.removeEventListener('mousemove', onDragMove)
        window.removeEventListener('mouseup', onDragEnd)
      }
    }
  }, [isDragging, onDragMove, onDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResizeMove)
      window.addEventListener('mouseup', onResizeEnd)
      return () => {
        window.removeEventListener('mousemove', onResizeMove)
        window.removeEventListener('mouseup', onResizeEnd)
      }
    }
  }, [isResizing, onResizeMove, onResizeEnd])

  if (isMinimized) {
    return (
      <div
        className="fixed z-50 bg-gray-900 text-white rounded-xl shadow-2xl flex items-center gap-2 px-4 py-2 cursor-move select-none"
        style={{ left: position.x, top: position.y }}
        onMouseDown={onDragStart}
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium">📺 จอ TV</span>
        <button onClick={() => setIsMinimized(false)} className="p-1 hover:bg-gray-700 rounded" title="ขยาย">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="p-1 hover:bg-red-600 rounded" title="ปิด">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed z-50 bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: isMaximized ? 0 : position.x,
        top: isMaximized ? 0 : position.y,
        width: isMaximized ? '100vw' : size.width,
        height: isMaximized ? '100vh' : size.height,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={onDragStart}
      >
        <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-white flex-1">📺 จอแสดงคิว TV</span>
        <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="ย่อ">
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title={isMaximized ? '缩小' : 'ขยายเต็มจอ'}>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="p-1 hover:bg-red-600 rounded text-gray-400 hover:text-white" title="ปิด">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* TV Content */}
      <div className="flex-1 overflow-hidden">
        <TVDisplay />
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-50 hover:opacity-100"
          onMouseDown={onResizeStart}
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5 text-gray-500">
            <path d="M14 16L16 14M16 14L16 18M16 14L12 14" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M10 16L12 14M12 14L12 18M12 14L8 14" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  )
}
