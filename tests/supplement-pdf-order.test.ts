import assert from 'node:assert/strict';
import test from 'node:test';
import { orderSupplementItemsForPdf } from '../src/features/supplements/pdfItemOrder.ts';

const item = (id: string, supplementName: string, unitPrice: number) => ({ id, supplementName, unitPrice });

test('PDF groups applications first, paid products next, and free products last', () => {
  const ordered = orderSupplementItemsForPdf([
    item('free-1', 'ของแถม', 0),
    item('paid-1', 'Vitamin C', 500),
    item('application-1', 'ใบสมัคร MEMBER', 100),
    item('paid-2', 'Protein', 900),
    item('free-2', 'กระเป๋าฟรี', 0),
  ]);
  assert.deepEqual(ordered.map(row => row.id), ['application-1', 'paid-1', 'paid-2', 'free-1', 'free-2']);
});

test('a free application remains in the first group', () => {
  const source = [
    item('paid', 'Vitamin C', 500),
    item('free-application', 'ใบสมัคร ABO', 0),
    item('free', 'ของแถม', 0),
  ];
  const ordered = orderSupplementItemsForPdf(source);
  assert.deepEqual(ordered.map(row => row.id), ['free-application', 'paid', 'free']);
  assert.deepEqual(source.map(row => row.id), ['paid', 'free-application', 'free']);
});
