export function fillFormOnCanvas(canvas, imageDataUrl, fields) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original form
      ctx.drawImage(img, 0, 0);

      // Draw each field value
      fields.forEach(field => {
        const x = (field.x / 100) * img.width;
        const y = (field.y / 100) * img.height;
        const w = (field.width / 100) * img.width;
        const h = (field.height / 100) * img.height;

        // fontSize from AI is a % of image height
        const fontSize = field.fontSize
          ? (field.fontSize / 100) * img.height
          : h * 0.7;

        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
        ctx.textBaseline = 'middle';

        const textX = x + 3;
        const textY = y + h / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillText(field.value, textX, textY);
        ctx.restore();
      });

      resolve();
    };
    img.src = imageDataUrl;
  });
}
