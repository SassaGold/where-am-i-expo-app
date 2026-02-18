import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'biker';

export interface Theme {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    // Additional colors for visual appeal
    headerBg: string;
    headerGlow: string;
    headerGlowSecondary: string;
    cardBg: string;
    cardBorder: string;
    glowPrimary: string;
    glowAccent: string;
  };
}

const lightTheme: Theme = {
  isDark: false,
  colors: {
    background: '#ffffff',
    surface: '#f8fafc',
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#f59e0b',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    // Additional colors for visual appeal
    headerBg: '#f0f9ff',
    headerGlow: 'rgba(59,130,246,0.3)',
    headerGlowSecondary: 'rgba(139,92,246,0.2)',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    glowPrimary: 'rgba(59,130,246,0.4)',
    glowAccent: 'rgba(245,158,11,0.3)',
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    background: '#0f0a1a',
    surface: '#1b1030',
    primary: '#38bdf8',
    secondary: '#64748b',
    accent: '#f59e0b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#2d1b4d',
    error: '#f87171',
    success: '#22c55e',
    warning: '#f59e0b',
    // Additional colors for visual appeal
    headerBg: '#3b0764',
    headerGlow: 'rgba(236,72,153,0.55)',
    headerGlowSecondary: 'rgba(59,130,246,0.45)',
    cardBg: '#1b1030',
    cardBorder: '#2d1b4d',
    glowPrimary: 'rgba(56,189,248,0.4)',
    glowAccent: 'rgba(245,158,11,0.3)',
  },
};

const bikerTheme: Theme = {
  isDark: true,
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    primary: '#ff6b35',
    secondary: '#f7c59f',
    accent: '#ffcc00',
    text: '#ffffff',
    textSecondary: '#cccccc',
    border: '#404040',
    error: '#ff4757',
    success: '#2ed573',
    warning: '#ffa502',
    // Additional colors for visual appeal
    headerBg: '#2a1810',
    headerGlow: 'rgba(255,107,53,0.6)',
    headerGlowSecondary: 'rgba(255,204,0,0.4)',
    cardBg: '#2d2d2d',
    cardBorder: '#404040',
    glowPrimary: 'rgba(255,107,53,0.5)',
    glowAccent: 'rgba(255,204,0,0.4)',
  },
};

const themes = {
  biker: bikerTheme,
};

interface ThemeContextType {
  theme: Theme;
  themeType: ThemeType;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Always use biker theme
  const themeType: ThemeType = 'biker';
  const theme = themes[themeType];
  return (
    <ThemeContext.Provider value={{
      theme,
      themeType,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};