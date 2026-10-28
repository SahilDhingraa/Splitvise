'use client';

import { useEffect, useRef, useState } from 'react';

// A button that drops down a .menu. `children` gets a close function, so plain
// items can shut the menu while toggles (filters) leave it open.
export function Menu({
  label,
  button,
  buttonClassName,
  wrapClassName,
  menuClassName,
  children,
}: {
  label: string;
  button: React.ReactNode;
  buttonClassName: string;
  wrapClassName?: string;
  menuClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on any click outside the menu, or on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div
      className={`menu-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}
      ref={wrapRef}
      // Menus sit inside clickable rows; keep their clicks to themselves.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {button}
      </button>
      {isOpen && (
        <div className={`menu${menuClassName ? ` ${menuClassName}` : ''}`} role="menu">
          {children(() => setIsOpen(false))}
        </div>
      )}
    </div>
  );
}
