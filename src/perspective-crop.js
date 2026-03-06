/**
 * 4-corner perspective crop tool.
 * User drags dots to the 4 corners of the form, then we warp it to a flat rectangle.
 */

export class PerspectiveCrop {
  constructor(container, imageSrc) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.img = new Image();
    this.corners = [];
    this.dragging = null;

    this.canvas.style.cssText = 'display:block;touch-action:none;';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    this.img.onload = () => {
      this.setupCanvas();
      this.autoDetectCorners();
      this.draw();
      this.bindEvents();
    };
    this.img.src = imageSrc;
  }

  setupCanvas() {
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight || (window.innerHeight - 140);
    const aspect = this.img.height / this.img.width;

    // Fit image as large as possible within the container
    let displayWidth = containerWidth;
    let displayHeight = containerWidth * aspect;

    if (displayHeight > containerHeight) {
      displayHeight = containerHeight;
      displayWidth = containerHeight / aspect;
    }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;
    this.canvas.style.width = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';
    this.ctx.scale(dpr, dpr);

    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;
  }

  autoDetectCorners() {
    const m = 0.05;
    this.corners = [
      { x: m, y: m },
      { x: 1 - m, y: m },
      { x: 1 - m, y: 1 - m },
      { x: m, y: 1 - m },
    ];
  }

  draw() {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.img, 0, 0, w, h);

    // Darken outside
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    // Show selected area bright
    const pts = this.corners.map(c => ({ x: c.x * w, y: c.y * h }));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(this.img, 0, 0, w, h);
    ctx.restore();

    // Quad outline
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    // Corner dots — large for easy touch
    pts.forEach((pt) => {
      // Outer ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
  }

  getEventPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) / this.displayWidth,
      y: (touch.clientY - rect.top) / this.displayHeight,
    };
  }

  findCorner(pos) {
    // Generous touch target
    const threshold = 50 / this.displayWidth;
    let closest = null;
    let minDist = Infinity;
    this.corners.forEach((c, i) => {
      const dx = c.x - pos.x;
      const dy = c.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  bindEvents() {
    const onStart = (e) => {
      e.preventDefault();
      const pos = this.getEventPos(e);
      this.dragging = this.findCorner(pos);
    };

    const onMove = (e) => {
      e.preventDefault();
      if (this.dragging === null) return;
      const pos = this.getEventPos(e);
      this.corners[this.dragging] = {
        x: Math.max(0, Math.min(1, pos.x)),
        y: Math.max(0, Math.min(1, pos.y)),
      };
      this.draw();
    };

    const onEnd = (e) => {
      e.preventDefault();
      this.dragging = null;
    };

    this.canvas.addEventListener('mousedown', onStart);
    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseup', onEnd);
    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd, { passive: false });
  }

  getCroppedImage() {
    const src = this.corners.map(c => ({
      x: c.x * this.img.width,
      y: c.y * this.img.height,
    }));

    const topWidth = Math.sqrt((src[1].x - src[0].x) ** 2 + (src[1].y - src[0].y) ** 2);
    const bottomWidth = Math.sqrt((src[2].x - src[3].x) ** 2 + (src[2].y - src[3].y) ** 2);
    const leftHeight = Math.sqrt((src[3].x - src[0].x) ** 2 + (src[3].y - src[0].y) ** 2);
    const rightHeight = Math.sqrt((src[2].x - src[1].x) ** 2 + (src[2].y - src[1].y) ** 2);

    const outW = Math.round(Math.max(topWidth, bottomWidth));
    const outH = Math.round(Math.max(leftHeight, rightHeight));

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const octx = out.getContext('2d');

    // Perspective warp using mesh
    const steps = 50;
    for (let row = 0; row < steps; row++) {
      for (let col = 0; col < steps; col++) {
        const u0 = col / steps;
        const v0 = row / steps;
        const u1 = (col + 1) / steps;
        const v1 = (row + 1) / steps;

        const srcTL = this.bilinear(src, u0, v0);
        const srcTR = this.bilinear(src, u1, v0);
        const srcBL = this.bilinear(src, u0, v1);
        const srcBR = this.bilinear(src, u1, v1);

        const dx = u0 * outW;
        const dy = v0 * outH;
        const dw = (u1 - u0) * outW;
        const dh = (v1 - v0) * outH;

        const sx = Math.min(srcTL.x, srcBL.x);
        const sy = Math.min(srcTL.y, srcTR.y);
        const sw = Math.max(srcTR.x, srcBR.x) - sx;
        const sh = Math.max(srcBL.y, srcBR.y) - sy;

        if (sw > 0 && sh > 0 && dw > 0 && dh > 0) {
          octx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
        }
      }
    }

    return out.toDataURL('image/jpeg', 0.92);
  }

  bilinear(corners, u, v) {
    const top = {
      x: corners[0].x + (corners[1].x - corners[0].x) * u,
      y: corners[0].y + (corners[1].y - corners[0].y) * u,
    };
    const bottom = {
      x: corners[3].x + (corners[2].x - corners[3].x) * u,
      y: corners[3].y + (corners[2].y - corners[3].y) * u,
    };
    return {
      x: top.x + (bottom.x - top.x) * v,
      y: top.y + (bottom.y - top.y) * v,
    };
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
