import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { SavedSupplementCourse } from './types';
import { orderSupplementProducts } from './productOrder';

const baht = (value: number) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => htmlEntities[char] || char);

export async function downloadSupplementCoursePdf(course: SavedSupplementCourse) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;background:#f8fafc;color:#1e293b;padding:32px;font-family:Arial,"Noto Sans Thai",Tahoma,sans-serif;box-sizing:border-box;border-radius:24px;display:flex;gap:40px;align-items:stretch;';
  
  const allItems = orderSupplementProducts(course.items, item => item.supplementName, item => item.unitPrice);
  const paidItems = allItems.filter(item => Number(item.unitPrice || 0) > 0);
  const freeItems = allItems.filter(item => Number(item.unitPrice || 0) === 0);

  const totalFreeValue = freeItems.reduce((sum, item) => {
    const m = item.supplementName.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/g);
    const price = m ? Number(m[m.length - 1].replace(/,/g, '')) : 0;
    return sum + (price * Number(item.packageQuantity || 1));
  }, 0);

  root.innerHTML = `
    <!-- Left Column -->
    <div style="flex: 0 0 380px; display: flex; flex-direction: column;">
      <div style="border-bottom: 2px dashed #e2e8f0; padding-bottom: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px; font-size: 2rem; color: #0f172a; font-weight: 800; letter-spacing: -0.5px;">ใบสรุปคอร์ส</h2>
        <div style="background: #eff6ff; padding: 16px; border-radius: 16px; border: 1px solid #bfdbfe;">
          <span style="display: block; font-size: 0.8rem; color: #3b82f6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">ลูกเทรน</span>
          <strong style="display: block; font-size: 1.4rem; color: #1d4ed8; margin: 4px 0;">${escapeHtml(course.traineeName)}</strong>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 0.9rem; border-top: 1px solid #bfdbfe; padding-top: 8px;">ดูแลโดย: <b>${escapeHtml(course.trainerName)}</b></p>
        </div>
      </div>

      <div style="background: white; border-radius: 20px; padding: 24px; position: relative; overflow: hidden; flex: 1; display: flex; flex-direction: column; justify-content: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 0.95rem;">ยอดก่อนส่วนลด</span>
          <span style="font-size: 1.1rem; color: #1e293b; font-weight: 600;">฿${baht(course.subtotal)}</span>
        </div>
        ${Number(course.discountTotal || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; color: #ef4444;">
          <span style="font-size: 0.95rem;">ส่วนลดรวม</span>
          <span style="font-size: 1.1rem; font-weight: 600;">-฿${baht(course.discountTotal)}</span>
        </div>` : ''}
        <div style="height: 1px; background: #e2e8f0; margin: 16px 0;"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: ${Number(course.cashbackAmount || 0) > 0 ? '16px' : '0'};">
          <span style="color: #0f172a; font-size: 1.1rem; font-weight: 700;">ยอดรวมสุทธิ</span>
          <span style="font-size: 2.2rem; font-weight: 800; line-height: 1; color: #2563eb;">฿${baht(course.total)}</span>
        </div>
        
        ${Number(course.cashbackAmount || 0) > 0 ? `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
          <span style="color: #059669; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; font-weight: 600;">
            <span style="font-size: 1.2rem;">💸</span> ได้เงินคืนภายหลัง (${Number(course.cashbackPercent)}%)
          </span>
          <span style="color: #047857; font-size: 1.1rem; font-weight: 800;">฿${baht(course.cashbackAmount)}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Right Column -->
    <div style="flex: 1; display: flex; flex-direction: column;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-content: start;">
        ${paidItems.map(item => `
          <div style="display: flex; flex-direction: column; background: white; padding: 16px; border-radius: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; position: relative;">
            <div style="position: absolute; top: -1px; right: -1px; background: #ef4444; color: white; font-size: 0.9rem; font-weight: 800; padding: 4px 10px; border-radius: 0 16px 0 16px; line-height: 1; box-shadow: -2px 2px 4px rgba(0,0,0,0.1);">
              x${item.packageQuantity}
            </div>
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; padding-right: 24px;">
              <div style="width: 50px; height: 50px; border-radius: 10px; overflow: hidden; background: #f8fafc; flex-shrink: 0; border: 1px solid #e2e8f0;">
                ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 1.2rem;">📦</div>`}
              </div>
              <div style="flex: 1;">
                <h4 style="margin: 0 0 4px; font-size: 1rem; color: #1e293b; font-weight: 700; line-height: 1.3;">${escapeHtml(item.supplementName)}</h4>
                <span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; font-weight: 500;">${escapeHtml(item.contentQuantity)} ${escapeHtml(item.contentUnit)}</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
              <div style="color: #64748b; font-size: 0.85rem;">฿${baht(item.unitPrice)} / ชิ้น</div>
              <div style="text-align: right;">
                ${Number(item.discountAmount || 0) > 0 ? `<div style="font-size: 0.75rem; color: #ef4444; font-weight: 600; background: #fef2f2; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; display: inline-block;">ลด ฿${baht(item.discountAmount)}</div>` : ''}
                <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; line-height: 1;">฿${baht(item.netAmount)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      ${freeItems.length > 0 ? `
      <div style="margin-top: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 1.2rem; color: #059669; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>🎁</span> รายการของแถม (ฟรี)
          </h3>
          ${totalFreeValue > 0 ? `
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 6px 16px; border-radius: 24px; font-size: 0.95rem; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
            มูลค่ารวม <span style="font-size: 1.2rem; font-weight: 800; margin: 0 4px;">${baht(totalFreeValue)}</span> บาท
          </div>` : ''}
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-content: start;">
          ${freeItems.map(item => `
            <div style="display: flex; flex-direction: column; background: #ecfdf5; padding: 16px; border-radius: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border: 1px solid #a7f3d0; position: relative;">
              <div style="position: absolute; top: -1px; right: -1px; background: #10b981; color: white; font-size: 0.9rem; font-weight: 800; padding: 4px 10px; border-radius: 0 16px 0 16px; line-height: 1; box-shadow: -2px 2px 4px rgba(16,185,129,0.2);">
                x${item.packageQuantity}
              </div>
              <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; padding-right: 24px;">
                <div style="width: 50px; height: 50px; border-radius: 10px; overflow: hidden; background: white; flex-shrink: 0; border: 1px solid #a7f3d0;">
                  ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #a7f3d0; font-size: 1.2rem;">📦</div>`}
                </div>
                <div style="flex: 1;">
                  <h4 style="margin: 0 0 4px; font-size: 1rem; color: #064e3b; font-weight: 700; line-height: 1.3;">${escapeHtml(item.supplementName)}</h4>
                  <span style="display: inline-block; background: white; color: #047857; font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; font-weight: 600; border: 1px solid #d1fae5;">${escapeHtml(item.contentQuantity)} ${escapeHtml(item.contentUnit)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    </div>
  `;
  document.body.appendChild(root);
  try {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
    const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
    const pdf = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape since it's wide
    const pageWidth = 297;
    const pageHeight = 210;
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
