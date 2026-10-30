'use client';
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ background: '#09090B', color: '#FAFAFA', fontFamily: 'system-ui', display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>DISC couldn’t start</h1>
          <p style={{ color: '#A1A1AA' }}>Something went wrong while loading the app.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 999, border: 0, background: '#8B5CF6', color: '#fff' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
