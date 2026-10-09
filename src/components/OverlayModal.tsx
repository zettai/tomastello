"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Portal } from "./Portal";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface OverlayModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Dialog title — rendered as text only. */
  readonly title: string;
  readonly children: ReactNode;
  /** Element that opened the modal; focus returns here on close. */
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  /** Extra class on the panel (admin-window vs retro-window). */
  readonly panelClassName?: string;
  readonly titleBarClassName?: string;
  /** When set, that element receives initial focus; otherwise the first focusable that is not `data-destructive`. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly labelledBy?: string;
}

function lockScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const scrollbar = window.innerWidth - html.clientWidth;
  const prevOverflow = body.style.overflow;
  const prevPadding = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (scrollbar > 0) {
    body.style.paddingRight = `${scrollbar}px`;
  }
  return () => {
    body.style.overflow = prevOverflow;
    body.style.paddingRight = prevPadding;
  };
}

/**
 * Accessible overlay: Portal, focus trap, Esc/backdrop close, scroll lock without layout jump.
 * Destructive controls (`data-destructive`) never receive initial focus.
 */
export function OverlayModal({
  open,
  onClose,
  title,
  children,
  returnFocusRef,
  panelClassName = "admin-window",
  titleBarClassName = "admin-title-bar",
  initialFocusRef,
  labelledBy,
}: OverlayModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    return unlock;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let raf = 0;
    let attempts = 0;

    const focusInitial = () => {
      if (cancelled) return;
      const panel = panelRef.current;
      // Portal mounts after first paint; retry until the panel is in the DOM.
      if (!panel) {
        if (attempts < 60) {
          attempts += 1;
          raf = window.requestAnimationFrame(focusInitial);
        }
        return;
      }
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute("data-destructive"));
      (nodes[0] ?? panel).focus();
    };
    raf = window.requestAnimationFrame(focusInitial);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      returnFocusRef?.current?.focus();
    };
  }, [open, initialFocusRef, returnFocusRef]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <Portal>
      <div className="overlay-modal-root" role="presentation">
        <button
          type="button"
          className="overlay-modal-backdrop"
          aria-label="Close dialog"
          onClick={onClose}
        />
        <div className="overlay-modal-scroll">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy ?? titleId}
            tabIndex={-1}
            className={`overlay-modal-panel ${panelClassName}`}
          >
            <div className={titleBarClassName}>
              <span id={labelledBy ?? titleId}>{title}</span>
            </div>
            <div className="overlay-modal-body">{children}</div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export interface ConfirmDeleteModalProps {
  readonly open: boolean;
  readonly itemName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Delete confirmation: title names the item as text; Cancel is focused first. */
export function ConfirmDeleteModal({
  open,
  itemName,
  onCancel,
  onConfirm,
  returnFocusRef,
}: ConfirmDeleteModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const title = `Delete ${itemName}?`;

  return (
    <OverlayModal
      open={open}
      onClose={onCancel}
      title={title}
      returnFocusRef={returnFocusRef}
      initialFocusRef={cancelBtnRef}
    >
      <p className="admin-text text-sm mb-4">This cannot be undone.</p>
      <div className="flex gap-2 justify-end">
        <button
          ref={cancelBtnRef}
          type="button"
          className="admin-button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="admin-button admin-button-danger"
          data-destructive=""
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </OverlayModal>
  );
}
