/** 30% of the price rounded to whole lei, at least 20 lei. */
export function depositLei(priceLei: number): number {
  return Math.max(20, Math.round((priceLei * 3) / 10));
}
