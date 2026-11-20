import { create } from 'zustand';

// Panel bo'ylab yagona bildirishnoma (toast) va tasdiqlash oynasi.

export type ToastType = 'success' | 'error' | 'info';
export interface Toast { id: number; type: ToastType; text: string }

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** O'chirish kabi qaytarib bo'lmaydigan amal — tugma qizil bo'ladi */
  danger?: boolean;
}

interface UiState {
  toasts: Toast[];
  confirmState: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  pushToast: (type: ToastType, text: string) => void;
  dismissToast: (id: number) => void;
  openConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let nextId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  confirmState: null,

  pushToast: (type, text) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type, text }] }));
    // Xato uzoqroq turadi — o'qib ulgurish uchun
    setTimeout(() => get().dismissToast(id), type === 'error' ? 6000 : 3500);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      // Ochiq oyna bo'lsa — uni bekor qilingan deb yopamiz
      get().confirmState?.resolve(false);
      set({ confirmState: { ...opts, resolve } });
    }),

  closeConfirm: (ok) => {
    get().confirmState?.resolve(ok);
    set({ confirmState: null });
  },
}));

/** toast.success('Saqlandi') — komponentdan tashqarida ham ishlaydi. */
export const toast = {
  success: (text: string) => useUiStore.getState().pushToast('success', text),
  error: (text: string) => useUiStore.getState().pushToast('error', text),
  info: (text: string) => useUiStore.getState().pushToast('info', text),
};

/** if (!(await confirmDialog({ title: "O'chirilsinmi?", danger: true }))) return; */
export const confirmDialog = (opts: ConfirmOptions) => useUiStore.getState().openConfirm(opts);
