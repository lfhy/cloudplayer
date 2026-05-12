// Mini-player icons use the same hand-drawn linear language as the rest of the app chrome.
function wrap(content) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
}

export function miniPlayIcon() {
  return wrap('<path fill="currentColor" d="M8.5 6.2c0-1.07 1.18-1.72 2.08-1.15l7.37 4.73c.84.54.84 1.77 0 2.3l-7.37 4.72c-.9.58-2.08-.08-2.08-1.14z"/>');
}

export function miniPauseIcon() {
  return wrap('<g fill="currentColor"><rect x="7.25" y="5.75" width="3.5" height="12.5" rx="1.2"/><rect x="13.25" y="5.75" width="3.5" height="12.5" rx="1.2"/></g>');
}

export function miniPrevIcon() {
  return wrap('<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.75 6.5v11"/><path d="m17.25 7.15-6.4 4.1 6.4 4.1z"/><path d="m11.4 7.15-6.4 4.1 6.4 4.1z"/></g>');
}

export function miniNextIcon() {
  return wrap('<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.25 6.5v11"/><path d="m6.75 7.15 6.4 4.1-6.4 4.1z"/><path d="m12.6 7.15 6.4 4.1-6.4 4.1z"/></g>');
}

export function miniPinIcon() {
  return wrap('<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15.7 4.9 3.4 3.4"/><path d="m14.15 6.45 3.4 3.4"/><path d="m9.4 11.2 4.75-4.75 3.4 3.4-4.75 4.75"/><path d="m8.45 12.15 3.4 3.4"/><path d="M11.1 15.55 7.2 19.45"/><path d="m6.7 13.9 3.4 3.4"/></g>');
}

export function miniTranslucentIcon() {
  return wrap('<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.8c3.5 0 6.78 1.93 9.1 5.38.32.47.32 1.16 0 1.64C18.78 14.27 15.5 16.2 12 16.2S5.22 14.27 2.9 10.82a1.45 1.45 0 0 1 0-1.64C5.22 5.73 8.5 3.8 12 3.8Z"/><circle cx="12" cy="10" r="2.8"/><path d="M6 19.25h12"/></g>');
}

export function miniExitIcon() {
  return wrap('<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 8.75c0-1.89 0-2.84.59-3.42s1.53-.58 3.41-.58h6.5c1.89 0 2.84 0 3.42.58s.58 1.53.58 3.42v6.5c0 1.89 0 2.84-.58 3.42s-1.53.58-3.42.58h-6.5c-1.88 0-2.83 0-3.41-.58s-.59-1.53-.59-3.42z"/><path d="M9 15 15 9"/><path d="M11 9h4v4"/></g>');
}
