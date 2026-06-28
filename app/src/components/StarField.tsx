import { useRef, useEffect } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  active: boolean;
}

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarRef = useRef<ShootingStar>({ x: 0, y: 0, length: 0, speed: 0, opacity: 0, active: false });
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize stars
    const starCount = Math.floor(Math.random() * 51) + 100; // 100-150
    starsRef.current = Array.from({ length: starCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1, // 1-3px
      opacity: Math.random() * 0.6 + 0.3, // 0.3-0.9
      speedX: (Math.random() - 0.5) * 0.2, // -0.1 to 0.1
      speedY: (Math.random() - 0.5) * 0.2,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let shootingStarTimer = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!visibleRef.current) return;
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      for (const star of starsRef.current) {
        // Mouse magnetic effect
        const dx = mouseRef.current.x - star.x;
        const dy = mouseRef.current.y - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let moveX = star.speedX;
        let moveY = star.speedY;
        if (dist < 200) {
          const force = (1 - dist / 200) * 0.02;
          moveX += dx * force;
          moveY += dy * force;
        }

        star.x += moveX;
        star.y += moveY;

        // Wrap around
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      }

      // Shooting star
      shootingStarTimer++;
      if (!shootingStarRef.current.active && shootingStarTimer > 300) {
        if (Math.random() < 0.01) {
          shootingStarRef.current = {
            x: Math.random() * canvas.width * 0.5,
            y: Math.random() * canvas.height * 0.3,
            length: 80 + Math.random() * 40,
            speed: 8 + Math.random() * 4,
            opacity: 1,
            active: true,
          };
          shootingStarTimer = 0;
        }
      }

      if (shootingStarRef.current.active) {
        const ss = shootingStarRef.current;
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.length, ss.y + ss.length * 0.5);
        grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.length, ss.y + ss.length * 0.5);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.stroke();

        ss.x += ss.speed;
        ss.y += ss.speed * 0.5;
        ss.opacity -= 0.02;

        if (ss.opacity <= 0 || ss.x > canvas.width || ss.y > canvas.height) {
          ss.active = false;
        }
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
