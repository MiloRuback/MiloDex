import React from 'react'

export default function TitleBar() {
  return (
    <div className="titlebar drag-region">
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          color: 'hsl(240 5% 40%)',
          fontWeight: 500,
          letterSpacing: '0.05em'
        }}
      >
        MiloDex
      </div>
      <div
        className="no-drag"
        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
      >
        <button
          className="titlebar-btn minimize"
          onClick={() => window.milodex.window.minimize()}
          title="Minimizar"
        />
        <button
          className="titlebar-btn maximize"
          onClick={() => window.milodex.window.maximize()}
          title="Maximizar"
        />
        <button
          className="titlebar-btn close"
          onClick={() => window.milodex.window.close()}
          title="Fechar"
        />
      </div>
    </div>
  )
}
