import { useEffect, useRef, useCallback, useState } from 'react';

interface Photo {
  src: string;
  alt: string;
  caption: string;
}

interface PhotoCarousel3DProps {
  photos: Photo[];
  /** Pixels per second the carousel moves */
  speed?: number;
  title?: string;
}

export function PhotoCarousel3D({
  photos,
  speed = 40,
  title = 'Fotos de torneos anteriores',
}: PhotoCarousel3DProps) {
  const total = photos.length;
  // We duplicate the array to create seamless infinite loop
  const items = [...photos, ...photos, ...photos];
  const itemWidth = 260; // px base width of each item
  const gap = 16; // px gap between items
  const totalWidth = total * (itemWidth + gap);

  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const animRef = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const offsetRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragOffsetStart = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continuous movement
  const animate = useCallback((timestamp: number) => {
    if (!lastTime.current) lastTime.current = timestamp;
    const delta = (timestamp - lastTime.current) / 1000;
    lastTime.current = timestamp;

    offsetRef.current = (offsetRef.current + speed * delta) % totalWidth;
    setOffset(offsetRef.current);

    animRef.current = requestAnimationFrame(animate);
  }, [speed, totalWidth]);

  useEffect(() => {
    if (isPaused || total <= 1) {
      lastTime.current = 0;
      return;
    }
    lastTime.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPaused, animate, total]);

  const pauseTemporarily = useCallback(() => {
    setIsPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsPaused(false), 4000);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragOffsetStart.current = offsetRef.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartX.current;
    let newOffset = dragOffsetStart.current - dx;
    if (newOffset < 0) newOffset += totalWidth;
    offsetRef.current = newOffset % totalWidth;
    setOffset(offsetRef.current);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    pauseTemporarily();
  };

  if (photos.length === 0) return null;

  // Container width — use ref to get actual width
  const containerWidth = containerRef.current?.offsetWidth || 700;
  const centerX = containerWidth / 2;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-white mb-3 text-center drop-shadow-md">
        {title}
      </h3>

      <div
        ref={containerRef}
        className="relative mx-auto select-none overflow-hidden"
        style={{ maxWidth: '750px', height: '240px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {items.map((photo, i) => {
          // Position of this item in the virtual strip
          const basePos = i * (itemWidth + gap);
          // Current visual position relative to the offset (wrapping)
          let x = basePos - offset;
          // Wrap around — keep items within a reasonable range
          const stripLength = items.length * (itemWidth + gap);
          while (x < -itemWidth) x += stripLength;
          while (x > stripLength - itemWidth) x -= stripLength;

          // Distance from center of container
          const itemCenterX = x + itemWidth / 2;
          const distFromCenter = Math.abs(itemCenterX - centerX);
          const maxDist = containerWidth / 2 + itemWidth / 2;

          // Skip items way off screen
          if (distFromCenter > maxDist) return null;

          // Normalize: 0 = center, 1 = edge
          const t = Math.min(distFromCenter / (containerWidth / 2), 1);

          // Scale: 1.1 at center → 0.7 at edges
          const scale = 1.1 - t * 0.4;
          // Opacity: 1 at center → 0.3 at edges
          const opacity = 1 - t * 0.7;
          // Z-depth for 3D feel
          const translateZ = -t * 60;
          // Slight Y rotation for 3D perspective
          const rotateY = ((itemCenterX - centerX) / (containerWidth / 2)) * 25;

          return (
            <div
              key={`${photo.src}-${i}`}
              className="absolute top-1/2"
              style={{
                width: `${itemWidth}px`,
                height: '180px',
                left: `${x}px`,
                marginTop: '-90px',
                transform: `perspective(800px) scale(${scale}) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
                opacity,
                zIndex: Math.round((1 - t) * 50),
                transition: isDragging.current ? 'none' : 'opacity 0.1s',
              }}
            >
              <div className="w-full h-full rounded-xl overflow-hidden shadow-xl ring-1 ring-white/10">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                {photo.caption && scale > 0.95 && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white/90 font-medium drop-shadow truncate">
                      {photo.caption}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
