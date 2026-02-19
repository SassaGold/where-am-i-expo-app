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
    background: '#f5f6fa',
    surface: '#fff',
    primary: '#4338ca',
    secondary: '#a5b4fc',
    accent: '#ffd700',
    text: '#232946',
    textSecondary: '#6b7280',
    border: '#e0e7ef',
    error: '#ef4444',
    success: '#10b981',
    warning: '#fbbf24',
    // Additional colors for visual appeal
    headerBg: '#ede9fe',
    headerGlow: 'rgba(67,56,202,0.10)',
    headerGlowSecondary: 'rgba(255,215,0,0.10)',
    cardBg: '#fff',
    cardBorder: '#e0e7ef',
    glowPrimary: 'rgba(67,56,202,0.10)',
    glowAccent: 'rgba(255,215,0,0.10)',
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    background: '#181a2a',
    surface: '#232946',
    primary: '#a5b4fc',
    secondary: '#4338ca',
    accent: '#ffd700',
    text: '#f5f6fa',
    textSecondary: '#a1a1aa',
    border: '#232946',
    error: '#f87171',
    success: '#22c55e',
    warning: '#fbbf24',
    // Additional colors for visual appeal
    headerBg: '#232946',
    headerGlow: 'rgba(165,180,252,0.10)',
    headerGlowSecondary: 'rgba(255,215,0,0.10)',
    cardBg: '#232946',
    cardBorder: '#232946',
    glowPrimary: 'rgba(165,180,252,0.10)',
    glowAccent: 'rgba(255,215,0,0.10)',
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