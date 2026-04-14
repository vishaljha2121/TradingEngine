import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  title: string;
  description: string;
  formula?: string;
  children: React.ReactNode;
}

export function InfoTooltip({ title, description, formula, children }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipWidth = 280;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
      setPos({ top: rect.bottom + 6, left });
    }
  }, [show]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help border-b border-dotted border-[#6F7C8E]/40 hover:border-[#8EA0B8]/60 transition-colors"
      >
        {children}
      </span>
      {show && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="bg-[#111827] border border-[#1F2A3A] rounded-md shadow-xl px-3 py-2.5 max-w-[280px]">
            {/* Pointer triangle */}
            <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[5px] overflow-hidden">
              <div className="w-[8px] h-[8px] bg-[#111827] border border-[#1F2A3A] rotate-45 translate-y-[3px] mx-auto" />
            </div>
            <div className="text-[12px] font-bold text-[#E5EDF7] font-ui mb-1">{title}</div>
            <div className="text-[11px] text-[#A8B3C2] font-ui leading-relaxed">{description}</div>
            {formula && (
              <code className="text-[10px] font-mono text-[#8EA0B8] mt-1.5 block bg-[#0B1220] rounded px-2 py-1">{formula}</code>
            )}
          </div>
        </div>
      )}
    </>
  );
}
