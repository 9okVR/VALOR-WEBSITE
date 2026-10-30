const { useEffect, useState, useRef, useMemo, useCallback } = React;

const wrapperStyle = { display: 'inline-block', whiteSpace: 'pre-wrap' };
const srOnly = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0, visibility: 'hidden'
};

function DecryptedText({
  text = '',
  speed = 50,
  scrambleSpeed = 0,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+',
  animateOn = 'hover',
  idleMin = 0,
  idleMax = 0,
  encryptedStyle,
  revealedStyle,
  style
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(true);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);

  const availableChars = useMemo(
    () => (useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter((c) => c !== ' ')
      : characters.split('')),
    [useOriginalCharsOnly, text, characters]
  );

  const shuffleText = useCallback((original, revealed) => original
    .split('')
    .map((char, i) => {
      if (char === ' ') return ' ';
      if (revealed.has(i)) return original[i];
      return availableChars[Math.floor(Math.random() * availableChars.length)];
    })
    .join(''), [availableChars]);

  const triggerDecrypt = useCallback(() => {
    setRevealedIndices(new Set());
    setIsDecrypted(false);
    setIsAnimating(true);
  }, []);

  useEffect(() => {
    if (!isAnimating) return undefined;
    let iteration = 0;

    const nextIndex = (revealed) => {
      const len = text.length;
      if (revealDirection === 'end') return len - 1 - revealed.size;
      if (revealDirection === 'center') {
        const middle = Math.floor(len / 2);
        const offset = Math.floor(revealed.size / 2);
        const idx = revealed.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (idx >= 0 && idx < len && !revealed.has(idx)) return idx;
        for (let i = 0; i < len; i++) if (!revealed.has(i)) return i;
        return 0;
      }
      return revealed.size;
    };

    const tick = scrambleSpeed || speed;
    const perReveal = Math.max(1, Math.round(speed / tick));
    let ticks = 0;

    intervalRef.current = setInterval(() => {
      ticks += 1;
      setRevealedIndices((prev) => {
        if (sequential) {
          if (prev.size < text.length) {
            if (ticks % perReveal !== 0) {
              setDisplayText(shuffleText(text, prev));
              return prev;
            }
            const next = new Set(prev);
            next.add(nextIndex(prev));
            setDisplayText(shuffleText(text, next));
            return next;
          }
          clearInterval(intervalRef.current);
          setIsAnimating(false);
          setIsDecrypted(true);
          return prev;
        }
        setDisplayText(shuffleText(text, prev));
        iteration += 1;
        if (iteration >= maxIterations) {
          clearInterval(intervalRef.current);
          setIsAnimating(false);
          setDisplayText(text);
          setIsDecrypted(true);
        }
        return prev;
      });
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [isAnimating, text, speed, scrambleSpeed, maxIterations, sequential, revealDirection, shuffleText]);

  useEffect(() => {
    if (animateOn !== 'view' && animateOn !== 'inViewHover') return undefined;
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          triggerDecrypt();
          setHasAnimated(true);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [animateOn, hasAnimated, triggerDecrypt]);

  useEffect(() => {
    if (!idleMax || isAnimating || !hasAnimated) return undefined;
    const wait = idleMin + Math.random() * Math.max(1, idleMax - idleMin);
    const t = setTimeout(() => triggerDecrypt(), wait);
    return () => clearTimeout(t);
  }, [idleMin, idleMax, isAnimating, hasAnimated, triggerDecrypt]);

  const hoverProps = (animateOn === 'hover' || animateOn === 'inViewHover')
    ? {
      onMouseEnter: () => { if (!isAnimating) triggerDecrypt(); },
      onMouseLeave: () => {
        clearInterval(intervalRef.current);
        setIsAnimating(false);
        setRevealedIndices(new Set());
        setDisplayText(text);
        setIsDecrypted(true);
      }
    }
    : {};

  return React.createElement(
    'span',
    Object.assign({ ref: containerRef, style: Object.assign({}, wrapperStyle, style || {}) }, hoverProps),
    React.createElement('span', { style: srOnly }, text),
    React.createElement(
      'span',
      { 'aria-hidden': 'true' },
      displayText.split('').map((char, index) => {
        const done = revealedIndices.has(index) || (!isAnimating && isDecrypted);
        return React.createElement('span', { key: index, style: done ? revealedStyle : encryptedStyle }, char);
      })
    )
  );
}

module.exports = { DecryptedText };
