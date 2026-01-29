import { vi } from 'vitest';

// Mock translation API responses
export const mockTranslateResponse = {
  translation: 'Translated text',
  detectedLanguage: 'en',
  original: 'Original text',
  isPlaceholder: false,
};

export const mockTranslateError = {
  error: 'Translation failed',
};

// Helper to mock fetch for translation API
export function mockTranslationApi(response = mockTranslateResponse, ok = true) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: async () => response,
  });
}

// Helper to mock fetch error
export function mockTranslationApiError(error = mockTranslateError) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    json: async () => error,
  });
}

// Helper to mock network failure
export function mockNetworkError(message = 'Network error') {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error(message)
  );
}

// Reset fetch mock
export function resetFetchMock() {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
}
