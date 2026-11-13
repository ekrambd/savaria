import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  threshold?: number;
}

export function ScrollReveal({ 
  children, 
  className = '', 
  delayMs = 0, 
  threshold = 0.12 
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delayMs > 0) {
              setTimeout(() => setIsRevealed(true), delayMs);
            } else {
              setIsRevealed(true);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs, threshold]);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isRevealed ? 'is-revealed' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
