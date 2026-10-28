'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A centred dialog on desktop, a bottom sheet on a phone (see .modal in the CSS).
//
// Portalled to <body>: a room card lifts on hover with a transform, and a
// position:fixed element inside a transformed parent is positioned against that
// parent instead of the viewport.
export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Callers pass an inline arrow, so hold the latest one in a ref. Otherwise the
  // effect below would re-run on every parent render and keep stealing focus.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    // Dialogs can stack (a confirm over the edit-payment sheet). Escape closes
    // only the topmost one: the last backdrop in the document.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const backdrops = document.querySelectorAll('.backdrop');
      if (backdrops[backdrops.length - 1] === boxRef.current?.parentElement) closeRef.current();
    };
    document.addEventListener('keydown', onKey);

    // Stop the page behind from scrolling while the dialog is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first field, or failing that the first button. Not on a touch
    // screen: focusing a field there pops the keyboard over the sheet before
    // anyone has read it, so the dialog itself takes focus instead.
    const box = boxRef.current;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const first = touch
      ? box
      : (box?.querySelector<HTMLElement>('input.amount') ??
        box?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]), select') ??
        box?.querySelector<HTMLElement>('.btn-primary'));
    first?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div
      className="backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} ref={boxRef}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
