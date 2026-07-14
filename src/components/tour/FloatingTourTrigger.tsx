import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, PlayCircle, Settings, X, GraduationCap } from 'lucide-react';
import { useTour } from './TourProvider';
import { TourProfile } from '@/lib/tour-steps';

export function FloatingTourTrigger() {
  const { startTour } = useTour();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Determine which detailed tour applies to the current page
  let contextualProfile: TourProfile | null = null;
  let contextualLabel = '';

  if (location.pathname.startsWith('/organizations')) {
    contextualProfile = 'organizations';
    contextualLabel = 'Organisations Tour';
  } else if (location.pathname.startsWith('/users')) {
    contextualProfile = 'users';
    contextualLabel = 'User Management Tour';
  } else if (location.pathname.startsWith('/license')) {
    contextualProfile = 'license';
    contextualLabel = 'Licensing Tour';
  } else if (location.pathname.startsWith('/ai')) {
    contextualProfile = 'ai';
    contextualLabel = 'AI Credits Tour';
  }

  const handleStart = (profile: TourProfile) => {
    setIsOpen(false);
    startTour(profile);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 90000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
      }}
    >
      {/* Menu Options */}
      {isOpen && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
            border: '1px solid #e2e8f0',
            padding: '8px',
            width: 240,
            fontFamily: "'Inter', system-ui, sans-serif",
            animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Learning Centre</h4>
            <p style={{ margin: 0, marginTop: 4, fontSize: 12, color: '#64748b' }}>Replay interactive tutorials.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={() => handleStart('initial')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                color: '#334155',
                fontSize: 13,
                fontWeight: 600,
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <PlayCircle size={16} color="#0B4EA2" />
              General Overview
            </button>

            {contextualProfile && (
              <button
                onClick={() => handleStart(contextualProfile as TourProfile)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: '#f0f6ff',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#0B4EA2',
                  fontSize: 13,
                  fontWeight: 700,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0f0ff')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f0f6ff')}
              >
                <GraduationCap size={16} color="#FF7A1A" />
                {contextualLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#0B4EA2',
          border: 'none',
          boxShadow: '0 4px 12px rgba(11, 78, 162, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={(e) => !isOpen && (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => !isOpen && (e.currentTarget.style.transform = 'scale(1)')}
        title="Help & Tutorials"
      >
        {isOpen ? (
          <X size={18} color="#ffffff" />
        ) : (
          <HelpCircle size={20} color="#ffffff" />
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
