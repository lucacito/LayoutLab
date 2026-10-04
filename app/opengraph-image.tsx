import { ImageResponse } from 'next/og';

// Default social card for every page that does not set its own (shared links on LinkedIn, X, Slack, Facebook).
export const alt = 'Divi5Lab: the AI Editor for Divi 5';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0B3558 0%, #3D2F9B 55%, #635BFF 100%)',
          color: '#ffffff',
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.9, display: 'flex' }}>Divi5Lab</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, display: 'flex' }}>AI Editor for Divi 5</div>
          <div style={{ fontSize: 38, marginTop: 28, opacity: 0.92, display: 'flex' }}>
            Edit your pages in plain English. Every change validated, every change undoable.
          </div>
        </div>
        <div style={{ fontSize: 30, opacity: 0.85, display: 'flex' }}>Works with Claude, ChatGPT, Cursor and VS Code</div>
      </div>
    ),
    size,
  );
}
