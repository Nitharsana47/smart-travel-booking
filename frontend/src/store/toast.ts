import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'warn'
}

interface ToastState {
  toasts: Toast[]
  push: (text: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, text, tone }] })
    setTimeout(() => get().dismiss(id), 4200)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
