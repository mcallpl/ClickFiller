import { jsPDF } from 'jspdf';

/**
 * Exports the filled canvas as a PDF that matches the form dimensions.
 */
export function exportToPdf(canvas) {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const w = canvas.width;
  const h = canvas.height;

  // Determine orientation
  const orientation = w > h ? 'landscape' : 'portrait';

  // Create PDF with dimensions matching the image aspect ratio
  // Use points (72 per inch). Assume ~150 DPI for the image.
  const dpi = 150;
  const pdfWidth = (w / dpi) * 72;
  const pdfHeight = (h / dpi) * 72;

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [pdfWidth, pdfHeight],
  });

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save('filled-form.pdf');
}
