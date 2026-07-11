export function getEventLinkLabel(event: any): string | null {
  switch (event?.linkType) {
    case 'zoom': return 'เข้าผ่าน Zoom';
    case 'register': return 'ลงทะเบียน';
    case 'details': return 'ดูรายละเอียด';
    case 'custom': return event.linkLabel?.trim() || null;
    case 'rsvp': return 'ลงชื่อ';
    case 'calendar': return 'เพิ่มลงปฏิทิน';
    default: return null;
  }
}
