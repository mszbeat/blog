import Link from 'next/link';

/**
 * Root catch-all for routes that never reach the [locale] segment.
 *
 * Deliberately NOT a redirect: redirecting to a locale path that also fails to
 * match would loop. This renders a self-contained bilingual 404 instead — it
 * has no access to the [locale] layout, so translations and fonts are inlined.
 */
export default function RootNotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f8fc',
          color: '#10131c',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: '1.5rem',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '4.5rem',
              height: '4.5rem',
              borderRadius: '1.25rem',
              background: 'linear-gradient(135deg,#6366f1,#14b8a6)',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 800,
              boxShadow: '0 12px 28px rgba(99,102,241,.28)',
            }}
          >
            404
          </div>

          <h1 style={{ marginTop: '1.75rem', fontSize: '1.5rem', fontWeight: 800 }}>
            صفحه پیدا نشد
          </h1>
          <p style={{ marginTop: '.5rem', color: '#4b5163', lineHeight: 1.9, fontSize: '.9rem' }}>
            آدرسی که وارد کرده‌اید معتبر نیست.
          </p>

          <h2 dir="ltr" style={{ marginTop: '2rem', fontSize: '1rem', fontWeight: 700 }}>
            Page not found
          </h2>
          <p dir="ltr" style={{ marginTop: '.35rem', color: '#4b5163', fontSize: '.85rem' }}>
            The address you entered is not valid.
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/fa"
              style={{
                display: 'inline-flex', alignItems: 'center', height: '2.6rem', padding: '0 1.25rem',
                borderRadius: '.75rem', background: '#4f46e5', color: '#fff',
                fontSize: '.875rem', fontWeight: 600, textDecoration: 'none',
              }}
            >
              خانه
            </Link>
            <Link
              href="/en"
              dir="ltr"
              style={{
                display: 'inline-flex', alignItems: 'center', height: '2.6rem', padding: '0 1.25rem',
                borderRadius: '.75rem', border: '1px solid #d3d8e6', background: '#fff', color: '#10131c',
                fontSize: '.875rem', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Home (English)
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
