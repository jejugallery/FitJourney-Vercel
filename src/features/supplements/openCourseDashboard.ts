import liff from '@line/liff';
import { supplementCoursesApi } from '../../utils/api';

export async function openCourseDashboardExternal(courseId: string): Promise<void> {
  const inLine = liff.isInClient();
  const browserWindow = inLine ? null : window.open('about:blank', '_blank');
  if (!inLine && !browserWindow) throw new Error('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่');
  if (browserWindow) browserWindow.opener = null;
  try {
    const { token } = await supplementCoursesApi.createPdfToken(courseId);
    const url = new URL('/supplement-course-dashboard', window.location.origin);
    url.searchParams.set('token', token);
    if (inLine) liff.openWindow({ url: url.toString(), external: true });
    else browserWindow!.location.href = url.toString();
  } catch (error) {
    browserWindow?.close();
    throw error;
  }
}
