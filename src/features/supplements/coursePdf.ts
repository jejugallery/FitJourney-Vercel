import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { SavedSupplementCourse } from './types';
import { orderSupplementItemsForPdf } from './pdfItemOrder';

const baht = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => htmlEntities[char] || char);

export async function downloadSupplementCoursePdf(course: SavedSupplementCourse) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;color:#1e293b;padding:48px;font-family:Arial,"Noto Sans Thai",Tahoma,sans-serif;box-sizing:border-box;';
  root.innerHTML = `
    <div style="border-bottom:4px solid #ff416c;padding-bottom:18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end">
      <div><div style="font-size:29px;font-weight:800;color:#ff416c">FitJourney.th</div><div style="font-size:18px;font-weight:700;margin-top:6px">รายการจัดคอร์สอาหารเสริม</div></div>
      <div style="font-size:13px;text-align:right;color:#64748b">วันที่ ${new Date(course.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#fff1f4;border-radius:12px;padding:16px;margin-bottom:22px;font-size:14px">
      <div><span style="color:#64748b">เทรนเนอร์</span><br><b>${escapeHtml(course.trainerName)}</b></div>
      <div><span style="color:#64748b">ลูกเทรน</span><br><b>${escapeHtml(course.traineeName)}</b></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#ff416c;color:#fff">
        <th style="padding:10px;text-align:left">อาหารเสริม</th><th style="padding:10px">บรรจุ</th><th style="padding:10px">จำนวน</th><th style="padding:10px;text-align:right">ราคา</th><th style="padding:10px;text-align:right">ส่วนลด</th><th style="padding:10px;text-align:right">สุทธิ</th>
      </tr></thead>
      <tbody>${orderSupplementItemsForPdf(course.items).map(item => `<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px"><div style="display:flex;align-items:center;gap:9px"><img crossorigin="anonymous" src="${escapeHtml(item.imageUrl)}" style="width:42px;height:42px;border-radius:8px;object-fit:cover"><b>${escapeHtml(item.supplementName)}</b></div></td>
        <td style="padding:10px;text-align:center">${item.contentQuantity} ${escapeHtml(item.contentUnit)}</td><td style="padding:10px;text-align:center">${item.packageQuantity}</td>
        <td style="padding:10px;text-align:right">฿${baht(item.grossAmount)}</td><td style="padding:10px;text-align:right">-฿${baht(item.discountAmount)}</td><td style="padding:10px;text-align:right;font-weight:700">฿${baht(item.netAmount)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div style="margin:24px 0 0 auto;width:310px;font-size:14px">
      <div style="display:flex;justify-content:space-between;padding:6px"><span>ยอดก่อนส่วนลด</span><b>฿${baht(course.subtotal)}</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px;color:#dc2626"><span>ส่วนลดรวม</span><b>-฿${baht(course.discountTotal)}</b></div>
      <div style="display:flex;justify-content:space-between;padding:12px 8px;border-top:2px solid #ff416c;font-size:20px;color:#ff416c"><span>ยอดรวมสุทธิ</span><b>฿${baht(course.total)}</b></div>
      ${Number(course.cashbackAmount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:8px;padding:10px;border-radius:8px;background:#ecfdf5;color:#047857"><span>ได้เงินคืนภายหลัง (${Number(course.cashbackPercent)}%)</span><b>฿${baht(course.cashbackAmount)}</b></div>` : ''}
    </div>`;
  document.body.appendChild(root);
  try {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
    const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    const imageData = canvas.toDataURL('image/jpeg', 0.94);
    let remaining = imageHeight;
    let y = 0;
    pdf.addImage(imageData, 'JPEG', 0, y, pageWidth, imageHeight);
    remaining -= pageHeight;
    while (remaining > 0) {
      y = remaining - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'JPEG', 0, y, pageWidth, imageHeight);
      remaining -= pageHeight;
    }
    const safeName = course.traineeName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'trainee';
    const date = new Date(course.createdAt).toISOString().slice(0, 10);
    pdf.save(`Supplement-Course-${safeName}-${date}.pdf`);
  } finally {
    root.remove();
  }
}
