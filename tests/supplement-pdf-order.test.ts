import assert from 'node:assert/strict';
import test from 'node:test';
import { orderSupplementProducts } from '../src/features/supplements/productOrder.ts';

const item = (id: string, supplementName: string, unitPrice: number) => ({ id, supplementName, unitPrice });
const order = (items: ReturnType<typeof item>[]) => orderSupplementProducts(items, row => row.supplementName, row => row.unitPrice);

test('groups applications first, paid products next, and free products last with names sorted', () => {
  const ordered = order([
    item('free-2', 'ของแถม ข', 0),
    item('paid-2', 'วิตามิน บี', 500),
    item('application-2', 'ใบสมัคร MEMBER', 100),
    item('paid-1', 'โปรตีน เอ', 900),
    item('application-1', 'ใบสมัคร ABO', 100),
    item('free-1', 'ของแถม ก', 0),
  ]);
  assert.deepEqual(ordered.map(row => row.id), ['application-1', 'application-2', 'paid-1', 'paid-2', 'free-1', 'free-2']);
});

test('a free application remains in the first group', () => {
  const source = [
    item('paid', 'Vitamin C', 500),
    item('free-application', 'ใบสมัคร ABO', 0),
    item('free', 'ของแถม', 0),
  ];
  const ordered = order(source);
  assert.deepEqual(ordered.map(row => row.id), ['free-application', 'paid', 'free']);
  assert.deepEqual(source.map(row => row.id), ['paid', 'free-application', 'free']);
});

test('equal names retain their original relative order', () => {
  const ordered = order([item('second', 'โปรตีน', 500), item('first', 'โปรตีน', 500)]);
  assert.deepEqual(ordered.map(row => row.id), ['second', 'first']);
});
