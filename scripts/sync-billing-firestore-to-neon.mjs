import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { neon } from '@neondatabase/serverless';

const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const databaseUrl = envText.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
if (!databaseUrl) throw new Error('DATABASE_URL is missing from .env');

const firebaseConfig = {
  apiKey: 'AIzaSyBKLSIGyGCXu0IhLzUgRHVXrgHkVv-55FU',
  authDomain: 'fitjourneythailand.firebaseapp.com',
  projectId: 'fitjourneythailand',
  storageBucket: 'fitjourneythailand.firebasestorage.app',
  messagingSenderId: '971236941563',
  appId: '1:971236941563:web:cb44dfbd76f7b1fed6da5e'
};

const db = getFirestore(initializeApp(firebaseConfig));
const sql = neon(databaseUrl);
const timestamp = (value) => value?.toDate?.()?.toISOString?.() || value || null;

const billingSnap = await getDocs(collection(db, 'billings'));
const usedSlipSnap = await getDocs(collection(db, 'used_slips'));
let paymentCount = 0;

for (const billingDoc of billingSnap.docs) {
  const b = billingDoc.data();
  await sql`
    INSERT INTO billings (
      id, name, amount, bank_name, account_name, account_number, description,
      invitation_text, invitation_color, button_color, status, created_by, created_at
    ) VALUES (
      ${billingDoc.id}, ${b.name || ''}, ${Number(b.amount || 0)}, ${b.bankName || ''},
      ${b.accountName || ''}, ${b.accountNumber || ''}, ${b.description || ''},
      ${b.invitationText || ''}, ${b.invitationColor || ''}, ${b.buttonColor || ''},
      ${b.status || 'pending'}, ${b.createdBy || ''}, ${timestamp(b.createdAt)}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, amount = EXCLUDED.amount, bank_name = EXCLUDED.bank_name,
      account_name = EXCLUDED.account_name, account_number = EXCLUDED.account_number,
      description = EXCLUDED.description, invitation_text = EXCLUDED.invitation_text,
      invitation_color = EXCLUDED.invitation_color, button_color = EXCLUDED.button_color,
      status = EXCLUDED.status, created_by = EXCLUDED.created_by,
      created_at = COALESCE(EXCLUDED.created_at, billings.created_at)
  `;

  const paymentsSnap = await getDocs(collection(db, 'billings', billingDoc.id, 'payments'));
  for (const paymentDoc of paymentsSnap.docs) {
    const p = paymentDoc.data();
    const userId = p.userId || paymentDoc.id;
    await sql`
      INSERT INTO billing_payments (
        billing_id, user_id, display_name, picture_url, slip_url, slip_id,
        friends, slips, submitted_at
      ) VALUES (
        ${billingDoc.id}, ${userId}, ${p.displayName || ''}, ${p.pictureUrl || ''},
        ${p.slipUrl || ''}, ${p.slipId || null}, ${JSON.stringify(p.friends || [])}::jsonb,
        ${JSON.stringify(p.slips || [])}::jsonb, ${timestamp(p.submittedAt)}
      )
      ON CONFLICT (billing_id, user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name, picture_url = EXCLUDED.picture_url,
        slip_url = EXCLUDED.slip_url, slip_id = EXCLUDED.slip_id,
        friends = EXCLUDED.friends, slips = EXCLUDED.slips,
        submitted_at = COALESCE(EXCLUDED.submitted_at, billing_payments.submitted_at)
    `;
    paymentCount += 1;
  }
}

for (const slipDoc of usedSlipSnap.docs) {
  const s = slipDoc.data();
  await sql`
    INSERT INTO used_slips (slip_id, billing_id, user_id, slip_url, submitted_at)
    VALUES (
      ${s.slipId || slipDoc.id}, ${s.billingId || ''}, ${s.userId || ''},
      ${s.slipUrl || ''}, ${timestamp(s.submittedAt)}
    )
    ON CONFLICT (slip_id) DO UPDATE SET
      billing_id = EXCLUDED.billing_id, user_id = EXCLUDED.user_id,
      slip_url = EXCLUDED.slip_url,
      submitted_at = COALESCE(EXCLUDED.submitted_at, used_slips.submitted_at)
  `;
}

const [billingTotal] = await sql`SELECT COUNT(*)::int AS count FROM billings`;
const [paymentTotal] = await sql`SELECT COUNT(*)::int AS count FROM billing_payments`;
const [slipTotal] = await sql`SELECT COUNT(*)::int AS count FROM used_slips`;

console.log(JSON.stringify({
  firestore: { billings: billingSnap.size, payments: paymentCount, usedSlips: usedSlipSnap.size },
  neonAfterSync: { billings: billingTotal.count, payments: paymentTotal.count, usedSlips: slipTotal.count }
}, null, 2));
