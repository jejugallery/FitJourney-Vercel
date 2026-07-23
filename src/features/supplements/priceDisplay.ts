export function displayProductPrice(price: number): string {
  const value = Number(price || 0);
  if (value === 0) return 'ฟรี';
  return `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
