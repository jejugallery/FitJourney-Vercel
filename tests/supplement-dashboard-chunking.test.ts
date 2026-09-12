import assert from 'node:assert/strict';
import test from 'node:test';

function calculateDashboardPages(itemCount: number, itemsPerPage = 5) {
  const itemPageCount = Math.ceil(itemCount / itemsPerPage);
  const totalPages = itemPageCount + 1; // +1 for separate summary page
  return { itemPageCount, totalPages };
}

test('calculates pages correctly for different item counts with 5 items per chunk and separate summary page', () => {
  assert.deepEqual(calculateDashboardPages(0), { itemPageCount: 0, totalPages: 1 });
  assert.deepEqual(calculateDashboardPages(3), { itemPageCount: 1, totalPages: 2 });
  assert.deepEqual(calculateDashboardPages(5), { itemPageCount: 1, totalPages: 2 });
  assert.deepEqual(calculateDashboardPages(6), { itemPageCount: 2, totalPages: 3 });
  assert.deepEqual(calculateDashboardPages(12), { itemPageCount: 3, totalPages: 4 });
});
